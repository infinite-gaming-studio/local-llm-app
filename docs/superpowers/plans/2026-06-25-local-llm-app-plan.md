# Local LLM App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build a desktop app with bundled local LLM inference, multimodal (image/video/screen) understanding, Agent with tool calling, and Markdown-based Skills system.

**Architecture:** Electron (React/TypeScript) for UI + Python sidecar (FastAPI/llama-cpp-python) for LLM inference and Agent orchestration. Communication via localhost HTTP/WebSocket.

**Tech Stack:** Electron, React 19, TypeScript, Vite, Python 3.12, FastAPI, llama-cpp-python, ffmpeg

---

## File Structure

```
local-llm-app/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── electron-builder.yml
├── index.html
├── electron/
│   ├── main.ts              # Electron 入口，窗口管理
│   ├── preload.ts            # contextBridge API
│   └── sidecar.ts            # SidecarManager
├── src/
│   ├── main.tsx              # React 入口
│   ├── App.tsx               # 路由/布局
│   ├── api.ts                # HTTP/WS 客户端
│   ├── components/
│   │   ├── ChatView.tsx
│   │   ├── MessageList.tsx
│   │   ├── InputBox.tsx
│   │   └── MediaPreview.tsx
│   ├── pages/
│   │   ├── Chat.tsx
│   │   ├── Settings.tsx
│   │   └── Skills.tsx
│   └── hooks/
│       └── useChat.ts
├── sidecar/
│   ├── requirements.txt
│   ├── main.py               # FastAPI 入口
│   ├── model_manager.py       # 模型加载/推理
│   ├── agent.py               # AgentOrchestrator
│   ├── engine.py              # SkillEngine
│   └── tools/
│       ├── __init__.py
│       ├── file_ops.py
│       ├── code_exec.py
│       ├── web_tools.py
│       └── media_tools.py
└── tests/
    └── sidecar/
        ├── test_model_manager.py
        ├── test_agent.py
        └── test_engine.py
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `electron-builder.yml`
- Create: `index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "local-llm-app",
  "version": "0.1.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "electron": "^34.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.2.0",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "electron"]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["vite.config.ts", "electron-builder.yml"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: { outDir: 'dist-electron' },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
      },
    ]),
    renderer(),
  ],
})
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Local LLM App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 6: Create electron-builder.yml**

```yaml
appId: com.local-llm.app
productName: Local LLM App
directories:
  buildResources: resources
  output: release
files:
  - dist
  - dist-electron
  - sidecar/**/*

extraResources:
  - from: sidecar/
    to: sidecar/
    filter:
      - "**/*"
      - "!__pycache__/**"

mac:
  target: [dmg, zip]
  icon: resources/icon.png

win:
  target: [nsis]
  icon: resources/icon.png

linux:
  target: [AppImage, deb]
  icon: resources/icon.png
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: node_modules created, no errors

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html electron-builder.yml
git commit -m "feat: project scaffold"
```

---

### Task 2: Python Sidecar — FastAPI Server

**Files:**
- Create: `sidecar/requirements.txt`
- Create: `sidecar/main.py`

- [ ] **Step 1: Create sidecar/requirements.txt**

```
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
llama-cpp-python>=0.3.0
pydantic>=2.0.0
httpx>=0.28.0
aiofiles>=24.0.0
pdfplumber>=0.11.0
python-docx>=1.1.0
openpyxl>=3.1.0
```

- [ ] **Step 2: Create sidecar/main.py**

```python
import asyncio
import json
import sys
import socket
import signal

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ChatRequest(BaseModel):
    messages: list[dict]
    stream: bool = False


class ModelLoadRequest(BaseModel):
    path: str
    ctx_size: int = 32768
    gpu_layers: int = -1


app_state = {
    "model": None,
    "model_loaded": False,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("SIDECAR_READY", flush=True)
    yield
    if app_state["model"] is not None:
        app_state["model"].unload()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": app_state["model_loaded"]}


@app.post("/model/load")
async def load_model(req: ModelLoadRequest):
    from model_manager import ModelManager

    if app_state["model"] is not None:
        app_state["model"].unload()
        app_state["model"] = None

    manager = ModelManager(req.path, ctx_size=req.ctx_size, gpu_layers=req.gpu_layers)
    manager.load()
    app_state["model"] = manager
    app_state["model_loaded"] = True
    return {"status": "loaded", "model": req.path}


@app.post("/model/unload")
async def unload_model():
    if app_state["model"] is not None:
        app_state["model"].unload()
        app_state["model"] = None
        app_state["model_loaded"] = False
    return {"status": "unloaded"}


@app.get("/model/status")
async def model_status():
    if app_state["model"] is not None:
        return {
            "loaded": True,
            "path": app_state["model"].path,
            "ctx_size": app_state["model"].ctx_size,
        }
    return {"loaded": False}


@app.post("/chat")
async def chat(req: ChatRequest):
    if app_state["model"] is None:
        return JSONResponse({"error": "no model loaded"}, status_code=400)

    result = app_state["model"].chat(req.messages)
    return {"message": {"role": "assistant", "content": result}}


@app.websocket("/chat/stream")
async def chat_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        req = json.loads(data)
        messages = req.get("messages", [])

        if app_state["model"] is None:
            await websocket.send_json({"error": "no model loaded"})
            await websocket.close()
            return

        full_content = ""
        async for token in app_state["model"].chat_stream(messages):
            full_content += token
            await websocket.send_json({"token": token})

        await websocket.send_json({"done": True, "full_content": full_content})
        await websocket.close()
    except WebSocketDisconnect:
        pass


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    import uvicorn

    port = find_free_port()
    with open(sys.argv[1], "w") as f:
        f.write(str(port))

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
```

