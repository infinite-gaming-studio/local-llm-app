from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import AsyncGenerator
from urllib.parse import urlparse

import httpx
from llama_cpp import Llama
from huggingface_hub import hf_hub_download


MODELS_DIR = os.path.expanduser("~/.llm-app/models")

MODELS_CATALOG = [
    # ── 多模态 VL(优先)──────────────────────────────────────────────
    {
        "id": "gemma-4-e2b-it",
        "name": "Gemma 4 E2B IT (Q8_0)",
        "description": "Google 最新代,原生多模态(文+图),端侧入门首选",
        "url": "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q8_0.gguf",
        "size_bytes": 5339766528,
        "requirements": "8GB+ RAM",
        "params": "2B",
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
        "id": "gemma-4-e4b-it",
        "name": "Gemma 4 E4B IT (Q4_K_M)",
        "description": "Google 多模态,8GB 机器首选,质量速度平衡",
        "url": "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf",
        "size_bytes": 3221225472,
        "requirements": "8GB+ RAM",
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
        "url": "https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/gemma-4-12B-it-Q4_K_M.gguf",
        "size_bytes": 7381382048,
        "requirements": "16GB+ RAM",
        "params": "12B",
        "language": "中文 / English",
    },
    {
        "id": "gemma-4-31b-it",
        "name": "Gemma 4 31B IT (IQ4_XS)",
        "description": "Google 多模态旗舰,IQ4_XS 优化量化,16GB Mac 可运行",
        "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/gemma-4-31B-it-IQ4_XS.gguf",
        "size_bytes": 16106127360,
        "requirements": "16GB+ RAM",
        "params": "31B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-30b-a3b",
        "name": "Qwen3-VL 30B-A3B MoE (IQ4_XS)",
        "description": "MoE 仅 3B 激活,IQ4_XS 优化量化,最佳质量/大小比",
        "url": "https://huggingface.co/unsloth/Qwen3-VL-30B-A3B-Instruct-GGUF/resolve/main/Qwen3-VL-30B-A3B-Instruct-IQ4_XS.gguf",
        "size_bytes": 16428249907,
        "requirements": "16GB+ RAM",
        "params": "30B MoE",
        "language": "中文 / English",
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

    # Clean up stale .partial files from old download system
    for f in Path(MODELS_DIR).glob("*.partial"):
        f.unlink(missing_ok=True)

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
    partial_path = dest + ".partial"

    # Clean up stale .partial from old download system
    if os.path.exists(partial_path):
        os.remove(partial_path)

    if os.path.exists(dest):
        _download_states[model_id] = {"status": "completed", "progress": 1.0, "path": dest}
        return _download_states[model_id]

    with _download_lock:
        if model_id in _download_states and _download_states[model_id]["status"] == "downloading":
            return {"status": "already_downloading"}
        _download_states[model_id] = {"status": "downloading", "progress": 0.0}

    thread = threading.Thread(
        target=_download_worker_hf,
        args=(model_id, model["url"], dest, model["size_bytes"]),
        daemon=True,
    )
    thread.start()
    return {"status": "started", "model_id": model_id}


def get_download_progress(model_id: str) -> dict | None:
    return _download_states.get(model_id)


def _parse_hf_url(url: str) -> tuple[str, str]:
    path = urlparse(url).path.strip("/")
    parts = path.split("/")
    repo_id = "/".join(parts[:2])
    filename = parts[-1]
    return repo_id, filename


def _poll_download_progress(model_id: str, cache_dir: str, repo_id: str, expected_size: int, stop_event: threading.Event):
    """Poll the HF cache blob file size to report download progress.
    
    Works with both standard Python download and hf_transfer (Rust).
    """
    repo_cache = os.path.join(cache_dir, f"models--{repo_id.replace('/', '--')}", "blobs")
    while not stop_event.is_set():
        if os.path.isdir(repo_cache):
            for fname in os.listdir(repo_cache):
                if fname.endswith(".incomplete"):
                    fpath = os.path.join(repo_cache, fname)
                    try:
                        size = os.path.getsize(fpath)
                    except OSError:
                        continue
                    if expected_size > 0:
                        _download_states[model_id]["progress"] = min(size / expected_size, 0.999)
                    break
                # If blob file exists without .incomplete, download is essentially done
                if not fname.endswith(".lock") and not fname.endswith(".incomplete") and expected_size > 0:
                    try:
                        size = os.path.getsize(os.path.join(repo_cache, fname))
                        if size >= expected_size:
                            _download_states[model_id]["progress"] = 0.999
                    except OSError:
                        pass
        stop_event.wait(1.0)


def _download_worker_hf(model_id: str, url: str, dest: str, expected_size: int):
    _download_states[model_id] = {"status": "downloading", "progress": 0.0}
    Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)

    try:
        repo_id, filename = _parse_hf_url(url)

        os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")

        # Use dedicated cache per download so we can find the blob
        cache_dir = os.path.join(MODELS_DIR, ".hf_cache")
        Path(cache_dir).mkdir(parents=True, exist_ok=True)

        stop_polling = threading.Event()
        poll_thread = threading.Thread(
            target=_poll_download_progress,
            args=(model_id, cache_dir, repo_id, expected_size, stop_polling),
            daemon=True,
        )
        poll_thread.start()

        try:
            cached_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                cache_dir=cache_dir,
                force_download=False,
                local_files_only=False,
            )
        except Exception:
            # Retry with force_download if cache is corrupted
            cached_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                cache_dir=cache_dir,
                force_download=True,
                local_files_only=False,
            )
        finally:
            stop_polling.set()

        if os.path.exists(dest):
            os.remove(dest)
        try:
            os.symlink(cached_path, dest)
        except (OSError, PermissionError):
            import shutil
            shutil.copy2(cached_path, dest)

        _download_states[model_id] = {"status": "completed", "progress": 1.0, "path": dest}

    except Exception as e:
        _download_states[model_id] = {
            "status": "error",
            "progress": 0.0,
            "error": _friendly_error(e),
        }


def _friendly_error(e: Exception) -> str:
    msg = str(e)
    if "socks" in msg.lower() and "socksio" in msg.lower():
        return "SOCKS 代理需要 socksio 库: pip install httpx[socks]"
    if "proxy" in msg.lower() and "connect" in msg.lower():
        return f"代理连接失败: {msg[:100]}"
    return msg
