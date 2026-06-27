import tempfile, time
from conversations import ConversationStore

def _conv(title="hi", messages=None):
    return {"title": title, "messages": messages or [{"role": "user", "content": "ping"}]}

def test_create_returns_id(tmp_path):
    store = ConversationStore(str(tmp_path))
    cid = store.save(_conv())
    assert isinstance(cid, str) and len(cid) == 32

def test_get_returns_saved(tmp_path):
    store = ConversationStore(str(tmp_path))
    cid = store.save(_conv("hello"))
    got = store.get(cid)
    assert got["title"] == "hello"
    assert got["messages"][0]["content"] == "ping"

def test_list_sorted_by_updated_desc(tmp_path):
    store = ConversationStore(str(tmp_path))
    a = store.save(_conv("a")); time.sleep(0.01); b = store.save(_conv("b"))
    lst = store.list_conversations()
    assert lst[0]["id"] == b and lst[1]["id"] == a
    assert all("messages" not in x for x in lst)

def test_save_upsert_keeps_id(tmp_path):
    store = ConversationStore(str(tmp_path))
    cid = store.save(_conv("a"))
    store.save({"id": cid, "title": "a2", "messages": []})
    assert store.get(cid)["title"] == "a2"

def test_rename(tmp_path):
    store = ConversationStore(str(tmp_path))
    cid = store.save(_conv("a"))
    store.rename(cid, "new")
    assert store.get(cid)["title"] == "new"

def test_delete(tmp_path):
    store = ConversationStore(str(tmp_path))
    cid = store.save(_conv("a"))
    assert store.delete(cid) is True
    assert store.get(cid) is None
