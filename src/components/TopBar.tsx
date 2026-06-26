import { SidebarSimple } from '@phosphor-icons/react'

interface TopBarProps {
  onToggleSidebar: () => void
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  return (
    <header className="flex items-center gap-2 px-4 h-12 border-b border-[--color-border] shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg text-[--color-text-muted] hover:bg-[--color-surface-2] hover:text-[--color-text] transition-colors"
        aria-label="切换侧栏"
      >
        <SidebarSimple size={18} />
      </button>
      <span className="text-[13px] text-[--color-text-muted]">新对话</span>
    </header>
  )
}
