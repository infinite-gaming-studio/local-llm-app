import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Chat } from './pages/Chat'
import { Settings } from './pages/Settings'
import { Skills } from './pages/Skills'
import { Sidebar } from './components/Sidebar'
import { getTheme, setTheme } from './lib/theme'
import { useModelDownloads } from './store/useModelDownloads'
import { useLogs } from './store/useLogs'

export default function App() {
  useEffect(() => {
    setTheme(getTheme())
    useModelDownloads.getState().restore()
    const unsubscribeLogs = useLogs.getState().init()
    return () => {
      unsubscribeLogs()
    }
  }, [])

  return (
    <HashRouter>
      <div className="flex h-full">
        <Sidebar />
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
