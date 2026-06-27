import { useRef, useEffect, useState } from 'react'
import { Composer } from '../components/Composer'
import { Message } from '../components/Message'
import { MessageStream } from '../components/MessageStream'
import { EmptyState } from '../components/EmptyState'
import { NoModelState } from '../components/NoModelState'
import { useConversations } from '../store/useConversations'

export function Chat() {
  const { activeConv, streaming, streamingContent, send, stop, modelLoaded } = useConversations()
  const messages = activeConv?.messages ?? []
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  // 智能自动滚动：仅在用户已在底部附近时跟随（避免用户上滑查看历史时被强制拉回）
  useEffect(() => {
    if (!atBottom) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streamingContent, atBottom])

  // 新会话切换时重置到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
    setAtBottom(true)
  }, [activeConv?.id])

  // 未加载模型：显示引导卡片，禁用 Composer
  if (!modelLoaded && messages.length === 0 && !streaming) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 h-full">
            <NoModelState />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onScroll={(e) => {
          const el = e.currentTarget
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
          {messages.length === 0 && !streaming ? (
            <EmptyState onPick={send} />
          ) : (
            <>
              {messages.map((m, i) => {
                const content = streaming && i === messages.length - 1 && m.role === 'assistant'
                  ? streamingContent
                  : m.content
                return (
                  <Message
                    key={i}
                    msg={{ ...m, content }}
                    streaming={streaming}
                    isLast={i === messages.length - 1}
                  />
                )
              })}
              {streaming && <MessageStream />}
            </>
          )}
        </div>
      </div>
      <Composer onSend={send} onStop={stop} streaming={streaming} disabled={!modelLoaded} />
    </div>
  )
}
