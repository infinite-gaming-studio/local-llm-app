from __future__ import annotations

import json
import re
from typing import AsyncGenerator, Generator, Union
from tools import get_tool_schemas, execute_tool


SYSTEM_PROMPT_BASE = """你是一个有用的 AI 助手。你可以使用以下工具来帮助用户完成任务：
{tool_descriptions}

当你需要使用工具时，请以 JSON 格式返回：
{{"tool": "tool_name", "args": {{"key": "value"}}}}

在得到工具执行结果后，请基于结果给出最终回复。"""


def _extract_text(content: Union[str, list]) -> str:
    """从 message content 中提取纯文本。

    content 可能是 str（纯文本消息）或 list（多模态消息，
    如 [{"type":"image_url",...},{"type":"text","text":"..."}]）。
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return " ".join(parts)
    return ""


class AgentOrchestrator:
    def __init__(self, model, skill_engine=None):
        self.model = model
        self.skill_engine = skill_engine
        self.max_tool_rounds = 5

    def build_system_prompt(self, skill_context: str = "") -> str:
        schemas = get_tool_schemas()
        tool_descriptions = "\n".join(
            f"- {s['name']}: {s['description']}" for s in schemas
        )
        prompt = SYSTEM_PROMPT_BASE.format(tool_descriptions=tool_descriptions)
        if skill_context:
            prompt += f"\n\n当前 Skill 指令:\n{skill_context}"
        return prompt

    def _detect_tool_call(self, text: str) -> dict | None:
        m = re.search(r'\{"tool":\s*"[^"]+"', text)
        if not m:
            return None
        try:
            start = m.start()
            end = text.index("}", start) + 1
            tc = json.loads(text[start:end])
            if "tool" in tc and "args" in tc:
                return tc
        except (json.JSONDecodeError, ValueError):
            pass
        return None

    def run(self, messages: list[dict], stream: bool = False):
        skill_context = ""
        if self.skill_engine:
            # 多模态消息的 content 是 list，需先提取纯文本
            skill_context = self.skill_engine.match_skill(_extract_text(messages[-1]["content"]))

        system_prompt = self.build_system_prompt(skill_context)
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        for _ in range(self.max_tool_rounds):
            result = self.model.chat(full_messages)

            tool_call = self._detect_tool_call(result)
            if tool_call:
                full_messages.append({"role": "assistant", "content": result})
                full_messages.append({
                    "role": "tool",
                    "content": str(execute_tool(tool_call["tool"], tool_call["args"])),
                })
                continue

            return result
        return "已到达工具调用上限，请简化请求。"

async def run_stream(self, messages: list[dict]) -> AsyncGenerator[dict, None]:
        """流式运行 agent，逐 token 产出事件。

        事件类型:
        - {"type": "token", "content": "..."}  — 文本 token
        - {"type": "clear"}                    — 清除当前内容（工具调用前）
        - {"type": "tool", "tool": "..."}      — 工具调用开始
        - {"type": "done", "content": "..."}   — 完成
        """
        skill_context = ""
        if self.skill_engine:
            # 多模态消息的 content 是 list，需先提取纯文本
            skill_context = self.skill_engine.match_skill(_extract_text(messages[-1]["content"]))

        system_prompt = self.build_system_prompt(skill_context)
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        for _ in range(self.max_tool_rounds):
            accumulated = ""
            async for token in self.model.chat_stream(full_messages):
                accumulated += token
                yield {"type": "token", "content": token}

            # 检查是否为工具调用
            json_match = re.search(r'\{"tool":\s*"[^"]+"', accumulated)
            if json_match:
                try:
                    start = json_match.start()
                    end = accumulated.index("}", start) + 1
                    tool_call = json.loads(accumulated[start:end])
                    if "tool" in tool_call and "args" in tool_call:
                        # 通知前端清除已显示的工具调用 JSON
                        yield {"type": "clear"}
                        yield {"type": "tool", "tool": tool_call["tool"]}

                        tool_result = execute_tool(tool_call["tool"], tool_call["args"])
                        full_messages.append({"role": "assistant", "content": accumulated})
                        full_messages.append({"role": "tool", "content": str(tool_result)})
                        continue
                except (json.JSONDecodeError, ValueError):
                    pass

            yield {"type": "done", "content": accumulated}
            return

        yield {"type": "done", "content": "已到达工具调用上限，请简化请求。"}