- [ ] **Step 3: Commit**

```bash
git add sidecar/requirements.txt sidecar/main.py
git commit -m "feat: python sidecar fastapi server"
```

---

### Task 3: Python Sidecar — ModelManager

**Files:**
- Create: `sidecar/model_manager.py`
- Create: `tests/sidecar/test_model_manager.py`

- [ ] **Step 1: Create sidecar/model_manager.py**

```python
from __future__ import annotations

from typing import AsyncGenerator
from llama_cpp import Llama


class ModelManager:
    def __init__(self, path: str, ctx_size: int = 32768, gpu_layers: int = -1):
        self.path = path
        self.ctx_size = ctx_size
        self.gpu_layers = gpu_layers
        self._model: Llama | None = None

    def load(self):
        self._model = Llama(
            model_path=self.path,
            n_ctx=self.ctx_size,
            n_gpu_layers=self.gpu_layers,
            verbose=False,
        )

    def unload(self):
        if self._model is not None:
            del self._model
            self._model = None

    def chat(self, messages: list[dict]) -> str:
        if self._model is None:
            raise RuntimeError("model not loaded")

        result = self._model.create_chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        return result["choices"][0]["message"]["content"]

    async def chat_stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        if self._model is None:
            raise RuntimeError("model not loaded")

        result = self._model.create_chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            stream=True,
        )

        for chunk in result:
            delta = chunk["choices"][0]["delta"]
            if "content" in delta:
                yield delta["content"]
```

- [ ] **Step 2: Create tests/sidecar/test_model_manager.py**

```python
import pytest
from sidecar.model_manager import ModelManager


def test_model_manager_init():
    mm = ModelManager(path="/fake/model.gguf", ctx_size=4096, gpu_layers=0)
    assert mm.path == "/fake/model.gguf"
    assert mm.ctx_size == 4096
    assert mm.gpu_layers == 0
    assert mm._model is None


def test_chat_without_load_raises():
    mm = ModelManager("/fake.gguf")
    with pytest.raises(RuntimeError, match="model not loaded"):
        mm.chat([{"role": "user", "content": "hi"}])
```

- [ ] **Step 3: Install Python deps**

Run: `pip install -r sidecar/requirements.txt`
Expected: packages installed

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/sidecar/test_model_manager.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add sidecar/model_manager.py tests/sidecar/test_model_manager.py
git commit -m "feat: model manager with llama-cpp-python"
```

---

### Task 4: Electron — Main Process + Preload

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/sidecar.ts`

- [ ] **Step 1: Create electron/sidecar.ts**

```ts
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

export class SidecarManager {
  private process: ChildProcess | null = null
  private port: number = 0
  private restartCount = 0
  private maxRestarts = 3

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null
  }

  async start(): Promise<number> {
    const portFile = path.join(app.getPath('userData'), 'sidecar-port.txt')
    const sidecarDir = app.isPackaged
      ? path.join(process.resourcesPath, 'sidecar')
      : path.join(__dirname, '..', 'sidecar')

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

    this.process = spawn(pythonCmd, ['main.py', portFile], {
      cwd: sidecarDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      console.log('[sidecar]', line)
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[sidecar:err]', data.toString().trim())
    })

    this.process.on('exit', (code) => {
      console.log(`[sidecar] exited with code ${code}`)
      this.process = null
      if (this.restartCount < this.maxRestarts) {
        this.restartCount++
        this.start()
      }
    })

    await this.waitForReady(portFile)
    return this.port
  }

  private async waitForReady(portFile: string, timeoutMs = 30000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const content = require('fs').readFileSync(portFile, 'utf-8').trim()
        this.port = parseInt(content, 10)
        if (!isNaN(this.port)) {
          await this.healthCheck()
          return
        }
      } catch {
        // file not ready yet
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('Sidecar did not start in time')
  }

  private async healthCheck(): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < 10000) {
      try {
        const res = await fetch(`${this.baseUrl}/health`)
        if (res.ok) return
      } catch {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    throw new Error('Sidecar health check failed')
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process) this.process.kill('SIGKILL')
      }, 5000)
    }
  }
}
```

