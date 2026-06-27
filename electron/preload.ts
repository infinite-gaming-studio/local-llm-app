import { contextBridge, ipcRenderer } from 'electron'

const api = {
  chat: (messages: unknown[]) => ipcRenderer.invoke('chat', messages),
  chatStream: (
    messages: unknown[],
    onToken: (t: string) => void,
    onDone: (c: string) => void,
    onClear?: () => void,
    onTool?: (tool: string) => void,
  ) => {
    const tokenHandler = (_event: Electron.IpcRendererEvent, token: string) => onToken(token)
    const doneHandler = (_event: Electron.IpcRendererEvent, content: string) => onDone(content)
    const clearHandler = (_event: Electron.IpcRendererEvent) => onClear?.()
    const toolHandler = (_event: Electron.IpcRendererEvent, tool: string) => onTool?.(tool)

    ipcRenderer.on('chat:token', tokenHandler)
    ipcRenderer.on('chat:done', doneHandler)
    ipcRenderer.on('chat:clear', clearHandler)
    ipcRenderer.on('chat:tool', toolHandler)
    ipcRenderer.send('chat:start', messages)

    return () => {
      ipcRenderer.removeListener('chat:token', tokenHandler)
      ipcRenderer.removeListener('chat:done', doneHandler)
      ipcRenderer.removeListener('chat:clear', clearHandler)
      ipcRenderer.removeListener('chat:tool', toolHandler)
    }
  },
  loadModel: (path: string, options?: { ctx_size?: number; gpu_layers?: number }) =>
    ipcRenderer.invoke('model:load', path, options),
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
  importModel: (modelId: string | null, metadata?: Record<string, unknown>) =>
    ipcRenderer.invoke('models:import', modelId, metadata),
  importMmproj: (modelId: string) => ipcRenderer.invoke('models:import-mmproj', modelId),
  getModelMetadata: (modelId: string) => ipcRenderer.invoke('models:get-metadata', modelId),
  updateModelMetadata: (modelId: string, fields: Record<string, unknown>) =>
    ipcRenderer.invoke('models:update-metadata', modelId, fields),
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
