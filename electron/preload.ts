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
  getSidecarDiagnostics: () => ipcRenderer.invoke('sidecar:diagnostics'),
  startScreenCapture: () => ipcRenderer.invoke('screen:start'),
  stopScreenCapture: () => ipcRenderer.invoke('screen:stop'),
  getScreenFrame: () => ipcRenderer.invoke('screen:frame'),
  getSkills: () => ipcRenderer.invoke('skills:list'),
  getAvailableModels: () => ipcRenderer.invoke('models:available'),
  getLocalModels: () => ipcRenderer.invoke('models:local'),
  downloadModel: (modelId: string) => ipcRenderer.invoke('models:download', modelId),
  getDownloadProgress: (modelId: string) => ipcRenderer.invoke('models:download-progress', modelId),
  deleteLocalModel: (modelId: string) => ipcRenderer.invoke('models:delete-local', modelId),
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  getConversation: (id: string) => ipcRenderer.invoke('conversations:get', id),
  saveConversation: (conv: unknown) => ipcRenderer.invoke('conversations:save', conv),
  renameConversation: (id: string, title: string) => ipcRenderer.invoke('conversations:rename', id, title),
  deleteConversation: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  onLog: (cb: (e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, e: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => cb(e)
    ipcRenderer.on('sidecar:log', handler)
    return () => ipcRenderer.removeListener('sidecar:log', handler)
  },
  setSettings: (settings: { hf_token?: string }) => ipcRenderer.invoke('settings:set', settings),
}

contextBridge.exposeInMainWorld('llmApp', api)
