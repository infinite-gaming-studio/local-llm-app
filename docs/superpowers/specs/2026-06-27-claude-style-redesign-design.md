# Local LLM App — Claude 风格重设计

## 概述

对现有 Local LLM App 的渲染层(Electron + React)做一次以 Claude.ai 为参照的交互与视觉重设计,并补齐多会话历史持久化。目标:交互逻辑深度复刻 Claude.ai,移除全部 emoji 改为图标,设计风格精致、克制、冷静。

**Design Read:** 桌面端 AI 聊天产品(Electron 渲染层)的重设计,面向中文重度用户,采用 Claude.ai 式 calm / refined 设计语言,leaning toward Tailwind v4 + 自托管 Geist 字体 + Phosphor 图标 + 受控微动效。

**Dials(为聊天产品校准,非落地页):** `DESIGN_VARIANCE 4 / MOTION_INTENSITY 3 / VISUAL_DENSITY 4`。Claude 是克制冷静的,不是花哨的;动效只服务于反馈与状态切换,不做装饰性滚动叙事。

## 范围

- **渲染层重写:** 全部组件由 inline `style={{}}` 迁移到 Tailwind v4,移除技术债。
- **交互逻辑复刻 Claude.ai:** 左侧会话历史侧栏、居中内容列、非气泡消息排版、底部 composer、空状态、流式光标、消息操作、暗色模式。
- **emoji → icon:** 移除现有 4 处 emoji(💬 ⚙️ 🧩 🖼️),统一使用 Phosphor 图标。
- **多会话持久化:** 会话存到 `~/.llm-app/conversations/`(文件系统),由 Python sidecar 提供 CRUD 端点。
- **Markdown 渲染:** 助手消息支持完整 Markdown / GFM / 代码高亮。
- **后端日志抽屉:** 聊天区底部可折叠抽屉,实时流式展示 sidecar(模型调用)的 stdout/stderr,供开发者调试。

非范围:不改 LLM 推理、Agent、Skills、屏幕捕获等后端核心能力;不动 Electron 窗口管理与打包。

## 模型目录更新(全量替换为 2026.6 新一代端侧模型)

现有 `sidecar/model_manager.py` 的 `MODELS_CATALOG` 是 2025 年初旧清单(Qwen2.5/Llama3.1/Gemma2/Mistral7B/Phi3.5/DeepSeek-R1-distill),全量替换为 2026 年 6 月最新代际。**多模态 VL 优先**(spec 原定位),纯文本只保留差异化价值型号。所有模型均有 GGUF + llama.cpp 支持。

**多模态 VL 模型(优先)**

| 硬件 | 推荐模型 | 参数 | 显存(Q4) | 亮点 |
|---|---|---|---|---|
| 4GB | Gemma 4 2B IT | 2B | ~1.5GB | Google,原生多模态,端侧入门 |
| 8GB | Gemma 4 4B IT | 4B | ~3GB | 多模态,8GB 机器首选 |
| 8GB | Qwen3-VL 2B-Instruct | 2B | ~1.5GB | Qwen 多模态,中文强 |
| 16GB | Qwen3-VL 4B-Instruct | 4B | ~3GB | 多模态,中文 SOTA 小模型 |
| 16GB | Qwen3-VL 8B-Instruct | 8B | ~5GB | 多模态中坚,综合强 |
| 16GB | Gemma 4 12B IT | 12B | ~8GB | 多模态,256K 上下文 |
| 24GB | Qwen3-VL 14B-Instruct | 14B | ~9GB | 多模态,逼近云端质量 |
| 24GB | Gemma 4 27B IT | 27B | ~17GB | 多模态旗舰 |
| 32GB+ | Qwen3-VL 32B-A3B MoE | 32B MoE(3B 激活) | ~18GB | MoE 速度快,质量高 |

**纯文本模型(差异化价值,次选)**

| 硬件 | 推荐模型 | 参数 | 显存(Q4) | 亮点 |
|---|---|---|---|---|
| 2GB | Llama 4 1B Scout | 1B | ~1GB | Meta 端侧,英文快,极轻 |
| 4GB | Llama 4 3B Scout | 3B | ~2GB | Meta 端侧,英文 |
| 16GB | GLM-5 9B Chat | 9B | ~6GB | 智谱,中文好,agentic |
| 16GB | DeepSeek-V4 Distill 7B | 7B | ~5GB | 推理链强,数学/逻辑专长 |
| 24GB | Phi-4 14B | 14B | ~9GB | 微软,推理出色,MIT 许可 |
| 16GB+ | gpt-oss 20B | 20B MoE(3.6B 激活) | ~12GB | OpenAI 开源,原生 MXFP4 |
| 工作站 | gpt-oss 120B | 120B MoE(5.1B 激活) | ~70GB | 旗舰开源,需大显存 |

