import { useConversations } from '../store/useConversations'
import { Wrench } from '@phosphor-icons/react'

export function MessageStream() {
  const toolActive = useConversations((s) => s.toolActive)

  if (toolActive) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-[13px] text-[var(--color-text-muted)]">
        <Wrench size={14} className="animate-spin" />
        调用工具: {toolActive}…
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <span className="w-[6px] h-[6px] rounded-full bg-[var(--color-text-muted)] animate-messageDot"
        style={{ animationDelay: '0ms' }} />
      <span className="w-[6px] h-[6px] rounded-full bg-[var(--color-text-muted)] animate-messageDot"
        style={{ animationDelay: '200ms' }} />
      <span className="w-[6px] h-[6px] rounded-full bg-[var(--color-text-muted)] animate-messageDot"
        style={{ animationDelay: '400ms' }} />
    </div>
  )
}
