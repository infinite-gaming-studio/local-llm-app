import { useState, useEffect, useRef } from 'react'
import { api, AvailableModel, LocalModel, SidecarDiagnostics, ImportResult, ModelMetadata } from '../api'
import { Trash, Key, Copy, Upload, Check, FolderOpen, PencilSimple, Terminal } from '@phosphor-icons/react'
import { ModelMetadataModal } from '../components/ModelMetadataModal'
import { useConversations } from '../store/useConversations'
import { useLogs } from '../store/useLogs'

const MB = 1024 * 1024
const GB = 1024 * MB
function formatSize(b: number) { return b >= GB ? `${(b / GB).toFixed(1)} GB` : b >= MB ? `${Math.round(b / MB)} MB` : `${b} B` }

export function Settings() {
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; path?: string; ctx_size?: number; gpu_layers?: number }>({ loaded: false })
  const [models, setModels] = useState<AvailableModel[]>([])
  const [localModels, setLocalModels] = useState<LocalModel[]>([])
  const [loading, setLoading] = useState(true)
  const [operating, setOperating] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  // metadata modal: {modelId, isNew, initial} | null
  const [metaModal, setMetaModal] = useState<{ modelId: string; isNew: boolean; initial?: Partial<ModelMetadata> } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [diag, setDiag] = useState<SidecarDiagnostics | null>(null)
  const [hfToken, setHfToken] = useState(() => localStorage.getItem('llm-app:hf-token') || '')
  const [hfTokenSaved, setHfTokenSaved] = useState(false)
  const [defaultCtxSize, setDefaultCtxSize] = useState(() => {
    const v = localStorage.getItem('llm-app:default-ctx-size')
    return v ? parseInt(v, 10) : 32768
  })
  const [defaultGpuLayers, setDefaultGpuLayers] = useState(() => {
    const v = localStorage.getItem('llm-app:default-gpu-layers')
    return v ? parseInt(v, 10) : -1
  })

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

  const handleLoad = async (path: string, options?: { ctx_size?: number; gpu_layers?: number }) => {
    setOperating(path)
    try {
      const merged = {
        ctx_size: options?.ctx_size ?? defaultCtxSize,
        gpu_layers: options?.gpu_layers ?? defaultGpuLayers,
      }
      const result = await api.loadModel(path, merged)
      if (result.status === 'error') {
        setError(result.error || '模型加载失败')
      } else {
        setError(null)
        setModelStatus(await api.getModelStatus())
        // 同步当前模型模态到对话 store
        await useConversations.getState().refreshModelStatus()
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '模型加载失败')
    }
    setOperating(null)
  }
  const handleUnload = async () => {
    setOperating('unload')
    try {
      await api.unloadModel()
      setModelStatus({ loaded: false })
      await useConversations.getState().refreshModelStatus()
    } catch (e) { console.error(e) }
    setOperating(null)
  }

  const handleCopyLink = async (model: AvailableModel) => {
    try {
      await navigator.clipboard.writeText(model.url)
      setCopiedId(model.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const copyMmprojLink = async (model: AvailableModel) => {
    if (!model.mmproj_url) return
    try {
      await navigator.clipboard.writeText(model.mmproj_url)
      setCopiedId(`mmproj:${model.id}`)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleImportMmproj = async (modelId: string) => {
    setImporting(`mmproj:${modelId}`)
    setImportMsg(null)
    try {
      const result: ImportResult = await api.importMmproj(modelId)
      if (result.status === 'canceled') {
        // 用户取消
      } else if (result.status === 'imported') {
        setImportMsg({
          id: `mmproj:${modelId}`,
          text: `mmproj 导入成功 (${result.action === 'moved' ? '移动' : '复制'}${result.size_bytes ? `, ${formatSize(result.size_bytes)}` : ''})`,
          ok: true,
        })
        await loadData(false)
      } else {
        setImportMsg({ id: `mmproj:${modelId}`, text: result.error || 'mmproj 导入失败', ok: false })
      }
    } catch (e) {
      setImportMsg({ id: `mmproj:${modelId}`, text: String(e), ok: false })
    }
    setImporting(null)
    if (importMsg) setTimeout(() => setImportMsg(null), 4000)
  }

  const handleImport = async (modelId: string | null) => {
    setImporting(modelId || '__custom__')
    setImportMsg(null)
    try {
      const result: ImportResult = await api.importModel(modelId)
      if (result.status === 'canceled') {
        // 用户取消，不显示消息
      } else if (result.status === 'imported' && result.model_id) {
        setImportMsg({
          id: modelId || '__custom__',
          text: `导入成功 (${result.action === 'moved' ? '移动' : '复制'}, ${formatSize(result.size_bytes || 0)})`,
          ok: true,
        })
        await loadData(false)
        // 导入成功后弹出 metadata 编辑表单
        setMetaModal({
          modelId: result.model_id,
          isNew: true,
          initial: result.metadata,
        })
      } else {
        setImportMsg({ id: modelId || '__custom__', text: result.error || '导入失败', ok: false })
      }
    } catch (e) {
      setImportMsg({ id: modelId || '__custom__', text: String(e), ok: false })
    }
    setImporting(null)
    if (importMsg) setTimeout(() => setImportMsg(null), 4000)
  }

  const handleEditMetadata = (model: LocalModel) => {
    setMetaModal({
      modelId: model.id,
      isNew: false,
      initial: {
        display_name: model.name,
        description: model.description,
        params: model.params,
        language: model.language,
        requirements: model.requirements,
        ctx_size: model.ctx_size,
        gpu_layers: model.gpu_layers,
      },
    })
  }

  const handleMetadataSaved = async () => {
    await loadData(false)
  }

  return (
    <div className="h-full overflow-auto px-8 py-8 max-w-3xl mx-auto">
      <h2 className="text-[22px] font-semibold mt-0 mb-5">设置</h2>
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] rounded-xl mb-7">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${modelStatus.loaded ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[14px] font-medium">{modelStatus.loaded ? '模型已加载' : '模型未加载'}</span>
        {modelStatus.path && <span className="text-[12px] text-[var(--color-text-muted)] flex-1 truncate">{modelStatus.path}</span>}
        {modelStatus.loaded && (
          <>
            <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
              上下文 {modelStatus.ctx_size ? (modelStatus.ctx_size >= 1024 ? `${modelStatus.ctx_size / 1024}K` : modelStatus.ctx_size) : '?'}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
              GPU {modelStatus.gpu_layers === -1 ? '全部' : modelStatus.gpu_layers === 0 ? '关闭' : modelStatus.gpu_layers}
            </span>
            <button onClick={handleUnload} disabled={operating === 'unload'}
              className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
              {operating === 'unload' ? '卸载中…' : '卸载模型'}
            </button>
          </>
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

      <details className="mb-5">
        <summary className="cursor-pointer text-[14px] text-[var(--color-text-muted)] flex items-center gap-2">
          <Terminal size={14} /> 默认加载参数
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] text-[var(--color-text-muted)] mb-1">上下文长度 (ctx_size)</label>
            <input type="number" value={defaultCtxSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 32768
                setDefaultCtxSize(v)
                localStorage.setItem('llm-app:default-ctx-size', String(v))
              }}
              min={512} step={512}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[14px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40" />
          </div>
          <div>
            <label className="block text-[12px] text-[var(--color-text-muted)] mb-1">GPU 层数 (gpu_layers)</label>
            <input type="number" value={defaultGpuLayers}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || -1
                setDefaultGpuLayers(v)
                localStorage.setItem('llm-app:default-gpu-layers', String(v))
              }}
              min={-1}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[14px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40" />
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">推荐模型和自定义路径加载时使用此默认值。本地模型优先使用其 metadata 中的值。</p>
      </details>

      <h3 className="text-[17px] font-semibold mb-1">推荐模型</h3>
      <p className="text-[13px] text-[var(--color-text-muted)] mb-3">选择适合你设备的模型,复制链接下载后导入即可使用</p>

      {/* 操作引导 */}
      <div className="mb-4 px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-muted)] leading-relaxed">
        <span className="font-medium text-[var(--color-text)]">使用步骤:</span>
        <br />
        1. 点击「复制链接」获取模型下载地址,用浏览器或下载工具下载 .gguf 文件
        <br />
        2. 下载完成后点击「导入模型」选择对应的 .gguf 文件
        <br />
        3. 导入成功后点击「加载使用」即可开始对话
        <br />
        <span className="text-amber-500">多模态模型(带「多模态」标签)需额外下载并导入 mmproj 视觉投影文件,否则图片分析不可用</span>
      </div>

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
            const isDone = m.downloaded
            const isOp = m.local_path ? operating === m.local_path : operating === m.id
            const isImporting = importing === m.id
            const isImportingMmproj = importing === `mmproj:${m.id}`
            const msg = importMsg && (importMsg.id === m.id || importMsg.id === `mmproj:${m.id}`) ? importMsg : null
            const isVl = !!m.mmproj_url
            return (
              <div key={m.id} className={`p-4 rounded-xl border flex flex-col gap-2 ${isDone ? 'border-emerald-300/60 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-[var(--color-border)]'}`}>
                <div className="font-semibold text-[15px]">{m.name}</div>
                <div className="text-[13px] text-[var(--color-text-muted)]">{m.description}</div>
                <div className="flex gap-1.5 flex-wrap text-[12px]">
                  <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)]">{m.params}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)]">{formatSize(m.size_bytes)}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--color-accent-soft)] text-[var(--color-accent)]">{m.requirements}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)]">{m.language}</span>
                  {isVl && <span className="px-2 py-0.5 rounded bg-[var(--color-accent-soft)] text-[var(--color-accent)]">多模态</span>}
                </div>
                {isVl && (
                  <div className="text-[12px] flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                    {m.mmproj_downloaded ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-medium">
                        <Check size={13} /> mmproj 视觉投影已导入
                      </span>
                    ) : (
                      <>
                        <span className="text-amber-500 flex items-center gap-1">
                          ⚠ 多模态需额外导入 mmproj 视觉投影
                        </span>
                        <div className="ml-auto flex gap-1.5">
                          <button onClick={() => copyMmprojLink(m)}
                            className="px-2 py-1 rounded border border-[var(--color-border)] text-[11px] hover:bg-[var(--color-surface-2)] transition-colors flex items-center gap-1">
                            {copiedId === `mmproj:${m.id}` ? <><Check size={11} /> 已复制</> : <><Copy size={11} /> mmproj 链接</>}
                          </button>
                          <button onClick={() => handleImportMmproj(m.id)} disabled={isImportingMmproj}
                            className="px-2 py-1 rounded bg-[var(--color-accent)] text-white text-[11px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1">
                            {isImportingMmproj ? '导入中…' : <><Upload size={11} /> 导入 mmproj</>}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {msg && (
                  <div className={`text-[12px] ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                    {msg.text}
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  {isDone ? (
                    <>
                      <button onClick={() => handleLoad(m.local_path!)} disabled={isOp}
                        className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                        {isOp ? '加载中…' : '加载使用'}
                      </button>
                      <button onClick={async () => { await api.deleteLocalModel(m.id); loadData() }}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                        <Trash size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleCopyLink(m)}
                        className="flex-1 py-2 rounded-lg border border-[var(--color-border)] text-[13px] font-medium hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center gap-1.5">
                        {copiedId === m.id ? <><Check size={15} /> 已复制</> : <><Copy size={15} /> 复制链接</>}
                      </button>
                      <button onClick={() => handleImport(m.id)} disabled={isImporting}
                        className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                        {isImporting ? '选择文件…' : <><Upload size={15} /> 导入模型</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 导入自定义模型 */}
      <div className="mt-5 p-4 rounded-xl border border-dashed border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen size={16} className="text-[var(--color-text-muted)]" />
          <span className="text-[14px] font-medium">导入自定义模型</span>
        </div>
        <p className="text-[12px] text-[var(--color-text-muted)] mb-3">选择已下载的 .gguf 文件导入到模型目录,导入后可在下方「本地模型」中加载</p>
        <button
          onClick={() => handleImport(null)}
          disabled={importing === '__custom__'}
          className="w-full py-2 rounded-lg border border-[var(--color-border)] text-[13px] font-medium hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
          {importing === '__custom__' ? '选择文件…' : <><Upload size={15} /> 选择 .gguf 文件导入</>}
        </button>
        {importMsg && importMsg.id === '__custom__' && (
          <div className={`text-[12px] mt-2 ${importMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
            {importMsg.text}
          </div>
        )}
      </div>

      {localModels.filter((lm) => !models.some((m) => m.id === lm.id)).length > 0 && (
        <>
          <h3 className="text-[17px] font-semibold mt-6 mb-3">本地模型</h3>
          <div className="flex flex-col gap-2">
            {localModels.filter((lm) => !models.some((m) => m.id === lm.id)).map((lm) => (
              <div key={lm.path} className="px-4 py-3 border border-[var(--color-border)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">{lm.name}</div>
                    {lm.description && (
                      <div className="text-[12px] text-[var(--color-text-muted)] truncate mt-0.5">{lm.description}</div>
                    )}
                  </div>
                  <span className="text-[12px] text-[var(--color-text-muted)] shrink-0">{formatSize(lm.size_bytes)}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap text-[11px] mt-2">
                  {lm.params && <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">{lm.params}</span>}
                  {lm.ctx_size && <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">ctx {lm.ctx_size >= 1024 ? `${lm.ctx_size / 1024}K` : lm.ctx_size}</span>}
                  <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">GPU {lm.gpu_layers === -1 ? '全部' : lm.gpu_layers === 0 ? '关闭' : lm.gpu_layers}</span>
                  {lm.modalities && lm.modalities.includes('image') && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--color-accent-soft)] text-[var(--color-accent)]">多模态</span>
                  )}
                  {lm.modalities?.includes('image') && lm.has_mmproj && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Check size={10} /> mmproj
                    </span>
                  )}
                  {lm.language && <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">{lm.language}</span>}
                </div>
                {lm.modalities?.includes('image') && !lm.has_mmproj && (
                  <div className="text-[12px] flex items-center gap-2 px-2.5 py-1.5 mt-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                    <span className="text-amber-600 dark:text-amber-400">⚠ 未导入 mmproj 视觉投影，图片分析不可用</span>
                    <button
                      onClick={() => handleImportMmproj(lm.id)}
                      disabled={importing === `mmproj:${lm.id}`}
                      className="ml-auto px-2 py-1 rounded bg-[var(--color-accent)] text-white text-[11px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1">
                      {importing === `mmproj:${lm.id}` ? '导入中…' : <><Upload size={11} /> 导入 mmproj</>}
                    </button>
                  </div>
                )}
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => handleLoad(lm.path, { ctx_size: lm.ctx_size, gpu_layers: lm.gpu_layers })}
                    disabled={operating === lm.path}
                    className="flex-1 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[12px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                    {operating === lm.path ? '加载中…' : '加载使用'}
                  </button>
                  <button
                    onClick={() => handleEditMetadata(lm)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors flex items-center gap-1 text-[12px]">
                    <PencilSimple size={13} /> 编辑
                  </button>
                  <button
                    onClick={async () => { await api.deleteLocalModel(lm.id); loadData() }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {metaModal && (
        <ModelMetadataModal
          modelId={metaModal.modelId}
          isNew={metaModal.isNew}
          initial={metaModal.initial}
          onClose={() => setMetaModal(null)}
          onSaved={handleMetadataSaved}
        />
      )}

      <details className="mt-7">
        <summary className="cursor-pointer text-[14px] text-[var(--color-text-muted)]">高级设置:自定义模型路径</summary>
        <CustomPathInput onLoad={handleLoad} operating={operating} />
      </details>

      <details className="mt-4 mb-4">
        <summary className="cursor-pointer text-[14px] text-[var(--color-text-muted)] flex items-center gap-1.5">
          <Terminal size={14} /> 后端日志
        </summary>
        <BackendLogPanel />
      </details>
    </div>
  )
}

const ERROR_RE = /error|traceback/i

function BackendLogPanel() {
  const entries = useLogs((s) => s.entries)
  const clear = useLogs((s) => s.clear)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(true)

  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, follow])

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between px-3 h-8 text-[12px] border-b border-[var(--color-border)]">
        <span className="text-[var(--color-text-muted)]">{entries.length} 条</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="w-3 h-3" />
            跟随
          </label>
          <button onClick={clear} className="p-1 rounded hover:bg-[var(--color-surface-2)]" aria-label="清空">
            <Trash size={13} />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
          setFollow(atBottom)
        }}
        className="overflow-auto px-3 py-2 font-mono text-[12px] leading-relaxed h-[280px]"
      >
        {entries.length === 0 ? (
          <div className="text-[var(--color-text-muted)] py-4">暂无日志，sidecar 启动后此处显示模型调用输出</div>
        ) : (
          entries.map((e, i) => {
            const t = new Date(e.ts)
            const ts = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
            const err = e.stream === 'stderr' || ERROR_RE.test(e.line)
            return (
              <div key={i} className={err ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
                <span className="opacity-60">{ts}</span> {e.line}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function CustomPathInput({ onLoad, operating }: { onLoad: (p: string, options?: { ctx_size?: number; gpu_layers?: number }) => void; operating: string | null }) {
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