实现:`MODELS_CATALOG` 字段结构不变(`id`/`name`/`description`/`url`/`size_bytes`/`requirements`/`params`/`language`),仅替换条目。下载源用各官方 GGUF 仓库(`ggml-org/*`、`Qwen/*`、`google/*`、`openai/*` 等),沿用现有断点续传 + 重试机制。UI(Settings 模型卡 + TopBar 选择器)无需改动,自动渲染新目录。

## 视觉系统

### 配色(Claude.ai 配色,brand override)

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--canvas` | `#F5F4EF` 暖纸 | `#1F1E1D` 暖墨 | 主背景 |
| `--surface` | `#EFEDE5` | `#262624` | 侧栏 / composer 底 |
| `--surface-2` | `#E9E6DC` | `#2D2B27` | 用户消息块 |
| `--text` | `#1F1E1D` | `#EDEBE5` | 正文 |
| `--text-muted` | `#87867F` | `#A8A69E` | 次要文本 / 角色标签 |
| `--border` | `#E5E2D8` | `#36352F` | 1px hairline |
| `--accent` | `#C96442` clay | `#D97757` | 主按钮 / 聚焦环 / 光标 / 星标 |
| `--accent-soft` | `#F4E9E3` | `#3A2A24` | 强调悬浮底 |

- 单一强调色(clay),全页锁定,不做 AI-purple / 霓虹。
- 无纯黑纯白;暖灰为底,营造温度感。
- 暗色模式默认跟随 `prefers-color-scheme`,顶栏可手动切换并持久化(localStorage)。

### 字体

- **Geist Sans**(UI / 正文)与 **Geist Mono**(代码),通过 `@fontsource/geist-sans` + `@fontsource/geist-mono` 自托管,`font-display: swap`。禁止 Google Fonts `<link>`。
- 字号阶梯:`text-[13px]`(侧栏/次要)、`text-[15px]`(正文/composer)、`text-[22px]`(空状态标题)、`text-[28px]`(页面标题)。
- 行高:正文 `leading-relaxed`,消息 `leading-[1.65]`。

### 图标

- 单一图标库 `@phosphor-icons/react`,全局 `weight="regular"`,`size` 按场景(16 / 20 / 24)。
- 映射(覆盖现有 4 个 emoji):
  - `💬 对话` → `ChatCircle`
  - `⚙️ 设置` → `Gear`
  - `🧩 Skills` → `PuzzlePiece`
  - `🖼️`(InputBox 附件)→ `Image`
- 新增:`Plus`(新对话)、`ArrowUp`(发送)、`Stop`(停止)、`Copy`、`ArrowsClockwise`(重生成)、`PencilSimple`(编辑)、`Trash`、`MagnifyingGlass`(搜索)、`SidebarSimple`(折叠)、`Sun` / `Moon`(主题)、`DotsThree`(更多)、`Sparkle`(空状态星标 `✻`)。
- 不手写 SVG 图标。

### 形状与阴影

- 统一圆角阶梯:按钮 / 输入 12px,消息块 14px,composer 16px,头像 / 角标 8px。全页一处定义,不混用。
- 阴影仅用于 composer 浮层与下拉,`shadow-sm` + tinted(`shadow-[0_1px_3px_rgba(0,0,0,0.04)]` light / 暖墨 tint dark)。消息行不加阴影。

## 交互逻辑(Claude.ai 深度复刻)

### 三栏布局

1. **左栏 Sidebar(260px,可折叠)**
   - 顶部:**New chat** 主按钮(clay 描边,hover 填充 `--accent-soft`,左 `Plus` 图标)。
   - 搜索框:`MagnifyingGlass` + 输入,实时过滤会话标题。
   - 会话列表:按 `Today` / `Previous 7 Days` / `Older` 分组(以会话 `updated_at` 计算)。条目 = 单行标题(首条用户消息前 ~40 字,超长省略),hover 右侧出 `Trash` + `DotsThree`;激活态 `--surface` 高亮 + 左侧 2px clay 条。
   - 底部:Chat / Skills / Settings 三项导航(图标 + 文字,激活态高亮),下方主题切换(`Sun` / `Moon`)。
   - 折叠后只剩图标列,顶部 `SidebarSimple` 展开。

