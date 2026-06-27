from __future__ import annotations
import json, os, uuid, time
from pathlib import Path


class ConversationStore:
    def __init__(self, base_dir: str | None = None):
        self.dir = Path(base_dir or os.path.expanduser("~/.llm-app/conversations"))
        self.dir.mkdir(parents=True, exist_ok=True)

    def list_conversations(self) -> list[dict]:
        out = []
        for f in self.dir.glob("*.json"):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                out.append({"id": d["id"], "title": d["title"], "updated_at": d["updated_at"]})
            except (json.JSONDecodeError, KeyError):
                continue
        out.sort(key=lambda x: x["updated_at"], reverse=True)
        return out

    def get(self, cid: str) -> dict | None:
        f = self.dir / f"{cid}.json"
        if not f.exists():
            return None
        return json.loads(f.read_text(encoding="utf-8"))

    def save(self, conv: dict) -> str:
        cid = conv.get("id") or uuid.uuid4().hex
        now = conv.get("updated_at") or time.time()
        existing = self.get(cid) or {}
        data = {
            "id": cid,
            "title": conv.get("title", existing.get("title", "")),
            "messages": conv.get("messages", existing.get("messages", [])),
            "created_at": existing.get("created_at", now),
            "updated_at": now,
        }
        (self.dir / f"{cid}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return cid

    def rename(self, cid: str, title: str) -> dict | None:
        d = self.get(cid)
        if d is None:
            return None
        d["title"] = title
        self.save(d)
        return d

    def delete(self, cid: str) -> bool:
        f = self.dir / f"{cid}.json"
        if f.exists():
            f.unlink()
            return True
        return False
