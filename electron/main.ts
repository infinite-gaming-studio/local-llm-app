import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { SidecarManager } from './sidecar'
import { ScreenCapture } from './screen-capture'

app.commandLine.appendSwitch('in-process-gpu')
app.commandLine.appendSwitch('no-sandbox')

let mainWindow: BrowserWindow | null = null
const sidecar = new SidecarManager()
const screenCapture = new ScreenCapture()

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

let logBuffer: Array<{ stream: 'stdout' | 'stderr'; line: string; ts: number }> = []
let rendererReady = false

function sendLogsToRenderer(e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) {
  if (!rendererReady || !mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isCrashed()) {
    logBuffer.push(e)
    return
  }
  try {
    mainWindow.webContents.send('sidecar:log', e)
  } catch {
    logBuffer.push(e)
  }
}

function flushLogBuffer() {
  if (!mainWindow || mainWindow.isDestroyed() || !rendererReady) return
  for (const e of logBuffer) {
    try { mainWindow.webContents.send('sidecar:log', e) } catch {}
  }
  logBuffer = []
}

async function setupIPC() {
  ipcMain.handle('sidecar:diagnostics', () => ({
    port: (sidecar as any).port,
    isRunning: sidecar.isRunning,
    startError: sidecar.startError,
    pythonPath: sidecar.pythonPath,
    sidecarDir: sidecar.sidecarDir,
  }))

  ipcMain.handle('sidecar:health', async () => {
    const res = await fetch(`${sidecar.baseUrl}/health`)
    return res.json()
  })

  ipcMain.handle('model:load', async (_event, modelPath: string, options?: { ctx_size?: number; gpu_layers?: number }) => {
    const res = await fetch(`${sidecar.baseUrl}/model/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: modelPath, ...options }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { status: 'error', error: `后端返回 ${res.status}: ${text || res.statusText}` }
    }
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
    try {
      const res = await fetch(`${sidecar.baseUrl}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: true }),
      })
if (!res.body) {
        mainWindow?.webContents.send('chat:done', '')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'token') {
              fullContent += event.content
              mainWindow?.webContents.send('chat:token', event.content)
            } else if (event.type === 'clear') {
              fullContent = ''
              mainWindow?.webContents.send('chat:clear')
            } else if (event.type === 'tool') {
              mainWindow?.webContents.send('chat:tool', event.tool)
            } else if (event.type === 'done') {
              const content = event.content || fullContent
              mainWindow?.webContents.send('chat:done', content)
            }
          } catch {}
        }
      }
    } catch (e) {
      try { mainWindow?.webContents.send('chat:done', '') } catch {}
    }
  })

  ipcMain.handle('skills:list', async () => {
    const res = await fetch(`${sidecar.baseUrl}/skills`)
    return res.json()
  })

  ipcMain.handle('screen:start', () => {
    screenCapture.start(1)
  })

  ipcMain.handle('screen:stop', () => {
    screenCapture.stop()
  })

  ipcMain.handle('screen:frame', () => {
    return screenCapture.getLastFrame()
  })

  ipcMain.handle('models:available', async () => {
    const res = await fetch(`${sidecar.baseUrl}/models/available`)
    return res.json()
  })

  ipcMain.handle('models:local', async () => {
    const res = await fetch(`${sidecar.baseUrl}/models/local`)
    return res.json()
  })

  ipcMain.handle('models:import', async (_event, modelId: string | null, metadata?: Record<string, unknown>) => {
    // 打开文件选择对话框
    const result = await dialog.showOpenDialog({
      title: modelId ? `选择 ${modelId} 对应的 .gguf 模型文件` : '选择 .gguf 模型文件',
      filters: [{ name: 'GGUF 模型文件', extensions: ['gguf'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'canceled' }
    }
    const filePath = result.filePaths[0]
    const res = await fetch(`${sidecar.baseUrl}/models/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_path: filePath, model_id: modelId, metadata }),
    })
    return res.json()
  })

  ipcMain.handle('models:import-mmproj', async (_event, modelId: string) => {
    const result = await dialog.showOpenDialog({
      title: `选择 ${modelId} 的 mmproj 视觉投影文件`,
      filters: [{ name: 'GGUF 文件', extensions: ['gguf'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'canceled' }
    }
    const filePath = result.filePaths[0]
    const res = await fetch(`${sidecar.baseUrl}/models/import-mmproj`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_path: filePath, model_id: modelId }),
    })
    return res.json()
  })

  ipcMain.handle('models:get-metadata', async (_event, modelId: string) => {
    const res = await fetch(`${sidecar.baseUrl}/models/local/${modelId}/metadata`)
    return res.json()
  })

  ipcMain.handle('models:update-metadata', async (_event, modelId: string, fields: Record<string, unknown>) => {
    const res = await fetch(`${sidecar.baseUrl}/models/local/${modelId}/metadata`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    return res.json()
  })

  ipcMain.handle('models:delete-local', async (_event, modelId: string) => {
    const res = await fetch(`${sidecar.baseUrl}/models/local/${modelId}`, { method: 'DELETE' })
    return res.json()
  })

  ipcMain.handle('conversations:list', async () => {
    const res = await fetch(`${sidecar.baseUrl}/conversations`)
    return res.json()
  })

  ipcMain.handle('conversations:get', async (_event, id: string) => {
    const res = await fetch(`${sidecar.baseUrl}/conversations/${id}`)
    return res.json()
  })

  ipcMain.handle('conversations:save', async (_event, conv: unknown) => {
    const res = await fetch(`${sidecar.baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conv),
    })
    return res.json()
  })

  ipcMain.handle('conversations:rename', async (_event, id: string, title: string) => {
    const res = await fetch(`${sidecar.baseUrl}/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    return res.json()
  })

  ipcMain.handle('conversations:delete', async (_event, id: string) => {
    const res = await fetch(`${sidecar.baseUrl}/conversations/${id}`, { method: 'DELETE' })
    return res.json()
  })

  ipcMain.handle('settings:set', async (_event, body: { hf_token?: string }) => {
    const res = await fetch(`${sidecar.baseUrl}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
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

  rendererReady = true
  flushLogBuffer()

  mainWindow?.webContents.on('did-finish-load', () => {
    rendererReady = true
    flushLogBuffer()
  })

  mainWindow?.webContents.on('render-process-gone', () => {
    rendererReady = false
  })

  sidecar.onLog((e) => sendLogsToRenderer(e))
})

app.on('window-all-closed', () => {
  sidecar.stop()
  app.quit()
})
