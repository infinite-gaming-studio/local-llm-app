from .file_ops import read_file, write_file
from .code_exec import run_python, run_shell
from .web_tools import web_search, web_fetch
from .media_tools import extract_frames, parse_document

BUILTIN_TOOLS = {
    "read_file": {
        "fn": read_file,
        "schema": {
            "name": "read_file",
            "description": "读取本地文件内容",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"}
                },
                "required": ["path"],
            },
        },
    },
    "write_file": {
        "fn": write_file,
        "schema": {
            "name": "write_file",
            "description": "写入内容到本地文件",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"},
                    "content": {"type": "string", "description": "文件内容"},
                },
                "required": ["path", "content"],
            },
        },
    },
    "run_python": {
        "fn": run_python,
        "schema": {
            "name": "run_python",
            "description": "执行 Python 代码",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python 代码"},
                },
                "required": ["code"],
            },
        },
    },
    "run_shell": {
        "fn": run_shell,
        "schema": {
            "name": "run_shell",
            "description": "执行 Shell 命令",
            "parameters": {
                "type": "object",
                "properties": {
                    "cmd": {"type": "string", "description": "Shell 命令"},
                },
                "required": ["cmd"],
            },
        },
    },
    "web_search": {
        "fn": web_search,
        "schema": {
            "name": "web_search",
            "description": "搜索网页",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                },
                "required": ["query"],
            },
        },
    },
    "web_fetch": {
        "fn": web_fetch,
        "schema": {
            "name": "web_fetch",
            "description": "抓取网页内容",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "网页 URL"},
                },
                "required": ["url"],
            },
        },
    },
    "extract_frames": {
        "fn": extract_frames,
        "schema": {
            "name": "extract_frames",
            "description": "从视频中提取关键帧",
            "parameters": {
                "type": "object",
                "properties": {
                    "video_path": {"type": "string", "description": "视频文件路径"},
                    "max_frames": {"type": "integer", "description": "最大帧数"},
                },
                "required": ["video_path"],
            },
        },
    },
    "parse_document": {
        "fn": parse_document,
        "schema": {
            "name": "parse_document",
            "description": "解析文档内容 (PDF/Word/Excel)",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文档路径"},
                },
                "required": ["path"],
            },
        },
    },
}


def get_tool_schemas() -> list[dict]:
    return [t["schema"] for t in BUILTIN_TOOLS.values()]


def execute_tool(name: str, args: dict) -> str:
    tool = BUILTIN_TOOLS.get(name)
    if tool is None:
        raise ValueError(f"unknown tool: {name}")
    return tool["fn"](**args)
