import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from './cn'
import { useToastStore, type ToastTone } from './toast-store'

const STYLE: Record<ToastTone, string> = {
  success: 'border-success/30 bg-success-soft text-success',
  error: 'border-danger/30 bg-danger-soft text-danger',
  info: 'border-info/30 bg-info-soft text-info',
}
const ICON = { success: CheckCircle2, error: XCircle, info: Info }

/** Vùng hiển thị thông báo kết quả thao tác; gắn một lần ở gốc ứng dụng. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn('pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg', STYLE[t.tone])}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-ink">{t.message}</p>
            <button type="button" aria-label="Đóng thông báo" onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
