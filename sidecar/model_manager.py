from __future__ import annotations

import base64
import json
import os
import re
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import AsyncGenerator, Optional

from llama_cpp import Llama


# 匹配 data URL: data:image/png;base64,xxxx
_DATA_URL_RE = re.compile(r"^data:(image/[\w+.-]+);base64,(.+)$", re.DOTALL)


def _preprocess_messages(messages: list[dict]) -> list[dict]:
    """把多模态消息里的 data URL 图片解码到临时文件，转成 file:// URL。

    llama-cpp-python 对 data URL 的支持因版本而异，转成 file:// 更稳健。
    返回新的 messages，原 messages 不变。
    """
    processed = []
    for msg in messages:
        content = msg.get("content")
        if not isinstance(content, list):
            processed.append(msg)
            continue
        new_content = []
        for item in content:
            if not isinstance(item, dict):
                new_content.append(item)
                continue
            if item.get("type") == "image_url":
                url = (item.get("image_url") or {}).get("url", "")
                m = _DATA_URL_RE.match(url)
                if m:
                    mime = m.group(1)  # image/png
                    b64 = m.group(2)
                    ext = mime.split("/", 1)[-1].replace("+", "")
                    tmp = Path(tempfile.gettempdir()) / f"llm-app-img-{uuid.uuid4().hex[:8]}.{ext}"
                    try:
                        tmp.write_bytes(base64.b64decode(b64))
                        new_content.append({
                            "type": "image_url",
                            "image_url": {"url": f"file://{tmp}"},
                        })
                        continue
                    except Exception:
                        pass  # 解码失败保留原样
            new_content.append(item)
        processed.append({**msg, "content": new_content})
    return processed


DATA_DIR = os.environ.get("LLM_APP_DATA_DIR", os.path.expanduser("~/.llm-app"))
MODELS_DIR = os.path.join(DATA_DIR, "models")
METADATA_FILE = os.path.join(DATA_DIR, "models", "metadata.json")

# 自定义模型默认参数（用户可在导入后/编辑时覆盖）
DEFAULT_CTX_SIZE = 32768
DEFAULT_GPU_LAYERS = -1

