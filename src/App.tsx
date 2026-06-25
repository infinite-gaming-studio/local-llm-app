import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Chat } from './pages/Chat'
import { Settings } from './pages/Settings'
import { Skills } from './pages/Skills'

const linkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#333',
  padding: '8px 12px',
  borderRadius: 6,
  fontSize: 14,
  display: 'block',
}

const activeLinkStyle: React.CSSProperties = {
  ...linkStyle,
  background: '#f0f0f0',
  fontWeight: 600,
}

export default function App() {
  return (
    <HashRouter>
      <div style={{
        display: 'flex', height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1a1a1a',
      }}>
        <nav style={{
          width: 220, borderRight: '1px solid #e0e0e0',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 4,
          background: '#fafafa',
        }}>
          <h1 style={{ fontSize: 18, margin: '0 0 20px 8px', fontWeight: 600 }}>Local LLM</h1>
          <NavLink
            to="/"
            style={({ isActive }) => isActive ? { ...linkStyle, ...activeLinkStyle } : linkStyle}
          >
            💬 对话
          </NavLink>
          <NavLink
            to="/settings"
            style={({ isActive }) => isActive ? { ...linkStyle, ...activeLinkStyle } : linkStyle}
          >
            ⚙️ 设置
          </NavLink>
          <NavLink
            to="/skills"
            style={({ isActive }) => isActive ? { ...linkStyle, ...activeLinkStyle } : linkStyle}
          >
            🧩 Skills
          </NavLink>
        </nav>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
