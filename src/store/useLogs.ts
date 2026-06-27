import { create } from 'zustand'
import { api, LogEntry } from '../api'

const MAX = 2000

interface LogStore {
  entries: LogEntry[]
  push: (e: LogEntry) => void
  clear: () => void
  init: () => () => void
}

export const useLogs = create<LogStore>((set) => ({
  entries: [],
  push: (e) => set((s) => {
    const next = [...s.entries, e]
    if (next.length > MAX) next.splice(0, next.length - MAX)
    return { entries: next }
  }),
  clear: () => set({ entries: [] }),
  init: () => {
    if (typeof window === 'undefined' || !api?.onLog) return () => {}
    return api.onLog((e) => useLogs.getState().push(e))
  },
}))
