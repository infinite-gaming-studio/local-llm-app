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
    let anyCompleted = false
    for (const [id] of active) {
      try {
        const st = await api.getDownloadProgress(id)
        set((s) => ({ downloads: { ...s.downloads, [id]: st } }))
        if (st.status === 'completed') {
          anyCompleted = true
        }
        if (st.status === 'completed' || st.status === 'error') {
          await api.getAvailableModels()
        }
      } catch (e) { console.error(e) }
    }
    if (anyCompleted) {
      get().stopPolling()
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
