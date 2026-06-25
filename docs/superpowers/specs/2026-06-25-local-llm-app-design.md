# Local LLM App — 设计文档

## 概述

一个基于本地大模型的桌面应用，集成 llm 推理、多模态理解、Agent 自动化和 Skills 系统，定位为专业工作流工具。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 桌面壳 | Electron | 跨平台 (macOS/Windows/Linux) |
| 渲染进程 | React + TypeScript | UI 层 |
| 主进程 | TypeScript (Node.js) | IPC 桥接、窗口管理、屏幕捕获 |
| 推理后端 | Python (FastAPI) | 侧车进程，独立生命周期 |
| LLM 引擎 | llama-cpp-python | 内嵌推理，不依赖外部服务 |
| 通信 | HTTP + WebSocket | localhost 随机端口 |

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                     Electron App                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Renderer Process (React)                             │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │    │
│  │  │ Chat     │ │ Settings │ │ Skill Manager UI     │ │    │
│  │  │ (文本/图) │ │ (模型切  │ │ (浏览/管理 skills)  │ │    │
│  │  │          │ │ 换/配置) │ │                      │ │    │
│  │  └────┬─────┘ └──────────┘ └──────────────────────┘ │    │
│  └───────┼──────────────────────────────────────────────┘    │
│  ┌───────┼──────────────────────────────────────────────┐    │
│  │  Main Process                                         │    │
│  │  ├── SidecarManager: 启动/监控/重启 Python 侧车        │    │
│  │  ├── WindowManager: 窗口/原生菜单/系统托盘              │    │
│  │  ├── ScreenCapture: 桌面录屏 (desktopCapturer)         │    │
│  │  └── IPC Bridge: contextBridge 暴露安全 API            │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP + WebSocket (localhost:随机端口)
┌──────────────────────────┴───────────────────────────────────┐
│                   Python Sidecar                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  FastAPI Routes                                       │    │
│  │  POST /chat         → 统一聊天入口(文本/图/视频帧)    │    │
│  │  WS  /chat/stream   → 流式输出                       │    │
│  │  POST /model/load   → 加载/切换模型                   │    │
│  │  POST /model/unload → 卸载模型                        │    │
│  │  GET  /model/status → 当前模型信息                    │    │
│  │  POST /embed        → 文本向量化                      │    │
│  │  POST /agent/exec   → 执行 Agent 任务                 │    │
│  │  POST /tools/*      → 独立工具调用                     │    │
│  │  GET  /skills       → 获取可用 skill 列表              │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  ModelManager                                          │    │
│  │  一次只加载一个 VL 模型，用户可手动切换                 │    │
│  │  ├── load(path, ctx_size, gpu_layers)                  │    │
│  │  ├── unload()                                          │    │
│  │  ├── chat(messages, stream) → 流式/非流式              │    │
│  │  └── embed(text) → vector                             │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  AgentOrchestrator                                     │    │
│  │  1. 接收用户消息 + 对话历史                             │    │
│  │  2. 解析当前会话绑定的 skill，注入 system prompt        │    │
│  │  3. 调用 LLM (含可用工具列表)                           │    │
│  │  4. LLM 返回文本 / 工具调用请求                         │    │
│  │  5. 工具调用 → 执行 → 结果送回 LLM                     │    │
│  │  6. 循环直到 LLM 返回最终回复                           │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  SkillEngine                                           │    │
│  │  ├── 从 ~/.llm-app/skills/ 加载所有 .md 文件            │    │
│  │  ├── 解析 frontmatter (name, description, tools)        │    │
│  │  ├── Agent 自动匹配当前任务适合的 skill                  │    │
│  │  └── 按需将 skill 指令注入 LLM context                  │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  Tools                                                  │    │
│  │  ├── built-in: read/write file, run python, run shell,  │    │
│  │  │   web search, web fetch, extract frames, parse doc   │    │
│  │  └── skill-defined: 由 Skill 注册的扩展工具              │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 模型管理

### 一次一个 VL 模型

不支持多模型并发。用户通过 Settings 手动切换模型：

```
用户选模型 → POST /model/load → 卸载旧模型 → 加载新 GGUF → 返回状态
```

### 默认推荐模型 (2026 年 6 月)

| 硬件 | 推荐模型 | 显存 | 说明 |
|---|---|---|---|
| 8GB | Gemma 4 E4B | ~5GB | 原生多模态(文本+图像+音频+视频)，Apache 2.0 |
| 16GB | Gemma 4 12B Unified | ~8GB | 无独立编码器，原生多模态，256K context |
| 24GB | Gemma 4 26B-A4B MoE | ~16GB | 4B active/token，质量速度平衡 |
| 32GB+ | Qwen 3.6-27B Dense | ~17GB | 本地 VL SOTA，视觉内建 |

模型下载：首次使用时从 HuggingFace/镜像站下载 GGUF，保存到 `~/.llm-app/models/`。

## 多模态能力

### 图像理解
- 用户拖拽/粘贴图片到聊天
- 图片压缩后 base64 传给 Python 侧车
- VL 模型直接理解图像内容

### 视频分析
- 支持视频文件上传
- Python 侧车用 ffmpeg 按帧率抽关键帧
- 将帧序列作为多图输入给 VL 模型

### 屏幕实时分析
- Electron `desktopCapturer` 定时截屏
- 帧发送到 Python 侧车
- 支持问"当前屏幕上是什么"或持续监控变化

## Agent 与工具

### 工作流程

```
User Input → LLM 判断是否需要工具 → 需要 → Tool Registry → 执行工具 → 结果送回 LLM → 最终回复
                                   → 不需要 → 直接回复
```

### 内置工具

| 工具 | 说明 | 安全措施 |
|---|---|---|
| read_file | 读取本地文件 | 限定 ~/.llm-app/ 目录 |
| write_file | 写入本地文件 | 限定 ~/.llm-app/ 目录 |
| run_python | 执行 Python 代码 | subprocess 隔离，timeout 30s，资源限制 |
| run_shell | 执行 Shell 命令 | 白名单命令，禁止危险操作 |
| web_search | 网络搜索 | 调用搜索 API |
| web_fetch | 抓取网页内容 | timeout 限制 |
| extract_frames | 视频抽帧 | 调用 ffmpeg |
| parse_document | 解析文档(PDF/Word/Excel) | 只读解析 |

## Skills 系统

### 存储位置

```
~/.llm-app/skills/
├── document-processor.md
├── video-analyzer.md
└── code-reviewer.md
```

### Skill 格式

```markdown
# skill: document-processor
## Description
处理和分析文档文件（PDF、Word、Excel）

## Instructions
当你需要处理文档时，按以下步骤：
1. 用 parse_document 工具读取文件内容
2. 根据用户需求提取关键信息
3. 输出结构化摘要

## Tools
(可选：此 skill 需要注册的额外工具)
```

### 工作方式

- 所有 skill 文件在 Python 侧车启动时加载到 SkillEngine
- Agent 根据用户输入自动判断适合的 skill
- 匹配的 skill 指令动态注入到 LLM system prompt
- 用户可手动指定："用 xxx skill 来做"
- 每个对话 session 可绑定不同 skill 组合

## 通信协议

### HTTP API (请求-响应)

```
POST /chat
Body: {
  messages: [{role, content}],
  stream: false
}
Response: {message: {role, content}}
```

### WebSocket (流式)

```
WS /chat/stream
→ {messages: [{role, content}]}
← {token: "..."}
← {token: "..."}
← {done: true, full_content: "..."}
```

## 项目结构

```
local-llm-app/
├── electron/              # Electron 主进程
│   ├── main.ts            # 入口
│   ├── sidecar.ts         # SidecarManager
│   ├── screen-capture.ts  # 屏幕捕获
│   └── preload.ts         # IPC bridge
├── src/                   # React 渲染进程
│   ├── App.tsx
│   ├── components/
│   │   ├── ChatView.tsx
│   │   ├── MessageList.tsx
│   │   ├── InputBox.tsx
│   │   ├── MediaPreview.tsx
│   │   └── ScreenShare.tsx
│   ├── pages/
│   │   ├── Chat.tsx
│   │   ├── Settings.tsx
│   │   └── Skills.tsx
│   └── hooks/
│       └── useChat.ts
├── sidecar/               # Python 侧车
│   ├── main.py            # FastAPI 入口
│   ├── model_manager.py   # 模型管理
│   ├── agent.py           # AgentOrchestrator
│   ├── engine.py          # SkillEngine
│   ├── tools/             # 工具实现
│   │   ├── file_ops.py
│   │   ├── code_exec.py
│   │   ├── web_tools.py
│   │   └── media_tools.py
│   └── requirements.txt
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.yml
```

## 生命周期

### 应用启动
1. Electron 启动 → 创建窗口
2. Main Process 启动 Python 侧车 (subprocess)
3. 侧车启动 FastAPI，选择随机空闲端口
4. 侧车输出端口号到 stdout
5. Main Process 读取端口，进行健康检查
6. 侧车加载默认模型
7. App 就绪

### 应用退出
1. Electron 窗口关闭
2. Main Process 发送 SIGTERM 给侧车
3. 等待侧车退出 (timeout 5s)
4. 强制 SIGKILL 如果未退出
5. 退出 Electron

### 侧车崩溃
1. Main Process 检测到子进程退出
2. 自动重启侧车 (最多 3 次)
3. 重启后重新加载模型
4. UI 显示重连状态

## 安全

### 工具执行沙箱
- run_python: 隔离 subprocess, timeout, 内存限制, 禁止危险 import
- run_shell: 白名单命令, 禁止危险操作 (rm -rf, sudo 等)
- 文件操作: 限定在 ~/.llm-app/workspace/ 目录内
- 网络请求: timeout 限制, 禁止内网扫描

### 模型安全
- 仅支持 GGUF 格式
- 模型文件校验 (SHA256)
- 用户确认后下载
