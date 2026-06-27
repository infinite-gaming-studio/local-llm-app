import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Plus, MagnifyingGlass, ChatCircle, PuzzlePiece, Gear, Trash, PencilSimple, ArrowsClockwise } from '@phosphor-icons/react'
import { useConversations } from '../store/useConversations'
import { useModelDownloads } from '../store/useModelDownloads'
import { ThemeToggle } from './ThemeToggle'
import { ConfirmDialog } from './ConfirmDialog'

const DAY = 86400000

function getEpochDay(ts: number) {
  return Math.floor(ts / DAY)
}

function group(list: { id: string; title: string; updated_at: number }[]) {
  const todayEpoch = getEpochDay(Date.now())
  const yesterdayEpoch = todayEpoch - 1
  const dayOfWeek = new Date().getDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const mondayEpoch = todayEpoch - daysSinceMonday
  const todayBucket: any[] = []; const yesterdayBucket: any[] = []; const weekBucket: any[] = []; const olderBucket: any[] = []
  for (const c of list) {
    const e = getEpochDay(c.updated_at)
    if (e === todayEpoch) todayBucket.push(c)
    else if (e === yesterdayEpoch) yesterdayBucket.push(c)
    else if (e >= mondayEpoch) weekBucket.push(c)
    else olderBucket.push(c)
  }
  return { today: todayBucket, yesterday: yesterdayBucket, week: weekBucket, older: olderBucket }
}

export function Sidebar() {
  const { conversations, init, selectConversation, deleteConversation, renameConversation, activeId, createConversation } = useConversations()
  const { downloads } = useModelDownloads()
  const activeDownloadList = Object.values(downloads).filter((d) => d.status === 'downloading')
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
  const { today, yesterday, week, older } = group(filtered)

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${isActive ? 'bg-[var(--color-surface-2)] text-[var(--color-text)] font-medium' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60'}`

  const Row = (c: { id: string; title: string }) => (
    <div key={c.id} role="button" tabIndex={0} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${activeId === c.id ? 'bg-[var(--color-accent-soft)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]/60'}`}
      onClick={() => { selectConversation(c.id); nav('/') }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectConversation(c.id); nav('/') } }}>
      {renaming === c.id ? (
        <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => { if (renameVal.trim()) renameConversation(c.id, renameVal.trim()); setRenaming(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="flex-1 bg-transparent outline-none text-[13px] text-[var(--color-text)] border-b border-[var(--color-accent)]" />
      ) : <span className="flex-1 truncate text-[13px]">{c.title}</span>}
      {renaming !== c.id && (
        <div className="hidden group-hover:flex gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); setRenaming(c.id); setRenameVal(c.title) }} className="p-1 rounded hover:bg-[var(--color-border)]" aria-label="重命名"><PencilSimple size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); setConfirmDel(c.id) }} className="p-1 rounded hover:bg-[var(--color-border)]" aria-label="删除"><Trash size={13} /></button>
        </div>
      )}
    </div>
  )

  const Section = ({ label, items }: { label: string; items: any[] }) => items.length ? (
    <div className="mb-3">
      <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] opacity-70">{label}</div>
      {items.map(Row)}
    </div>
  ) : null

  return (
    <nav className="w-72 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
      <div className="p-3">
        <button onClick={() => { createConversation(); nav('/') }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-[13px] text-[var(--color-text)] hover:bg-[var(--color-accent-soft)] hover:border-[var(--color-accent)]/40 transition-colors">
          <Plus size={16} /> 新对话
        </button>
      </div>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface-2)]/60">
          <MagnifyingGlass size={15} className="text-[var(--color-text-muted)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索对话" aria-label="搜索对话"
            className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
      </div>
      <div className="flex-1 overflow-auto px-2">
        <Section label="今天" items={today} />
        <Section label="昨天" items={yesterday} />
        <Section label="本周" items={week} />
        <Section label="更早" items={older} />
      </div>
      <div className="p-3 border-t border-[var(--color-border)] flex flex-col gap-1">
        <NavLink to="/" end className={navItem}><ChatCircle size={18} /> 对话</NavLink>
        <NavLink to="/skills" className={navItem}><PuzzlePiece size={18} /> 训练技能</NavLink>
        <NavLink to="/settings" className={navItem}><Gear size={18} /> 设置</NavLink>
        {activeDownloadList.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <NavLink to="/settings" className={navItem}>
              <ArrowsClockwise size={18} className={motionOk ? 'animate-spin' : ''} /> 下载中 {activeDownloadList.length}
            </NavLink>
            <div className="px-3 pb-1 space-y-0.5">
              {activeDownloadList.map((d, i) => (
                <div key={i} className="h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div className="h-full bg-[var(--color-accent)] rounded-full transition-[width] duration-300" style={{ width: `${Math.round((d.progress || 0) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2 mt-1 border-t border-[var(--color-border)]"><ThemeToggle /></div>
      </div>
      {confirmDel && <ConfirmDialog title="删除对话?" confirmText="删除" onConfirm={async () => { await deleteConversation(confirmDel); setConfirmDel(null) }} onCancel={() => setConfirmDel(null)} />}
    </nav>
  )
}
