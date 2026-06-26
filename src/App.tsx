import { useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { ChatCircle, PuzzlePiece, Gear } from '@phosphor-icons/react'
import { Chat } from './pages/Chat'
import { Settings } from './pages/Settings'
import { Skills } from './pages/Skills'
import { ThemeToggle } from './components/ThemeToggle'
import { getTheme, setTheme } from './lib/theme'

export default function App() {
  useEffect(() => { setTheme(getTheme()) }, [])

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
      isActive
        ? 'bg-[--color-surface-2] text-[--color-text] font-medium'
        : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-2]/60'
    }`

  return (
    <HashRouter>
      <div className="flex h-full">
        <nav className="w-[260px] shrink-0 border-r border-[--color-border] bg-[--color-surface] flex flex-col">
          <div className="flex-1 overflow-auto p-3">
            <div className="px-2 py-3 text-[13px] font-semibold text-[--color-text]">Local LLM</div>
          </div>
          <div className="p-3 border-t border-[--color-border] flex flex-col gap-1">
            <NavLink to="/" end className={navItem}><ChatCircle size={18} /> 对话</NavLink>
            <NavLink to="/skills" className={navItem}><PuzzlePiece size={18} /> Skills</NavLink>
            <NavLink to="/settings" className={navItem}><Gear size={18} /> 设置</NavLink>
            <div className="pt-2 mt-1 border-t border-[--color-border]"><ThemeToggle /></div>
          </div>
        </nav>
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/skills" element={<Skills />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
