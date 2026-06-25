import pytest
from sidecar.agent import AgentOrchestrator


class FakeModel:
    def __init__(self):
        self.call_count = 0

    def chat(self, messages):
        return "这是一个普通回复"


class FakeSkillEngine:
    def match_skill(self, text):
        return ""


def test_build_system_prompt():
    model = FakeModel()
    engine = FakeSkillEngine()
    agent = AgentOrchestrator(model, engine)
    prompt = agent.build_system_prompt()
    assert "工具" in prompt or "工具" in prompt
    assert "read_file" in prompt


def test_run_returns_text():
    model = FakeModel()
    engine = FakeSkillEngine()
    agent = AgentOrchestrator(model, engine)
    result = agent.run([{"role": "user", "content": "你好"}])
    assert result == "这是一个普通回复"
