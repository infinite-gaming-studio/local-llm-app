import asyncio
import json
import os
import sys
import socket

from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from model_manager import (
    ModelManager, get_available_models, get_local_models,
    import_model, import_mmproj, delete_local_model,
    get_model_metadata, set_model_metadata, get_model_modalities, get_mmproj_path,
)
from engine import SkillEngine
from conversations import ConversationStore


class ChatRequest(BaseModel):
    messages: list[dict]
    stream: bool = False


class ModelLoadRequest(BaseModel):
    path: str
    ctx_size: Optional[int] = None
    gpu_layers: Optional[int] = None


class ModelImportRequest(BaseModel):
    source_path: str
    model_id: Optional[str] = None
    metadata: Optional[dict] = None


class ModelMetadataUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    params: Optional[str] = None
    language: Optional[str] = None
    requirements: Optional[str] = None
    ctx_size: Optional[int] = None
    gpu_layers: Optional[int] = None
    modalities: Optional[list[str]] = None


class ConversationBody(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    messages: list[dict] = []


class RenameBody(BaseModel):
    title: str


class SettingsBody(BaseModel):
    hf_token: Optional[str] = None


app_state = {
    "model": None,
    "model_loaded": False,
    "agent": None,
    "skill_engine": None,
    "conversations": None,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("SIDECAR_READY", flush=True)
    app_state["skill_engine"] = SkillEngine()
    app_state["conversations"] = ConversationStore()
    yield
    if app_state["model"] is not None:
        app_state["model"].unload()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": app_state["model_loaded"]}


@app.post("/model/load")
async def load_model(req: ModelLoadRequest):
    if app_state["model"] is not None:
        app_state["model"].unload()
        app_state["model"] = None

    # 从 metadata 取默认值，前端传入则覆盖
    from pathlib import Path as _Path
    model_id = _Path(req.path).stem
    meta = get_model_metadata(model_id)
    ctx_size = req.ctx_size if req.ctx_size is not None else meta.get("ctx_size", 32768)
    gpu_layers = req.gpu_layers if req.gpu_layers is not None else meta.get("gpu_layers", -1)

    # 自动查找 mmproj 视觉投影文件（多模态模型需要）
    mmproj_path = get_mmproj_path(model_id)

    manager = ModelManager(req.path, ctx_size=ctx_size, gpu_layers=gpu_layers, mmproj_path=mmproj_path)
    manager.load()
    app_state["model"] = manager
    app_state["model_loaded"] = True

    from agent import AgentOrchestrator
    app_state["agent"] = AgentOrchestrator(manager, app_state["skill_engine"])
    return {
        "status": "loaded",
        "model": req.path,
        "ctx_size": ctx_size,
        "gpu_layers": gpu_layers,
        "mmproj_loaded": mmproj_path is not None,
    }


@app.post("/model/unload")
async def unload_model():
    if app_state["model"] is not None:
        app_state["model"].unload()
        app_state["model"] = None
        app_state["model_loaded"] = False
        app_state["agent"] = None
    return {"status": "unloaded"}


@app.get("/model/status")
async def model_status():
    if app_state["model"] is not None:
        from pathlib import Path as _Path
        model_id = _Path(app_state["model"].path).stem
        return {
            "loaded": True,
            "path": app_state["model"].path,
            "ctx_size": app_state["model"].ctx_size,
            "gpu_layers": app_state["model"].gpu_layers,
            "modalities": get_model_modalities(model_id),
        }
    return {"loaded": False, "modalities": ["text"]}


@app.post("/chat")
async def chat(req: ChatRequest):
    if app_state["agent"] is None:
        return JSONResponse({"error": "no model loaded"}, status_code=400)

    content = app_state["agent"].run(req.messages)
    return {"message": {"role": "assistant", "content": content}}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    if app_state["agent"] is None:
        return JSONResponse({"error": "no model loaded"}, status_code=400)

    async def event_stream():
        async for event in app_state["agent"].run_stream(req.messages):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/skills")
async def list_skills():
    if app_state["skill_engine"] is None:
        return {"skills": []}
    return {"skills": app_state["skill_engine"].get_skills_list()}


# ── Conversations ──────────────────────────────────────────────────


@app.get("/conversations")
async def list_conversations():
    return {"conversations": app_state["conversations"].list_conversations()}


@app.get("/conversations/{cid}")
async def get_conversation(cid: str):
    c = app_state["conversations"].get(cid)
    if c is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return c


@app.post("/conversations")
async def create_conversation(req: ConversationBody):
    cid = app_state["conversations"].save(req.model_dump())
    return {"id": cid}


@app.put("/conversations/{cid}")
async def update_conversation(cid: str, req: ConversationBody):
    body = req.model_dump(); body["id"] = cid
    app_state["conversations"].save(body)
    return {"id": cid}


@app.patch("/conversations/{cid}")
async def rename_conversation(cid: str, req: RenameBody):
    c = app_state["conversations"].rename(cid, req.title)
    if c is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"status": "ok"}


@app.delete("/conversations/{cid}")
async def delete_conversation(cid: str):
    app_state["conversations"].delete(cid)
    return {"status": "ok"}


# ── Settings ────────────────────────────────────────────────────────


@app.post("/settings")
async def update_settings(req: SettingsBody):
    if req.hf_token:
        os.environ["HF_TOKEN"] = req.hf_token
        return {"status": "ok", "hf_token_set": True}
    return {"status": "ok", "hf_token_set": False}


# ── Model marketplace ──────────────────────────────────────────────


@app.get("/models/available")
async def models_available():
    return {"models": get_available_models()}


@app.get("/models/local")
async def models_local():
    return {"models": get_local_models()}


@app.post("/models/import")
async def models_import(req: ModelImportRequest):
    result = import_model(req.source_path, req.model_id, req.metadata)
    if result["status"] == "error":
        return JSONResponse(result, status_code=400)
    return result


class MmprojImportRequest(BaseModel):
    source_path: str
    model_id: str


@app.post("/models/import-mmproj")
async def models_import_mmproj(req: MmprojImportRequest):
    result = import_mmproj(req.source_path, req.model_id)
    if result["status"] == "error":
        return JSONResponse(result, status_code=400)
    return result


@app.get("/models/local/{model_id}/metadata")
async def models_get_metadata(model_id: str):
    return {"model_id": model_id, "metadata": get_model_metadata(model_id)}


@app.put("/models/local/{model_id}/metadata")
async def models_update_metadata(model_id: str, req: ModelMetadataUpdate):
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    updated = set_model_metadata(model_id, fields)
    return {"model_id": model_id, "metadata": updated}


@app.delete("/models/local/{model_id}")
async def models_local_delete(model_id: str):
    return delete_local_model(model_id)


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    import uvicorn

    port = find_free_port()
    with open(sys.argv[1], "w") as f:
        f.write(str(port))

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
