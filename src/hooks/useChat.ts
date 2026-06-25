import { useState, useCallback, useRef } from 'react'
import { api } from '../api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const sendMessage = useCallback(async (text: string, images?: string[]) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      images,
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const chatMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.images && m.images.length > 0
        ? [{ type: 'image_url', image_url: { url: m.images[0] } }, { type: 'text', text: m.content }]
        : (m.content || ''),
    }))

    const cleanup = api.chatStream(
      chatMessages,
      (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
        )
      },
      () => {
        setStreaming(false)
      }
    )

    cleanupRef.current = cleanup
  }, [messages])

  const stopStreaming = useCallback(() => {
    cleanupRef.current?.()
    setStreaming(false)
  }, [])

  return { messages, streaming, sendMessage, stopStreaming }
}