2. **中区(内容列居中,`max-w-3xl` = 768px)**
   - **TopBar:** 左 `SidebarSimple`(折叠按钮)+ 模型选择器(当前模型名 + `CaretDown`,下拉列本地已下载模型,选中即 `loadModel`)。
   - **空状态:** 居中 clay `Sparkle`(`✻`)+ 问候语("今天能帮你做点什么?")+ 4 个示例 prompt chip(可点击直接发送)。
   - **消息流:** 见下。
   - **Composer:** 底部固定。

3. **消息排版(关键差异,非气泡)**
   - 每条消息占一整行(不限宽到 75%),仅内容列 max-w-3xl 约束。
   - **用户消息:** `--surface-2` 圆角块(14px),内边距 `px-4 py-3`,纯文本(不渲染 Markdown)。
   - **助手消息:** 无背景,左侧 24px 处 clay `Sparkle` 头像,右侧 Markdown 渲染区。
   - 每条消息上方:小号 muted 角色标签("你" / 模型名,`text-[12px] text-[--text-muted]`)。
   - **hover 操作(右侧浮出,`opacity-0 group-hover:opacity-100`):**
     - 用户:复制、编辑(编辑进入 inline textarea,保存后截断其后消息并重新生成)。
     - 助手:复制、重生成(以该助手消息的上一条用户消息为起点重新请求)。
   - 图片消息:在消息块内 `max-h-60 rounded-lg` 展示。

4. **Composer**
   - 圆角 16px,`--surface` 底,1px `--border`,聚焦时 `ring-2 ring-[--accent]/40`。
   - 左侧 `Image` 附件按钮(打开文件选择 + 拖拽 + 粘贴,保留现有逻辑)。
   - 右侧 clay 圆形 `ArrowUp` 发送按钮;流式中变为 `Stop` 方形按钮。
   - textarea 自适应高度(min 1 行,max 8 行),Enter 发送 / Shift+Enter 换行。
   - 待发送图片在 composer 上方 chip 预览(缩略图 + `X` 移除)。

5. **流式与动效**
   - 助手消息逐 token 追加,末尾 clay 闪烁光标 `▍`(`@keyframes blink`)。
   - 新消息进入:`fade + slide-up 200ms`,`cubic-bezier(0.16,1,0.3,1)`。
   - `prefers-reduced-motion: reduce` 时全部降级为静态 / 即时。
   - 不做滚动叙事、视差、磁吸;动效只服务于反馈与状态切换(MOTION_INTENSITY 3 的定义)。

6. **Markdown 渲染**
   - `react-markdown` + `remark-gfm` + `rehype-highlight` + `highlight.js`。
   - 代码块:header bar(语言标签 + `Copy` 按钮)+ 暗色代码底(`#1F1E1D` light 模式下也用暗底,营造代码感)。
   - 表格 / 列表 / 引用 / 链接按 GFM;链接外开。
   - 用户消息保持纯文本(`white-space: pre-wrap`)。

7. **会话持久化**
   - 首条用户消息发送时自动创建会话:标题 = 前 40 字,`updated_at` 刷新。
   - 侧栏在发送 / 收到首个 token 时实时更新列表。
   - 切换会话:加载该会话消息,composer 清空。
   - 删除:侧栏 `Trash` → 确认对话框 → 删除文件并从列表移除。
   - 重命名:`DotsThree` → Rename → inline 输入。

8. **后端日志抽屉(LogDrawer)**
   - 位置:Composer 正上方一条可折叠条;展开时挤压 MessageStream 高度(flex 布局),Composer 始终贴底。
   - 收起态:28px 薄条,左 `Terminal` 图标 + "后端日志" + 最近一行日志尾部(muted,单行省略),右 `CaretUp` 展开 + 行数 badge。
   - 展开态:高度 240px(可拖拽边缘调整 120–480px),顶部 header(`Terminal` + "后端日志" + `Trash` 清空 + `CaretDown` 收起),下方等宽字体滚动区,新行自动滚到底部(用户手动上滚时暂停自动跟随,出现"↓ 跟随最新"按钮恢复)。
   - 日志行:等宽 `Geist Mono` `text-[12px]`,按来源着色(stdout = `--text-muted`,stderr / 含 "ERROR"/"Traceback" = clay `--accent`),行首带 `HH:MM:SS` 时间戳。
   - 环形缓冲:渲染层只保留最近 2000 行,超出丢弃最旧行(防内存膨胀)。
   - 开关:Composer 上方薄条点击切换;快捷键 `Cmd/Ctrl+L` 切换;收起时仍接收日志(静默缓冲)。
   - 空状态:"暂无日志,sidecar 启动后此处显示模型调用输出"。

