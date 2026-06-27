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

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ConversationDetail {
  id: string
  title: string
  messages: unknown[]
  created_at: string
  updated_at: string
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
      listConversations: () => Promise<{ conversations: Conversation[] }>
      getConversation: (id: string) => Promise<ConversationDetail>
      saveConversation: (conv: unknown) => Promise<ConversationDetail>
      renameConversation: (id: string, title: string) => Promise<ConversationDetail>
      deleteConversation: (id: string) => Promise<{ status: string }>
      onLog: (cb: (e: LogEntry) => void) => () => void
    }
  }
}

export const api = window.llmApp
