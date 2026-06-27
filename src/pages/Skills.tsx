import { useState, useEffect } from 'react'
import { api } from '../api'
import { PuzzlePiece } from '@phosphor-icons/react'

export function Skills() {
  const [skills, setSkills] = useState<Array<{ name: string; description: string }>>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.getSkills().then((d) => setSkills(d.skills)).catch(() => {}).finally(() => setLoading(false)) }, [])

  return (
    <div className="h-full overflow-auto px-8 py-8 max-w-2xl mx-auto">
      <h2 className="text-[22px] font-semibold mt-0 mb-2">Skills</h2>
      <p className="text-[var(--color-text-muted)] mb-6 leading-relaxed text-[14px]">
        Skill 文件位于 <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[13px]">~/.llm-app/skills/</code>,Agent 会根据对话内容自动匹配。
      </p>
      {loading && <p className="text-[var(--color-text-muted)]">加载中…</p>}
      {!loading && skills.length === 0 && (
        <div className="p-8 bg-[var(--color-surface)] rounded-xl text-center text-[var(--color-text-muted)]">
          <PuzzlePiece size={28} className="mx-auto mb-2 opacity-40" />
          <p className="mb-1">暂无 skill 文件</p>
          <p className="text-[13px]">在 ~/.llm-app/skills/ 下创建 .md 文件即可添加</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {skills.map((s) => (
          <div key={s.name} className="p-4 border border-[var(--color-border)] rounded-xl">
            <h3 className="text-[16px] font-semibold mb-1.5">{s.name}</h3>
            <p className="text-[14px] text-[var(--color-text-muted)]">{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
