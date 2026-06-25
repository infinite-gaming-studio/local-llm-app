from __future__ import annotations

import json
import re
from typing import AsyncGenerator
from tools import get_tool_schemas, execute_tool


SYSTEM_PROMPT_BASE = """你是一个有用的 AI 助手。你可以使用以下工具来帮助用户完成任务：
{tool_descriptions}

当你需要使用工具时，请以 JSON 格式返回：
{{"tool": "tool_name", "args": {{"key": "value"}}}}

在得到工具执行结果后，请基于结果给出最终回复。"""


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

    def run(self, messages: list[dict], stream: bool = False):
        skill_context = ""
        if self.skill_engine:
            skill_context = self.skill_engine.match_skill(messages[-1]["content"])

        system_prompt = self.build_system_prompt(skill_context)
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        for _ in range(self.max_tool_rounds):
            result = self.model.chat(full_messages)

            json_match = re.search(r'\{"tool":\s*"[^"]+"', result)
            if json_match:
                try:
                    start = json_match.start()
                    end = result.index("}", start) + 1
                    tool_call = json.loads(result[start:end])
                    if "tool" in tool_call and "args" in tool_call:
                        tool_result = execute_tool(tool_call["tool"], tool_call["args"])
                        full_messages.append({"role": "assistant", "content": result})
                        full_messages.append({
                            "role": "tool",
                            "content": str(tool_result),
                        })
                        continue
                except (json.JSONDecodeError, ValueError) as e:
                    full_messages.append({
                        "role": "assistant",
                        "content": result,
                    })
                    return result

            return result
        return "已到达工具调用上限，请简化请求。"
