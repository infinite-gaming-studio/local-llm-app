import { useState, useEffect } from 'react'
import { api } from '../api'

export function Skills() {
  const [skills, setSkills] = useState<Array<{ name: string; description: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSkills().then((data) => {
      setSkills(data.skills)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2 style={{ marginTop: 0 }}>Skills</h2>
      <p style={{ color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
        Skill 文件位于 <code>~/.llm-app/skills/</code> 目录，Agent 会根据对话内容自动匹配合适的 skill。
      </p>

      {loading && <p>加载中...</p>}

      {!loading && skills.length === 0 && (
        <div style={{
          padding: 32, background: '#f9f9f9', borderRadius: 8,
          textAlign: 'center', color: '#999',
        }}>
          <p style={{ margin: '0 0 8px' }}>暂无 skill 文件</p>
          <p style={{ fontSize: 13, margin: 0 }}>
            在 ~/.llm-app/skills/ 目录下创建 .md 文件即可添加 skill
          </p>
        </div>
      )}

      {skills.map((s) => (
        <div
          key={s.name}
          style={{
            padding: 16, marginBottom: 8,
            border: '1px solid #e0e0e0', borderRadius: 8,
          }}
        >
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{s.name}</h3>
          <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{s.description}</p>
        </div>
      ))}
    </div>
  )
}
