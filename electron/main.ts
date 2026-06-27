import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { SidecarManager } from './sidecar'
import { ScreenCapture } from './screen-capture'

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
      const data = JSON.parse(event.data.toString())
      if (data.token) {
        mainWindow?.webContents.send('chat:token', data.token)
      }
      if (data.done) {
        mainWindow?.webContents.send('chat:done', data.full_content)
        ws.close()
      }
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

  ipcMain.handle('models:download', async (_event, modelId: string) => {
    const res = await fetch(`${sidecar.baseUrl}/models/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: modelId }),
    })
    return res.json()
  })

  ipcMain.handle('models:download-progress', async (_event, modelId: string) => {
    const res = await fetch(`${sidecar.baseUrl}/models/download/progress/${modelId}`)
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

  sidecar.onLog((e) => mainWindow?.webContents.send('sidecar:log', e))
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
