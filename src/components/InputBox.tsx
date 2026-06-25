import { useState, useRef, useEffect } from 'react'

interface InputBoxProps {
  onSend: (text: string, images?: string[]) => void
  disabled: boolean
}

export function InputBox({ onSend, disabled }: InputBoxProps) {
  const [text, setText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = () => {
            setPendingImages((prev) => [...prev, reader.result as string])
          }
          reader.readAsDataURL(file)
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleSend = () => {
    if ((!text.trim() && pendingImages.length === 0) || disabled) return
    onSend(text.trim(), pendingImages.length > 0 ? pendingImages : undefined)
    setText('')
    setPendingImages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div>
      {pendingImages.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px', flexWrap: 'wrap' }}>
          {pendingImages.map((img, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={img} alt={`preview ${i}`} style={{ maxWidth: 100, maxHeight: 100, borderRadius: 6 }} />
              <button
                onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: '50%',
                  border: 'none', background: '#ff4444', color: '#fff',
                  cursor: 'pointer', fontSize: 12, lineHeight: '20px', textAlign: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          borderTop: '1px solid #e0e0e0',
          padding: '12px 16px',
          background: dragOver ? '#f0f7ff' : '#fff',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const files = Array.from(e.dataTransfer.files)
          files.forEach((f) => {
            if (f.type.startsWith('image/')) {
              const reader = new FileReader()
              reader.onload = () => {
                setPendingImages((prev) => [...prev, reader.result as string])
              }
              reader.readAsDataURL(f)
            }
          })
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            multiple
            onChange={(e) => {
              const files = e.target.files
              if (files) {
                Array.from(files).forEach((f) => {
                  const reader = new FileReader()
                  reader.onload = () => {
                    setPendingImages((prev) => [...prev, reader.result as string])
                  }
                  reader.readAsDataURL(f)
                })
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 18 }}
            disabled={disabled}
            title="添加图片"
          >
            🖼️
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            rows={1}
            disabled={disabled}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1px solid #ccc', resize: 'none',
              fontFamily: 'inherit', fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!text.trim() && pendingImages.length === 0) || disabled}
            style={{
              padding: '8px 20px', cursor: 'pointer',
              background: disabled ? '#ccc' : '#007aff',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 500,
            }}
          >
            {disabled ? '思考中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
