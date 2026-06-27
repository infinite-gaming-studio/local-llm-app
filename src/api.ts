export interface AvailableModel {
  id: string
  name: string
  description: string
  url: string
  size_bytes: number
  requirements: string
  params: string
  language: string
  downloaded: boolean
  local_path: string | null
}

export interface DownloadState {
  status: 'downloading' | 'completed' | 'error' | 'not_found' | 'already_downloading' | 'started'
  progress: number
  path?: string
  error?: string
  model_id?: string
  retrying?: number
}

export interface LocalModel {
  id: string
  name: string
  path: string
  size_bytes: number
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
      getSkills: () => Promise<{ skills: Array<{ name: string; description: string }> }>
      getAvailableModels: () => Promise<{ models: AvailableModel[] }>
      getLocalModels: () => Promise<{ models: LocalModel[] }>
      downloadModel: (modelId: string) => Promise<DownloadState>
      getDownloadProgress: (modelId: string) => Promise<DownloadState>
      deleteLocalModel: (modelId: string) => Promise<{ status: string }>
      listConversations: () => Promise<{ conversations: ConversationMeta[] }>
      getConversation: (id: string) => Promise<Conversation>
      saveConversation: (
        conv: Partial<Conversation> & { title: string; messages: Conversation['messages'] }
      ) => Promise<{ id: string }>
      renameConversation: (id: string, title: string) => Promise<{ status: string }>
      deleteConversation: (id: string) => Promise<{ status: string }>
      onLog: (cb: (e: LogEntry) => void) => () => void
    }
  }
}

export const api = window.llmApp
