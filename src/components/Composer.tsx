import { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon, ArrowUp, Stop, X } from '@phosphor-icons/react'

interface ComposerProps {
  onSend: (text: string, images?: string[]) => void
  onStop: () => void
  streaming: boolean
}

export function Composer({ onSend, onStop, streaming }: ComposerProps) {
  const [text, setText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const r = new FileReader()
          r.onload = () => setPendingImages((p) => [...p, r.result as string])
          r.readAsDataURL(file)
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [text])

  const send = () => {
    if ((!text.trim() && pendingImages.length === 0) || streaming) return
    onSend(text.trim(), pendingImages.length ? pendingImages : undefined)
    setText('')
    setPendingImages([])
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const addFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/')) return
      const r = new FileReader()
      r.onload = () => setPendingImages((p) => [...p, r.result as string])
      r.readAsDataURL(f)
    })
  }

  const canSend = (text.trim().length > 0 || pendingImages.length > 0) && !streaming

  return (
    <div className="px-4 pb-4 pt-2 shrink-0" onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}>
      {pendingImages.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative">
              <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg" />
              <button onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[--color-accent] text-white grid place-items-center">
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`flex items-end gap-2 rounded-2xl border border-[--color-border] bg-[--color-surface] px-3 py-2 transition-colors ${dragOver ? 'ring-2 ring-[--color-accent]/40' : ''}`}>
        <input ref={fileInputRef} type="file" accept="image/*" hidden multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <button onClick={() => fileInputRef.current?.click()} disabled={streaming}
          className="p-2 rounded-lg text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-2] transition-colors disabled:opacity-40"
          aria-label="添加图片">
          <ImageIcon size={20} />
        </button>
        <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
          placeholder="发送消息…  (Enter 发送,Shift+Enter 换行)" rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-relaxed py-1.5 max-h-[200px]" />
        {streaming ? (
          <button onClick={onStop} aria-label="停止生成"
            className="w-9 h-9 rounded-xl bg-[--color-surface-2] text-[--color-text] grid place-items-center hover:bg-[--color-border] transition-colors">
            <Stop size={18} weight="fill" />
          </button>
        ) : (
          <button onClick={send} disabled={!canSend} aria-label="发送"
            className="w-9 h-9 rounded-xl bg-[--color-accent] text-white grid place-items-center disabled:opacity-30 transition-opacity hover:opacity-90">
            <ArrowUp size={18} weight="bold" />
          </button>
        )}
      </div>
    </div>
  )
}
