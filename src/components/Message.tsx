import { useState, useRef, useMemo, isValidElement, type ReactNode } from 'react'
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
        <span className="text-[12px] text-[var(--color-text-muted)] mb-1 px-1">你</span>
        <div className="flex items-end gap-2 max-w-[80%]">
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 mb-1">
            <button onClick={() => { setDraft(msg.content); setEditing(true) }} className="p-1 rounded hover:bg-[var(--color-surface-2)]" aria-label="编辑"><PencilSimple size={14} /></button>
            <button onClick={copy} className="p-1 rounded hover:bg-[var(--color-surface-2)]" aria-label="复制">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
          </div>
          <div className="rounded-[14px] px-4 py-3 bg-[var(--color-surface-2)] whitespace-pre-wrap leading-[1.65]">
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
          className="w-[80%] rounded-[14px] px-4 py-3 bg-[var(--color-surface-2)] outline-none ring-2 ring-[var(--color-accent)]/40 resize-none" />
        <div className="flex gap-2 mt-2">
          <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg text-[13px] hover:bg-[var(--color-surface-2)]">取消</button>
          <button onClick={() => { editAndResend(draft); setEditing(false) }} className="px-3 py-1 rounded-lg bg-[var(--color-accent)] text-white text-[13px]">保存并重发</button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex gap-3">
      <Sparkle size={20} weight="fill" className="text-[var(--color-accent)] mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[12px] text-[var(--color-text-muted)] mb-1 block px-0.5">AI</span>
        <div className="prose prose-sm max-w-none dark:prose-invert leading-[1.65]
          prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
          prose-p:my-2 prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0
          prose-code:before:content-none prose-code:after:content-none
          prose-code:bg-[var(--color-surface-2)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono
          prose-a:text-[var(--color-accent)] prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-l-[var(--color-accent)] prose-blockquote:not-italic
          prose-table:text-[13px] prose-th:bg-[var(--color-surface-2)] prose-img:rounded-lg">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{
            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          }}>{msg.content}</ReactMarkdown>
          {streaming && isLast && <span className="inline-block w-2 h-4 bg-[var(--color-accent)] align-middle animate-pulse" />}
        </div>
        {!streaming && (
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 mt-1.5">
            <button onClick={copy} className="p-1 rounded hover:bg-[var(--color-surface-2)]" aria-label="复制">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            <button onClick={regenerate} className="p-1 rounded hover:bg-[var(--color-surface-2)]" aria-label="重新生成"><ArrowsClockwise size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

/** 从 react-markdown 传递的 children 中提取 code 元素的语言标识 */
function useCodeLanguage(children: ReactNode): string | undefined {
  return useMemo(() => {
    const codeEl = Array.isArray(children) ? children[0] : children
    if (!isValidElement(codeEl)) return undefined
    const props = codeEl.props as { className?: string }
    const className = props.className || ''
    const match = /language-(\w+)/.exec(className)
    return match?.[1]
  }, [children])
}

function CodeBlock({ children }: { children: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const lang = useCodeLanguage(children)

  const copy = () => {
    const text = preRef.current?.textContent || ''
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative rounded-lg overflow-hidden my-3 bg-[#1F1E1D] border border-[var(--color-border)]">
      <div className="flex items-center justify-between px-4 h-8 bg-[#2A2927] border-b border-[var(--color-border)]">
        <span className="text-[11px] font-mono text-[#A8A69E] uppercase tracking-wide">{lang || 'text'}</span>
        <button onClick={copy}
          className="text-[11px] text-[#A8A69E] hover:text-[#EDEBE5] flex items-center gap-1 transition-colors">
          {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
        </button>
      </div>
      <pre ref={preRef} className="p-4 overflow-auto text-[13px] font-mono text-[#EDEBE5] leading-relaxed">{children}</pre>
    </div>
  )
}
