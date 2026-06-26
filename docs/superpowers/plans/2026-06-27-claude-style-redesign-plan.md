# Claude 风格重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Local LLM App 渲染层重写为 Claude.ai 风格(精致/克制/暗色模式),移除全部 emoji 改 Phosphor 图标,补齐多会话文件持久化、后端日志底部抽屉、模型下载跨页面进度持久。

**Architecture:** Tailwind v4 + 自托管 Geist 字体 + Phosphor 图标 + Zustand 全局状态(会话/下载/日志三 store)+ sidecar 新增 conversations CRUD 文件持久化 + Electron stdout/stderr 日志转发。全部 inline style → Tailwind 类。

**Tech Stack:** React 19, Tailwind v4 (`@tailwindcss/vite`), `@phosphor-icons/react`, `@fontsource/geist-sans` / `geist-mono`, `zustand`, `react-markdown` + `remark-gfm` + `rehype-highlight` + `highlight.js`, `motion`, FastAPI/pytest(sidecar), vitest(stores)。

## Global Constraints

- 设计 tokens 见 spec:canvas `#F5F4EF`/`#1F1E1D`,surface `#EFEDE5`/`#262624`,surface-2 `#E9E6DC`/`#2D2B27`,text `#1F1E1D`/`#EDEBE5`,text-muted `#87867F`/`#A8A69E`,border `#E5E2D8`/`#36352F`,accent(clay) `#C96442`/`#D97757`。无纯黑纯白。
- 圆角阶梯:按钮/输入 12px,消息块 14px,composer 16px,头像/角标 8px。
- 图标单一 `@phosphor-icons/react`,`weight="regular"`,不手写 SVG。
- 字体 `Geist Sans` + `Geist Mono`,自托管 `@fontsource`,禁止 Google Fonts `<link>`。
- 暗色模式默认跟随 `prefers-color-scheme`,可手动切换并持久化(localStorage `llm-app:theme`)。
- 动效只服务反馈/状态切换;`prefers-reduced-motion: reduce` 降级为静态。
- 每个 task 后必须 `npm run lint`(`tsc --noEmit`)通过;Python task 后必须 `pytest tests/sidecar` 通过。
- 不改 LLM 推理/Agent/Skills/屏幕捕获核心;不动 Electron 打包配置。
- 文案为中文。

---

## File Structure

**Create:**
- `src/index.css` — Tailwind 入口 + design tokens(CSS 变量)+ `@font-face` 导入 + 暗色变量。
- `src/store/useModelDownloads.ts` — 下载进度全局 store(跨页面持久)。
- `src/store/useLogs.ts` — sidecar 日志环形缓冲 store。
- `src/store/useConversations.ts` — 会话列表/当前消息/流式 store。
- `src/components/Sidebar.tsx` — 左栏(新对话/搜索/会话列表/导航/主题/下载指示)。
- `src/components/TopBar.tsx` — 侧栏开关 + 模型选择器。
- `src/components/Composer.tsx` — 替代 InputBox。
- `src/components/Message.tsx` — 单条消息(用户块/助手 Markdown/操作)。
- `src/components/MessageStream.tsx` — 替代 MessageList。
- `src/components/EmptyState.tsx` — 星标 + 问候 + 示例 chip。
- `src/components/LogDrawer.tsx` — 底部折叠日志抽屉。
- `src/components/ThemeToggle.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/lib/theme.ts` — 主题读写工具。
- `sidecar/conversations.py` — 会话文件持久化 CRUD。
- `tests/sidecar/test_conversations.py` — pytest。
- `tests/store/useModelDownloads.test.ts` 等 — vitest。

**Modify:**
- `package.json` — 加依赖 + 脚本。
- `vite.config.ts` — `@tailwindcss/vite` 插件。
- `src/main.tsx` — import `index.css`。
- `src/App.tsx` — 布局 shell 重写。
- `src/api.ts` — 加 Conversation 类型与方法 + onLog。
- `src/pages/Chat.tsx` / `Settings.tsx` / `Skills.tsx` — 套新设计系统 + 接 store。
- `src/hooks/useChat.ts` — 并入 store 或保留为底层。
- `electron/sidecar.ts` — stdout/stderr 行转发。
- `electron/main.ts` — `sidecar:log` 转发 + conversations IPC 代理。
- `electron/preload.ts` — 暴露 onLog + conversation 方法。
- `sidecar/main.py` — conversations 路由。
- `sidecar/model_manager.py` — `MODELS_CATALOG` 全量替换为 2026.6 新一代端侧模型(9 VL + 7 纯文本)。

**Delete:**
- `src/components/InputBox.tsx` / `MessageList.tsx` / `ChatView.tsx`(由新组件替代)。

---

## Phase 1 — 基础设施 + 布局

### Task 1: 安装依赖 + 配置 Tailwind v4

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/index.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: Tailwind v4 生效;`src/index.css` 作为全局样式入口;design tokens CSS 变量在 `:root` 与 `.dark` 下可用。

- [ ] **Step 1: 安装依赖**

```bash
npm i tailwindcss @tailwindcss/vite @tailwindcss/typography @phosphor-icons/react @fontsource/geist-sans @fontsource/geist-mono zustand react-markdown remark-gfm rehype-highlight highlight.js motion
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: 修改 `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: { build: { outDir: 'dist-electron' } },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) { args.reload() },
      },
    ]),
    renderer(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
  },
})
```

在 `package.json` `scripts` 加 `"test": "vitest run"`。

- [ ] **Step 3: 创建 `tests/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: 创建 `src/index.css`(tokens + 字体)**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "@fontsource/geist-sans/400.css";
@import "@fontsource/geist-sans/500.css";
@import "@fontsource/geist-sans/600.css";
@import "@fontsource/geist-mono/400.css";

@theme {
  --font-sans: "Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --color-canvas: #F5F4EF;
  --color-surface: #EFEDE5;
  --color-surface-2: #E9E6DC;
  --color-text: #1F1E1D;
  --color-text-muted: #87867F;
  --color-border: #E5E2D8;
  --color-accent: #C96442;
  --color-accent-soft: #F4E9E3;
}

.dark {
  --color-canvas: #1F1E1D;
  --color-surface: #262624;
  --color-surface-2: #2D2B27;
  --color-text: #EDEBE5;
  --color-text-muted: #A8A69E;
  --color-border: #36352F;
  --color-accent: #D97757;
  --color-accent-soft: #3A2A24;
}

html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--color-canvas);
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 5: `src/main.tsx` 引入 css**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: 验证**

Run: `npm run lint`
Expected: PASS(无类型错误)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: tailwind v4 + geist fonts + design tokens"
```

---

### Task 2: 主题工具 + ThemeToggle

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/components/ThemeToggle.tsx`

**Interfaces:**
- Produces: `getTheme()`/`setTheme()`/`toggleTheme()`(`'light'|'dark'`),持久化到 localStorage `llm-app:theme`,在 `<html>` 上增删 `.dark` class;`ThemeToggle` 图标按钮。

- [ ] **Step 1: 创建 `src/lib/theme.ts`**

```ts
type Theme = 'light' | 'dark'

export function getTheme(): Theme {
  const stored = localStorage.getItem('llm-app:theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setTheme(t: Theme) {
  localStorage.setItem('llm-app:theme', t)
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
```

- [ ] **Step 2: 创建 `src/components/ThemeToggle.tsx`**

```tsx
import { useState } from 'react'
import { Sun, Moon } from '@phosphor-icons/react'
import { getTheme, toggleTheme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme())
  return (
    <button
      onClick={() => setThemeState(toggleTheme())}
      className="p-2 rounded-lg text-[--color-text-muted] hover:bg-[--color-surface-2] hover:text-[--color-text] transition-colors"
      aria-label="切换主题"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
```

- [ ] **Step 3: 在 App 初始化时应用主题**

(在 Task 3 的 App shell 中 `useEffect(() => setTheme(getTheme()), [])`)

- [ ] **Step 4: 验证**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: theme toggle with persistence"
```

---

### Task 3: 布局 shell(App.tsx)

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: 三栏 shell(`Sidebar` + main 区 Router)+ 主题初始化。Sidebar 暂用骨架,导航 Chat/Skills/Settings 用 Phosphor 图标替 emoji。

- [ ] **Step 1: 重写 `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { ChatCircle, PuzzlePiece, Gear } from '@phosphor-icons/react'
import { Chat } from './pages/Chat'
import { Settings } from './pages/Settings'
import { Skills } from './pages/Skills'
import { ThemeToggle } from './components/ThemeToggle'
import { getTheme, setTheme } from './lib/theme'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => { setTheme(getTheme()) }, [])

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
      isActive
        ? 'bg-[--color-surface-2] text-[--color-text] font-medium'
        : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-2]/60'
    }`

  return (
    <HashRouter>
      <div className="flex h-full">
        {sidebarOpen && (
          <nav className="w-[260px] shrink-0 border-r border-[--color-border] bg-[--color-surface] flex flex-col">
            <div className="flex-1 overflow-auto p-3">
              <div className="px-2 py-3 text-[13px] font-semibold text-[--color-text]">Local LLM</div>
            </div>
            <div className="p-3 border-t border-[--color-border] flex flex-col gap-1">
              <NavLink to="/" end className={navItem}><ChatCircle size={18} /> 对话</NavLink>
              <NavLink to="/skills" className={navItem}><PuzzlePiece size={18} /> Skills</NavLink>
              <NavLink to="/settings" className={navItem}><Gear size={18} /> 设置</NavLink>
              <div className="pt-2 mt-1 border-t border-[--color-border]"><ThemeToggle /></div>
            </div>
          </nav>
        )}
        <main className="flex-1 flex flex-col overflow-hidden">
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
```

- [ ] **Step 2: 验证**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: layout shell with sidebar nav + phosphor icons"
```

---

### Task 4: TopBar 组件

**Files:**
- Create: `src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `sidebarOpen` 状态由 Chat 页持有并传入 `onToggleSidebar`。
- Produces: `<TopBar onToggleSidebar={...} />`,左侧折叠按钮 + 标题(模型选择器下拉留到 Phase 5 Task)。

- [ ] **Step 1: 创建 `src/components/TopBar.tsx`**

