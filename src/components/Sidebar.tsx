import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Plus, MagnifyingGlass, ChatCircle, PuzzlePiece, Gear, Trash, PencilSimple, ArrowsClockwise } from '@phosphor-icons/react'
import { useConversations } from '../store/useConversations'
import { useModelDownloads } from '../store/useModelDownloads'
import { ThemeToggle } from './ThemeToggle'
import { ConfirmDialog } from './ConfirmDialog'

const DAY = 86400000

function group(list: { id: string; title: string; updated_at: number }[]) {
  const now = Date.now()
  const today: any[] = []; const week: any[] = []; const older: any[] = []
  for (const c of list) {
    const age = now - c.updated_at
    if (age < DAY) today.push(c)
    else if (age < 7 * DAY) week.push(c)
    else older.push(c)
  }
  return { today, week, older }
}

export function Sidebar() {
  const { conversations, init, selectConversation, deleteConversation, renameConversation, activeId, createConversation } = useConversations()
  const { downloads } = useModelDownloads()
  const activeDownloads = Object.values(downloads).filter((d) => d.status === 'downloading')
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [motionOk, setMotionOk] = useState(true)
  const nav = useNavigate()

  useEffect(() => { init() }, [init])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setMotionOk(!mq.matches)
    const handler = (e: MediaQueryListEvent) => setMotionOk(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const filtered = conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
  const { today, week, older } = group(filtered)

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-[--color-surface-2] text-[--color-text] font-medium' : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-2]/60'}`

  const Row = (c: { id: string; title: string }) => (
    <div key={c.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${activeId === c.id ? 'bg-[--color-surface-2] text-[--color-text]' : 'text-[--color-text-muted] hover:bg-[--color-surface-2]/60'}`}
      onClick={() => { selectConversation(c.id); nav('/') }}>
      {renaming === c.id ? (
        <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => { if (renameVal.trim()) renameConversation(c.id, renameVal.trim()); setRenaming(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 bg-transparent outline-none text-[13px] text-[--color-text] border-b border-[--color-accent]" />
      ) : <span className="flex-1 truncate text-[13px]">{c.title}</span>}
      {renaming !== c.id && (
        <div className="hidden group-hover:flex gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); setRenaming(c.id); setRenameVal(c.title) }} className="p-1 rounded hover:bg-[--color-border]"><PencilSimple size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); setConfirmDel(c.id) }} className="p-1 rounded hover:bg-[--color-border]"><Trash size={13} /></button>
        </div>
      )}
    </div>
  )

  const Section = ({ label, items }: { label: string; items: any[] }) => items.length ? (
    <div className="mb-3">
      <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[--color-text-muted] opacity-70">{label}</div>
      {items.map(Row)}
    </div>
  ) : null

  return (
    <nav className="w-[260px] shrink-0 border-r border-[--color-border] bg-[--color-surface] flex flex-col">
      <div className="p-3">
        <button onClick={() => { createConversation(); nav('/') }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[--color-border] text-[13px] text-[--color-text] hover:bg-[--color-accent-soft] hover:border-[--color-accent]/40 transition-colors">
          <Plus size={16} /> 新对话
        </button>
      </div>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[--color-surface-2]/60">
          <MagnifyingGlass size={15} className="text-[--color-text-muted]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对话"
            className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
      </div>
      <div className="flex-1 overflow-auto px-2">
        <Section label="今天" items={today} />
        <Section label="过去 7 天" items={week} />
        <Section label="更早" items={older} />
      </div>
      <div className="p-3 border-t border-[--color-border] flex flex-col gap-1">
        <NavLink to="/" end className={navItem}><ChatCircle size={18} /> 对话</NavLink>
        <NavLink to="/skills" className={navItem}><PuzzlePiece size={18} /> Skills</NavLink>
        <NavLink to="/settings" className={navItem}><Gear size={18} /> 设置</NavLink>
        {activeDownloads.length > 0 && (
          <NavLink to="/settings" className={navItem}>
            <ArrowsClockwise size={18} className={motionOk ? 'animate-spin' : ''} /> 下载中 {activeDownloads.length}
          </NavLink>
        )}
        <div className="pt-2 mt-1 border-t border-[--color-border]"><ThemeToggle /></div>
      </div>
      {confirmDel && <ConfirmDialog title="删除对话?" confirmText="删除" onConfirm={async () => { await deleteConversation(confirmDel); setConfirmDel(null) }} onCancel={() => setConfirmDel(null)} />}
    </nav>
  )
}
