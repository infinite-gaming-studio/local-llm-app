import { useState, useEffect } from 'react'
import { api } from '../api'

export function Settings() {
  const [modelStatus, setModelStatus] = useState<{ loaded: boolean; path?: string; ctx_size?: number }>({ loaded: false })
  const [modelPath, setModelPath] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getModelStatus().then(setModelStatus).catch(() => {})
  }, [])

  const handleLoad = async () => {
    if (!modelPath.trim()) return
    setLoading(true)
    try {
      await api.loadModel(modelPath.trim())
      const status = await api.getModelStatus()
      setModelStatus(status)
    } catch (e) {
      console.error('load failed', e)
    }
    setLoading(false)
  }

  const handleUnload = async () => {
    setLoading(true)
    try {
      await api.unloadModel()
      setModelStatus({ loaded: false })
    } catch (e) {
      console.error('unload failed', e)
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2 style={{ marginTop: 0 }}>模型设置</h2>

      <div style={{
        padding: 16, background: '#f9f9f9', borderRadius: 8, marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: modelStatus.loaded ? '#34c759' : '#ff3b30',
        }} />
        <span>{modelStatus.loaded ? '模型已加载' : '模型未加载'}</span>
        {modelStatus.path && (
          <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
            {modelStatus.path}
          </span>
        )}
      </div>

      <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
        GGUF 模型路径
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={modelPath}
          onChange={(e) => setModelPath(e.target.value)}
          placeholder="/path/to/model.gguf"
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 8,
            border: '1px solid #ccc', fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={handleLoad}
          disabled={loading || !modelPath.trim()}
          style={{
            padding: '10px 20px', cursor: 'pointer',
            background: loading || !modelPath.trim() ? '#ccc' : '#007aff',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 500,
          }}
        >
          {loading ? '加载中...' : '加载模型'}
        </button>
      </div>

      {modelStatus.loaded && (
        <button
          onClick={handleUnload}
          disabled={loading}
          style={{
            padding: '10px 20px', cursor: 'pointer',
            background: '#ff3b30', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 500,
          }}
        >
          卸载模型
        </button>
      )}
    </div>
  )
}
