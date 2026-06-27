interface ConfirmDialogProps { title: string; confirmText?: string; onConfirm: () => void; onCancel: () => void }
export function ConfirmDialog({ title, confirmText = '确认', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center z-50" onClick={onCancel}>
      <div className="bg-[--color-canvas] rounded-xl p-5 min-w-[280px] shadow-lg" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] mb-4">{title}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[13px] hover:bg-[--color-surface-2]">取消</button>
          <button onClick={onConfirm} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[13px] hover:opacity-90">{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
