import { create } from 'zustand'
import { api, ConversationMeta, Conversation, Modality } from '../api'

interface ConvStore {
  conversations: ConversationMeta[]
  activeId: string | null
  activeConv: Conversation | null
  loading: boolean
  streaming: boolean
  streamingContent: string
  toolActive: string | null
  activeModalities: Modality[]
  modelLoaded: boolean
  init: () => Promise<void>
  refreshModelStatus: () => Promise<void>
  createConversation: () => Promise<string>
  selectConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  send: (text: string, images?: string[]) => Promise<void>
  stop: () => void
  regenerate: () => Promise<void>
  editAndResend: (text: string) => Promise<void>
}

let cleanupStream: (() => void) | null = null

export const useConversations = create<ConvStore>((set, get) => ({
  conversations: [],
  activeId: null,
  activeConv: null,
  loading: false,
  streaming: false,
  streamingContent: '',
  toolActive: null,
  activeModalities: ['text'],
  modelLoaded: false,

  init: async () => {
    set({ loading: true })
    const d = await api.listConversations()
    set({ conversations: d.conversations, loading: false })
  },

  refreshModelStatus: async () => {
    try {
      const s = await api.getModelStatus()
      set({
        activeModalities: s.modalities?.length ? s.modalities : ['text'],
        modelLoaded: !!s.loaded,
      })
    } catch {
      // 拉取失败保持现状
    }
  },

  createConversation: async () => {
    if (get().streaming) get().stop()
    // 若当前已在一个空白新对话上（无消息），直接复用，避免重复创建
    const cur = get().activeConv
    if (cur && cur.messages.length === 0) {
      return cur.id
    }
    const saved = await api.saveConversation({ title: '新对话', messages: [] })
    set({
      activeId: saved.id,
      activeConv: { id: saved.id, title: '新对话', messages: [], created_at: Date.now(), updated_at: Date.now() },
      streamingContent: '',
      toolActive: null,
    })
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
          toolActive: null,
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
        set({ streaming: false, streamingContent: '', toolActive: null, activeConv: { ...conv!, messages: msgs, id: saved.id } })
        if (!get().activeId) set({ activeId: saved.id })
        await get().init()
      },
      () => {
        set({ streamingContent: '' })
      },
      (tool) => {
        set({ toolActive: tool })
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
    set({ streaming: false, streamingContent: '', toolActive: null })
  },

  regenerate: async () => {
    if (get().streaming) get().stop()
    const msgs = get().activeConv?.messages ?? []
    let lastUser = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUser = i; break }
    }
    if (lastUser < 0) return
    const userMsg = msgs[lastUser]
    const conv = get().activeConv
    set({ activeConv: conv ? { ...conv, messages: msgs.slice(0, lastUser) } : null })
    await get().send(userMsg.content, userMsg.images)
  },

  editAndResend: async (text: string) => {
    if (get().streaming) get().stop()
    const msgs = get().activeConv?.messages ?? []
    let lastUser = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUser = i; break }
    }
    if (lastUser < 0) { await get().send(text); return }
    const conv = get().activeConv
    set({ activeConv: conv ? { ...conv, messages: msgs.slice(0, lastUser) } : null })
    await get().send(text)
  },
}))
