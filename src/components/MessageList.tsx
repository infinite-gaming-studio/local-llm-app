import { useEffect, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

interface MessageListProps {
  messages: Message[]
  streaming: boolean
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#999', userSelect: 'none',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontWeight: 400, margin: '0 0 8px' }}>Local LLM App</h2>
          <p style={{ margin: 0 }}>发送消息开始对话，或拖拽/粘贴图片进行分析</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}
        >
          <div style={{
            maxWidth: '75%',
            borderRadius: 16,
            padding: '10px 16px',
            background: msg.role === 'user' ? '#007aff' : '#f0f0f0',
            color: msg.role === 'user' ? '#fff' : '#000',
          }}>
            {msg.images?.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="upload"
                style={{
                  maxWidth: '100%', maxHeight: 240,
                  borderRadius: 8, marginBottom: 8,
                  display: 'block',
                }}
              />
            ))}
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
              {msg.content}
              {streaming && msg === messages[messages.length - 1] && msg.role === 'assistant' && (
                <span style={{ animation: 'blink 1s step-end infinite' }}>▍</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4, padding: '0 8px' }}>
            {msg.role === 'user' ? '你' : 'AI'}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
