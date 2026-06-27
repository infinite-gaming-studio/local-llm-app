import { TopBar } from '../components/TopBar'
import { Composer } from '../components/Composer'
import { Message } from '../components/Message'
import { LogDrawer } from '../components/LogDrawer'
import { useConversations } from '../store/useConversations'

export function Chat() {
  const { activeConv, streaming, streamingContent, send, stop } = useConversations()
  const messages = activeConv?.messages ?? []

  return (
    <div className="flex flex-col h-full">
      <TopBar onToggleSidebar={() => {}} />
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.length === 0 ? (
            <div className="text-center text-[--color-text-muted] mt-24">发送消息开始对话</div>
          ) : messages.map((m, i) => {
            const content = streaming && i === messages.length - 1 && m.role === 'assistant'
              ? streamingContent
              : m.content
            return (
              <Message
                key={i}
                msg={{ ...m, content }}
                streaming={streaming}
                isLast={i === messages.length - 1}
                onRegenerate={() => {}}
                onEdit={() => {}}
              />
            )
          })}
        </div>
      </div>
      <LogDrawer />
      <Composer onSend={send} onStop={stop} streaming={streaming} />
    </div>
  )
}