9. **模型下载进度跨页面持久化**
   - 现状 bug:下载状态存在 `Settings.tsx` 的 `useState`,切路由组件卸载即丢失进度显示(后端仍在下载,但 UI 不再反映)。
   - 方案:把下载状态(`downloads: Record<modelId, DownloadState>`)与轮询逻辑提到 **Zustand 全局 store**(`useModelDownloads`),组件卸载不丢;`Settings.tsx` 与任何页面共享同一份状态。
   - 轮询:store 内管理 `setInterval`(复用现有 `GET /models/download/progress/{id}`,1.5s 间隔),只要有 `status === 'downloading'` 的条目就持续轮询;全部完成 / 出错时停轮询。store 在 App 挂载时初始化,恢复进行中的下载状态(调一次 `getDownloadProgress` 对所有已知 modelId)。
   - 全局可见性:Sidebar 底部或 TopBar 模型选择器处,有下载进行时显示一个小进度指示(clay 微型进度条 + "下载中 N 个"),点击跳转 Settings。用户在任何页面都能感知下载未丢。
   - 完成态处理:`completed` 后自动 `loadData()` 刷新模型列表(沿用现有逻辑,移入 store);`error` 在对应模型卡显示错误,并允许重试。
   - 崩溃恢复:sidecar 重启后下载可能中断,store 启动时对 `downloading` 条目主动查一次进度,若后端返回 `not_found` 则标记为 `error` 并提示"下载已中断,请重试"。

## 架构改动

### Python sidecar

新文件 `sidecar/conversations.py`:

```python
# 存储目录:~/.llm-app/conversations/
# 每个会话一个 JSON 文件:{id, title, messages, created_at, updated_at}
# messages: [{id, role, content, images?, created_at}]
```

`main.py` 新增路由(沿用现有 FastAPI 模式):

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/conversations` | 列表(返回 `[{id, title, updated_at}]`,按 `updated_at` desc) |
| `GET` | `/conversations/{id}` | 单个详情(含 messages) |
| `POST` | `/conversations` | 创建 / upsert(body 含 messages) |
| `PUT` | `/conversations/{id}` | 更新 messages / title |
| `PATCH` | `/conversations/{id}` | 仅重命名 |
| `DELETE` | `/conversations/{id}` | 删除 |

### Electron

`main.ts` 为每条会话路由加 `ipcMain.handle`(fetch 代理,沿用现有 `model:*` 模式)。`preload.ts` 暴露:

```ts
listConversations: () => Promise<{ conversations: ConversationMeta[] }>
getConversation: (id: string) => Promise<Conversation>
saveConversation: (c: Conversation) => Promise<{ id: string }>
renameConversation: (id: string, title: string) => Promise<{ status: string }>
deleteConversation: (id: string) => Promise<{ status: string }>
```

**sidecar 日志转发(供 LogDrawer):** `SidecarManager` 已捕获子进程 stdout/stderr;新增:

- `main.ts` 在 sidecar 启动后,把子进程 stdout/stderr 的每行经 `ipcMain` 转发为 `sidecar:log` 事件(带 `{stream: 'stdout'|'stderr', line, ts}`)。
- `preload.ts` 暴露 `onLog(cb)`(注册 `sidecar:log` 监听,返回取消订阅函数)。
- 渲染层 `useLogs` store 订阅,写入环形缓冲(最近 2000 行)。

### 前端

**`api.ts`** — 加 `Conversation` / `ConversationMeta` 类型与上述方法。

**状态管理** — 引入 **Zustand**(单一小依赖),`useConversations` store 管理:当前会话 id、会话列表、当前消息、流式状态、发送 / 停止 / 新建 / 切换 / 删除 / 重命名动作。替代现有 `useChat` 的局部状态(保留 `useChat` 作为内部实现细节或合并进 store,实施时定)。

**组件树重构:**

```
src/
├── App.tsx                      # 布局 shell:Sidebar + Router + ThemeProvider
├── store/
│   ├── useConversations.ts      # Zustand store(会话)
│   ├── useModelDownloads.ts     # Zustand store(下载进度全局,跨页面持久)
│   └── useLogs.ts               # Zustand store(sidecar 日志环形缓冲)
├── components/
│   ├── Sidebar.tsx              # 左栏(新对话/搜索/会话列表/导航/主题 + 下载指示)
│   ├── TopBar.tsx               # 侧栏开关 + 模型选择器
│   ├── Composer.tsx             # 替代 InputBox
│   ├── Message.tsx              # 单条消息(用户块/助手 Markdown/操作)
│   ├── MessageStream.tsx        # 替代 MessageList,渲染 + 自动滚动
│   ├── EmptyState.tsx           # 星标 + 问候 + 示例 chip
│   ├── LogDrawer.tsx            # 底部折叠日志抽屉
│   ├── ThemeToggle.tsx
│   └── ConfirmDialog.tsx        # 删除确认等
├── pages/
│   ├── Chat.tsx                 # 串接 store + 上述组件
│   ├── Settings.tsx             # 套用设计系统重排(配色/字体/圆角) + 读 useModelDownloads
│   └── Skills.tsx               # 同上
└── hooks/
    └── useChat.ts               # 流式底层(或并入 store)