- [ ] **Step 2: Create electron/preload.ts**

```ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  chat: (messages: unknown[]) => ipcRenderer.invoke('chat', messages),
  chatStream: (messages: unknown[], onToken: (t: string) => void, onDone: (c: string) => void) => {
    const tokenHandler = (_event: Electron.IpcRendererEvent, token: string) => onToken(token)
    const doneHandler = (_event: Electron.IpcRendererEvent, content: string) => onDone(content)

    ipcRenderer.on('chat:token', tokenHandler)
    ipcRenderer.on('chat:done', doneHandler)
    ipcRenderer.send('chat:start', messages)

    return () => {
      ipcRenderer.removeListener('chat:token', tokenHandler)
      ipcRenderer.removeListener('chat:done', doneHandler)
    }
  },
  loadModel: (path: string) => ipcRenderer.invoke('model:load', path),
  unloadModel: () => ipcRenderer.invoke('model:unload'),
  getModelStatus: () => ipcRenderer.invoke('model:status'),
  getHealth: () => ipcRenderer.invoke('sidecar:health'),
  startScreenCapture: () => ipcRenderer.invoke('screen:start'),
  stopScreenCapture: () => ipcRenderer.invoke('screen:stop'),
  getScreenFrame: () => ipcRenderer.invoke('screen:frame'),
}

contextBridge.exposeInMainWorld('llmApp', api)
```

- [ ] **Step 3: Create electron/main.ts**

```ts
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { SidecarManager } from './sidecar'

let mainWindow: BrowserWindow | null = null
const sidecar = new SidecarManager()

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

async function setupIPC() {
  ipcMain.handle('sidecar:health', async () => {
    const res = await fetch(`${sidecar.baseUrl}/health`)
    return res.json()
  })

  ipcMain.handle('model:load', async (_event, modelPath: string) => {
    const res = await fetch(`${sidecar.baseUrl}/model/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: modelPath }),
    })
    return res.json()
  })

  ipcMain.handle('model:unload', async () => {
    const res = await fetch(`${sidecar.baseUrl}/model/unload`, { method: 'POST' })
    return res.json()
  })

  ipcMain.handle('model:status', async () => {
    const res = await fetch(`${sidecar.baseUrl}/model/status`)
    return res.json()
  })

  ipcMain.handle('chat', async (_event, messages: unknown[]) => {
    const res = await fetch(`${sidecar.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream: false }),
    })
    const data = await res.json()
    return data.message.content
  })

  ipcMain.on('chat:start', async (_event, messages: unknown[]) => {
    const ws = new WebSocket(`ws://127.0.0.1:${(sidecar as any).port}/chat/stream`)

    ws.onopen = () => {
      ws.send(JSON.stringify({ messages }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.token) {
        mainWindow?.webContents.send('chat:token', data.token)
      }
      if (data.done) {
        mainWindow?.webContents.send('chat:done', data.full_content)
        ws.close()
      }
    }
  })
}

app.whenReady().then(async () => {
  try {
    await sidecar.start()
    console.log(`Sidecar started on port ${(sidecar as any).port}`)
  } catch (err) {
    console.error('Failed to start sidecar:', err)
  }

  await setupIPC()
  await createWindow()
})

app.on('window-all-closed', () => {
  sidecar.stop()
  app.quit()
})
```

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/preload.ts electron/sidecar.ts
git commit -m "feat: electron main process with sidecar manager"
```

---

### Task 5: React UI — Chat Page

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/api.ts`
- Create: `src/hooks/useChat.ts`
- Create: `src/components/InputBox.tsx`
- Create: `src/components/MessageList.tsx`
- Create: `src/components/ChatView.tsx`
- Create: `src/pages/Chat.tsx`

- [ ] **Step 1: Create src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 2: Create src/api.ts**

```ts
declare global {
  interface Window {
    llmApp: {
      chat: (messages: unknown[]) => Promise<string>
      chatStream: (
        messages: unknown[],
        onToken: (t: string) => void,
        onDone: (c: string) => void
      ) => () => void
      loadModel: (path: string) => Promise<{ status: string }>
      unloadModel: () => Promise<{ status: string }>
      getModelStatus: () => Promise<{ loaded: boolean; path?: string }>
      getHealth: () => Promise<{ status: string }>
      startScreenCapture: () => Promise<void>
      stopScreenCapture: () => Promise<void>
      getScreenFrame: () => Promise<string>
    }
  }
}

export const api = window.llmApp
```

- [ ] **Step 3: Create src/hooks/useChat.ts**

```ts
import { useState, useCallback, useRef } from 'react'
import { api } from '../api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const sendMessage = useCallback(async (text: string, images?: string[]) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      images,
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const chatMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.images
        ? [{ type: 'image_url', image_url: { url: m.images[0] } }, { type: 'text', text: m.content }]
        : m.content,
    }))

    const cleanup = api.chatStream(
      chatMessages,
      (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
        )
      },
      (_fullContent) => {
        setStreaming(false)
      }
    )

    cleanupRef.current = cleanup
  }, [messages])

  const stopStreaming = useCallback(() => {
    cleanupRef.current?.()
    setStreaming(false)
  }, [])

  return { messages, streaming, sendMessage, stopStreaming }
}
```

- [ ] **Step 4: Create src/components/InputBox.tsx**

```tsx
import { useState, useRef } from 'react'

