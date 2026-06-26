import { useState } from 'react'
import { Sun, Moon } from '@phosphor-icons/react'
import { getTheme, toggleTheme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme())
  return (
    <button
      onClick={() => setThemeState(toggleTheme())}
      className="p-2 rounded-lg text-[--color-text-muted] hover:bg-[--color-surface-2] hover:text-[--color-text] transition-colors"
      aria-label="切换主题"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