```tsx
import { SidebarSimple } from '@phosphor-icons/react'

interface TopBarProps {
  onToggleSidebar: () => void
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  return (
    <header className="flex items-center gap-2 px-4 h-12 border-b border-[--color-border] shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg text-[--color-text-muted] hover:bg-[--color-surface-2] hover:text-[--color-text] transition-colors"
        aria-label="切换侧栏"
      >
        <SidebarSimple size={18} />
      </button>
      <span className="text-[13px] text-[--color-text-muted]">新对话</span>
    </header>
  )
}
```

- [ ] **Step 2: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: topbar with sidebar toggle"
```

---

### Task 5: Composer 基础(替代 InputBox)

**Files:**
- Create: `src/components/Composer.tsx`

**Interfaces:**
- Produces: `<Composer onSend={(text, images?)=>void} onStop={()=>void} streaming={bool} />`。图片拖拽/粘贴/选择保留;Enter 发送/Shift+Enter 换行;发送按钮 clay 圆形 `ArrowUp`,流式中变 `Stop`。本 task 不接会话逻辑,只做组件。

- [ ] **Step 1: 创建 `src/components/Composer.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon, ArrowUp, Stop, X } from '@phosphor-icons/react'

interface ComposerProps {
  onSend: (text: string, images?: string[]) => void
  onStop: () => void
  streaming: boolean
}

