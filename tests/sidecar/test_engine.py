import tempfile
from pathlib import Path
from engine import SkillEngine


def test_parse_skill():
    content = """# skill: document-processor
## Description
处理和分析文档文件

## Instructions
1. 用 parse_document 工具读取文件
2. 输出结构化摘要
"""
    engine = SkillEngine(skills_dir="/tmp/nonexistent")
    skill = engine._parse_skill(content)
    assert skill is not None
    assert skill.name == "document-processor"
    assert "处理和分析文档文件" in skill.description
    assert "parse_document" in skill.instructions


def test_load_skills_from_dir():
    with tempfile.TemporaryDirectory() as tmp:
        skill_file = Path(tmp) / "test-skill.md"
        skill_file.write_text("""# skill: test-skill
## Description
测试用 skill

## Instructions
做测试
""")

        engine = SkillEngine(skills_dir=tmp)
        assert len(engine.skills) == 1
        assert engine.skills[0].name == "test-skill"


def test_match_skill():
    with tempfile.TemporaryDirectory() as tmp:
        skill_file = Path(tmp) / "doc.md"
        skill_file.write_text("""# skill: doc-processor
## Description
文档处理 分析 摘要

## Instructions
处理文档步骤...
""")

        engine = SkillEngine(skills_dir=tmp)
        context = engine.match_skill("帮我处理这个文档")
        assert "doc-processor" in context
        assert "处理文档步骤" in context
