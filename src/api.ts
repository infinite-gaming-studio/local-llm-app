export type Modality = 'text' | 'image'

export interface AvailableModel {
  id: string
  name: string
  description: string
  url: string
  mmproj_url?: string
  size_bytes: number
  requirements: string
  params: string
  language: string
  modalities: Modality[]
  downloaded: boolean
  local_path: string | null
  mmproj_downloaded?: boolean | null
}

export interface ImportResult {
  status: 'imported' | 'error' | 'canceled'
  model_id?: string
  path?: string
  size_bytes?: number
  action?: 'moved' | 'copied'
  metadata?: ModelMetadata
  error?: string
}

export interface ModelMetadata {
  display_name?: string
  description?: string
  params?: string
  language?: string
  requirements?: string
  ctx_size?: number
  gpu_layers?: number
  modalities?: Modality[]
  imported_at?: number
  updated_at?: number
}

export interface LocalModel {
  id: string
  name: string
  path: string
  size_bytes: number
  is_custom?: boolean
  description?: string
  params?: string
  language?: string
  requirements?: string
  modalities?: Modality[]
  ctx_size?: number
  gpu_layers?: number
  mmproj_path?: string | null
  has_mmproj?: boolean
}

export interface ConversationMeta {
  id: string
  title: string
  updated_at: number
}

export interface Conversation {
  id: string
  title: string
  created_at: number
  updated_at: number
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    images?: string[]
  }>
}

export interface LogEntry {
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

export interface SidecarDiagnostics {
  port: number
  isRunning: boolean
  startError: string | null
  pythonPath: string
  sidecarDir: string
}

declare global {
  interface Window {
    llmApp: {
      chat: (messages: unknown[]) => Promise<string>
      chatStream: (
        messages: unknown[],
        onToken: (t: string) => void,
        onDone: (c: string) => void,
        onClear?: () => void,
        onTool?: (tool: string) => void,
      ) => () => void
      loadModel: (path: string, options?: { ctx_size?: number; gpu_layers?: number }) => Promise<{ status: string; ctx_size?: number; gpu_layers?: number; error?: string; mmproj_loaded?: boolean }>
      unloadModel: () => Promise<{ status: string }>
      getModelStatus: () => Promise<{ loaded: boolean; path?: string; ctx_size?: number; gpu_layers?: number; modalities: Modality[] }>
      getSidecarDiagnostics: () => Promise<SidecarDiagnostics>
      getHealth: () => Promise<{ status: string }>
      startScreenCapture: () => Promise<void>
      stopScreenCapture: () => Promise<void>
      getScreenFrame: () => Promise<string>
      getSkills: () => Promise<{ skills: Array<{ name: string; description: string }> }>
      getAvailableModels: () => Promise<{ models: AvailableModel[] }>
      getLocalModels: () => Promise<{ models: LocalModel[] }>
      importModel: (modelId: string | null, metadata?: Record<string, unknown>) => Promise<ImportResult>
      importMmproj: (modelId: string) => Promise<ImportResult>
      getModelMetadata: (modelId: string) => Promise<{ model_id: string; metadata: ModelMetadata }>
      updateModelMetadata: (modelId: string, fields: Partial<ModelMetadata>) => Promise<{ model_id: string; metadata: ModelMetadata }>
      deleteLocalModel: (modelId: string) => Promise<{ status: string }>
      listConversations: () => Promise<{ conversations: ConversationMeta[] }>
      getConversation: (id: string) => Promise<Conversation>
      saveConversation: (
        conv: Partial<Conversation> & { title: string; messages: Conversation['messages'] }
      ) => Promise<{ id: string }>
      renameConversation: (id: string, title: string) => Promise<{ status: string }>
      deleteConversation: (id: string) => Promise<{ status: string }>
      onLog: (cb: (e: LogEntry) => void) => () => void
      setSettings: (settings: { hf_token?: string }) => Promise<{ status: string }>
    }
  }
}

export const api = window.llmApp
