import asyncio
import json
import sys
import socket

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from model_manager import ModelManager
from engine import SkillEngine


class ChatRequest(BaseModel):
    messages: list[dict]
    stream: bool = False


class ModelLoadRequest(BaseModel):
    path: str
    ctx_size: int = 32768
    gpu_layers: int = -1


app_state = {
    "model": None,
    "model_loaded": False,
    "agent": None,
    "skill_engine": None,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("SIDECAR_READY", flush=True)
    app_state["skill_engine"] = SkillEngine()
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

    manager = ModelManager(req.path, ctx_size=req.ctx_size, gpu_layers=req.gpu_layers)
    manager.load()
    app_state["model"] = manager
    app_state["model_loaded"] = True

    from agent import AgentOrchestrator
    app_state["agent"] = AgentOrchestrator(manager, app_state["skill_engine"])
    return {"status": "loaded", "model": req.path}


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
        return {
            "loaded": True,
            "path": app_state["model"].path,
            "ctx_size": app_state["model"].ctx_size,
        }
    return {"loaded": False}


@app.post("/chat")
async def chat(req: ChatRequest):
    if app_state["agent"] is None:
        return JSONResponse({"error": "no model loaded"}, status_code=400)

    content = app_state["agent"].run(req.messages)
    return {"message": {"role": "assistant", "content": content}}


@app.websocket("/chat/stream")
async def chat_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        req = json.loads(data)
        messages = req.get("messages", [])

        if app_state["agent"] is None:
            await websocket.send_json({"error": "no model loaded"})
            await websocket.close()
            return

        full_content = app_state["agent"].run(messages)
        await websocket.send_json({"token": full_content})
        await websocket.send_json({"done": True, "full_content": full_content})
        await websocket.close()
    except WebSocketDisconnect:
        pass


@app.get("/skills")
async def list_skills():
    if app_state["skill_engine"] is None:
        return {"skills": []}
    return {"skills": app_state["skill_engine"].get_skills_list()}


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
