import { Sparkle } from '@phosphor-icons/react'

const EXAMPLES = ['帮我总结这段文档', '解释一下这段代码', '写一个 Python 脚本批量重命名文件', '把这段中文翻译成英文']

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <Sparkle size={36} weight="fill" className="text-[--color-accent] mb-4" />
      <h2 className="text-[22px] font-semibold mb-2">今天能帮你做点什么?</h2>
      <p className="text-[--color-text-muted] text-[14px] mb-8">发送消息开始对话,或试试下面的示例</p>
      <div className="grid sm:grid-cols-2 gap-2 max-w-xl w-full">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => onPick(ex)}
            className="text-left px-4 py-3 rounded-xl border border-[--color-border] hover:bg-[--color-surface] hover:border-[--color-accent]/40 transition-colors text-[14px] text-[--color-text-muted]">
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
