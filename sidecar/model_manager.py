from __future__ import annotations

import os
import time
import threading
from pathlib import Path
from typing import AsyncGenerator
from urllib.parse import urlparse

import httpx
from llama_cpp import Llama


MODELS_DIR = os.path.expanduser("~/.llm-app/models")

MODELS_CATALOG = [
    {
        "id": "qwen2.5-7b-instruct",
        "name": "Qwen2.5 7B Instruct (Q4_K_M)",
        "description": "通义千问最新7B模型，中英文双强，综合能力出色，推荐首选",
        "url": "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
        "size_bytes": 4724464026,
        "requirements": "8GB+ RAM",
        "params": "7B",
        "language": "中文 / English",
    },
    {
        "id": "deepseek-r1-distill-qwen-7b",
        "name": "DeepSeek-R1-Distill-Qwen-7B (Q4_K_M)",
        "description": "DeepSeek 蒸馏版，推理能力极强，擅长数学和复杂逻辑问题",
        "url": "https://huggingface.co/QuantFactory/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B.Q4_K_M.gguf",
        "size_bytes": 4724464026,
        "requirements": "8GB+ RAM",
        "params": "7B",
        "language": "中文 / English",
    },
    {
        "id": "llama-3.1-8b",
        "name": "Llama 3.1 8B Instruct (Q4_K_M)",
        "description": "Meta 最强8B开源模型，英文对话质量顶尖，支持128K上下文",
        "url": "https://huggingface.co/QuantFactory/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf",
        "size_bytes": 5368709120,
        "requirements": "8GB+ RAM",
        "params": "8B",
        "language": "English",
    },
    {
        "id": "gemma-2-9b",
        "name": "Gemma 2 9B (Q4_K_M)",
        "description": "Google 出品，9B 参数中的佼佼者，质量与安全性出色",
        "url": "https://huggingface.co/QuantFactory/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it.Q4_K_M.gguf",
        "size_bytes": 5905580032,
        "requirements": "12GB+ RAM",
        "params": "9B",
        "language": "English",
    },
    {
        "id": "mistral-7b-v0.3",
        "name": "Mistral 7B v0.3 (Q4_K_M)",
        "description": "Mistral 最新7B，推理速度极快，效率标杆，低延迟首选",
        "url": "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/mistral-7b-instruct-v0.3.Q4_K_M.gguf",
        "size_bytes": 4294967296,
        "requirements": "8GB+ RAM",
        "params": "7B",
        "language": "English",
    },
    {
        "id": "phi-3.5-mini",
        "name": "Phi-3.5 Mini 3.8B (Q4_K_M)",
        "description": "微软轻量模型，资源需求低但表现优秀，适合快速对话",
        "url": "https://huggingface.co/microsoft/Phi-3.5-mini-instruct-gguf/resolve/main/Phi-3.5-mini-instruct.Q4_K_M.gguf",
        "size_bytes": 2684354560,
        "requirements": "4GB+ RAM",
        "params": "3.8B",
        "language": "English",
    },
]

_download_states: dict[str, dict] = {}
_download_lock = threading.Lock()


class ModelManager:
    def __init__(self, path: str, ctx_size: int = 32768, gpu_layers: int = -1):
        self.path = path
        self.ctx_size = ctx_size
        self.gpu_layers = gpu_layers
        self._model: Llama | None = None

    def load(self):
        self._model = Llama(
            model_path=self.path,
            n_ctx=self.ctx_size,
            n_gpu_layers=self.gpu_layers,
            verbose=False,
        )

    def unload(self):
        if self._model is not None:
            del self._model
            self._model = None

    def chat(self, messages: list[dict]) -> str:
        if self._model is None:
            raise RuntimeError("model not loaded")

        result = self._model.create_chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        return result["choices"][0]["message"]["content"]

    async def chat_stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        if self._model is None:
            raise RuntimeError("model not loaded")

        result = self._model.create_chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            stream=True,
        )

        for chunk in result:
            delta = chunk["choices"][0]["delta"]
            if "content" in delta:
                yield delta["content"]


# ── Model catalog & download helpers ────────────────────────────────

