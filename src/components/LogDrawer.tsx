import { useEffect, useRef, useState } from 'react'
import { Terminal, Trash, CaretUp, CaretDown } from '@phosphor-icons/react'
import { useLogs } from '../store/useLogs'

const ERROR_RE = /error|traceback/i

export function LogDrawer() {
  const entries = useLogs((s) => s.entries)
  const clear = useLogs((s) => s.clear)
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(240)
  const [follow, setFollow] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (follow && scrollRef.current && open) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries, follow, open])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const h = window.innerHeight - e.clientY
      setHeight(Math.max(120, Math.min(480, h)))
    }
    const onUp = () => { draggingRef.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const last = entries[entries.length - 1]

  return (
    <div className="shrink-0 border-t border-[--color-border]" style={open ? { height } : {}}>
      {open && <div className="h-1 cursor-row-resize bg-transparent" onMouseDown={(e) => { e.preventDefault(); draggingRef.current = true }} />}
      <div className="flex items-center gap-2 px-4 h-7 text-[12px]">
        <Terminal size={14} className="text-[--color-text-muted]" />
        <span className="text-[--color-text-muted]">后端日志</span>
        {!open && last && <span className="text-[--color-text-muted] truncate flex-1">{last.line}</span>}
        <span className="text-[--color-text-muted]">{entries.length}</span>
        <button onClick={clear} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label="清空"><Trash size={13} /></button>
        <button onClick={() => setOpen((o) => !o)} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label={open ? '收起' : '展开'}>
          {open ? <CaretDown size={13} /> : <CaretUp size={13} />}
        </button>
      </div>
      {open && (
        <div ref={scrollRef} onScroll={(e) => {
          const el = e.currentTarget; const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
          setFollow(atBottom)
        }} className="overflow-auto px-4 py-1 font-mono text-[12px] leading-relaxed h-[calc(100%-32px)]">
          {entries.length === 0 ? <div className="text-[--color-text-muted] py-4">暂无日志，sidecar 启动后此处显示模型调用输出</div> :
            entries.map((e, i) => {
              const t = new Date(e.ts); const ts = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
              const err = e.stream === 'stderr' || ERROR_RE.test(e.line)
              return <div key={i} className={err ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}><span className="opacity-60">{ts}</span> {e.line}</div>
            })}
          {!follow && <button onClick={() => setFollow(true)} className="sticky bottom-2 ml-auto block px-2 py-1 rounded bg-[--color-surface-2] text-[--color-text]">↓ 跟随最新</button>}
        </div>
      )}
    </div>
  )
}
