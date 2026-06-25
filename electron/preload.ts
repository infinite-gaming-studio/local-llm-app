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
  getSkills: () => ipcRenderer.invoke('skills:list'),
}

contextBridge.exposeInMainWorld('llmApp', api)
