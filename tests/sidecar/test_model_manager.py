import pytest
from sidecar.model_manager import ModelManager


def test_model_manager_init():
    mm = ModelManager(path="/fake/model.gguf", ctx_size=4096, gpu_layers=0)
    assert mm.path == "/fake/model.gguf"
    assert mm.ctx_size == 4096
    assert mm.gpu_layers == 0
    assert mm._model is None


def test_chat_without_load_raises():
    mm = ModelManager("/fake.gguf")
    with pytest.raises(RuntimeError, match="model not loaded"):
        mm.chat([{"role": "user", "content": "hi"}])
