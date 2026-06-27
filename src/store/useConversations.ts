import { create } from 'zustand'
import { api, ConversationMeta } from '../api'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

interface ConvStore {
  list: ConversationMeta[]
  currentId: string | null
  messages: Message[]
  streaming: boolean
  loadList: () => Promise<void>
  select: (id: string) => Promise<void>
  newChat: () => void
  send: (text: string, images?: string[]) => Promise<void>
  stop: () => void
  remove: (id: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
}

let cleanupStream: (() => void) | null = null

export const useConversations = create<ConvStore>((set, get) => ({
  list: [],
  currentId: null,
  messages: [],
  streaming: false,

  loadList: async () => {
    const d = await api.listConversations()
    set({ list: d.conversations })
  },

  select: async (id) => {
    if (get().streaming) get().stop()
    const c = await api.getConversation(id)
    set({ currentId: id, messages: c.messages.map((m, i) => ({ id: `${id}-${i}`, ...m })) })
  },

  newChat: () => {
    if (get().streaming) get().stop()
    set({ currentId: null, messages: [] })
  },

  send: async (text, images) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, images }
    const assistantId = (Date.now() + 1).toString()
    const base = get().messages
    const next = [...base, userMsg, { id: assistantId, role: 'assistant' as const, content: '' }]
    set({ messages: next, streaming: true })

    const cid = get().currentId
    const title = text.slice(0, 40) || '新对话'

    const chatMessages = [...base, userMsg].map((m) => ({
      role: m.role,
      content: m.images?.length
        ? [
            { type: 'image_url' as const, image_url: { url: m.images[0] } },
            { type: 'text' as const, text: m.content },
          ]
        : (m.content || ''),
    }))

    cleanupStream = api.chatStream(
      chatMessages,
      (token) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          ),
        })),
      async () => {
        set({ streaming: false })
        const saved = await api.saveConversation({
          id: cid ?? undefined,
          title,
          messages: get().messages.map(({ role, content, images }) => ({ role, content, images })),
        })
        if (!get().currentId) set({ currentId: saved.id })
        get().loadList()
      },
    )
  },

  stop: () => {
    cleanupStream?.()
    cleanupStream = null
    set({ streaming: false })
  },

  remove: async (id) => {
    await api.deleteConversation(id)
    if (get().currentId === id) get().newChat()
    await get().loadList()
  },

  rename: async (id, title) => {
    await api.renameConversation(id, title)
    await get().loadList()
  },
}))
