import { useState, useEffect, useRef } from 'react'
import { api, AvailableModel, LocalModel, DownloadState } from '../api'

const MB = 1024 * 1024
const GB = 1024 * MB

function formatSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`
  return `${bytes} B`
}

function formatProgress(pct: number): string {
  return `${Math.round(pct * 100)}%`
}

export function Settings() {
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; path?: string }>({ loaded: false })
  const [models, setModels] = useState<AvailableModel[]>([])
  const [localModels, setLocalModels] = useState<LocalModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({})
  const [loading, setLoading] = useState(true)
  const [operating, setOperating] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = async () => {
    try {
      const [status, avail, local] = await Promise.all([
        api.getModelStatus(),
        api.getAvailableModels(),
        api.getLocalModels(),
      ])
      setModelStatus(status)
      setModels(avail.models)
      setLocalModels(local.models)
    } catch (e) {
      console.error('loadData failed', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const timer = setTimeout(() => setLoading(false), 15000)
    return () => {
      clearTimeout(timer)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const activeDownloads = Object.entries(downloads).filter(
    ([, s]) => s.status === 'downloading'
  )

  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (activeDownloads.length === 0) return
    pollRef.current = setInterval(async () => {
      for (const [id] of activeDownloads) {
        try {
          const state = await api.getDownloadProgress(id)
          setDownloads((prev) => ({ ...prev, [id]: state }))
          if (state.status === 'completed' || state.status === 'error') {
            loadData()
          }
        } catch (e) {
          console.error('poll progress failed', e)
        }
      }
    }, 1500)
  }, [activeDownloads.length])

  const handleDownload = async (modelId: string) => {
    setDownloads((prev) => ({ ...prev, [modelId]: { status: 'downloading', progress: 0 } }))
    try {
      const result = await api.downloadModel(modelId)
      if (result.status === 'error') {
        setDownloads((prev) => ({ ...prev, [modelId]: result }))
      }
    } catch (e) {
      console.error('download failed', e)
      setDownloads((prev) => ({ ...prev, [modelId]: { status: 'error', progress: 0, error: String(e) } }))
    }
  }

  const handleLoadModel = async (path: string) => {
    setOperating(path)
    try {
      await api.loadModel(path)
      const status = await api.getModelStatus()
      setModelStatus(status)
    } catch (e) {
      console.error('load failed', e)
    }
    setOperating(null)
  }

  const handleUnload = async () => {
    setOperating('unload')
    try {
      await api.unloadModel()
      setModelStatus({ loaded: false })
    } catch (e) {
      console.error('unload failed', e)
    }
    setOperating(null)
  }

  return (
    <div style={{ padding: 32, maxWidth: 900, overflow: 'auto', height: '100%' }}>
      <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 22, fontWeight: 600 }}>设置</h2>

      {/* Model status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', background: '#f5f5f5', borderRadius: 10,
        marginBottom: 28,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: modelStatus.loaded ? '#34c759' : '#ff3b30',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {modelStatus.loaded ? '模型已加载' : '模型未加载'}
        </span>
        {modelStatus.path && (
          <span style={{ fontSize: 12, color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {modelStatus.path}
          </span>
        )}
        {modelStatus.loaded && (
          <button
            onClick={handleUnload}
            disabled={operating === 'unload'}
            style={{
              marginLeft: 'auto', padding: '6px 16px', cursor: 'pointer',
              background: operating === 'unload' ? '#ccc' : '#ff3b30',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 500, flexShrink: 0,
            }}
          >
            {operating === 'unload' ? '卸载中...' : '卸载模型'}
          </button>
        )}
      </div>

      {/* Model marketplace */}
      <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>推荐模型</h3>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
        选择适合你设备的模型，点击下载后即可使用
      </p>

      {loading ? (
        <p style={{ color: '#999' }}>加载中...</p>
      ) : models.length === 0 ? (
        <p style={{ color: '#999', padding: 32, textAlign: 'center', background: '#f9f9f9', borderRadius: 8 }}>
          暂无可用模型，请检查后端是否运行
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {models.map((m) => {
            const dlState = downloads[m.id]
            const isDownloading = dlState?.status === 'downloading'
            const isDownloaded = m.downloaded || dlState?.status === 'completed'
            const isOperating = m.local_path ? operating === m.local_path : operating === m.id

            return (
              <div
                key={m.id}
                style={{
                  padding: 16, borderRadius: 10,
                  border: `1px solid ${isDownloaded ? '#c9e6c9' : '#e0e0e0'}`,
                  background: isDownloaded ? '#f8fff8' : '#fff',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                      {m.description}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  <span style={{ background: '#f0f0f0', padding: '2px 8px', borderRadius: 4 }}>
                    {m.params}
                  </span>
                  <span style={{ background: '#f0f0f0', padding: '2px 8px', borderRadius: 4 }}>
                    {formatSize(m.size_bytes)}
                  </span>
                  <span style={{ background: '#e8f0fe', padding: '2px 8px', borderRadius: 4 }}>
                    {m.requirements}
                  </span>
                  <span style={{ background: '#fff3e0', padding: '2px 8px', borderRadius: 4 }}>
                    {m.language}
                  </span>
                </div>

                {/* Download progress bar */}
                {isDownloading && dlState && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{
                      height: 6, background: '#e0e0e0', borderRadius: 3,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: formatProgress(dlState.progress),
                        background: '#007aff', borderRadius: 3,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      {dlState.retrying ? (
                        <span style={{ color: '#ff9500' }}>重试中 ({dlState.retrying})</span>
                      ) : <span />}
                      {formatProgress(dlState.progress)}
                    </div>
                  </div>
                )}

                {/* Error state */}
                {dlState?.status === 'error' && (
                  <div style={{ fontSize: 12, color: '#ff3b30' }}>
                    下载失败: {dlState.error}
                  </div>
                )}

                {/* Action button */}
                <div style={{ marginTop: 'auto' }}>
                  {isDownloaded ? (
                    <button
                      onClick={() => handleLoadModel(m.local_path || dlState?.path || m.id)}
                      disabled={isOperating}
                      style={{
                        width: '100%', padding: '8px 0', cursor: isOperating ? 'default' : 'pointer',
                        background: isOperating ? '#ccc' : '#34c759',
                        color: '#fff', border: 'none', borderRadius: 6,
                        fontSize: 13, fontWeight: 500,
                      }}
                    >
                      {isOperating ? '加载中...' : '加载使用'}
                    </button>
                  ) : isDownloading ? (
                    <div style={{
                      width: '100%', padding: '8px 0', textAlign: 'center',
                      background: '#f0f0f0', borderRadius: 6,
                      fontSize: 13, color: '#666',
                    }}>
                      下载中...
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDownload(m.id)}
                      disabled={isOperating}
                      style={{
                        width: '100%', padding: '8px 0', cursor: isOperating ? 'default' : 'pointer',
                        background: isOperating ? '#ccc' : '#007aff',
                        color: '#fff', border: 'none', borderRadius: 6,
                        fontSize: 13, fontWeight: 500,
                      }}
                    >
                      {isOperating ? '准备中...' : '下载'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Local models (not in catalog) */}
      {localModels.filter((lm) => !models.some((m) => m.id === lm.id)).length > 0 && (
        <>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: '24px 0 12px' }}>本地模型</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {localModels
              .filter((lm) => !models.some((m) => m.id === lm.id))
              .map((lm) => (
                <div
                  key={lm.path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', border: '1px solid #e0e0e0', borderRadius: 8,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{lm.name}</span>
                  <span style={{ fontSize: 12, color: '#999' }}>{formatSize(lm.size_bytes)}</span>
                  <button
                    onClick={() => handleLoadModel(lm.path)}
                    disabled={operating === lm.path}
                    style={{
                      padding: '6px 16px', cursor: operating === lm.path ? 'default' : 'pointer',
                      background: operating === lm.path ? '#ccc' : '#007aff',
                      color: '#fff', border: 'none', borderRadius: 6,
                      fontSize: 13, fontWeight: 500,
                    }}
                  >
                    {operating === lm.path ? '加载中...' : '加载'}
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      {/* Advanced: custom path */}
      <details style={{ marginTop: 28 }}>
        <summary style={{ cursor: 'pointer', fontSize: 14, color: '#888', userSelect: 'none' }}>
          高级设置：自定义模型路径
        </summary>
        <CustomPathInput onLoad={handleLoadModel} operating={operating} />
      </details>
    </div>
  )
}

function CustomPathInput({ onLoad, operating }: { onLoad: (path: string) => void; operating: string | null }) {
  const [modelPath, setModelPath] = useState('')

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
      <input
        value={modelPath}
        onChange={(e) => setModelPath(e.target.value)}
        placeholder="/path/to/model.gguf"
        style={{
          flex: 1, padding: '10px 12px', borderRadius: 8,
          border: '1px solid #ccc', fontSize: 14, outline: 'none',
        }}
      />
      <button
        onClick={() => onLoad(modelPath.trim())}
        disabled={!modelPath.trim() || operating === modelPath.trim()}
        style={{
          padding: '10px 20px', cursor: !modelPath.trim() || operating === modelPath.trim() ? 'default' : 'pointer',
          background: !modelPath.trim() || operating === modelPath.trim() ? '#ccc' : '#007aff',
          color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 14, fontWeight: 500,
        }}
      >
        {operating === modelPath.trim() ? '加载中...' : '加载模型'}
      </button>
    </div>
  )
}
