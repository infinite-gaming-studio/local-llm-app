import { InputBox } from './InputBox'
import { MessageList } from './MessageList'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

interface ChatViewProps {
  messages: Message[]
  streaming: boolean
  onSend: (text: string, images?: string[]) => void
  onStop: () => void
}

export function ChatView({ messages, streaming, onSend, onStop }: ChatViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MessageList messages={messages} streaming={streaming} />
      {streaming && (
        <div style={{ textAlign: 'center', padding: '2px 0' }}>
          <button
            onClick={onStop}
            style={{
              cursor: 'pointer', fontSize: 12, border: 'none',
              background: 'transparent', color: '#007aff',
              padding: '4px 12px',
            }}
          >
            停止生成
          </button>
        </div>
      )}
      <InputBox onSend={onSend} disabled={streaming} />
    </div>
  )
}
