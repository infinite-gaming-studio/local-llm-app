import { useState } from 'react'
import { useChat } from '../hooks/useChat'
import { TopBar } from '../components/TopBar'
import { Composer } from '../components/Composer'

export function Chat() {
  const { messages, streaming, sendMessage, stopStreaming } = useChat()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex flex-col h-full">
      <TopBar onToggleSidebar={() => setSidebarOpen((s) => !s)} />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="text-center text-[--color-text-muted] mt-24">发送消息开始对话</div>
          ) : messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-2xl px-4 py-3 max-w-[80%] whitespace-pre-wrap leading-[1.65] ${
                m.role === 'user' ? 'bg-[--color-surface-2]' : ''}`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Composer onSend={sendMessage} onStop={stopStreaming} streaming={streaming} />
    </div>
  )
}