interface InputBoxProps {
  onSend: (text: string, images?: string[]) => void
  disabled: boolean
}

export function InputBox({ onSend, disabled }: InputBoxProps) {
  const [text, setText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        borderTop: '1px solid #e0e0e0',
        padding: '12px 16px',
        background: dragOver ? '#f0f7ff' : '#fff',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files)
        const reader = new FileReader()
        reader.onload = () => onSend('', [reader.result as string])
        files.forEach((f) => reader.readAsDataURL(f))
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              const reader = new FileReader()
              reader.onload = () => onSend('', [reader.result as string])
              reader.readAsDataURL(file)
            }
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '8px 12px', cursor: 'pointer' }}
          disabled={disabled}
        >
          📷
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          rows={1}
          disabled={disabled}
          style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #ccc', resize: 'none' }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          {disabled ? '思考中...' : '发送'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create src/components/MessageList.tsx**

```tsx
import { useEffect, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

interface MessageListProps {
  messages: Message[]
  streaming: boolean
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontWeight: 400 }}>Local LLM App</h2>
          <p>发送消息开始对话，或拖拽图片进行分析</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            marginBottom: 16,
            textAlign: msg.role === 'user' ? 'right' : 'left',
          }}
        >
          {msg.images?.map((img, i) => (
            <img key={i} src={img} alt="upload" style={{ maxWidth: 240, maxHeight: 240, borderRadius: 8, marginBottom: 4 }} />
          ))}
          <div
            style={{
              display: 'inline-block',
              padding: '10px 14px',
              borderRadius: 12,
              background: msg.role === 'user' ? '#007aff' : '#f0f0f0',
              color: msg.role === 'user' ? '#fff' : '#000',
              maxWidth: '70%',
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.content}
            {streaming && msg === messages[messages.length - 1] && msg.role === 'assistant' && (
              <span style={{ animation: 'blink 1s infinite' }}>▍</span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 6: Create src/components/ChatView.tsx**

```tsx
import { InputBox } from './InputBox'
import { MessageList } from './MessageList'
import { useChat } from '../hooks/useChat'

interface ChatViewProps {
  messages: ReturnType<typeof useChat>['messages']
  streaming: boolean
  onSend: ReturnType<typeof useChat>['sendMessage']
  onStop: ReturnType<typeof useChat>['stopStreaming']
}

export function ChatView({ messages, streaming, onSend, onStop }: ChatViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MessageList messages={messages} streaming={streaming} />
      {streaming && (
        <div style={{ textAlign: 'center', padding: 4 }}>
          <button onClick={onStop} style={{ cursor: 'pointer', fontSize: 12 }}>停止生成</button>
        </div>
      )}
      <InputBox onSend={onSend} disabled={streaming} />
    </div>
  )
}
```

- [ ] **Step 7: Create src/App.tsx**

```tsx
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Chat } from './pages/Chat'
import { Settings } from './pages/Settings'
import { Skills } from './pages/Skills'