def get_available_models() -> list[dict]:
    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)
    result = []
    for model in MODELS_CATALOG:
        local_path = os.path.join(MODELS_DIR, f"{model['id']}.gguf")
        entry = dict(model)
        entry["downloaded"] = os.path.exists(local_path)
        entry["local_path"] = local_path if entry["downloaded"] else None
        result.append(entry)
    return result


def get_local_models() -> list[dict]:
    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)
    local = []
    for f in Path(MODELS_DIR).glob("*.gguf"):
        model_id = f.stem
        catalog_match = next((m for m in MODELS_CATALOG if m["id"] == model_id), None)
        local.append({
            "id": model_id,
            "name": catalog_match["name"] if catalog_match else model_id,
            "path": str(f),
            "size_bytes": f.stat().st_size,
        })
    return local


def start_download(model_id: str) -> dict:
    model = next((m for m in MODELS_CATALOG if m["id"] == model_id), None)
    if model is None:
        return {"status": "error", "error": f"unknown model: {model_id}"}

    dest = os.path.join(MODELS_DIR, f"{model_id}.gguf")
    if os.path.exists(dest):
        _download_states[model_id] = {"status": "completed", "progress": 1.0, "path": dest}
        return _download_states[model_id]

    with _download_lock:
        if model_id in _download_states and _download_states[model_id]["status"] == "downloading":
            return {"status": "already_downloading"}

        _download_states[model_id] = {"status": "downloading", "progress": 0.0}

    thread = threading.Thread(
        target=_download_worker,
        args=(model_id, model["url"], dest, model["size_bytes"]),
        daemon=True,
    )
    thread.start()

    return {"status": "started", "model_id": model_id}


def get_download_progress(model_id: str) -> dict | None:
    return _download_states.get(model_id)


def _parse_hf_url(url: str) -> tuple[str, str]:
    """Parse a HuggingFace URL into (repo_id, filename).

    https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf
    -> ("Qwen/Qwen2.5-7B-Instruct-GGUF", "qwen2.5-7b-instruct-q4_k_m.gguf")
    """
    path = urlparse(url).path.strip("/")
    parts = path.split("/")
    repo_id = "/".join(parts[:2])
    filename = parts[-1]
    return repo_id, filename


def _download_worker(model_id: str, url: str, dest: str, expected_size: int):
    """Download with resume (Range header) + aggressive retry for unstable connections."""
    partial = dest + ".partial"
    max_retries = 30

    _download_states[model_id] = {"status": "downloading", "progress": 0.0}

    for attempt in range(max_retries):
        try:
            resume_pos = os.path.getsize(partial) if os.path.exists(partial) else 0
            headers = {"Range": f"bytes={resume_pos}-"} if resume_pos > 0 else {}

            with httpx.stream(
                "GET", url,
                follow_redirects=True,
                timeout=httpx.Timeout(None, connect=15.0, read=None),
                headers=headers,
            ) as resp:
                if resp.status_code == 416:
                    break

                resp.raise_for_status()

                remaining = int(resp.headers.get("content-length", 0))
                total = resume_pos + remaining if remaining > 0 else expected_size
                downloaded = resume_pos
                mode = "ab" if resume_pos > 0 else "wb"

                Path(dest).parent.mkdir(parents=True, exist_ok=True)

                with open(partial, mode) as f:
                    for chunk in resp.iter_bytes(chunk_size=262144):
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            _download_states[model_id]["progress"] = min(downloaded / total, 0.999)

            actual_size = os.path.getsize(partial)
            if total > 0 and actual_size >= total:
                os.rename(partial, dest)
                _download_states[model_id] = {"status": "completed", "progress": 1.0, "path": dest}
                return
            elif total > 0 and actual_size < total:
                raise IOError(f"incomplete: {actual_size}/{total}")

        except Exception as e:
            if attempt < max_retries - 1:
                current = os.path.getsize(partial) if os.path.exists(partial) else 0
                pct = current / expected_size if expected_size > 0 else 0
                _download_states[model_id] = {
                    "status": "downloading",
                    "progress": pct,
                    "retrying": attempt + 1,
                }
                time.sleep(1)
                continue

            _download_states[model_id] = {
                "status": "error",
                "progress": 0.0,
                "error": str(e),
            }
            return
