import { useState, useEffect } from 'react'
import { api, AvailableModel, LocalModel, SidecarDiagnostics } from '../api'
import { useModelDownloads } from '../store/useModelDownloads'
import { Trash, Key } from '@phosphor-icons/react'

const MB = 1024 * 1024
const GB = 1024 * MB
function formatSize(b: number) { return b >= GB ? `${(b / GB).toFixed(1)} GB` : b >= MB ? `${Math.round(b / MB)} MB` : `${b} B` }
function pct(p: number) { return `${Math.round(p * 100)}%` }

export function Settings() {
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; path?: string }>({ loaded: false })
  const [models, setModels] = useState<AvailableModel[]>([])
  const [localModels, setLocalModels] = useState<LocalModel[]>([])
  const [loading, setLoading] = useState(true)
  const [operating, setOperating] = useState<string | null>(null)
  const { downloads, startDownload, clearError } = useModelDownloads()

  const [error, setError] = useState<string | null>(null)
  const [diag, setDiag] = useState<SidecarDiagnostics | null>(null)
  const [hfToken, setHfToken] = useState(() => localStorage.getItem('llm-app:hf-token') || '')
  const [hfTokenSaved, setHfTokenSaved] = useState(false)

  const saveHfToken = async () => {
    localStorage.setItem('llm-app:hf-token', hfToken)
    await api.setSettings({ hf_token: hfToken || undefined })
    setHfTokenSaved(true)
    setTimeout(() => setHfTokenSaved(false), 2000)
  }

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const [status, avail, local] = await Promise.all([
        api.getModelStatus(),
        api.getAvailableModels(),
        api.getLocalModels()
      ])
      setModelStatus(status)
      setModels(avail.models)
      setLocalModels(local.models)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '无法连接到后端服务')
      try { setDiag(await api.getSidecarDiagnostics()) } catch {}
    }
    setLoading(false)
  }
  useEffect(() => {
    loadData(true)
    const t = setTimeout(() => setLoading(false), 15000)
    return () => clearTimeout(t)
  }, [])

  // Send stored HF token to sidecar on mount
  useEffect(() => {
    const token = localStorage.getItem('llm-app:hf-token')
    if (token) {
      api.setSettings({ hf_token: token }).catch(() => {})
    }
  }, [])

  // Reload model list when any download completes
  const completedIds = Object.entries(downloads)
    .filter(([, d]) => d.status === 'completed')
    .map(([id]) => id)
  useEffect(() => {
    if (completedIds.length > 0) {
      loadData(false)
    }
  }, [completedIds.join(',')])

  const handleLoad = async (path: string) => { setOperating(path); try { await api.loadModel(path); setModelStatus(await api.getModelStatus()) } catch (e) { console.error(e) }; setOperating(null) }
  const handleUnload = async () => { setOperating('unload'); try { await api.unloadModel(); setModelStatus({ loaded: false }) } catch (e) { console.error(e) }; setOperating(null) }

  return (
    <div className="h-full overflow-auto px-8 py-8 max-w-3xl mx-auto">
      <h2 className="text-[22px] font-semibold mt-0 mb-5">设置</h2>
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] rounded-xl mb-7">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${modelStatus.loaded ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[14px] font-medium">{modelStatus.loaded ? '模型已加载' : '模型未加载'}</span>
        {modelStatus.path && <span className="text-[12px] text-[var(--color-text-muted)] flex-1 truncate">{modelStatus.path}</span>}
        {modelStatus.loaded && (
          <button onClick={handleUnload} disabled={operating === 'unload'}
            className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
            {operating === 'unload' ? '卸载中…' : '卸载模型'}
          </button>
        )}
      </div>

      <details className="mb-5">
        <summary className="cursor-pointer text-[14px] text-[var(--color-text-muted)] flex items-center gap-2">
          <Key size={14} /> HuggingFace 令牌
        </summary>
        <div className="mt-3 flex gap-2">
          <input value={hfToken} onChange={(e) => setHfToken(e.target.value)} placeholder="hf_..."
            className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[14px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40" />
          <button onClick={saveHfToken}
            className="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
            {hfTokenSaved ? '已保存' : '保存'}
          </button>
        </div>
      </details>

      <h3 className="text-[17px] font-semibold mb-1">推荐模型</h3>
      <p className="text-[13px] text-[var(--color-text-muted)] mb-4">选择适合你设备的模型,下载后即可使用</p>

      {loading ? (
        <p className="text-[var(--color-text-muted)] p-8 text-center">加载中…</p>
      ) : error ? (
        <div className="p-8 text-center bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">连接失败</p>
          <p className="text-[13px] text-[var(--color-text-muted)] mb-4">{error}</p>
          {diag && (
            <div className="text-left text-[12px] font-mono bg-red-100/50 dark:bg-red-950/30 rounded p-3 mb-4 space-y-1">
              <p>Python: {diag.pythonPath || '未检测到'}</p>
              <p>工作目录: {diag.sidecarDir}</p>
              <p>端口: {diag.port || '未启动'}</p>
              <p>运行状态: {diag.isRunning ? '运行中' : '已停止'}</p>
              {diag.startError && <p className="text-red-600 dark:text-red-400">错误: {diag.startError}</p>}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => loadData(true)}
              className="px-5 py-2 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">
              重试
            </button>
          </div>
        </div>
      ) : models.length === 0 ? (
        <>
          <p className="text-[var(--color-text-muted)] p-8 text-center bg-[var(--color-surface)] rounded-lg">暂无可用模型,请检查后端是否运行</p>
          <button
            onClick={() => loadData(true)}
            className="mt-4 w-full py-2 rounded-lg border border-[var(--color-border)] text-[13px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
          >
            刷新
          </button>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {models.map((m) => {
            const dl = downloads[m.id]
            const isDl = dl?.status === 'downloading'
            const isDone = m.downloaded || dl?.status === 'completed'
            const isOp = m.local_path ? operating === m.local_path : operating === m.id
            return (
              <div key={m.id} className={`p-4 rounded-xl border flex flex-col gap-2 ${isDone ? 'border-emerald-300/60 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-[var(--color-border)]'}`}>
                <div className="font-semibold text-[15px]">{m.name}</div>
                <div className="text-[13px] text-[var(--color-text-muted)]">{m.description}</div>
                <div className="flex gap-1.5 flex-wrap text-[12px]">
                  <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)]">{m.params}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)]">{formatSize(m.size_bytes)}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--color-accent-soft)] text-[var(--color-accent)]">{m.requirements}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)]">{m.language}</span>
                </div>
                {isDl && dl && (
                  <div className="mt-1">
                    <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                      <div className="h-full bg-[var(--color-accent)] rounded-full transition-[width] duration-300" style={{ width: pct(dl.progress) }} />
                    </div>
                    <div className="text-[12px] text-[var(--color-text-muted)] mt-1 flex justify-between">
                      {dl.retrying ? <span className="text-amber-500">重试中 ({dl.retrying})</span> : <span />}
                      {pct(dl.progress)}
                    </div>
                  </div>
                )}
                {dl?.status === 'error' && (
                  <div className="text-[12px] text-red-500 flex items-start justify-between gap-2">
                    <span>下载失败: {dl.error}</span>
                    <button onClick={() => clearError(m.id)} className="shrink-0 underline hover:opacity-70">忽略</button>
                  </div>
                )}
                <div className="mt-auto">
                  {isDone ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleLoad(m.local_path || dl?.path || m.id)} disabled={isOp}
                        className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                        {isOp ? '加载中…' : '加载使用'}
                      </button>
                      <button onClick={async () => { await api.deleteLocalModel(m.id); loadData() }}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                        <Trash size={16} />
                      </button>
                    </div>
                  ) : isDl ? (
                    <div className="w-full py-2 text-center rounded-lg bg-[var(--color-surface-2)] text-[13px] text-[var(--color-text-muted)] border border-[var(--color-border)]">下载中…</div>
                  ) : (
                    <button onClick={() => startDownload(m.id)} disabled={isOp}
                      className="w-full py-2 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                      {isOp ? '准备中…' : '下载'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {localModels.filter((lm) => !models.some((m) => m.id === lm.id)).length > 0 && (
        <>
          <h3 className="text-[17px] font-semibold mt-6 mb-3">本地模型</h3>
          <div className="flex flex-col gap-2">
            {localModels.filter((lm) => !models.some((m) => m.id === lm.id)).map((lm) => (
              <div key={lm.path} className="flex items-center gap-3 px-4 py-2.5 border border-[var(--color-border)] rounded-lg">
                <span className="flex-1 text-[14px] font-medium">{lm.name}</span>
                <span className="text-[12px] text-[var(--color-text-muted)]">{formatSize(lm.size_bytes)}</span>
                <button onClick={() => handleLoad(lm.path)} disabled={operating === lm.path}
                  className="px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {operating === lm.path ? '加载中…' : '加载'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <details className="mt-7">
        <summary className="cursor-pointer text-[14px] text-[var(--color-text-muted)]">高级设置:自定义模型路径</summary>
        <CustomPathInput onLoad={handleLoad} operating={operating} />
      </details>
    </div>
  )
}

function CustomPathInput({ onLoad, operating }: { onLoad: (p: string) => void; operating: string | null }) {
  const [p, setP] = useState('')
  return (
    <div className="mt-3 flex gap-2">
      <input value={p} onChange={(e) => setP(e.target.value)} placeholder="/path/to/model.gguf"
        className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[14px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40" />
      <button onClick={() => onLoad(p.trim())} disabled={!p.trim() || operating === p.trim()}
        className="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-[14px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
        {operating === p.trim() ? '加载中…' : '加载模型'}
      </button>
    </div>
  )
}