export default function App() {
  return (
    <HashRouter>
      <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, sans-serif' }}>
        <nav style={{ width: 200, borderRight: '1px solid #e0e0e0', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ fontSize: 18, margin: '0 0 16px' }}>Local LLM</h1>
          <NavLink to="/" style={navStyle}>💬 对话</NavLink>
          <NavLink to="/settings" style={navStyle}>⚙️ 设置</NavLink>
          <NavLink to="/skills" style={navStyle}>🧩 Skills</NavLink>
        </nav>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/skills" element={<Skills />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

const navStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#333',
  padding: '8px 12px',
  borderRadius: 6,
}
```

- [ ] **Step 8: Create src/pages/Chat.tsx**

```tsx
import { useChat } from '../hooks/useChat'
import { ChatView } from '../components/ChatView'

export function Chat() {
  const { messages, streaming, sendMessage, stopStreaming } = useChat()

  return (
    <ChatView
      messages={messages}
      streaming={streaming}
      onSend={sendMessage}
      onStop={stopStreaming}
    />
  )
}
```

- [ ] **Step 9: Create src/pages/Settings.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api'

export function Settings() {
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; path?: string }>({ loaded: false })
  const [modelPath, setModelPath] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getModelStatus().then(setModelStatus)
  }, [])

  const handleLoad = async () => {
    if (!modelPath.trim()) return
    setLoading(true)
    await api.loadModel(modelPath.trim())
    const status = await api.getModelStatus()
    setModelStatus(status)
    setLoading(false)
  }

  const handleUnload = async () => {
    setLoading(true)
    await api.unloadModel()
    setModelStatus({ loaded: false })
    setLoading(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2>模型设置</h2>
      <div style={{ marginBottom: 16 }}>
        <p>状态: {modelStatus.loaded ? '已加载' : '未加载'}</p>
        {modelStatus.path && <p style={{ fontSize: 12, color: '#666' }}>路径: {modelStatus.path}</p>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={modelPath}
          onChange={(e) => setModelPath(e.target.value)}
          placeholder="模型 GGUF 文件路径"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button onClick={handleLoad} disabled={loading || !modelPath.trim()} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          {loading ? '加载中...' : '加载模型'}
        </button>
      </div>
      {modelStatus.loaded && (
        <button onClick={handleUnload} disabled={loading} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          卸载模型
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 10: Create src/pages/Skills.tsx**

```tsx
export function Skills() {
  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2>Skills</h2>
      <p>可在此查看和管理已加载的 skill 文件。</p>
    </div>
  )
}
```

- [ ] **Step 11: Verify build**

Run: `npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 12: Commit**

```bash
git add src/ electron/ package.json index.html tsconfig.json vite.config.ts
git commit -m "feat: react chat ui with electron integration"
```

---

### Task 6: Python Sidecar — Tool Registry

**Files:**
- Create: `sidecar/tools/__init__.py`
- Create: `sidecar/tools/file_ops.py`
- Create: `sidecar/tools/code_exec.py`
- Create: `sidecar/tools/web_tools.py`
- Create: `sidecar/tools/media_tools.py`

- [ ] **Step 1: Create sidecar/tools/__init__.py**

```python
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
                    "max_frames": {"type": "integer", "description": "最大帧数", "default": 5},
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
```

- [ ] **Step 2: Create sidecar/tools/file_ops.py**

```python
import os

WORKSPACE_DIR = os.path.expanduser("~/.llm-app/workspace")


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
```

- [ ] **Step 3: Create sidecar/tools/code_exec.py**

```python
import subprocess
import resource
import tempfile
import os


def run_python(code: str, timeout: int = 30) -> str:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        f.flush()
        try:
            result = subprocess.run(
                ["python3", f.name],
                capture_output=True,
                text=True,
                timeout=timeout,
                env={**os.environ, "PYTHONPATH": ""},
            )
            if result.returncode == 0:
                return result.stdout or "(no output)"
            else:
                return f"Error:\n{result.stderr}"
        except subprocess.TimeoutExpired:
            return "Error: execution timed out"
        finally:
            os.unlink(f.name)


def run_shell(cmd: str, timeout: int = 30) -> str:
    DENIED = ["rm -rf", "sudo", "mkfs", "dd", ":(){ :|:& };:"]
    for dangerous in DENIED:
        if dangerous in cmd:
            return f"Error: command denied (matches dangerous pattern: {dangerous})"

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.stdout or result.stderr or "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: command timed out"
```

- [ ] **Step 4: Create sidecar/tools/web_tools.py**

```python
import httpx


def web_search(query: str) -> str:
    return f"[web search] query: {query} (requires search API key)"


def web_fetch(url: str, timeout: int = 15) -> str:
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True)
        resp.raise_for_status()
        text = resp.text
        return text[:10000] + ("..." if len(text) > 10000 else "")
    except httpx.HTTPError as e:
        return f"Error fetching URL: {e}"
```

- [ ] **Step 5: Create sidecar/tools/media_tools.py**

