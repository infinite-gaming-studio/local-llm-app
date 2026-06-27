import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SidebarSimple, CaretDown, Check, Warning } from '@phosphor-icons/react'
import { api, AvailableModel } from '../api'
import { useConversations } from '../store/useConversations'

interface TopBarProps {
  onToggleSidebar: () => void
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const nav = useNavigate()
  const [models, setModels] = useState<AvailableModel[]>([])
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; path?: string }>({ loaded: false })
  const [open, setOpen] = useState(false)
  const [operating, setOperating] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getAvailableModels().then((d) => setModels(d.models)).catch(() => {})
    api.getModelStatus().then(setModelStatus).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentModel = models.find((m) => m.local_path === modelStatus.path)
  const currentName = modelStatus.loaded
    ? (currentModel?.name ?? modelStatus.path ?? '已加载')
    : '未加载'

  const handleSelect = async (m: AvailableModel) => {
    if (!m.local_path) return
    setOperating(m.id)
    try {
      await api.loadModel(m.local_path)
      setModelStatus(await api.getModelStatus())
      // 同步模型模态和加载状态到对话 store（影响 Composer 显示和 Chat 引导）
      await useConversations.getState().refreshModelStatus()
    } catch (e) { console.error(e) }
    setOperating(null)
    setOpen(false)
  }

  const selectable = models.filter((m) => m.downloaded || m.local_path)

  return (
    <header className="flex items-center gap-2 px-4 h-12 border-b border-[var(--color-border)] shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors"
        aria-label="切换侧栏"
      >
        <SidebarSimple size={18} />
      </button>
      <span className="text-[13px] text-[var(--color-text-muted)]">新对话</span>

      <div className="flex-1" />

      <div className="relative" ref={ref}>
        {modelStatus.loaded ? (
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors"
            aria-label="选择模型"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {currentName}
            <CaretDown size={10} />
          </button>
        ) : (
          <button
            onClick={() => nav('/settings')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] text-[var(--color-accent)] bg-[var(--color-accent-soft)] hover:opacity-80 transition-opacity"
            aria-label="前往加载模型"
          >
            <Warning size={12} weight="fill" />
            点击加载模型
          </button>
        )}

        {open && (
          <div className="absolute right-0 top-full mt-1 w-56 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg z-50">
            {selectable.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[var(--color-text-muted)]">暂无可用模型</div>
            ) : selectable.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelect(m)}
                disabled={operating === m.id}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors"
              >
                <span className="w-4 flex justify-center shrink-0">
                  {modelStatus.path === m.local_path && <Check size={14} className="text-emerald-500" />}
                </span>
                <span className="flex-1 text-left truncate">{m.name}</span>
                {operating === m.id && <span className="text-[11px] text-[var(--color-text-muted)]">加载中…</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}