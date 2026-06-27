import { useNavigate } from 'react-router-dom'
import { Cube, Gear } from '@phosphor-icons/react'

export function NoModelState() {
  const nav = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-soft)] grid place-items-center mb-5">
        <Cube size={32} className="text-[var(--color-accent)]" />
      </div>
      <h2 className="text-[22px] font-semibold mb-2">还没有加载模型</h2>
      <p className="text-[var(--color-text-muted)] text-[14px] mb-6 max-w-md">
        需要先加载一个模型才能开始对话。前往「设置」页面导入或加载本地模型。
      </p>
      <button
        onClick={() => nav('/settings')}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
      >
        <Gear size={16} /> 去加载模型
      </button>
    </div>
  )
}