```python
import subprocess
import tempfile
import os
import json


def extract_frames(video_path: str, max_frames: int = 5) -> list[str]:
    if not os.path.exists(video_path):
        return [f"Error: file not found: {video_path}"]

    frames = []
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "json", video_path,
            ],
            capture_output=True, text=True, timeout=10,
        )
        info = json.loads(result.stdout)
        duration = float(info["format"]["duration"])
        interval = duration / (max_frames + 1)

        for i in range(max_frames):
            timestamp = interval * (i + 1)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-ss", str(timestamp),
                        "-i", video_path,
                        "-vframes", "1",
                        "-q:v", "2",
                        tmp.name,
                    ],
                    capture_output=True, text=True, timeout=30,
                )
                with open(tmp.name, "rb") as f:
                    import base64
                    frames.append(base64.b64encode(f.read()).decode())
                os.unlink(tmp.name)

        return frames
    except Exception as e:
        return [f"Error extracting frames: {e}"]


def parse_document(path: str) -> str:
    if not os.path.exists(path):
        return f"Error: file not found: {path}"

    ext = os.path.splitext(path)[1].lower()

    if ext == ".txt":
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    ext_map = {
        ".pdf": "pdf",
        ".docx": "docx",
        ".xlsx": "xlsx",
        ".csv": "csv",
    }
    format_type = ext_map.get(ext, ext)

    if format_type in ("pdf", "docx", "xlsx"):
        try:
            result = subprocess.run(
                ["python3", "-c", f"""
import sys
ext = '{format_type}'
path = '{path}'
if ext == 'pdf':
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        print('\\n'.join(p.page_text for p in pdf.pages[:20]))
elif ext == 'docx':
    from docx import Document
    doc = Document(path)
    print('\\n'.join(p.text for p in doc.paragraphs))
elif ext == 'xlsx':
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True)
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        print(f'--- Sheet: {{sheet}} ---')
        for row in ws.iter_rows(values_only=True):
            print('\\t'.join(str(c) for c in row if c is not None))
"""],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                return result.stdout[:10000]
            return f"Error parsing document: {result.stderr}"
        except subprocess.TimeoutExpired:
            return "Error: document parsing timed out"

    if format_type == "csv":
        import csv
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = []
            for i, row in enumerate(reader):
                if i >= 50:
                    rows.append("... (truncated)")
                    break
                rows.append(", ".join(row))
            return "\n".join(rows)

    return f"Unsupported file type: {ext}"
```

- [ ] **Step 6: Commit**

```bash
git add sidecar/tools/
git commit -m "feat: tool registry with built-in tools"
```

---

### Task 7: Python Sidecar — Agent Orchestrator

**Files:**
- Create: `sidecar/agent.py`
- Create: `tests/sidecar/test_agent.py`
- Modify: `sidecar/main.py`

- [ ] **Step 1: Create sidecar/agent.py**

```python
from __future__ import annotations

from typing import AsyncGenerator
from model_manager import ModelManager
from tools import get_tool_schemas, execute_tool
from engine import SkillEngine


SYSTEM_PROMPT_BASE = """你是一个有用的 AI 助手。你可以使用以下工具来帮助用户完成任务：
{tool_descriptions}

当你需要使用工具时，请以 JSON 格式返回：
{{"tool": "tool_name", "args": {{"key": "value"}}}}

在得到工具执行结果后，请基于结果给出最终回复。"""


class AgentOrchestrator:
    def __init__(self, model: ModelManager, skill_engine: SkillEngine):
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

    async def run(
        self, messages: list[dict], stream: bool = False
    ) -> AsyncGenerator[str, None] | str:
        skill_context = self.skill_engine.match_skill(messages[-1]["content"])
        system_prompt = self.build_system_prompt(skill_context)
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        for _ in range(self.max_tool_rounds):
            if stream:
                result = self.model.chat(full_messages)
            else:
                result = self.model.chat(full_messages)

            try:
                import json
                import re

                json_match = re.search(r'\{[^}]+\}', result.strip())
                if json_match:
                    tool_call = json.loads(json_match.group())
                    if "tool" in tool_call and "args" in tool_call:
                        tool_result = execute_tool(tool_call["tool"], tool_call["args"])
                        full_messages.append({"role": "assistant", "content": result})
                        full_messages.append({
                            "role": "tool",
                            "content": str(tool_result),
                        })
                        continue
            except (json.JSONDecodeError, AttributeError):
                pass

            if stream:

                async def gen():
                    yield result

                return gen()
            return result

        return "已到达工具调用上限，请简化请求。"
```

- [ ] **Step 2: Create tests/sidecar/test_agent.py**

```python
import pytest
from sidecar.agent import AgentOrchestrator
from sidecar.model_manager import ModelManager
from sidecar.engine import SkillEngine


class FakeModel:
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
    assert "工具" in prompt
    assert "read_file" in prompt


def test_run_returns_text():
    model = FakeModel()
    engine = FakeSkillEngine()
    agent = AgentOrchestrator(model, engine)
    result = agent.run([{"role": "user", "content": "你好"}])
    assert result == "这是一个普通回复"
```

- [ ] **Step 3: Run tests**

Run: `python -m pytest tests/sidecar/test_agent.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add sidecar/agent.py tests/sidecar/test_agent.py
git commit -m "feat: agent orchestrator with tool calling"
```

---

### Task 8: Python Sidecar — SkillEngine

