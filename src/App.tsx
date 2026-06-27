import { useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Chat } from './pages/Chat'
import { Settings } from './pages/Settings'
import { Skills } from './pages/Skills'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { getTheme, setTheme } from './lib/theme'
import { useLogs } from './store/useLogs'
import { useConversations } from './store/useConversations'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const toggleSidebar = useCallback(() => setSidebarOpen((s) => !s), [])

  useKeyboardShortcuts(sidebarOpen, setSidebarOpen)

  useEffect(() => {
    setTheme(getTheme())
    const unsubscribeLogs = useLogs.getState().init()
    // 拉取当前已加载模型的模态信息，决定 Composer 显示哪些上传按钮
    useConversations.getState().refreshModelStatus()
    return () => {
      unsubscribeLogs()
    }
  }, [])

  return (
    <HashRouter>
      <div className="flex h-full">
        {sidebarOpen && <Sidebar />}
        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBar onToggleSidebar={toggleSidebar} />
          <div className="flex-1 min-h-0 overflow-hidden">
            <Routes>
              <Route path="/" element={<Chat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/skills" element={<Skills />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  )
}
