export function MessageStream() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <span className="w-[6px] h-[6px] rounded-full bg-[--color-text-muted] animate-messageDot"
        style={{ animationDelay: '0ms' }} />
      <span className="w-[6px] h-[6px] rounded-full bg-[--color-text-muted] animate-messageDot"
        style={{ animationDelay: '200ms' }} />
      <span className="w-[6px] h-[6px] rounded-full bg-[--color-text-muted] animate-messageDot"
        style={{ animationDelay: '400ms' }} />
    </div>
  )
}