MODELS_CATALOG = [
    # ── 多模态 VL(优先)──────────────────────────────────────────────
    {
        "id": "gemma-4-e2b-it",
        "name": "Gemma 4 E2B IT (Q8_0)",
        "description": "Google 最新代,原生多模态(文+图),端侧入门首选",
        "url": "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q8_0.gguf",
        "mmproj_url": "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/mmproj-gemma-4-E2B-it-Q8_0.gguf",
        "size_bytes": 5339766528,
        "requirements": "8GB+ RAM",
        "params": "2B",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    {
        "id": "qwen3-vl-2b-instruct",
        "name": "Qwen3-VL 2B Instruct (Q4_K_M)",
        "description": "Qwen 多模态,中文理解强,极轻量",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/Qwen3VL-2B-Instruct-Q4_K_M.gguf",
        "mmproj_url": "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf",
        "size_bytes": 1107409952,
        "requirements": "8GB+ RAM",
        "params": "2B",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    {
        "id": "qwen3-vl-4b-instruct",
        "name": "Qwen3-VL 4B Instruct (Q4_K_M)",
        "description": "多模态中文 SOTA 小模型,16GB 机器性价比之选",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF/resolve/main/Qwen3VL-4B-Instruct-Q4_K_M.gguf",
        "mmproj_url": "https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF/resolve/main/mmproj-Qwen3VL-4B-Instruct-Q8_0.gguf",
        "size_bytes": 2497281664,
        "requirements": "16GB+ RAM",
        "params": "4B",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    {
        "id": "gemma-4-e4b-it",
        "name": "Gemma 4 E4B IT (Q4_K_M)",
        "description": "Google 多模态,8GB 机器首选,质量速度平衡",
        "url": "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf",
        "mmproj_url": "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/mmproj-gemma-4-E4B-it-Q8_0.gguf",
        "size_bytes": 3221225472,
        "requirements": "8GB+ RAM",
        "params": "4B",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    {
        "id": "qwen3-vl-8b-instruct",
        "name": "Qwen3-VL 8B Instruct (Q4_K_M)",
        "description": "多模态中坚,综合能力强,推荐主力",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/Qwen3VL-8B-Instruct-Q4_K_M.gguf",
        "mmproj_url": "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/mmproj-Qwen3VL-8B-Instruct-Q8_0.gguf",
        "size_bytes": 5027784800,
        "requirements": "16GB+ RAM",
        "params": "8B",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    {
        "id": "gemma-4-12b-it",
        "name": "Gemma 4 12B IT (Q4_K_M)",
        "description": "Google 多模态,256K 上下文,质量高",
        "url": "https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/gemma-4-12B-it-Q4_K_M.gguf",
        "mmproj_url": "https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/mmproj-gemma-4-12B-it-Q8_0.gguf",
        "size_bytes": 7381382048,
        "requirements": "16GB+ RAM",
        "params": "12B",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    {
        "id": "gemma-4-31b-it",
        "name": "Gemma 4 31B IT (IQ4_XS)",
        "description": "Google 多模态旗舰,IQ4_XS 优化量化,16GB Mac 可运行",
        "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/gemma-4-31B-it-IQ4_XS.gguf",
        "mmproj_url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/mmproj-gemma-4-31B-it-Q8_0.gguf",
        "size_bytes": 16106127360,
        "requirements": "16GB+ RAM",
        "params": "31B",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    {
        "id": "qwen3-vl-30b-a3b",
        "name": "Qwen3-VL 30B-A3B MoE (IQ4_XS)",
        "description": "MoE 仅 3B 激活,IQ4_XS 优化量化,最佳质量/大小比",
        "url": "https://huggingface.co/unsloth/Qwen3-VL-30B-A3B-Instruct-GGUF/resolve/main/Qwen3-VL-30B-A3B-Instruct-IQ4_XS.gguf",
        "mmproj_url": "https://huggingface.co/unsloth/Qwen3-VL-30B-A3B-Instruct-GGUF/resolve/main/mmproj-Qwen3-VL-30B-A3B-Instruct-Q8_0.gguf",
        "size_bytes": 16428249907,
        "requirements": "16GB+ RAM",
        "params": "30B MoE",
        "language": "中文 / English",
        "modalities": ["text", "image"],
    },
    # ── 纯文本(差异化价值,次选)──────────────────────────────────────
    {
        "id": "phi-4-14b",
        "name": "Phi-4 14B (Q4_K_M)",
        "description": "微软,推理出色,MIT 许可",
        "url": "https://huggingface.co/MaziyarPanahi/phi-4-GGUF/resolve/main/phi-4.Q4_K_M.gguf",
        "size_bytes": 8847638528,
        "requirements": "24GB+ RAM",
        "params": "14B",
        "language": "English",
        "modalities": ["text"],
    },
]

class ModelManager:
    def __init__(self, path: str, ctx_size: int = 32768, gpu_layers: int = -1, mmproj_path: Optional[str] = None):
        self.path = path
        self.ctx_size = ctx_size
        self.gpu_layers = gpu_layers
        self.mmproj_path = mmproj_path
        self._model: Optional[Llama] = None

    def load(self):
        kwargs = dict(
            model_path=self.path,
            n_ctx=self.ctx_size,
            n_gpu_layers=self.gpu_layers,
            verbose=False,
        )
        # 多模态模型：加载 mmproj 视觉投影器
        if self.mmproj_path and os.path.exists(self.mmproj_path):
            try:
                from llama_cpp.llama_chat_format import Llava15ChatHandler
                chat_handler = Llava15ChatHandler(
                    clip_model_path=self.mmproj_path,
                    verbose=False,
                )
                kwargs["chat_handler"] = chat_handler
                print(f"[model] 已加载视觉投影器: {self.mmproj_path}", flush=True)
            except Exception as e:
                print(f"[model] 加载视觉投影器失败，将作为纯文本模型使用: {e}", flush=True)

        self._model = Llama(**kwargs)

    def unload(self):
        if self._model is not None:
            del self._model
            self._model = None

    def chat(self, messages: list[dict]) -> str:
        if self._model is None:
            raise RuntimeError("model not loaded")

        # 多模态消息预处理：data URL → file:// URL
        messages = _preprocess_messages(messages)

        # 采样参数说明:
        # - temperature=0.6: 适度降低随机性,减少小模型乱选 token 的概率
        # - top_p=0.9: 核采样,过滤长尾低概率 token
        # - top_k=40: 限制候选集,防止小模型在尾部乱选
        # - repeat_penalty=1.25: 关键! Q4 量化中文小模型极易"结巴"(逐 token 重复),
        #   1.1 默认值远远不够,1.18 仍会出现"激励激励"式重复,提到 1.25
        # - frequency_penalty=0.8: 配合 repeat_penalty 进一步抑制已出现 token
        # - presence_penalty=0.3: 鼓励引入新话题,减少原地打转
        result = self._model.create_chat_completion(
            messages=messages,
            temperature=0.6,
            top_p=0.9,
            top_k=40,
            repeat_penalty=1.25,
            frequency_penalty=0.8,
            presence_penalty=0.3,
            max_tokens=4096,
        )
        return result["choices"][0]["message"]["content"]

    async def chat_stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        if self._model is None:
            raise RuntimeError("model not loaded")

        # 多模态消息预处理：data URL → file:// URL
        messages = _preprocess_messages(messages)

        from starlette.concurrency import iterate_in_threadpool

        result = self._model.create_chat_completion(
            messages=messages,
            temperature=0.6,
            top_p=0.9,
            top_k=40,
            repeat_penalty=1.25,
            frequency_penalty=0.8,
            presence_penalty=0.3,
            max_tokens=4096,
            stream=True,
        )

        async for chunk in iterate_in_threadpool(iter(result)):
            delta = chunk["choices"][0]["delta"]
            if "content" in delta:
                yield delta["content"]


# ── Model catalog & download helpers ────────────────────────────────

def get_available_models() -> list[dict]:
    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)

    result = []
    for model in MODELS_CATALOG:
        local_path = os.path.join(MODELS_DIR, f"{model['id']}.gguf")
        mmproj_path = os.path.join(MODELS_DIR, f"{model['id']}.mmproj.gguf")
        entry = dict(model)
        entry["downloaded"] = os.path.exists(local_path)
        entry["local_path"] = local_path if entry["downloaded"] else None
        entry["mmproj_downloaded"] = os.path.exists(mmproj_path) if "modalities" in model and "image" in model.get("modalities", []) else None
        result.append(entry)
    return result


def get_mmproj_path(model_id: str) -> Optional[str]:
    """返回某模型的 mmproj 文件路径，不存在则 None。"""
    p = os.path.join(MODELS_DIR, f"{model_id}.mmproj.gguf")
    return p if os.path.exists(p) else None


def get_local_models() -> list[dict]:
    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)
    metadata = _load_metadata()
    local = []
    for f in Path(MODELS_DIR).glob("*.gguf"):
        name = f.name
        # 跳过 mmproj 文件（它们是附属文件，不作为独立模型显示）
        if ".mmproj." in name:
            continue
        model_id = f.stem
        catalog_match = next((m for m in MODELS_CATALOG if m["id"] == model_id), None)
        meta = metadata.get(model_id, {})
        mmproj_path = get_mmproj_path(model_id)
        # catalog 模型优先用 catalog 字段；自定义模型用 metadata；都没有则回退
        entry = {
            "id": model_id,
            "name": (catalog_match["name"] if catalog_match else None) or meta.get("display_name") or model_id,
            "path": str(f),
            "size_bytes": f.stat().st_size,
            "is_custom": catalog_match is None,
            "description": (catalog_match["description"] if catalog_match else None) or meta.get("description", ""),
            "params": (catalog_match["params"] if catalog_match else None) or meta.get("params", ""),
            "language": (catalog_match["language"] if catalog_match else None) or meta.get("language", ""),
            "requirements": (catalog_match["requirements"] if catalog_match else None) or meta.get("requirements", ""),
            "modalities": (catalog_match["modalities"] if catalog_match else None) or meta.get("modalities", ["text"]),
            "ctx_size": meta.get("ctx_size", DEFAULT_CTX_SIZE),
            "gpu_layers": meta.get("gpu_layers", DEFAULT_GPU_LAYERS),
            "mmproj_path": mmproj_path,
            "has_mmproj": mmproj_path is not None,
        }
        local.append(entry)
    return local


def get_model_modalities(model_id: str) -> list[str]:
    """返回某模型的模态列表。catalog 优先，否则查 metadata，否则 ['text']。"""
    catalog_match = next((m for m in MODELS_CATALOG if m["id"] == model_id), None)
    if catalog_match:
        return catalog_match.get("modalities", ["text"])
    meta = get_model_metadata(model_id)
    return meta.get("modalities", ["text"])


# ── Metadata persistence ───────────────────────────────────────────


def _load_metadata() -> dict:
    """读取全部模型 metadata。文件不存在或损坏时返回空 dict。"""
    try:
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_metadata(data: dict) -> None:
    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)
    tmp = METADATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, METADATA_FILE)


def get_model_metadata(model_id: str) -> dict:
    """返回单个模型的 metadata，不存在则返回空 dict。"""
    return _load_metadata().get(model_id, {})


def set_model_metadata(model_id: str, fields: dict) -> dict:
    """更新单个模型 metadata 的部分字段。返回更新后的完整 metadata。

    允许的字段: display_name, description, params, language, requirements,
                ctx_size, gpu_layers, modalities
    """
    allowed = {
        "display_name", "description", "params", "language",
        "requirements", "ctx_size", "gpu_layers", "modalities",
    }
    data = _load_metadata()
    current = data.get(model_id, {})
    for k, v in fields.items():
        if k in allowed:
            current[k] = v
    current["updated_at"] = int(time.time())
    if "imported_at" not in current:
        current["imported_at"] = current["updated_at"]
    data[model_id] = current
    _save_metadata(data)
    return current


def delete_local_model(model_id: str) -> dict:
    model_path = os.path.join(MODELS_DIR, f"{model_id}.gguf")

    removed = False
    if os.path.exists(model_path):
        os.remove(model_path)
        removed = True

    # 清理残留的 partial 文件
    partial_path = model_path + ".partial"
    if os.path.exists(partial_path):
        os.remove(partial_path)
        removed = True

    # 清理 mmproj 视觉投影文件
    mmproj_path = os.path.join(MODELS_DIR, f"{model_id}.mmproj.gguf")
    if os.path.exists(mmproj_path):
        os.remove(mmproj_path)
        removed = True

    # 清理 metadata
    data = _load_metadata()
    if model_id in data:
        del data[model_id]
        _save_metadata(data)

    return {"status": "deleted", "removed": removed}


def import_model(
    source_path: str,
    model_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    """导入本地模型文件到模型目录。

    - model_id 为 None 时，使用文件名（不含扩展名）作为 model_id
    - metadata 可选，用于初始化 display_name/ctx_size/gpu_layers 等字段
    - 同名文件已存在时先删除
    - 跨文件系统时使用 copy2，同文件系统时使用 rename（移动）
    """
    if not os.path.exists(source_path):
        return {"status": "error", "error": f"文件不存在: {source_path}"}

    if not source_path.lower().endswith(".gguf"):
        return {"status": "error", "error": "仅支持 .gguf 格式模型文件"}

    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)

    if model_id is None:
        model_id = Path(source_path).stem

    dest = os.path.join(MODELS_DIR, f"{model_id}.gguf")

    # 清理旧文件
    if os.path.exists(dest):
        os.remove(dest)

    # 尝试移动（同文件系统），失败则复制
    try:
        shutil.move(source_path, dest)
        action = "moved"
    except (OSError, shutil.Error):
        shutil.copy2(source_path, dest)
        action = "copied"

    size = os.path.getsize(dest)

    # 写入/合并 metadata
    initial_meta = {
        "display_name": model_id,
        "imported_at": int(time.time()),
    }
    if metadata:
        initial_meta.update(metadata)
    saved_meta = set_model_metadata(model_id, initial_meta)

    print(f"[import] {model_id}: 模型已导入 ({action}, {size // (1024*1024)}MB)", flush=True)

    return {
        "status": "imported",
        "model_id": model_id,
        "path": dest,
        "size_bytes": size,
        "action": action,
        "metadata": saved_meta,
    }


def import_mmproj(source_path: str, model_id: str) -> dict:
    """导入多模态模型的视觉投影文件(mmproj)。

    文件将保存为 {MODELS_DIR}/{model_id}.mmproj.gguf。
    """
    if not os.path.exists(source_path):
        return {"status": "error", "error": f"文件不存在: {source_path}"}

    if not source_path.lower().endswith(".gguf"):
        return {"status": "error", "error": "仅支持 .gguf 格式文件"}

    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)
    dest = os.path.join(MODELS_DIR, f"{model_id}.mmproj.gguf")

    if os.path.exists(dest):
        os.remove(dest)

    try:
        shutil.move(source_path, dest)
        action = "moved"
    except (OSError, shutil.Error):
        shutil.copy2(source_path, dest)
        action = "copied"

    size = os.path.getsize(dest)
    print(f"[import] {model_id}: mmproj 已导入 ({action}, {size // (1024*1024)}MB)", flush=True)

    return {
        "status": "imported",
        "model_id": model_id,
        "mmproj_path": dest,
        "size_bytes": size,
        "action": action,
    }
