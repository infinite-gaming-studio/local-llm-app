import os

WORKSPACE_DIR = os.path.join(os.environ.get("LLM_APP_DATA_DIR", os.path.expanduser("~/.llm-app")), "workspace")


def read_file(path: str) -> str:
    full_path = os.path.abspath(os.path.join(WORKSPACE_DIR, path))
    if not full_path.startswith(WORKSPACE_DIR):
        raise PermissionError("path outside workspace")
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path: str, content: str) -> str:
    full_path = os.path.abspath(os.path.join(WORKSPACE_DIR, path))
    if not full_path.startswith(WORKSPACE_DIR):
        raise PermissionError("path outside workspace")
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    return f"written: {path}"