**Files:**
- Create: `sidecar/engine.py`
- Create: `tests/sidecar/test_engine.py`

- [ ] **Step 1: Create sidecar/engine.py**

```python
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
        for skill in self.skills:
            if skill.description and any(
                kw in user_input.lower()
                for kw in skill.description.lower().split()
            ):
                matches.append(skill)
            elif skill.name.lower() in user_input.lower():
                matches.append(skill)

        if matches:
            return "\n\n".join(s.to_context() for s in matches[:2])
        return ""

    def get_skills_list(self) -> list[dict]:
        return [
            {"name": s.name, "description": s.description} for s in self.skills
        ]
```

- [ ] **Step 2: Create tests/sidecar/test_engine.py**

```python
import tempfile
import os
from pathlib import Path
from sidecar.engine import SkillEngine, Skill


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
```

- [ ] **Step 3: Run tests**

Run: `python -m pytest tests/sidecar/test_engine.py -v`
Expected: 3 passed

- [ ] **Step 4: Commit**

```bash
git add sidecar/engine.py tests/sidecar/test_engine.py
git commit -m "feat: skill engine with markdown parsing"
```

---

### Task 9: Wire Agent into FastAPI

**Files:**
- Modify: `sidecar/main.py`

- [ ] **Step 1: Update sidecar/main.py to integrate Agent + Skills**

Add imports and update the lifespan and routes:

```python
import asyncio
import json
import sys
import socket
import signal

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agent import AgentOrchestrator
from engine import SkillEngine


class ChatRequest(BaseModel):
    messages: list[dict]
    stream: bool = False


class ModelLoadRequest(BaseModel):
    path: str
    ctx_size: int = 32768
    gpu_layers: int = -1


app_state = {
    "model": None,
    "model_loaded": False,
    "agent": None,
    "skill_engine": None,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    from model_manager import ModelManager

    print("SIDECAR_READY", flush=True)
    app_state["skill_engine"] = SkillEngine()
    yield
    if app_state["model"] is not None:
        app_state["model"].unload()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": app_state["model_loaded"]}


@app.post("/model/load")
async def load_model(req: ModelLoadRequest):
    from model_manager import ModelManager

    if app_state["model"] is not None:
        app_state["model"].unload()
        app_state["model"] = None

    manager = ModelManager(req.path, ctx_size=req.ctx_size, gpu_layers=req.gpu_layers)
    manager.load()
    app_state["model"] = manager
    app_state["model_loaded"] = True
    app_state["agent"] = AgentOrchestrator(manager, app_state["skill_engine"])
    return {"status": "loaded", "model": req.path}


@app.post("/model/unload")
async def unload_model():
    if app_state["model"] is not None:
        app_state["model"].unload()
        app_state["model"] = None
        app_state["model_loaded"] = False
        app_state["agent"] = None
    return {"status": "unloaded"}


@app.get("/model/status")
async def model_status():
    if app_state["model"] is not None:
        return {
            "loaded": True,
            "path": app_state["model"].path,
            "ctx_size": app_state["model"].ctx_size,
        }
    return {"loaded": False}


@app.post("/chat")
async def chat(req: ChatRequest):
    if app_state["agent"] is None:
        return JSONResponse({"error": "no model loaded"}, status_code=400)

    result = await app_state["agent"].run(req.messages)
    if hasattr(result, '__anext__'):
        content = ""
        async for token in result:
            content += token
    else:
        content = result
    return {"message": {"role": "assistant", "content": content}}


@app.websocket("/chat/stream")
async def chat_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        req = json.loads(data)
        messages = req.get("messages", [])

        if app_state["agent"] is None:
            await websocket.send_json({"error": "no model loaded"})
            await websocket.close()
            return

        result = app_state["agent"].run(messages, stream=True)
        full_content = ""
        async for token in result:
            full_content += token
            await websocket.send_json({"token": token})

        await websocket.send_json({"done": True, "full_content": full_content})
        await websocket.close()
    except WebSocketDisconnect:
        pass


@app.get("/skills")
async def list_skills():
    if app_state["skill_engine"] is None:
        return {"skills": []}
    return {"skills": app_state["skill_engine"].get_skills_list()}


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    import uvicorn

    port = find_free_port()
    with open(sys.argv[1], "w") as f:
        f.write(str(port))

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
```

- [ ] **Step 2: Add httpx and aiofiles to requirements**

Append to sidecar/requirements.txt:
```
httpx>=0.28.0
aiofiles>=24.0.0
```

- [ ] **Step 3: Commit**

```bash
git add sidecar/main.py sidecar/requirements.txt
git commit -m "feat: wire agent and skills into fastapi"
```

---

### Task 10: UI — Skills Management Page

**Files:**
- Modify: `src/pages/Skills.tsx`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Update preload.ts to expose skills API**

