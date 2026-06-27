import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { api, ModelMetadata, Modality } from '../api'

interface ModelMetadataModalProps {
  modelId: string
  initial?: Partial<ModelMetadata>
  /** 是否为新建（刚导入）；影响标题与提示文案 */
  isNew?: boolean
  /** 关闭弹窗 */
  onClose: () => void
  /** 保存成功后回调，参数为新的 metadata */
  onSaved: (metadata: ModelMetadata) => void
}

const PRESET_CTX_SIZES = [4096, 8192, 16384, 32768, 65536, 131072]

export function ModelMetadataModal({ modelId, initial, isNew = false, onClose, onSaved }: ModelMetadataModalProps) {
  const [displayName, setDisplayName] = useState(initial?.display_name || modelId)
  const [description, setDescription] = useState(initial?.description || '')
  const [params, setParams] = useState(initial?.params || '')
  const [language, setLanguage] = useState(initial?.language || '中文 / English')
  const [requirements, setRequirements] = useState(initial?.requirements || '8GB+ RAM')
  const [ctxSize, setCtxSize] = useState<number>(initial?.ctx_size ?? 32768)
  const [gpuLayers, setGpuLayers] = useState<number>(initial?.gpu_layers ?? -1)
  const [modalities, setModalities] = useState<Modality[]>(initial?.modalities ?? ['text'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 若未传 initial，尝试拉取已存的 metadata
    if (!initial) {
      api.getModelMetadata(modelId)
        .then((r) => {
          const m = r.metadata || {}
          if (m.display_name) setDisplayName(m.display_name)
          if (m.description) setDescription(m.description)
          if (m.params) setParams(m.params)
          if (m.language) setLanguage(m.language)
          if (m.requirements) setRequirements(m.requirements)
          if (typeof m.ctx_size === 'number') setCtxSize(m.ctx_size)
          if (typeof m.gpu_layers === 'number') setGpuLayers(m.gpu_layers)
          if (Array.isArray(m.modalities) && m.modalities.length) setModalities(m.modalities)
        })
        .catch(() => {})
    }
  }, [modelId, initial])

  const toggleModality = (m: Modality) => {
    setModalities((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // text 始终包含
      const finalModalities: Modality[] = modalities.includes('text') ? modalities : (['text', ...modalities] as Modality[])
      const fields: Partial<ModelMetadata> = {
        display_name: displayName.trim() || modelId,
        description: description.trim(),
        params: params.trim(),
        language: language.trim(),
        requirements: requirements.trim(),
        ctx_size: ctxSize,
        gpu_layers: gpuLayers,
        modalities: finalModalities,
      }
      const r = await api.updateModelMetadata(modelId, fields)
      onSaved(r.metadata)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 grid place-items-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[var(--color-canvas)] rounded-xl shadow-lg w-[440px] max-w-[92vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-[15px] font-semibold">
            {isNew ? '设置模型信息' : '编辑模型信息'}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {isNew && (
            <p className="text-[12px] text-[var(--color-text-muted)] bg-[var(--color-surface)] rounded px-3 py-2">
              模型已导入，请补充以下参数以确保加载正确（影响显存占用与生成质量）
            </p>
          )}

          <Field label="显示名称">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={modelId}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </Field>

          <Field label="描述">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：自定义导入的 Qwen 模型"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="参数量">
              <input
                value={params}
                onChange={(e) => setParams(e.target.value)}
                placeholder="例如：7B"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              />
            </Field>
            <Field label="语言">
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              />
            </Field>
          </div>

          <Field label="硬件需求">
            <input
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="例如：8GB+ RAM"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </Field>

          <Field label="支持的模态" hint="决定对话界面显示哪些上传按钮（文本始终包含）">
            <div className="flex gap-2">
              {(['text', 'image'] as Modality[]).map((m) => {
                const active = modalities.includes(m)
                const labels: Record<Modality, string> = { text: '文本', image: '图片' }
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleModality(m)}
                    className={`px-3 py-1.5 rounded-lg text-[13px] border transition-colors ${
                      active
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    {labels[m]}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="上下文长度（ctx_size）" hint="影响显存占用与最大对话长度，越大越占显存">
            <div className="flex gap-2">
              <input
                type="number"
                value={ctxSize}
                onChange={(e) => setCtxSize(parseInt(e.target.value) || 0)}
                min={512}
                step={512}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              />
              <select
                value={PRESET_CTX_SIZES.includes(ctxSize) ? ctxSize : ''}
                onChange={(e) => e.target.value && setCtxSize(parseInt(e.target.value))}
                className="px-2 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[12px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              >
                <option value="">常用</option>
                {PRESET_CTX_SIZES.map((v) => (
                  <option key={v} value={v}>{v >= 1024 ? `${v / 1024}K` : v}</option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="GPU 层数（gpu_layers）" hint="-1 = 全部放 GPU；0 = 全部 CPU；N = 前 N 层放 GPU">
            <input
              type="number"
              value={gpuLayers}
              onChange={(e) => setGpuLayers(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </Field>

          {error && (
            <p className="text-[12px] text-red-500">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--color-text-muted)] mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{hint}</p>}
    </div>
  )
}
