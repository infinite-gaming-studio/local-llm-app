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
    # ── 多模态 VL(优先)──────────────────────────────────────────────
    {
        "id": "gemma-4-2b-it",
        "name": "Gemma 4 2B IT (Q4_K_M)",
        "description": "Google 最新代,原生多模态(文+图),端侧入门首选",
        "url": "https://huggingface.co/ggml-org/gemma-4-2b-it-GGUF/resolve/main/gemma-4-2B-it-Q4_K_M.gguf",
        "size_bytes": 1610612736,
        "requirements": "4GB+ RAM",
        "params": "2B",
        "language": "中文 / English",
    },
    {
        "id": "gemma-4-4b-it",
        "name": "Gemma 4 4B IT (Q4_K_M)",
        "description": "Google 多模态,8GB 机器首选,质量速度平衡",
        "url": "https://huggingface.co/ggml-org/gemma-4-4b-it-GGUF/resolve/main/gemma-4-4B-it-Q4_K_M.gguf",
        "size_bytes": 3221225472,
        "requirements": "8GB+ RAM",
        "params": "4B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-2b-instruct",
        "name": "Qwen3-VL 2B Instruct (Q4_K_M)",
        "description": "Qwen 多模态,中文理解强,极轻量",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/Qwen3VL-2B-Instruct-Q4_K_M.gguf",
        "size_bytes": 1107409952,
        "requirements": "8GB+ RAM",
        "params": "2B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-4b-instruct",
        "name": "Qwen3-VL 4B Instruct (Q4_K_M)",
        "description": "多模态中文 SOTA 小模型,16GB 机器性价比之选",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF/resolve/main/Qwen3VL-4B-Instruct-Q4_K_M.gguf",
        "size_bytes": 2497281664,
        "requirements": "16GB+ RAM",
        "params": "4B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-8b-instruct",
        "name": "Qwen3-VL 8B Instruct (Q4_K_M)",
        "description": "多模态中坚,综合能力强,推荐主力",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/Qwen3VL-8B-Instruct-Q4_K_M.gguf",
        "size_bytes": 5027784800,
        "requirements": "16GB+ RAM",
        "params": "8B",
        "language": "中文 / English",
    },
    {
        "id": "gemma-4-12b-it",
        "name": "Gemma 4 12B IT (Q4_K_M)",
        "description": "Google 多模态,256K 上下文,质量高",
        "url": "https://huggingface.co/ggml-org/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12B-it-Q4_K_M.gguf",
        "size_bytes": 7381382048,
        "requirements": "16GB+ RAM",
        "params": "12B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-14b-instruct",
        "name": "Qwen3-VL 14B Instruct (Q4_K_M)",
        "description": "多模态,逼近云端质量,24GB 机器首选",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-14B-Instruct-GGUF/resolve/main/Qwen3VL-14B-Instruct-Q4_K_M.gguf",
        "size_bytes": 9663676416,
        "requirements": "24GB+ RAM",
        "params": "14B",
        "language": "中文 / English",
    },
    {
        "id": "gemma-4-27b-it",
        "name": "Gemma 4 27B IT (Q4_K_M)",
        "description": "Google 多模态旗舰,质量最强",
        "url": "https://huggingface.co/ggml-org/gemma-4-27b-it-GGUF/resolve/main/gemma-4-27B-it-Q4_K_M.gguf",
        "size_bytes": 18253611008,
        "requirements": "24GB+ RAM",
        "params": "27B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-32b-a3b",
        "name": "Qwen3-VL 32B-A3B MoE (Q4_K_M)",
        "description": "MoE 仅 3B 激活,速度快质量高,32GB+ 旗舰",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-32B-A3B-Instruct-GGUF/resolve/main/Qwen3VL-32B-A3B-Instruct-Q4_K_M.gguf",
        "size_bytes": 19327352832,
        "requirements": "32GB+ RAM",
        "params": "32B MoE",
        "language": "中文 / English",
    },
    # ── 纯文本(差异化价值,次选)──────────────────────────────────────
    {
        "id": "llama-4-1b-scout",
        "name": "Llama 4 1B Scout (Q4_K_M)",
        "description": "Meta 端侧,英文快,极轻量入门",
        "url": "https://huggingface.co/ggml-org/Llama-4-1B-Scout-GGUF/resolve/main/Llama-4-1B-Scout-Q4_K_M.gguf",
        "size_bytes": 1073741824,
        "requirements": "2GB+ RAM",
        "params": "1B",
        "language": "English",
    },
    {
        "id": "llama-4-3b-scout",
        "name": "Llama 4 3B Scout (Q4_K_M)",
        "description": "Meta 端侧,英文对话,低延迟",
        "url": "https://huggingface.co/ggml-org/Llama-4-3B-Scout-GGUF/resolve/main/Llama-4-3B-Scout-Q4_K_M.gguf",
        "size_bytes": 2147483648,
        "requirements": "4GB+ RAM",
        "params": "3B",
        "language": "English",
    },
    {
        "id": "glm-5-9b-chat",
        "name": "GLM-5 9B Chat (Q4_K_M)",
        "description": "智谱最新,中文好,agentic 能力强",
        "url": "https://huggingface.co/zai-org/GLM-5-9B-Chat-GGUF/resolve/main/GLM-5-9B-Chat-Q4_K_M.gguf",
        "size_bytes": 6442450944,
        "requirements": "16GB+ RAM",
        "params": "9B",
        "language": "中文 / English",
    },
    {
        "id": "deepseek-v4-distill-7b",
        "name": "DeepSeek-V4 Distill 7B (Q4_K_M)",
        "description": "推理链强,数学与复杂逻辑专长",
        "url": "https://huggingface.co/deepseek-ai/DeepSeek-V4-Distill-7B-GGUF/resolve/main/DeepSeek-V4-Distill-7B-Q4_K_M.gguf",
        "size_bytes": 5368709120,
        "requirements": "16GB+ RAM",
        "params": "7B",
        "language": "中文 / English",
    },
    {
        "id": "phi-4-14b",
        "name": "Phi-4 14B (Q4_K_M)",
        "description": "微软,推理出色,MIT 许可",
        "url": "https://huggingface.co/ggml-org/phi-4-GGUF/resolve/main/phi-4-Q4_K_M.gguf",
        "size_bytes": 9663676416,
        "requirements": "24GB+ RAM",
        "params": "14B",
        "language": "English",
    },
    {
        "id": "gpt-oss-20b",
        "name": "gpt-oss 20B (Q4_K_M)",
        "description": "OpenAI 开源,原生 MXFP4,MoE 3.6B 激活",
        "url": "https://huggingface.co/openai/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-Q4_K_M.gguf",
        "size_bytes": 12884901888,
        "requirements": "16GB+ RAM",
        "params": "20B MoE",
        "language": "English",
    },
    {
        "id": "gpt-oss-120b",
        "name": "gpt-oss 120B (Q4_K_M)",
        "description": "OpenAI 旗舰开源,MoE 5.1B 激活,需大显存或工作站",
        "url": "https://huggingface.co/openai/gpt-oss-120b-GGUF/resolve/main/gpt-oss-120b-Q4_K_M.gguf",
        "size_bytes": 75161927680,
        "requirements": "工作站级",
        "params": "120B MoE",
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


def delete_local_model(model_id: str) -> dict:
    model_path = os.path.join(MODELS_DIR, f"{model_id}.gguf")
    partial_path = model_path + ".partial"

    removed = False
    if os.path.exists(model_path):
        os.remove(model_path)
        removed = True
    if os.path.exists(partial_path):
        os.remove(partial_path)
        removed = True

    with _download_lock:
        _download_states.pop(model_id, None)

    return {"status": "deleted", "removed": removed}


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
