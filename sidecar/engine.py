from __future__ import annotations

import os
import re
from pathlib import Path


class Skill:
    def __init__(self, name: str, description: str, instructions: str, tools: list[dict] | None = None):
        self.name = name
        self.description = description
        self.instructions = instructions
        self.tools = tools or []

    def to_context(self) -> str:
        return f"## Skill: {self.name}\n{self.description}\n\n### Instructions\n{self.instructions}"


class SkillEngine:
    def __init__(self, skills_dir: str | None = None):
        self.skills_dir = skills_dir or os.path.expanduser("~/.llm-app/skills")
        self.skills: list[Skill] = []
        self._load_skills()

    def _load_skills(self):
        path = Path(self.skills_dir)
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            return

        for f in path.glob("*.md"):
            content = f.read_text(encoding="utf-8")
            skill = self._parse_skill(content)
            if skill:
                self.skills.append(skill)

    def _parse_skill(self, content: str) -> Skill | None:
        name_match = re.search(r'^#\s*skill:\s*(.+)$', content, re.MULTILINE)
        desc_match = re.search(r'##\s*Description\s*\n(.+)', content)
        instr_match = re.search(r'##\s*Instructions\s*\n(.+?)(?=\n##\s|\Z)', content, re.DOTALL)

        if not name_match:
            return None

        name = name_match.group(1).strip()
        description = desc_match.group(1).strip() if desc_match else ""
        instructions = instr_match.group(1).strip() if instr_match else ""
        return Skill(name, description, instructions)

    def match_skill(self, user_input: str) -> str:
        matches = []
        input_lower = user_input.lower()
        for skill in self.skills:
            if skill.description and self._keywords_match(skill.description, input_lower):
                matches.append(skill)
            elif skill.name.lower() in input_lower:
                matches.append(skill)

        if matches:
            return "\n\n".join(s.to_context() for s in matches[:2])
        return ""

    def _keywords_match(self, description: str, input_lower: str) -> bool:
        for kw in description.lower().split():
            if kw in input_lower:
                return True
            for ch in kw:
                if '\u4e00' <= ch <= '\u9fff' and ch in input_lower:
                    return True
        return False

    def get_skills_list(self) -> list[dict]:
        return [
            {"name": s.name, "description": s.description} for s in self.skills
        ]
