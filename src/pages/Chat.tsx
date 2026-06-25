import { useChat } from '../hooks/useChat'
import { ChatView } from '../components/ChatView'

export function Chat() {
  const { messages, streaming, sendMessage, stopStreaming } = useChat()

  return (
    <ChatView
      messages={messages}
      streaming={streaming}
      onSend={sendMessage}
      onStop={stopStreaming}
    />
  )
}