export function Composer({ onSend, onStop, streaming }: ComposerProps) {
  const [text, setText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const r = new FileReader()
          r.onload = () => setPendingImages((p) => [...p, r.result as string])
          r.readAsDataURL(file)
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [text])

  const send = () => {
    if ((!text.trim() && pendingImages.length === 0) || streaming) return
    onSend(text.trim(), pendingImages.length ? pendingImages : undefined)
    setText('')
    setPendingImages([])
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const addFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/')) return
      const r = new FileReader()
      r.onload = () => setPendingImages((p) => [...p, r.result as string])
      r.readAsDataURL(f)
    })
  }

  const canSend = (text.trim().length > 0 || pendingImages.length > 0) && !streaming

  return (
    <div className="px-4 pb-4 pt-2 shrink-0" onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}>
      {pendingImages.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative">
              <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg" />
              <button onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[--color-accent] text-white grid place-items-center">
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`flex items-end gap-2 rounded-2xl border border-[--color-border] bg-[--color-surface] px-3 py-2 transition-colors ${dragOver ? 'ring-2 ring-[--color-accent]/40' : ''}`}>
        <input ref={fileInputRef} type="file" accept="image/*" hidden multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <button onClick={() => fileInputRef.current?.click()} disabled={streaming}
          className="p-2 rounded-lg text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-2] transition-colors disabled:opacity-40"
          aria-label="添加图片">
          <ImageIcon size={20} />
        </button>
        <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
          placeholder="发送消息…  (Enter 发送,Shift+Enter 换行)" rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-relaxed py-1.5 max-h-[200px]" />
        {streaming ? (
          <button onClick={onStop} aria-label="停止生成"
            className="w-9 h-9 rounded-xl bg-[--color-surface-2] text-[--color-text] grid place-items-center hover:bg-[--color-border] transition-colors">
            <Stop size={18} weight="fill" />
          </button>
        ) : (
          <button onClick={send} disabled={!canSend} aria-label="发送"
            className="w-9 h-9 rounded-xl bg-[--color-accent] text-white grid place-items-center disabled:opacity-30 transition-opacity hover:opacity-90">
            <ArrowUp size={18} weight="bold" />
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: composer with attachments + send/stop"
```

---

### Task 6: Chat 页骨架(TopBar + 占位消息流 + Composer)

**Files:**
- Modify: `src/pages/Chat.tsx`

**Interfaces:**
- Consumes: 现有 `useChat` 临时保留(Phase 3 替换为 store)。本 task 仅把新 TopBar/Composer 接上,消息列表暂用简化版。

- [ ] **Step 1: 重写 `src/pages/Chat.tsx`**

```tsx
import { useState } from 'react'
import { useChat } from '../hooks/useChat'
import { TopBar } from '../components/TopBar'
import { Composer } from '../components/Composer'

export function Chat() {
  const { messages, streaming, sendMessage, stopStreaming } = useChat()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex flex-col h-full">
      <TopBar onToggleSidebar={() => setSidebarOpen((s) => !s)} />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="text-center text-[--color-text-muted] mt-24">发送消息开始对话</div>
          ) : messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-2xl px-4 py-3 max-w-[80%] whitespace-pre-wrap leading-[1.65] ${
                m.role === 'user' ? 'bg-[--color-surface-2]' : ''}`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Composer onSend={sendMessage} onStop={stopStreaming} streaming={streaming} />
    </div>
  )
}
```

- [ ] **Step 2: 同步 App.tsx 让 sidebar 状态由 Chat 持有**

更新 `App.tsx`:移除 App 内 `sidebarOpen`,改为始终渲染 Sidebar 骨架;侧栏折叠的完整控制在 Phase 3 完成。本 task 保持 sidebar 常开,TopBar 按钮暂为占位(不隐藏侧栏),避免状态分裂。

App.tsx 中删去 `sidebarOpen` 状态与条件渲染,`<nav>` 始终渲染。

- [ ] **Step 3: 验证** — Run: `npm run lint` → PASS;手动 `npm run dev` 确认布局可见。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: chat page skeleton with topbar/composer"
```

---

### Task 7: 重排 Settings 页(设计系统,接 store 前的纯样式)

**Files:**
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `api`(现有);下载状态仍用本地 `useState`(Phase 2 Task 9-11 提到 store)。
- Produces: 套用新 tokens/圆角/字体的 Settings 页,功能不变。

- [ ] **Step 1: 重写 `src/pages/Settings.tsx`**

把所有 inline `style={{}}` 替换为 Tailwind 类,沿用原逻辑。完整文件:

```tsx
import { useState, useEffect, useRef } from 'react'
import { api, AvailableModel, LocalModel, DownloadState } from '../api'

const MB = 1024 * 1024
const GB = 1024 * MB
function formatSize(b: number) { return b >= GB ? `${(b / GB).toFixed(1)} GB` : b >= MB ? `${Math.round(b / MB)} MB` : `${b} B` }
function pct(p: number) { return `${Math.round(p * 100)}%` }

export function Settings() {
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; path?: string }>({ loaded: false })
  const [models, setModels] = useState<AvailableModel[]>([])
  const [localModels, setLocalModels] = useState<LocalModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({})
  const [loading, setLoading] = useState(true)
  const [operating, setOperating] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = async () => {
    try {
      const [status, avail, local] = await Promise.all([api.getModelStatus(), api.getAvailableModels(), api.getLocalModels()])
      setModelStatus(status); setModels(avail.models); setLocalModels(local.models)
    } catch (e) { console.error(e) }
    setLoading(false)
  }
  useEffect(() => { loadData(); const t = setTimeout(() => setLoading(false), 15000); return () => { clearTimeout(t); if (pollRef.current) clearInterval(pollRef.current) } }, [])

  const active = Object.entries(downloads).filter(([, s]) => s.status === 'downloading')
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (active.length === 0) return
    pollRef.current = setInterval(async () => {
      for (const [id] of active) {
        try {
          const st = await api.getDownloadProgress(id)
          setDownloads((p) => ({ ...p, [id]: st }))
          if (st.status === 'completed' || st.status === 'error') loadData()
        } catch (e) { console.error(e) }
      }
    }, 1500)
  }, [active.length])

  const handleDownload = async (id: string) => {
    setDownloads((p) => ({ ...p, [id]: { status: 'downloading', progress: 0 } }))
    try { const r = await api.downloadModel(id); if (r.status === 'error') setDownloads((p) => ({ ...p, [id]: r })) }
    catch (e) { setDownloads((p) => ({ ...p, [id]: { status: 'error', progress: 0, error: String(e) } })) }
  }
  const handleLoad = async (path: string) => { setOperating(path); try { await api.loadModel(path); setModelStatus(await api.getModelStatus()) } catch (e) { console.error(e) }; setOperating(null) }
  const handleUnload = async () => { setOperating('unload'); try { await api.unloadModel(); setModelStatus({ loaded: false }) } catch (e) { console.error(e) }; setOperating(null) }

  return (
    <div className="h-full overflow-auto px-8 py-8 max-w-3xl mx-auto">
      <h2 className="text-[22px] font-semibold mt-0 mb-5">设置</h2>
      <div className="flex items-center gap-3 px-4 py-3 bg-[--color-surface] rounded-xl mb-7">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${modelStatus.loaded ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[14px] font-medium">{modelStatus.loaded ? '模型已加载' : '模型未加载'}</span>
        {modelStatus.path && <span className="text-[12px] text-[--color-text-muted] flex-1 truncate">{modelStatus.path}</span>}
        {modelStatus.loaded && (
          <button onClick={handleUnload} disabled={operating === 'unload'}
            className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
            {operating === 'unload' ? '卸载中…' : '卸载模型'}
          </button>
        )}
      </div>

      <h3 className="text-[17px] font-semibold mb-1">推荐模型</h3>
      <p className="text-[13px] text-[--color-text-muted] mb-4">选择适合你设备的模型,下载后即可使用</p>

      {loading ? <p className="text-[--color-text-muted]">加载中…</p> : models.length === 0 ? (
        <p className="text-[--color-text-muted] p-8 text-center bg-[--color-surface] rounded-lg">暂无可用模型,请检查后端是否运行</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {models.map((m) => {
            const dl = downloads[m.id]
            const isDl = dl?.status === 'downloading'
            const isDone = m.downloaded || dl?.status === 'completed'
            const isOp = m.local_path ? operating === m.local_path : operating === m.id
            return (
              <div key={m.id} className={`p-4 rounded-xl border flex flex-col gap-2 ${isDone ? 'border-emerald-300/60 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-[--color-border]'}`}>
                <div className="font-semibold text-[15px]">{m.name}</div>
                <div className="text-[13px] text-[--color-text-muted]">{m.description}</div>
                <div className="flex gap-1.5 flex-wrap text-[12px]">
                  <span className="px-2 py-0.5 rounded bg-[--color-surface-2]">{m.params}</span>
                  <span className="px-2 py-0.5 rounded bg-[--color-surface-2]">{formatSize(m.size_bytes)}</span>
                  <span className="px-2 py-0.5 rounded bg-[--color-accent-soft] text-[--color-accent]">{m.requirements}</span>
                  <span className="px-2 py-0.5 rounded bg-[--color-surface-2]">{m.language}</span>
                </div>
                {isDl && dl && (
                  <div className="mt-1">
                    <div className="h-1.5 rounded-full bg-[--color-border] overflow-hidden">
                      <div className="h-full bg-[--color-accent] rounded-full transition-[width] duration-300" style={{ width: pct(dl.progress) }} />
                    </div>
                    <div className="text-[12px] text-[--color-text-muted] mt-1 flex justify-between">
                      {dl.retrying ? <span className="text-amber-500">重试中 ({dl.retrying})</span> : <span />}
                      {pct(dl.progress)}
                    </div>
                  </div>
                )}
                {dl?.status === 'error' && <div className="text-[12px] text-red-500">下载失败: {dl.error}</div>}
                <div className="mt-auto">
                  {isDone ? (
                    <button onClick={() => handleLoad(m.local_path || dl?.path || m.id)} disabled={isOp}
                      className="w-full py-2 rounded-lg bg-emerald-500 text-white text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                      {isOp ? '加载中…' : '加载使用'}
                    </button>
                  ) : isDl ? (
                    <div className="w-full py-2 text-center rounded-lg bg-[--color-surface-2] text-[13px] text-[--color-text-muted]">下载中…</div>
                  ) : (
                    <button onClick={() => handleDownload(m.id)} disabled={isOp}
                      className="w-full py-2 rounded-lg bg-[--color-accent] text-white text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                      {isOp ? '准备中…' : '下载'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {localModels.filter((lm) => !models.some((m) => m.id === lm.id)).length > 0 && (
        <>
          <h3 className="text-[17px] font-semibold mt-6 mb-3">本地模型</h3>
          <div className="flex flex-col gap-2">
            {localModels.filter((lm) => !models.some((m) => m.id === lm.id)).map((lm) => (
              <div key={lm.path} className="flex items-center gap-3 px-4 py-2.5 border border-[--color-border] rounded-lg">
                <span className="flex-1 text-[14px] font-medium">{lm.name}</span>
                <span className="text-[12px] text-[--color-text-muted]">{formatSize(lm.size_bytes)}</span>
                <button onClick={() => handleLoad(lm.path)} disabled={operating === lm.path}
                  className="px-4 py-1.5 rounded-lg bg-[--color-accent] text-white text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {operating === lm.path ? '加载中…' : '加载'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <details className="mt-7">
        <summary className="cursor-pointer text-[14px] text-[--color-text-muted]">高级设置:自定义模型路径</summary>
        <CustomPathInput onLoad={handleLoad} operating={operating} />
      </details>
    </div>
  )
}

function CustomPathInput({ onLoad, operating }: { onLoad: (p: string) => void; operating: string | null }) {
  const [p, setP] = useState('')
  return (
    <div className="mt-3 flex gap-2">
      <input value={p} onChange={(e) => setP(e.target.value)} placeholder="/path/to/model.gguf"
        className="flex-1 px-3 py-2.5 rounded-lg border border-[--color-border] bg-transparent text-[14px] outline-none focus:ring-2 focus:ring-[--color-accent]/40" />
      <button onClick={() => onLoad(p.trim())} disabled={!p.trim() || operating === p.trim()}
        className="px-5 py-2.5 rounded-lg bg-[--color-accent] text-white text-[14px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
        {operating === p.trim() ? '加载中…' : '加载模型'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: settings page restyled with design tokens"
```

---

### Task 8: 重排 Skills 页

**Files:**
- Modify: `src/pages/Skills.tsx`

- [ ] **Step 1: 重写 `src/pages/Skills.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api'
import { PuzzlePiece } from '@phosphor-icons/react'

export function Skills() {
  const [skills, setSkills] = useState<Array<{ name: string; description: string }>>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.getSkills().then((d) => setSkills(d.skills)).catch(() => {}).finally(() => setLoading(false)) }, [])

  return (
    <div className="h-full overflow-auto px-8 py-8 max-w-2xl mx-auto">
      <h2 className="text-[22px] font-semibold mt-0 mb-2">Skills</h2>
      <p className="text-[--color-text-muted] mb-6 leading-relaxed text-[14px]">
        Skill 文件位于 <code className="px-1.5 py-0.5 rounded bg-[--color-surface-2] text-[13px]">~/.llm-app/skills/</code>,Agent 会根据对话内容自动匹配。
      </p>
      {loading && <p className="text-[--color-text-muted]">加载中…</p>}
      {!loading && skills.length === 0 && (
        <div className="p-8 bg-[--color-surface] rounded-xl text-center text-[--color-text-muted]">
          <PuzzlePiece size={28} className="mx-auto mb-2 opacity-40" />
          <p className="mb-1">暂无 skill 文件</p>
          <p className="text-[13px]">在 ~/.llm-app/skills/ 下创建 .md 文件即可添加</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {skills.map((s) => (
          <div key={s.name} className="p-4 border border-[--color-border] rounded-xl">
            <h3 className="text-[16px] font-semibold mb-1.5">{s.name}</h3>
            <p className="text-[14px] text-[--color-text-muted]">{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: skills page restyled"
```

---

### Task 8b: 更新模型目录为 2026.6 新一代端侧模型

**Files:**
- Modify: `sidecar/model_manager.py:16-77`(`MODELS_CATALOG` 列表)
- Test: `tests/sidecar/test_model_manager.py`(已有,确认 catalog 解析仍通过)

**Interfaces:**
- Produces: `MODELS_CATALOG` 全量替换为 16 个新条目(9 多模态 VL + 7 纯文本),字段结构不变。UI(Settings 卡片 + TopBar 选择器)自动渲染,无需改前端。

**注:** 具体 GGUF 下载 URL 在实施时由 subagent 从对应 HuggingFace 仓库 `ggml-org/<model>-GGUF` / `Qwen/<model>-GGUF` / `google/<model>-gguf` / `openai/gpt-oss` 取最新 Q4_K_M 量化文件直链。下表 `url` 为占位模式,subagent 必须填入实际可下载的 `https://huggingface.co/<org>/<repo>/resolve/main/<file>.gguf`。

- [ ] **Step 1: 替换 `MODELS_CATALOG`**

把 `sidecar/model_manager.py` 中 `MODELS_CATALOG = [...]` 整段替换为:

```python
MODELS_CATALOG = [
    # ── 多模态 VL(优先)──────────────────────────────────────────────
    {
        "id": "gemma-4-2b-it",
        "name": "Gemma 4 2B IT (Q4_K_M)",
        "description": "Google 最新代,原生多模态(文+图),端侧入门首选",
        "url": "https://huggingface.co/ggml-org/gemma-4-2b-it-GGUF/resolve/main/gemma-4-2b-it-Q4_K_M.gguf",
        "size_bytes": 1610612736,
        "requirements": "4GB+ RAM",
        "params": "2B",
        "language": "中文 / English",
    },
    {
        "id": "gemma-4-4b-it",
        "name": "Gemma 4 4B IT (Q4_K_M)",
        "description": "Google 多模态,8GB 机器首选,质量速度平衡",
        "url": "https://huggingface.co/ggml-org/gemma-4-4b-it-GGUF/resolve/main/gemma-4-4b-it-Q4_K_M.gguf",
        "size_bytes": 3221225472,
        "requirements": "8GB+ RAM",
        "params": "4B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-2b-instruct",
        "name": "Qwen3-VL 2B Instruct (Q4_K_M)",
        "description": "Qwen 多模态,中文理解强,极轻量",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/qwen3-vl-2b-instruct-q4_k_m.gguf",
        "size_bytes": 1610612736,
        "requirements": "8GB+ RAM",
        "params": "2B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-4b-instruct",
        "name": "Qwen3-VL 4B Instruct (Q4_K_M)",
        "description": "多模态中文 SOTA 小模型,16GB 机器性价比之选",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF/resolve/main/qwen3-vl-4b-instruct-q4_k_m.gguf",
        "size_bytes": 3221225472,
        "requirements": "16GB+ RAM",
        "params": "4B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-8b-instruct",
        "name": "Qwen3-VL 8B Instruct (Q4_K_M)",
        "description": "多模态中坚,综合能力强,推荐主力",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/qwen3-vl-8b-instruct-q4_k_m.gguf",
        "size_bytes": 5368709120,
        "requirements": "16GB+ RAM",
        "params": "8B",
        "language": "中文 / English",
    },
    {
        "id": "gemma-4-12b-it",
        "name": "Gemma 4 12B IT (Q4_K_M)",
        "description": "Google 多模态,256K 上下文,质量高",
        "url": "https://huggingface.co/ggml-org/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q4_K_M.gguf",
        "size_bytes": 8589934592,
        "requirements": "16GB+ RAM",
        "params": "12B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-14b-instruct",
        "name": "Qwen3-VL 14B Instruct (Q4_K_M)",
        "description": "多模态,逼近云端质量,24GB 机器首选",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-14B-Instruct-GGUF/resolve/main/qwen3-vl-14b-instruct-q4_k_m.gguf",
        "size_bytes": 9663676416,
        "requirements": "24GB+ RAM",
        "params": "14B",
        "language": "中文 / English",
    },
    {
        "id": "gemma-4-27b-it",
        "name": "Gemma 4 27B IT (Q4_K_M)",
        "description": "Google 多模态旗舰,质量最强",
        "url": "https://huggingface.co/ggml-org/gemma-4-27b-it-GGUF/resolve/main/gemma-4-27b-it-Q4_K_M.gguf",
        "size_bytes": 18253611008,
        "requirements": "24GB+ RAM",
        "params": "27B",
        "language": "中文 / English",
    },
    {
        "id": "qwen3-vl-32b-a3b",
        "name": "Qwen3-VL 32B-A3B MoE (Q4_K_M)",
        "description": "MoE 仅 3B 激活,速度快质量高,32GB+ 旗舰",
        "url": "https://huggingface.co/Qwen/Qwen3-VL-32B-A3B-Instruct-GGUF/resolve/main/qwen3-vl-32b-a3b-instruct-q4_k_m.gguf",
        "size_bytes": 19327352832,
        "requirements": "32GB+ RAM",
        "params": "32B MoE",
        "language": "中文 / English",
    },
    # ── 纯文本(差异化价值,次选)──────────────────────────────────────
    {
        "id": "llama-4-1b-scout",
        "name": "Llama 4 1B Scout (Q4_K_M)",
        "description": "Meta 端侧,英文快,极轻量入门",
        "url": "https://huggingface.co/ggml-org/Llama-4-1B-Scout-GGUF/resolve/main/llama-4-1b-scout-q4_k_m.gguf",
        "size_bytes": 1073741824,
        "requirements": "2GB+ RAM",
        "params": "1B",
        "language": "English",
    },
    {
        "id": "llama-4-3b-scout",
        "name": "Llama 4 3B Scout (Q4_K_M)",
        "description": "Meta 端侧,英文对话,低延迟",
        "url": "https://huggingface.co/ggml-org/Llama-4-3B-Scout-GGUF/resolve/main/llama-4-3b-scout-q4_k_m.gguf",
        "size_bytes": 2147483648,
        "requirements": "4GB+ RAM",
        "params": "3B",
        "language": "English",
    },
    {
        "id": "glm-5-9b-chat",
        "name": "GLM-5 9B Chat (Q4_K_M)",
        "description": "智谱最新,中文好,agentic 能力强",
        "url": "https://huggingface.co/zai-org/GLM-5-9B-Chat-GGUF/resolve/main/glm-5-9b-chat-q4_k_m.gguf",
        "size_bytes": 6442450944,
        "requirements": "16GB+ RAM",
        "params": "9B",
        "language": "中文 / English",
    },
    {
        "id": "deepseek-v4-distill-7b",
        "name": "DeepSeek-V4 Distill 7B (Q4_K_M)",
        "description": "推理链强,数学与复杂逻辑专长",
        "url": "https://huggingface.co/deepseek-ai/DeepSeek-V4-Distill-7B-GGUF/resolve/main/deepseek-v4-distill-7b-q4_k_m.gguf",
        "size_bytes": 5368709120,
        "requirements": "16GB+ RAM",
        "params": "7B",
        "language": "中文 / English",
    },
    {
        "id": "phi-4-14b",
        "name": "Phi-4 14B (Q4_K_M)",
        "description": "微软,推理出色,MIT 许可",
        "url": "https://huggingface.co/ggml-org/phi-4-GGUF/resolve/main/phi-4-q4_k_m.gguf",
        "size_bytes": 9663676416,
        "requirements": "24GB+ RAM",
        "params": "14B",
        "language": "English",
    },
    {
        "id": "gpt-oss-20b",
        "name": "gpt-oss 20B (Q4_K_M)",
        "description": "OpenAI 开源,原生 MXFP4,MoE 3.6B 激活",
        "url": "https://huggingface.co/openai/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-q4_k_m.gguf",
        "size_bytes": 12884901888,
        "requirements": "16GB+ RAM",
        "params": "20B MoE",
        "language": "English",
    },
    {
        "id": "gpt-oss-120b",
        "name": "gpt-oss 120B (Q4_K_M)",
        "description": "OpenAI 旗舰开源,MoE 5.1B 激活,需大显存或工作站",
        "url": "https://huggingface.co/openai/gpt-oss-120b-GGUF/resolve/main/gpt-oss-120b-q4_k_m.gguf",
        "size_bytes": 75161927680,
        "requirements": "工作站级",
        "params": "120B MoE",
        "language": "English",
    },
]
```

- [ ] **Step 2: subagent 必须验证每个 URL 可下载**

对每个 `url` 执行 `curl -sI <url> | head -1`,确认返回 `HTTP/2 302` 或 `200`(HF 会 302 重定向到 CDN)。任何返回 404 的,subagent 到对应 HF 仓库页面找正确的 GGUF 文件名并修正 `url` 与 `size_bytes`。若某模型暂无官方 GGUF,从该条目删除并在 commit message 注明。

- [ ] **Step 3: 跑现有测试确认 catalog 解析仍通过**

Run: `pytest tests/sidecar/test_model_manager.py -v`
Expected: PASS(现有测试只验证 `get_available_models`/`get_local_models` 逻辑,不依赖具体条目,应仍通过)

- [ ] **Step 4: 验证** — Run: `npm run lint && pytest tests/sidecar -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: replace model catalog with 2026.6 end-side models (VL-first)"
```

---

## Phase 2 — 全局状态:下载持久 + 日志抽屉

### Task 9: vitest 设置 + useModelDownloads store

**Files:**
- Create: `tests/store/useModelDownloads.test.ts`
- Create: `src/store/useModelDownloads.ts`
- Modify: `src/api.ts`(在 global Window.llmApp 已有 `getDownloadProgress`,无需改)

**Interfaces:**
- Produces: `useModelDownloads` store,字段 `downloads: Record<string, DownloadState>`、`polling: boolean`;动作 `startDownload(id)`、`refreshProgress()`、`restore()`、`clearError(id)`、`stopPolling()`。内部 `setInterval` 1.5s 轮询所有 `downloading` 条目,完成/出错时刷新模型列表(通过 `api.getAvailableModels()`)。

- [ ] **Step 1: 写失败测试 `tests/store/useModelDownloads.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeProgress = vi.fn()
const fakeDownload = vi.fn()
const fakeAvailable = vi.fn()

vi.mock('../../src/api', () => ({
  api: {
    getDownloadProgress: fakeProgress,
    downloadModel: fakeDownload,
    getAvailableModels: fakeAvailable,
    getModelStatus: vi.fn(),
    getLocalModels: vi.fn(() => ({ models: [] })),
  },
}))

import { useModelDownloads } from '../src/store/useModelDownloads'

beforeEach(() => {
  useModelDownloads.setState({ downloads: {}, polling: false })
  fakeProgress.mockReset()
  fakeDownload.mockReset()
  fakeAvailable.mockReset()
})

describe('useModelDownloads', () => {
  it('startDownload sets downloading and calls api', async () => {
    fakeDownload.mockResolvedValue({ status: 'started', model_id: 'm1' })
    await useModelDownloads.getState().startDownload('m1')
    expect(useModelDownloads.getState().downloads['m1'].status).toBe('downloading')
    expect(fakeDownload).toHaveBeenCalledWith('m1')
  })

  it('restore queries progress for known downloading ids', async () => {
    useModelDownloads.setState({ downloads: { m2: { status: 'downloading', progress: 0 } } })
    fakeProgress.mockResolvedValue({ status: 'completed', progress: 1 })
    await useModelDownloads.getState().restore()
    expect(fakeProgress).toHaveBeenCalledWith('m2')
    expect(useModelDownloads.getState().downloads['m2'].status).toBe('completed')
  })

  it('restore marks not_found as error', async () => {
    useModelDownloads.setState({ downloads: { m3: { status: 'downloading', progress: 0 } } })
    fakeProgress.mockResolvedValue({ status: 'not_found' })
    await useModelDownloads.getState().restore()
    expect(useModelDownloads.getState().downloads['m3'].status).toBe('error')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/store/useModelDownloads.test.ts`
Expected: FAIL(module not found)

- [ ] **Step 3: 实现 `src/store/useModelDownloads.ts`**

```ts
import { create } from 'zustand'
import { api, DownloadState } from '../api'

let timer: ReturnType<typeof setInterval> | null = null

interface DownloadStore {
  downloads: Record<string, DownloadState>
  polling: boolean
  startDownload: (id: string) => Promise<void>
  refreshProgress: () => Promise<void>
  restore: () => Promise<void>
  clearError: (id: string) => void
  stopPolling: () => void
}

export const useModelDownloads = create<DownloadStore>((set, get) => ({
  downloads: {},
  polling: false,

  startDownload: async (id) => {
    set((s) => ({ downloads: { ...s.downloads, [id]: { status: 'downloading', progress: 0 } } }))
    try {
      const r = await api.downloadModel(id)
      if (r.status === 'error') set((s) => ({ downloads: { ...s.downloads, [id]: r } }))
    } catch (e) {
      set((s) => ({ downloads: { ...s.downloads, [id]: { status: 'error', progress: 0, error: String(e) } } }))
    }
    ensurePolling(set, get)
  },

  refreshProgress: async () => {
    const active = Object.entries(get().downloads).filter(([, d]) => d.status === 'downloading')
    if (active.length === 0) { get().stopPolling(); return }
    for (const [id] of active) {
      try {
        const st = await api.getDownloadProgress(id)
        set((s) => ({ downloads: { ...s.downloads, [id]: st } }))
        if (st.status === 'completed' || st.status === 'error') {
          await api.getAvailableModels()
        }
      } catch (e) { console.error(e) }
    }
  },

  restore: async () => {
    const active = Object.entries(get().downloads).filter(([, d]) => d.status === 'downloading')
    for (const [id] of active) {
      try {
        const st = await api.getDownloadProgress(id)
        if (st.status === 'not_found') {
          set((s) => ({ downloads: { ...s.downloads, [id]: { status: 'error', progress: 0, error: '下载已中断,请重试' } } }))
        } else {
          set((s) => ({ downloads: { ...s.downloads, [id]: st } }))
        }
      } catch (e) { console.error(e) }
    }
  },

  clearError: (id) => set((s) => { const next = { ...s.downloads }; delete next[id]; return { downloads: next } }),
  stopPolling: () => { if (timer) { clearInterval(timer); timer = null } set({ polling: false }) },
}))

function ensurePolling(set: (fn: any) => void, get: () => DownloadStore) {
  if (timer) return
  set({ polling: true })
  timer = setInterval(() => get().refreshProgress(), 1500)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/store/useModelDownloads.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: useModelDownloads store with polling + restore"
```

---

### Task 10: Settings 接 useModelDownloads(修复跨页面进度丢失)

**Files:**
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `useModelDownloads` 的 `downloads` / `startDownload` / `clearError`;本地模型列表仍由 Settings 自己 `loadData`,但 `getAvailableModels` 复用 store 刷新结果(简化:Settings 仍自调 `api.getAvailableModels`,store 仅负责进度)。

- [ ] **Step 1: 修改 Settings 下载相关逻辑**

把组件内 `downloads` useState + `handleDownload` + 轮询 `useEffect` 整段删除,改为从 store 取:

```tsx
import { useModelDownloads } from '../store/useModelDownloads'
// ...
const { downloads, startDownload, clearError } = useModelDownloads()
// 删除原 handleDownload、downloads useState、pollRef 轮询 useEffect
```

模型卡内 `handleDownload(m.id)` → `startDownload(m.id)`,`dlState` 从 `downloads[m.id]` 读(已有)。`isDownloading`/`isDownloaded`/渲染进度条逻辑不变。

- [ ] **Step 2: 在 App 挂载时恢复进行中下载**

`src/App.tsx` `useEffect` 内追加:

```tsx
import { useModelDownloads } from './store/useModelDownloads'
// useEffect 内:
useModelDownloads.getState().restore()
```

- [ ] **Step 3: 验证**

Run: `npm run lint && npx vitest run`
Expected: PASS;手动:Settings 发起下载 → 切到 Chat → 切回 Settings 进度仍在。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: model download progress persists across page navigation"
```

---

### Task 11: Sidebar 下载指示

**Files:**
- Modify: `src/App.tsx`(或 Sidebar,Phase 3 独立组件前先在 App 的 nav 内)

**Interfaces:**
- Consumes: `useModelDownloads`。

- [ ] **Step 1: 在 nav 底部加下载指示**

```tsx
import { useModelDownloads } from './store/useModelDownloads'
import { ArrowsClockwise } from '@phosphor-icons/react'
// ...
const activeDownloads = Object.values(useModelDownloads((s) => s.downloads)).filter((d) => d.status === 'downloading')
// 在导航区 Settings 链接后:
{activeDownloads.length > 0 && (
  <NavLink to="/settings" className={navItem}>
    <ArrowsClockwise size={18} className="animate-spin" /> 下载中 {activeDownloads.length}
  </NavLink>
)}
```

- [ ] **Step 2: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: sidebar download indicator"
```

---

### Task 12: sidecar stdout/stderr 日志转发

**Files:**
- Modify: `electron/sidecar.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/api.ts`

**Interfaces:**
- Produces: `electron/sidecar.ts` 暴露 `onLog(cb)` 注册 stdout/stderr 行监听;`main.ts` 启动后把日志 `webContents.send('sidecar:log', {stream, line, ts})`;`preload.ts` 暴露 `onLog`;`api.ts` 加 `LogEntry` 类型 + `onLog`。

- [ ] **Step 1: `electron/sidecar.ts` 加日志监听器**

在 `SidecarManager` 内把 stdout/stderr 的行式解析改为回调。修改 `start()` 中:

```ts
private logListeners = new Set<(e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void>()
onLog(cb: (e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void) {
  this.logListeners.add(cb); return () => this.logListeners.delete(cb)
}
private emitLog(stream: 'stdout' | 'stderr', line: string) {
  const e = { stream, line, ts: Date.now() }
  this.logListeners.forEach((cb) => cb(e))
}
```

把 `stdout?.on('data')` / `stderr?.on('data')` 内改为按行分割后 `this.emitLog('stdout'|'stderr', line)`(buffer 跨 chunk 拼接:维护 `private stdoutBuf = ''` / `stderrBuf = ''`,按 `\n` split,最后一段留存)。

- [ ] **Step 2: `electron/main.ts` 转发**

`setupIPC` 内(sidecar.start 后):

```ts
sidecar.onLog((e) => mainWindow?.webContents.send('sidecar:log', e))
```

- [ ] **Step 3: `electron/preload.ts` 暴露 onLog**

```ts
onLog: (cb: (e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, e: any) => cb(e)
  ipcRenderer.on('sidecar:log', handler)
  return () => ipcRenderer.removeListener('sidecar:log', handler)
},
```

- [ ] **Step 4: `src/api.ts` 加类型 + Window 声明**

```ts
export interface LogEntry { stream: 'stdout' | 'stderr'; line: string; ts: number }
// Window.llmApp 接口加:
onLog: (cb: (e: LogEntry) => void) => () => void
```

- [ ] **Step 5: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: forward sidecar stdout/stderr to renderer"
```

---

### Task 13: useLogs store(环形缓冲)

**Files:**
- Create: `tests/store/useLogs.test.ts`
- Create: `src/store/useLogs.ts`

**Interfaces:**
- Produces: `useLogs` store,字段 `entries: LogEntry[]`(最多 2000,超出 shift)、`clear()`、`push(e)`、`init()`(订阅 `api.onLog`)。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useLogs } from '../src/store/useLogs'

beforeEach(() => useLogs.setState({ entries: [] }))

describe('useLogs', () => {
  it('push appends entries', () => {
    useLogs.getState().push({ stream: 'stdout', line: 'hi', ts: 1 })
    expect(useLogs.getState().entries).toHaveLength(1)
  })
  it('ring buffer caps at 2000', () => {
    for (let i = 0; i < 2010; i++) useLogs.getState().push({ stream: 'stdout', line: String(i), ts: i })
    expect(useLogs.getState().entries).toHaveLength(2000)
    expect(useLogs.getState().entries[0].line).toBe('10')
  })
  it('clear empties entries', () => {
    useLogs.getState().push({ stream: 'stdout', line: 'x', ts: 1 })
    useLogs.getState().clear()
    expect(useLogs.getState().entries).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run tests/store/useLogs.test.ts` → FAIL

- [ ] **Step 3: 实现 `src/store/useLogs.ts`**

```ts
import { create } from 'zustand'
import { api, LogEntry } from '../api'

const MAX = 2000

interface LogStore {
  entries: LogEntry[]
  push: (e: LogEntry) => void
  clear: () => void
  init: () => () => void
}

export const useLogs = create<LogStore>((set) => ({
  entries: [],
  push: (e) => set((s) => {
    const next = [...s.entries, e]
    if (next.length > MAX) next.splice(0, next.length - MAX)
    return { entries: next }
  }),
  clear: () => set({ entries: [] }),
  init: () => {
    if (typeof window === 'undefined' || !window.llmApp?.onLog) return () => {}
    return window.llmApp.onLog((e) => useLogs.getState().push(e))
  },
}))
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run tests/store/useLogs.test.ts` → PASS

- [ ] **Step 5: App 挂载时 init**

`src/App.tsx` `useEffect` 内 `useLogs.getState().init()`(保存返回值在 cleanup 调用)。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: useLogs ring buffer store"
```

---

### Task 14: LogDrawer 组件

**Files:**
- Create: `src/components/LogDrawer.tsx`

**Interfaces:**
- Consumes: `useLogs`。
- Produces: `<LogDrawer />` 自包含(收起/展开、清空、自动跟随)。展开高度 240,可拖拽 120-480。

- [ ] **Step 1: 创建 `src/components/LogDrawer.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Terminal, Trash, CaretUp, CaretDown } from '@phosphor-icons/react'
import { useLogs } from '../store/useLogs'

export function LogDrawer() {
  const entries = useLogs((s) => s.entries)
  const clear = useLogs((s) => s.clear)
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(240)
  const [follow, setFollow] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (follow && scrollRef.current && open) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries, follow, open])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const h = window.innerHeight - e.clientY
      setHeight(Math.max(120, Math.min(480, h)))
    }
    const onUp = () => { draggingRef.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const last = entries[entries.length - 1]

  return (
    <div className="shrink-0 border-t border-[--color-border]" style={open ? { height } : {}}>
      {open && <div className="h-1 cursor-row-resize bg-transparent" onMouseDown={() => { draggingRef.current = true }} />}
      <div className="flex items-center gap-2 px-4 h-7 text-[12px]">
        <Terminal size={14} className="text-[--color-text-muted]" />
        <span className="text-[--color-text-muted]">后端日志</span>
        {!open && last && <span className="text-[--color-text-muted] truncate flex-1">{last.line}</span>}
        <span className="text-[--color-text-muted]">{entries.length}</span>
        <button onClick={clear} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label="清空"><Trash size={13} /></button>
        <button onClick={() => setOpen((o) => !o)} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label={open ? '收起' : '展开'}>
          {open ? <CaretDown size={13} /> : <CaretUp size={13} />}
        </button>
      </div>
      {open && (
        <div ref={scrollRef} onScroll={(e) => {
          const el = e.currentTarget; const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
          setFollow(atBottom)
        }} className="overflow-auto px-4 py-1 font-mono text-[12px] leading-relaxed h-[calc(100%-28px)]">
          {entries.length === 0 ? <div className="text-[--color-text-muted] py-4">暂无日志,sidecar 启动后此处显示模型调用输出</div> :
            entries.map((e, i) => {
              const t = new Date(e.ts); const ts = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
              const err = e.stream === 'stderr' || /error|traceback/i.test(e.line)
              return <div key={i} className={err ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}><span className="opacity-60">{ts}</span> {e.line}</div>
            })}
          {!follow && <button onClick={() => setFollow(true)} className="sticky bottom-2 ml-auto block px-2 py-1 rounded bg-[--color-surface-2] text-[--color-text]">↓ 跟随最新</button>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 在 Chat 页接入(Composer 上方)**

`src/pages/Chat.tsx` 在 `<Composer />` 上方加 `<LogDrawer />`。

- [ ] **Step 3: 验证** — Run: `npm run lint` → PASS;手动:展开抽屉可见 sidecar 日志。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: collapsible log drawer"
```

---

## Phase 3 — 会话持久化

### Task 15: sidecar conversations.py + pytest

**Files:**
- Create: `sidecar/conversations.py`
- Create: `tests/sidecar/test_conversations.py`

**Interfaces:**
- Produces: `ConversationStore` 类,方法 `list_conversations() -> list[dict]`、`get(id) -> dict | None`、`save(conv: dict) -> str`、`rename(id, title) -> dict`、`delete(id) -> bool`。存 `~/.llm-app/conversations/{id}.json`。`id` 为 `uuid4` hex。`save` upsert:有 id 更新,无 id 新建。`list` 按 `updated_at` desc。

- [ ] **Step 1: 写失败测试 `tests/sidecar/test_conversations.py`**

```python
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest tests/sidecar/test_conversations.py -v`
Expected: FAIL(ImportError)

- [ ] **Step 3: 实现 `sidecar/conversations.py`**

```python
from __future__ import annotations
import json, os, uuid
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
        now = conv.get("updated_at") or __import__("time").time()
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pytest tests/sidecar/test_conversations.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: conversation file persistence store"
```

---

### Task 16: sidecar main.py conversations 路由

**Files:**
- Modify: `sidecar/main.py`

**Interfaces:**
- Produces: 路由 `GET /conversations`、`GET /conversations/{id}`、`POST /conversations`、`PUT /conversations/{id}`、`PATCH /conversations/{id}`、`DELETE /conversations/{id}`。

- [ ] **Step 1: 修改 `sidecar/main.py`**

顶部 import:

```python
from conversations import ConversationStore
```

`lifespan` 内 `app_state["conversations"] = ConversationStore()`。

路由(加在 skills 路由后):

```python
class ConversationBody(BaseModel):
    id: str | None = None
    title: str | None = None
    messages: list[dict] = []


class RenameBody(BaseModel):
    title: str


@app.get("/conversations")
async def list_conversations():
    return {"conversations": app_state["conversations"].list_conversations()}


@app.get("/conversations/{cid}")
async def get_conversation(cid: str):
    c = app_state["conversations"].get(cid)
    if c is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return c


@app.post("/conversations")
async def create_conversation(req: ConversationBody):
    cid = app_state["conversations"].save(req.model_dump())
    return {"id": cid}


@app.put("/conversations/{cid}")
async def update_conversation(cid: str, req: ConversationBody):
    body = req.model_dump(); body["id"] = cid
    app_state["conversations"].save(body)
    return {"id": cid}


@app.patch("/conversations/{cid}")
async def rename_conversation(cid: str, req: RenameBody):
    c = app_state["conversations"].rename(cid, req.title)
    if c is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"status": "ok"}


@app.delete("/conversations/{cid}")
async def delete_conversation(cid: str):
    app_state["conversations"].delete(cid)
    return {"status": "ok"}
```

- [ ] **Step 2: 验证** — Run: `pytest tests/sidecar -v`(全量)→ PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: conversations CRUD routes"
```

---

### Task 17: Electron IPC for conversations

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

**Interfaces:**
- Produces: IPC 代理 + preload 暴露 `listConversations/getConversation/saveConversation/renameConversation/deleteConversation`。

- [ ] **Step 1: `electron/main.ts` 加 handlers**

```ts
ipcMain.handle('conversations:list', async () => (await fetch(`${sidecar.baseUrl}/conversations`)).json())
ipcMain.handle('conversations:get', async (_e, id: string) => (await fetch(`${sidecar.baseUrl}/conversations/${id}`)).json())
ipcMain.handle('conversations:save', async (_e, conv: any) => {
  const res = await fetch(`${sidecar.baseUrl}/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conv) })
  return res.json()
})
ipcMain.handle('conversations:rename', async (_e, id: string, title: string) => {
  const res = await fetch(`${sidecar.baseUrl}/conversations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
  return res.json()
})
ipcMain.handle('conversations:delete', async (_e, id: string) => {
  const res = await fetch(`${sidecar.baseUrl}/conversations/${id}`, { method: 'DELETE' })
  return res.json()
})
```

- [ ] **Step 2: `electron/preload.ts` 暴露**

```ts
listConversations: () => ipcRenderer.invoke('conversations:list'),
getConversation: (id: string) => ipcRenderer.invoke('conversations:get', id),
saveConversation: (conv: unknown) => ipcRenderer.invoke('conversations:save', conv),
renameConversation: (id: string, title: string) => ipcRenderer.invoke('conversations:rename', id, title),
deleteConversation: (id: string) => ipcRenderer.invoke('conversations:delete', id),
```

- [ ] **Step 3: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: electron ipc for conversations"
```

---

### Task 18: api.ts conversation 类型 + methods

**Files:**
- Modify: `src/api.ts`

**Interfaces:**
- Produces: `Conversation` / `ConversationMeta` 类型;`api.listConversations/getConversation/saveConversation/renameConversation/deleteConversation`。

- [ ] **Step 1: 修改 `src/api.ts`**

```ts
export interface ConversationMeta { id: string; title: string; updated_at: number }
export interface Conversation {
  id: string; title: string; updated_at: number; created_at: number
  messages: Array<{ role: 'user' | 'assistant'; content: string; images?: string[] }>
}
```

`Window.llmApp` 接口加:

```ts
listConversations: () => Promise<{ conversations: ConversationMeta[] }>
getConversation: (id: string) => Promise<Conversation>
saveConversation: (conv: Partial<Conversation> & { title: string; messages: Conversation['messages'] }) => Promise<{ id: string }>
renameConversation: (id: string, title: string) => Promise<{ status: string }>
deleteConversation: (id: string) => Promise<{ status: string }>
```

- [ ] **Step 2: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: api conversation types and methods"
```

---

### Task 19: useConversations store + tests

**Files:**
- Create: `tests/store/useConversations.test.ts`
- Create: `src/store/useConversations.ts`

**Interfaces:**
- Produces: `useConversations` store,字段 `list: ConversationMeta[]`、`currentId: string | null`、`messages: Message[]`、`streaming: boolean`;动作 `loadList()`、`select(id)`、`newChat()`、`send(text, images?)`(自动建会话/流式追加/完成后 save)、`stop()`、`remove(id)`、`rename(id, title)`。`Message = {id, role, content, images?}`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
const fakeList = vi.fn(); const fakeGet = vi.fn(); const fakeSave = vi.fn(); const fakeRename = vi.fn(); const fakeDelete = vi.fn()
vi.mock('../../src/api', () => ({
  api: {
    listConversations: fakeList, getConversation: fakeGet, saveConversation: fakeSave,
    renameConversation: fakeRename, deleteConversation: fakeDelete,
    chatStream: vi.fn(() => () => {}),
  },
}))
import { useConversations } from '../src/store/useConversations'

beforeEach(() => { useConversations.setState({ list: [], currentId: null, messages: [], streaming: false }); vi.clearAllMocks() })

describe('useConversations', () => {
  it('loadList populates list', async () => {
    fakeList.mockResolvedValue({ conversations: [{ id: '1', title: 't', updated_at: 1 }] })
    await useConversations.getState().loadList()
    expect(useConversations.getState().list).toHaveLength(1)
  })
  it('select loads messages', async () => {
    fakeGet.mockResolvedValue({ id: '2', title: 't', messages: [{ role: 'user', content: 'hi' }], updated_at: 1, created_at: 1 })
    await useConversations.getState().select('2')
    expect(useConversations.getState().currentId).toBe('2')
    expect(useConversations.getState().messages).toHaveLength(1)
  })
  it('newChat clears current', () => {
    useConversations.setState({ currentId: 'x', messages: [{ id: '1', role: 'user', content: 'x' }] })
    useConversations.getState().newChat()
    expect(useConversations.getState().currentId).toBeNull()
    expect(useConversations.getState().messages).toHaveLength(0)
  })
  it('remove deletes from list', async () => {
    useConversations.setState({ list: [{ id: '3', title: 't', updated_at: 1 }] })
    fakeDelete.mockResolvedValue({ status: 'ok' })
    await useConversations.getState().remove('3')
    expect(useConversations.getState().list).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run tests/store/useConversations.test.ts` → FAIL

- [ ] **Step 3: 实现 `src/store/useConversations.ts`**

```ts
import { create } from 'zustand'
import { api, ConversationMeta } from '../api'

export interface Message { id: string; role: 'user' | 'assistant'; content: string; images?: string[] }

interface ConvStore {
  list: ConversationMeta[]
  currentId: string | null
  messages: Message[]
  streaming: boolean
  loadList: () => Promise<void>
  select: (id: string) => Promise<void>
  newChat: () => void
  send: (text: string, images?: string[]) => Promise<void>
  stop: () => void
  remove: (id: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
}

let cleanupStream: (() => void) | null = null

export const useConversations = create<ConvStore>((set, get) => ({
  list: [], currentId: null, messages: [], streaming: false,

  loadList: async () => { const d = await api.listConversations(); set({ list: d.conversations }) },

  select: async (id) => {
    if (get().streaming) get().stop()
    const c = await api.getConversation(id)
    set({ currentId: id, messages: c.messages.map((m, i) => ({ id: `${id}-${i}`, ...m })) })
  },

  newChat: () => { if (get().streaming) get().stop(); set({ currentId: null, messages: [] }) },

  send: async (text, images) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, images }
    const assistantId = (Date.now() + 1).toString()
    const base = get().messages
    const next = [...base, userMsg, { id: assistantId, role: 'assistant' as const, content: '' }]
    set({ messages: next, streaming: true })

    const cid = get().currentId
    const title = text.slice(0, 40) || '新对话'

    const chatMessages = [...base, userMsg].map((m) => ({
      role: m.role,
      content: m.images?.length ? [{ type: 'image_url', image_url: { url: m.images[0] } }, { type: 'text', text: m.content }] : (m.content || ''),
    }))

    cleanupStream = api.chatStream(chatMessages,
      (token) => set((s) => ({ messages: s.messages.map((m) => m.id === assistantId ? { ...m, content: m.content + token } : m) })),
      async () => {
        set({ streaming: false })
        const saved = await api.saveConversation({ id: cid ?? undefined, title, messages: get().messages.map(({ role, content, images }) => ({ role, content, images })) })
        if (!get().currentId) set({ currentId: saved.id })
        get().loadList()
      })
  },

  stop: () => { cleanupStream?.(); cleanupStream = null; set({ streaming: false }) },

  remove: async (id) => { await api.deleteConversation(id); if (get().currentId === id) get().newChat(); await get().loadList() },
  rename: async (id, title) => { await api.renameConversation(id, title); await get().loadList() },
}))
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run tests/store/useConversations.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: useConversations store"
```

---

### Task 20: Sidebar 独立组件(会话列表)

**Files:**
- Create: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`(用新 Sidebar 替换内联 nav)

**Interfaces:**
- Consumes: `useConversations`、router(用 `useNavigate`)、`ThemeToggle`。
- Produces: `<Sidebar />` 含 New chat 按钮、搜索框、分组会话列表(Today/Previous 7 Days/Older)、hover 删除/重命名、底部导航 + 主题。

- [ ] **Step 1: 创建 `src/components/Sidebar.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Plus, MagnifyingGlass, ChatCircle, PuzzlePiece, Gear, Trash, DotsThree, PencilSimple, ArrowsClockwise } from '@phosphor-icons/react'
import { useConversations } from '../store/useConversations'
import { useModelDownloads } from '../store/useModelDownloads'
import { ThemeToggle } from './ThemeToggle'
import { ConfirmDialog } from './ConfirmDialog'

const DAY = 86400000

function group(list: { id: string; title: string; updated_at: number }[]) {
  const now = Date.now() / 1000
  const today: any[] = []; const week: any[] = []; const older: any[] = []
  for (const c of list) {
    const age = now - c.updated_at
    if (age < DAY) today.push(c); else if (age < 7 * DAY) week.push(c); else older.push(c)
  }
  return { today, week, older }
}

export function Sidebar() {
  const { list, loadList, select, remove, rename, currentId, newChat } = useConversations()
  const activeDownloads = Object.values(useModelDownloads((s) => s.downloads)).filter((d) => d.status === 'downloading')
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => { loadList() }, [])

  const filtered = list.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
  const { today, week, older } = group(filtered)

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-[--color-surface-2] text-[--color-text] font-medium' : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-2]/60'}`

  const Row = (c: { id: string; title: string }) => (
    <div key={c.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${currentId === c.id ? 'bg-[--color-surface-2] text-[--color-text]' : 'text-[--color-text-muted] hover:bg-[--color-surface-2]/60'}`}
      onClick={() => { select(c.id); nav('/') }}>
      {renaming === c.id ? (
        <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => { if (renameVal.trim()) rename(c.id, renameVal.trim()); setRenaming(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 bg-transparent outline-none text-[13px] text-[--color-text] border-b border-[--color-accent]" />
      ) : <span className="flex-1 truncate text-[13px]">{c.title}</span>}
      {renaming !== c.id && (
        <div className="hidden group-hover:flex gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); setRenaming(c.id); setRenameVal(c.title) }} className="p-1 rounded hover:bg-[--color-border]"><PencilSimple size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); setConfirmDel(c.id) }} className="p-1 rounded hover:bg-[--color-border]"><Trash size={13} /></button>
        </div>
      )}
    </div>
  )

  const Section = ({ label, items }: { label: string; items: any[] }) => items.length ? (
    <div className="mb-3">
      <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[--color-text-muted] opacity-70">{label}</div>
      {items.map(Row)}
    </div>
  ) : null

  return (
    <nav className="w-[260px] shrink-0 border-r border-[--color-border] bg-[--color-surface] flex flex-col">
      <div className="p-3">
        <button onClick={() => { newChat(); nav('/') }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[--color-border] text-[13px] text-[--color-text] hover:bg-[--color-accent-soft] hover:border-[--color-accent]/40 transition-colors">
          <Plus size={16} /> 新对话
        </button>
      </div>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[--color-surface-2]/60">
          <MagnifyingGlass size={15} className="text-[--color-text-muted]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对话"
            className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
      </div>
      <div className="flex-1 overflow-auto px-2">
        <Section label="今天" items={today} />
        <Section label="过去 7 天" items={week} />
        <Section label="更早" items={older} />
      </div>
      <div className="p-3 border-t border-[--color-border] flex flex-col gap-1">
        <NavLink to="/" end className={navItem}><ChatCircle size={18} /> 对话</NavLink>
        <NavLink to="/skills" className={navItem}><PuzzlePiece size={18} /> Skills</NavLink>
        <NavLink to="/settings" className={navItem}><Gear size={18} /> 设置</NavLink>
        {activeDownloads.length > 0 && (
          <NavLink to="/settings" className={navItem}>
            <ArrowsClockwise size={18} className="animate-spin" /> 下载中 {activeDownloads.length}
          </NavLink>
        )}
        <div className="pt-2 mt-1 border-t border-[--color-border]"><ThemeToggle /></div>
      </div>
      {confirmDel && <ConfirmDialog title="删除对话?" confirmText="删除" onConfirm={async () => { await remove(confirmDel); setConfirmDel(null) }} onCancel={() => setConfirmDel(null)} />}
    </nav>
  )
}
```

- [ ] **Step 2: 创建 `src/components/ConfirmDialog.tsx`**

```tsx
interface ConfirmDialogProps { title: string; confirmText?: string; onConfirm: () => void; onCancel: () => void }
export function ConfirmDialog({ title, confirmText = '确认', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center z-50" onClick={onCancel}>
      <div className="bg-[--color-canvas] rounded-xl p-5 min-w-[280px] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] mb-4">{title}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[13px] hover:bg-[--color-surface-2]">取消</button>
          <button onClick={onConfirm} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[13px] hover:opacity-90">{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: App.tsx 用 Sidebar 替换内联 nav**

`App.tsx` 删除内联 `<nav>`,改为 `<Sidebar />`;侧栏折叠状态留到 Phase 5(本 task 常开)。

- [ ] **Step 4: 验证** — Run: `npm run lint && npx vitest run` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sidebar with conversation list + grouping"
```

---

### Task 21: Chat 页接 useConversations(新建会话流程)

**Files:**
- Modify: `src/pages/Chat.tsx`

**Interfaces:**
- Consumes: `useConversations`(send/streaming/messages/stop),替换原 `useChat`。

- [ ] **Step 1: 重写 `src/pages/Chat.tsx`**

```tsx
import { TopBar } from '../components/TopBar'
import { Composer } from '../components/Composer'
import { LogDrawer } from '../components/LogDrawer'
import { useConversations } from '../store/useConversations'

export function Chat() {
  const { messages, streaming, send, stop } = useConversations()
  return (
    <div className="flex flex-col h-full">
      <TopBar onToggleSidebar={() => {}} />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="text-center text-[--color-text-muted] mt-24">发送消息开始对话</div>
          ) : messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-2xl px-4 py-3 max-w-[80%] whitespace-pre-wrap leading-[1.65] ${m.role === 'user' ? 'bg-[--color-surface-2]' : ''}`}>{m.content}</div>
            </div>
          ))}
        </div>
      </div>
      <LogDrawer />
      <Composer onSend={send} onStop={stop} streaming={streaming} />
    </div>
  )
}
```

- [ ] **Step 2: 删除 `src/hooks/useChat.ts`、`src/components/ChatView.tsx`、`InputBox.tsx`、`MessageList.tsx`**

```bash
rm src/hooks/useChat.ts src/components/ChatView.tsx src/components/InputBox.tsx src/components/MessageList.tsx
```

- [ ] **Step 3: 验证** — Run: `npm run lint && npx vitest run` → PASS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: chat page wired to useConversations; remove legacy components"
```

---

## Phase 4 — 消息与流式

### Task 22: Message 组件(Markdown + 操作)

**Files:**
- Create: `src/components/Message.tsx`

**Interfaces:**
- Consumes: `Message` from store;`onCopy/onRegenerate/onEdit` 回调(Phase 4 后续 task 实现,本 task 先接复制)。
- Produces: `<Message msg={...} isLast={bool} streaming={bool} onRegenerate onEdit />`。用户消息 = surface-2 块纯文本;助手 = Sparkle 头像 + Markdown 渲染 + hover 复制/重生成。

- [ ] **Step 1: 创建 `src/components/Message.tsx`**

```tsx
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Sparkle, Copy, ArrowsClockwise, PencilSimple, Check } from '@phosphor-icons/react'
import type { Message as Msg } from '../store/useConversations'

interface Props {
  msg: Msg
  streaming: boolean
  isLast: boolean
  onRegenerate: () => void
  onEdit: (newText: string) => void
}

export function Message({ msg, streaming, isLast, onRegenerate, onEdit }: Props) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)

  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  if (msg.role === 'user' && !editing) {
    return (
      <div className="group flex flex-col items-end">
        <span className="text-[12px] text-[--color-text-muted] mb-1 px-1">你</span>
        <div className="flex items-end gap-2 max-w-[80%]">
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 mb-1">
            <button onClick={() => { setDraft(msg.content); setEditing(true) }} className="p-1 rounded hover:bg-[--color-surface-2]"><PencilSimple size={14} /></button>
            <button onClick={copy} className="p-1 rounded hover:bg-[--color-surface-2]">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
          </div>
          <div className="rounded-[14px] px-4 py-3 bg-[--color-surface-2] whitespace-pre-wrap leading-[1.65]">
            {msg.images?.map((img, i) => <img key={i} src={img} alt="" className="max-h-60 rounded-lg mb-2 block" />)}
            {msg.content}
          </div>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end">
        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
          className="w-[80%] rounded-[14px] px-4 py-3 bg-[--color-surface-2] outline-none ring-2 ring-[--color-accent]/40 resize-none" />
        <div className="flex gap-2 mt-2">
          <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg text-[13px] hover:bg-[--color-surface-2]">取消</button>
          <button onClick={() => { onEdit(draft); setEditing(false) }} className="px-3 py-1 rounded-lg bg-[--color-accent] text-white text-[13px]">保存并重发</button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex gap-3">
      <Sparkle size={20} weight="fill" className="text-[--color-accent] mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[12px] text-[--color-text-muted] mb-1 block px-0.5">AI</span>
        <div className="prose prose-sm max-w-none dark:prose-invert leading-[1.65]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{
            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          }}>{msg.content}</ReactMarkdown>
          {streaming && isLast && <span className="inline-block w-2 h-4 bg-[--color-accent] align-middle animate-pulse" />}
        </div>
        {!streaming && (
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 mt-1.5">
            <button onClick={copy} className="p-1 rounded hover:bg-[--color-surface-2]">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            <button onClick={onRegenerate} className="p-1 rounded hover:bg-[--color-surface-2]"><ArrowsClockwise size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden my-3 bg-[#1F1E1D]">
      <pre className="p-4 overflow-auto text-[13px] font-mono text-[#EDEBE5]">{children}</pre>
    </div>
  )
}
```

- [ ] **Step 2: 在 `src/index.css` 末尾加 highlight.js 主题**

```css
@import "highlight.js/styles/github-dark.css";
```

- [ ] **Step 3: 验证** — Run: `npm run lint` → PASS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: message component with markdown + actions"
```

---

### Task 23: MessageStream + EmptyState + Chat 接入

**Files:**
- Create: `src/components/MessageStream.tsx`
- Create: `src/components/EmptyState.tsx`
- Modify: `src/pages/Chat.tsx`

**Interfaces:**
- Produces: `MessageStream` 自动滚动 + 渲染 `Message[]`;`EmptyState` 星标 + 问候 + 4 示例 chip。

- [ ] **Step 1: 创建 `src/components/EmptyState.tsx`**

```tsx
import { Sparkle } from '@phosphor-icons/react'

const EXAMPLES = ['帮我总结这段文档', '解释一下这段代码', '写一个 Python 脚本批量重命名文件', '把这段中文翻译成英文']

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <Sparkle size={36} weight="fill" className="text-[--color-accent] mb-4" />
      <h2 className="text-[22px] font-semibold mb-2">今天能帮你做点什么?</h2>
      <p className="text-[--color-text-muted] text-[14px] mb-8">发送消息开始对话,或试试下面的示例</p>
      <div className="grid sm:grid-cols-2 gap-2 max-w-xl w-full">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => onPick(ex)}
            className="text-left px-4 py-3 rounded-xl border border-[--color-border] hover:bg-[--color-surface] hover:border-[--color-accent]/40 transition-colors text-[14px] text-[--color-text-muted]">
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `src/components/MessageStream.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Message } from './Message'
import type { Message as Msg } from '../store/useConversations'

interface Props { messages: Msg[]; streaming: boolean; onRegenerate: () => void; onEdit: (text: string) => void }
const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function MessageStream({ messages, streaming, onRegenerate, onEdit }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }) }, [messages])
  if (messages.length === 0) return null
  return (
    <div ref={ref} className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-7">
        {messages.map((m, i) => (
          <motion.div key={m.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
            <Message msg={m} streaming={streaming} isLast={i === messages.length - 1} onRegenerate={onRegenerate} onEdit={onEdit} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 重写 `src/pages/Chat.tsx`**

```tsx
import { TopBar } from '../components/TopBar'
import { Composer } from '../components/Composer'
import { LogDrawer } from '../components/LogDrawer'
import { MessageStream } from '../components/MessageStream'
import { EmptyState } from '../components/EmptyState'
import { useConversations } from '../store/useConversations'

export function Chat() {
  const { messages, streaming, send, stop } = useConversations()
  return (
    <div className="flex flex-col h-full">
      <TopBar onToggleSidebar={() => {}} />
      {messages.length === 0 ? <EmptyState onPick={(t) => send(t)} /> : <MessageStream messages={messages} streaming={streaming} onRegenerate={() => {}} onEdit={(t) => send(t)} />}
      <LogDrawer />
      <Composer onSend={send} onStop={stop} streaming={streaming} />
    </div>
  )
}
```

- [ ] **Step 4: 验证** — Run: `npm run lint && npx vitest run` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: message stream + empty state + animations"
```

---

### Task 24: 复制 / 重生成 / 编辑 接 store

**Files:**
- Modify: `src/store/useConversations.ts`
- Modify: `src/pages/Chat.tsx`

**Interfaces:**
- Produces: store 动作 `regenerate()`(删最后一条 assistant,重发上一条 user)、`editLast(text)`(截断到被编辑 user,替换文本后重发)。

- [ ] **Step 1: store 加动作**

```ts
// useConversations.ts 内追加动作:
regenerate: () => {
  const msgs = get().messages
  let lastUser = -1
  for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user') { lastUser = i; break } }
  if (lastUser < 0) return
  const userMsg = msgs[lastUser]
  set({ messages: msgs.slice(0, lastUser) })
  get().send(userMsg.content, userMsg.images)
},
editAndResend: (text: string) => {
  const msgs = get().messages
  let lastUser = -1
  for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user') { lastUser = i; break } }
  if (lastUser < 0) { get().send(text); return }
  set({ messages: msgs.slice(0, lastUser) })
  get().send(text)
},
```

加到 interface 与 create 对象。

- [ ] **Step 2: Chat 页接回调**

```tsx
const { messages, streaming, send, stop, regenerate, editAndResend } = useConversations()
// MessageStream props:
onRegenerate={regenerate} onEdit={editAndResend}
```

- [ ] **Step 3: 加测试**

```ts
// tests/store/useConversations.test.ts 内追加:
it('regenerate removes last assistant and resends', async () => {
  useConversations.setState({ messages: [{ id: '1', role: 'user', content: 'hi' }, { id: '2', role: 'assistant', content: 'hey' }], currentId: 'c1' })
  const { api } = await import('../../src/api')
  ;(api.chatStream as any).mockImplementation((_m: any, onToken: any, onDone: any) => { onDone(); return () => {} })
  await useConversations.getState().regenerate()
  expect(useConversations.getState().messages.some((m) => m.role === 'assistant')).toBe(true)
})
```

- [ ] **Step 4: 验证** — Run: `npx vitest run tests/store/useConversations.test.ts && npm run lint` → PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: regenerate + edit-and-resend actions"
```

---

## Phase 5 — 打磨

### Task 25: 侧栏折叠 + TopBar 接入

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/pages/Chat.tsx`

**Interfaces:**
- Produces: `sidebarOpen` 状态提到 App 层,TopBar 按钮真正折叠/展开侧栏;Settings/Skills 页也加 TopBar(共享折叠)。

- [ ] **Step 1: App 持有 sidebarOpen 并下传**

```tsx
const [sidebarOpen, setSidebarOpen] = useState(true)
// 通过 context 或 props 传给 TopBar;最简:在 main 区顶部每个页面渲染 TopBar。
```

把 TopBar 提到 App 层 main 之上(各页面不再各自渲染 TopBar):

```tsx
<main className="flex-1 flex flex-col overflow-hidden">
  <TopBar onToggleSidebar={() => setSidebarOpen((s) => !s)} />
  <Routes>...</Routes>
</main>
```

Sidebar 条件渲染:`{sidebarOpen && <Sidebar />}`。Chat 页删除自己的 `<TopBar>`。

- [ ] **Step 2: Settings/Skills 页顶部留出 TopBar 空间**

各页根 div 改 `h-full overflow-auto`(TopBar 已在 App 层)。

- [ ] **Step 3: 验证** — Run: `npm run lint` → PASS;手动折叠/展开。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: collapsible sidebar"
```

---

### Task 26: 模型选择器下拉

**Files:**
- Modify: `src/components/TopBar.tsx`
- Modify: `src/api.ts`(已有 getLocalModels)

**Interfaces:**
- Produces: TopBar 中间显示当前模型名 + 下拉(本地已下载模型列表),选中 `api.loadModel(path)`。

- [ ] **Step 1: TopBar 加模型选择器**

```tsx
import { useState, useEffect } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { api, LocalModel } from '../api'

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [status, setStatus] = useState<{ loaded: boolean; path?: string }>({ loaded: false })
  const [locals, setLocals] = useState<LocalModel[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    api.getModelStatus().then(setStatus)
    api.getLocalModels().then((d) => setLocals(d.models))
  }, [])
  const current = locals.find((l) => l.path === status.path)?.name || (status.loaded ? '已加载' : '未加载')
  return (
    <header className="flex items-center gap-2 px-4 h-12 border-b border-[--color-border] shrink-0">
      <button onClick={onToggleSidebar} className="p-1.5 rounded-lg text-[--color-text-muted] hover:bg-[--color-surface-2] hover:text-[--color-text] transition-colors" aria-label="切换侧栏"><SidebarSimple size={18} /></button>
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] hover:bg-[--color-surface-2] transition-colors">
          {current} <CaretDown size={13} />
        </button>
        {open && (
          <div className="absolute top-full mt-1 left-0 min-w-[220px] bg-[--color-canvas] border border-[--color-border] rounded-xl shadow-lg py-1 z-50" onClick={() => setOpen(false)}>
            {locals.map((l) => (
              <button key={l.path} onClick={async () => { await api.loadModel(l.path); setStatus(await api.getModelStatus()); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[--color-surface] text-left">
                <span className="flex-1 truncate">{l.name}</span>
                {l.path === status.path && <Check size={14} className="text-[--color-accent]" />}
              </button>
            ))}
            {locals.length === 0 && <div className="px-3 py-2 text-[13px] text-[--color-text-muted]">无本地模型,请先到设置下载</div>}
          </div>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: 验证** — Run: `npm run lint` → PASS;手动切换模型。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: model selector dropdown in topbar"
```

---

### Task 27: 键盘快捷键

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `Cmd/Ctrl+K` 新对话、`Cmd/Ctrl+Shift+O` 折叠侧栏、`Cmd/Ctrl+L` 切换日志抽屉。

- [ ] **Step 1: App 加全局快捷键**

```tsx
import { useConversations } from './store/useConversations'
import { useLogs } from './store/useLogs'

useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === 'k') { e.preventDefault(); useConversations.getState().newChat() }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); setSidebarOpen((s) => !s) }
    if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); useLogs.getState() /* toggle via store state */ }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])
```

LogDrawer 开关需提到 store:`useLogs` 加 `open` 字段 + `toggle()`(或用独立 UI store);LogDrawer 读 `open` 而非本地 state。本 task 给 `useLogs` 加 `open: boolean` + `toggleOpen()`。

- [ ] **Step 2: useLogs 加 open/toggle**

```ts
// useLogs.ts interface:
open: boolean; toggleOpen: () => void
// create:
open: false, toggleOpen: () => set((s) => ({ open: !s.open }))
```

LogDrawer 改用 `const open = useLogs(s => s.open)` + `toggleOpen`。

- [ ] **Step 3: 验证** — Run: `npm run lint && npx vitest run` → PASS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: keyboard shortcuts"
```

---

### Task 28: 暗色模式全量校验 + a11y 复核

**Files:**
- 各组件(无新增,审计 + 修)

- [ ] **Step 1: 逐页暗色校验**

`npm run dev`,手动切暗色,逐组件核对:Sidebar / TopBar / Composer / Message / MessageStream / EmptyState / LogDrawer / Settings / Skills / ConfirmDialog。修任何 `bg-white`/硬编码浅色残留(应为 token 类)。

- [ ] **Step 2: 对比度复核**

确保 `--color-text` on `--color-canvas`、`--color-text-muted` on `--color-surface` 均过 WCAG AA(已有暖灰 token 满足)。composer 聚焦环 `ring-[--color-accent]/40` 可见。

- [ ] **Step 3: 聚焦可见性**

所有交互元素加 `focus-visible:ring-2 focus-visible:ring-[--color-accent]/40 focus-visible:outline-none`(批量补到按钮/输入)。

- [ ] **Step 4: reduced-motion 复核**

`prefers-reduced-motion: reduce` 下 MessageStream 不动画、LogDrawer 指示图标不 spin、Composer 无过渡。确认 `animate-pulse`/`animate-spin` 在 reduce 下停(可加全局 CSS `@media (prefers-reduced-motion: reduce){ *{animation:none!important; transition:none!important} }`)。

在 `src/index.css` 加:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 5: 验证** — Run: `npm run lint && npx vitest run && pytest tests/sidecar -v` → PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "polish: dark mode audit + a11y + reduced motion"
```

---

## Verification (全部完成)

- `npm run lint`(tsc)无错误
- `npx vitest run` 全绿
- `pytest tests/sidecar -v` 全绿
- 手动:新建/切换/删除/重命名会话;流式 Stop;图片拖拽/粘贴;暗色全组件;Markdown 代码块;reduced-motion;侧栏折叠;模型切换;日志抽屉展开/跟随/清空;下载跨页面进度持久。
- 模型目录:Settings 推荐模型区显示 16 个新一代模型(9 VL + 7 纯文本),按硬件档分组清晰;TopBar 模型选择器下拉正确列出本地已下载模型;每个 catalog URL 实际可下载。
