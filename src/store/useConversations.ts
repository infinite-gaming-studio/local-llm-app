import { create } from 'zustand'
import { api, ConversationMeta, Conversation } from '../api'

interface ConvStore {
  conversations: ConversationMeta[]
  activeId: string | null
  activeConv: Conversation | null
  loading: boolean
  streaming: boolean
  streamingContent: string
  init: () => Promise<void>
  createConversation: () => Promise<string>
  selectConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  send: (text: string, images?: string[]) => Promise<void>
  stop: () => void
}

let cleanupStream: (() => void) | null = null

export const useConversations = create<ConvStore>((set, get) => ({
  conversations: [],
  activeId: null,
  activeConv: null,
  loading: false,
  streaming: false,
  streamingContent: '',

  init: async () => {
    set({ loading: true })
    const d = await api.listConversations()
    set({ conversations: d.conversations, loading: false })
  },

  createConversation: async () => {
    if (get().streaming) get().stop()
    const saved = await api.saveConversation({ title: '新对话', messages: [] })
    set({ activeId: saved.id })
    await get().init()
    return saved.id
  },

  selectConversation: async (id) => {
    if (get().streaming) get().stop()
    set({ loading: true })
    const c = await api.getConversation(id)
    set({ activeId: id, activeConv: c, streamingContent: '', loading: false })
  },

  deleteConversation: async (id) => {
    await api.deleteConversation(id)
    if (get().activeId === id) set({ activeId: null, activeConv: null, streamingContent: '' })
    await get().init()
  },

  renameConversation: async (id, title) => {
    await api.renameConversation(id, title)
    const c = get().activeConv
    if (c && c.id === id) set({ activeConv: { ...c, title } })
    await get().init()
  },

  send: async (text, images) => {
    const base = get().activeConv?.messages ?? []
    const userMsg = { role: 'user' as const, content: text, images }
    const cid = get().activeId
    const title = text.slice(0, 40) || '新对话'
    set({
      activeConv: { id: cid ?? '', title, messages: [...base, userMsg, { role: 'assistant', content: '' }], created_at: Date.now(), updated_at: Date.now() },
      streaming: true,
      streamingContent: '',
    })

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
      (token) => {
        set((s) => ({
          streamingContent: s.streamingContent + token,
        }))
      },
      async () => {
        const content = get().streamingContent
        const conv = get().activeConv
        const msgs = conv?.messages ?? []
        msgs[msgs.length - 1] = { role: 'assistant', content }
        const saved = await api.saveConversation({
          id: cid ?? undefined,
          title,
          messages: msgs,
        })
        set({ streaming: false, streamingContent: '', activeConv: { ...conv!, messages: msgs, id: saved.id } })
        if (!get().activeId) set({ activeId: saved.id })
        await get().init()
      },
    )
  },

  stop: () => {
    cleanupStream?.()
    cleanupStream = null
    const content = get().streamingContent
    if (content) {
      const conv = get().activeConv
      const msgs = conv?.messages ?? []
      msgs[msgs.length - 1] = { role: 'assistant', content }
      set({ activeConv: conv ? { ...conv, messages: msgs } : null })
    }
    set({ streaming: false, streamingContent: '' })
  },
}))
