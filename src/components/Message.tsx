import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Sparkle, Copy, ArrowsClockwise, PencilSimple, Check } from '@phosphor-icons/react'
import { useConversations } from '../store/useConversations'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

interface Props {
  msg: Msg
  streaming: boolean
  isLast: boolean
}

export function Message({ msg, streaming, isLast }: Props) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const { regenerate, editAndResend } = useConversations()

  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  if (msg.role === 'user' && !editing) {
    return (
      <div className="group flex flex-col items-end">
        <span className="text-[12px] text-[--color-text-muted] mb-1 px-1">你</span>
        <div className="flex items-end gap-2 max-w-[80%]">
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 mb-1">
            <button onClick={() => { setDraft(msg.content); setEditing(true) }} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label="编辑"><PencilSimple size={14} /></button>
            <button onClick={copy} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label="复制">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
          </div>
          <div className="rounded-[14px] px-4 py-3 bg-[--color-surface-2] whitespace-pre-wrap leading-[1.65]">
            {msg.images?.map((img, i) => <img key={i} src={img} alt="" className="max-h-60 rounded-lg mb-2 block" />)}
            {msg.content}
          </div>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end">
        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
          className="w-[80%] rounded-[14px] px-4 py-3 bg-[--color-surface-2] outline-none ring-2 ring-[--color-accent]/40 resize-none" />
        <div className="flex gap-2 mt-2">
          <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg text-[13px] hover:bg-[--color-surface-2]">取消</button>
          <button onClick={() => { editAndResend(draft); setEditing(false) }} className="px-3 py-1 rounded-lg bg-[--color-accent] text-white text-[13px]">保存并重发</button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex gap-3">
      <Sparkle size={20} weight="fill" className="text-[--color-accent] mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[12px] text-[--color-text-muted] mb-1 block px-0.5">AI</span>
        <div className="prose prose-sm max-w-none dark:prose-invert leading-[1.65]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{
            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          }}>{msg.content}</ReactMarkdown>
          {streaming && isLast && <span className="inline-block w-2 h-4 bg-[--color-accent] align-middle animate-pulse" />}
        </div>
        {!streaming && (
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 mt-1.5">
            <button onClick={copy} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label="复制">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            <button onClick={regenerate} className="p-1 rounded hover:bg-[--color-surface-2]" aria-label="重新生成"><ArrowsClockwise size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden my-3 bg-[#1F1E1D]">
      <pre className="p-4 overflow-auto text-[13px] font-mono text-[#EDEBE5]">{children}</pre>
    </div>
  )
}