Add to `contextBridge.exposeInMainWorld`:
```ts
getSkills: () => ipcRenderer.invoke('skills:list'),
```

- [ ] **Step 2: Add IPC handler in electron/main.ts**

```ts
ipcMain.handle('skills:list', async () => {
  const res = await fetch(`${sidecar.baseUrl}/skills`)
  return res.json()
})
```

- [ ] **Step 3: Update src/api.ts**

```ts
getSkills: () => Promise<{ skills: Array<{ name: string; description: string }> }>
```

- [ ] **Step 4: Rewrite src/pages/Skills.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api'

export function Skills() {
  const [skills, setSkills] = useState<Array<{ name: string; description: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSkills().then((data) => {
      setSkills(data.skills)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2>Skills</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Skill 文件位于 <code>~/.llm-app/skills/</code> 目录，Agent 会根据对话内容自动匹配合适的 skill。
      </p>

      {loading && <p>加载中...</p>}

      {!loading && skills.length === 0 && (
        <div style={{ padding: 24, background: '#f9f9f9', borderRadius: 8, textAlign: 'center' }}>
          <p>暂无 skill 文件</p>
          <p style={{ fontSize: 12, color: '#999' }}>
            在 ~/.llm-app/skills/ 目录下创建 .md 文件即可添加 skill
          </p>
        </div>
      )}

      {skills.map((s) => (
        <div key={s.name} style={{ padding: 12, marginBottom: 8, border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 4px' }}>{s.name}</h3>
          <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{s.description}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Skills.tsx electron/preload.ts electron/main.ts src/api.ts
git commit -m "feat: skills management page"
```

---

### Task 11: Multimodal — Vision Support

**Files:**
- Modify: `sidecar/main.py`
- Modify: `src/components/InputBox.tsx`
- Create: `src/components/MediaPreview.tsx`

- [ ] **Step 1: Update InputBox to support image paste**

```tsx
useEffect(() => {
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          setPendingImages((prev) => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
      }
    }
  }
  document.addEventListener('paste', handlePaste)
  return () => document.removeEventListener('paste', handlePaste)
}, [])
```

- [ ] **Step 2: Create src/components/MediaPreview.tsx**

```tsx
interface MediaPreviewProps {
  images: string[]
  onRemove: (index: number) => void
}

export function MediaPreview({ images, onRemove }: MediaPreviewProps) {
  if (images.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px', flexWrap: 'wrap' }}>
      {images.map((img, i) => (
        <div key={i} style={{ position: 'relative' }}>
          <img src={img} alt={`preview ${i}`} style={{ maxWidth: 100, maxHeight: 100, borderRadius: 6 }} />
          <button
            onClick={() => onRemove(i)}
            style={{
              position: 'absolute', top: -6, right: -6,
              width: 20, height: 20, borderRadius: '50%',
              border: 'none', background: '#ff4444', color: '#fff',
              cursor: 'pointer', fontSize: 12, lineHeight: '20px', textAlign: 'center',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Modify ChatView to include MediaPreview**

Integrate MediaPreview into the chat flow — images are included in the message payload.

- [ ] **Step 4: Commit**

```bash
git add src/components/MediaPreview.tsx src/components/InputBox.tsx
git commit -m "feat: image paste and preview support"
```

---

### Task 12: Screen Capture Integration

**Files:**
- Create: `electron/screen-capture.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create electron/screen-capture.ts**

```ts
import { desktopCapturer } from 'electron'

export class ScreenCapture {
  private interval: ReturnType<typeof setInterval> | null = null
  private lastFrame: string | null = null

  start(fps: number = 1, onFrame?: (dataUrl: string) => void): void {
    this.stop()
    this.interval = setInterval(async () => {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail
        const dataUrl = thumbnail.toDataURL()
        this.lastFrame = dataUrl
        onFrame?.(dataUrl)
      }
    }, 1000 / fps)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.lastFrame = null
  }

  getLastFrame(): string | null {
    return this.lastFrame
  }
}
```

- [ ] **Step 2: Wire IPC handlers in electron/main.ts**

```ts
import { ScreenCapture } from './screen-capture'

const screenCapture = new ScreenCapture()

ipcMain.handle('screen:start', () => {
  screenCapture.start(1)
})

ipcMain.handle('screen:stop', () => {
  screenCapture.stop()
})

ipcMain.handle('screen:frame', () => {
  return screenCapture.getLastFrame()
})
```

- [ ] **Step 3: Commit**

```bash
git add electron/screen-capture.ts
git commit -m "feat: screen capture integration"
```

---

### Task 13: Run All Tests

- [ ] **Step 1: Run all Python tests**

Run: `python -m pytest tests/ -v`
Expected: all tests pass

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: all tests passing"
```
