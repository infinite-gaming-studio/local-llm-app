from __future__ import annotations

from typing import AsyncGenerator
from llama_cpp import Llama


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