```

全部 inline `style={{}}` → Tailwind 类;design tokens 写在 `src/index.css`(`@theme` 或 CSS 变量 + `dark:` 变体)。

### 新增依赖

| 包 | 用途 |
|---|---|
| `tailwindcss` `@tailwindcss/vite` | Tailwind v4(Vite 插件,不走 postcss plugin) |
| `@phosphor-icons/react` | 图标单一家族 |
| `@fontsource/geist-sans` `@fontsource/geist-mono` | 自托管字体 |
| `zustand` | 会话 / 流式状态 |
| `react-markdown` `remark-gfm` `rehype-highlight` `highlight.js` | 助手消息 Markdown |
| `motion` | 消息进入动效(`motion/react`) |

## 实施分阶段(同一 spec,plan 拆 phase)

1. **Phase 1 — 基础设施 + 布局:** 装依赖、配 Tailwind v4 + 字体 + tokens、搭三栏 shell、TopBar、Sidebar 骨架、Composer 基础样式、Settings/Skills 套新设计系统。无新交互,先确立视觉。
2. **Phase 2 — 全局状态基础:** 建 Zustand stores(`useModelDownloads` 提取 Settings 下载状态 + 轮询,跨页面持久;`useLogs` 环形缓冲);LogDrawer 底部折叠抽屉;Sidebar 下载指示。先解决"切页面丢进度"和"日志可见性"两个痛点。
3. **Phase 3 — 会话持久化:** sidecar `conversations.py` + 路由、Electron IPC、`useConversations` store、Sidebar 会话列表 / 切换 / 删除 / 重命名、新建会话流程。
4. **Phase 4 — 消息与流式:** Message / MessageStream / Markdown 渲染、非气泡排版、hover 操作(复制 / 编辑 / 重生成)、空状态、示例 chip、流式光标、动效与 reduced-motion。
5. **Phase 5 — 打磨:** 暗色模式全量校验、模型选择器下拉、键盘快捷键(Cmd+K 新对话 / Cmd+Shift+O 折叠侧栏 / Cmd+L 日志抽屉 等)、a11y 复核(对比度 / 聚焦环 / aria)、Lighthouse / 性能。

## 测试与验收

- `npm run lint`(= `tsc --noEmit`)每个 phase 后必须通过。
- 手动验证:新建 / 切换 / 删除 / 重命名会话;流式中 Stop;图片拖拽 / 粘贴;暗色模式全组件;Markdown 代码块复制;`prefers-reduced-motion` 降级;侧栏折叠;模型切换。
- 日志抽屉:sidecar 启动后抽屉可见实时日志;stderr / ERROR 行 clay 高亮;展开 / 收起 / 清空 / 拖拽调高 / 手动上滚暂停跟随;`Cmd/Ctrl+L` 切换;环形缓冲超 2000 行不崩。
- 下载持久化:Settings 发起下载 → 切到 Chat → 切回 Settings 进度仍在;Sidebar 下载指示可见;下载完成自动刷新模型列表;sidecar 重启后中断下载被标记 error。
- 验收对照 Claude.ai:空状态、消息排版、composer、侧栏分组、暗色模式逐项比对。

## 非目标 / 风险

- 不做多用户 / 同步 / 云端备份(纯本地)。
- 不引入设计系统组件库(shadcn / Radix),保持轻量;`ConfirmDialog` 等小组件自实现。
- 会话标题用首条消息前 40 字,不做 LLM 自动总结(避免额外推理开销)。
- 编辑用户消息后重生成会截断其后消息,不保留分支(不做 git 式分支)。
