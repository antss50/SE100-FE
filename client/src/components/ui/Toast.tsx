import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from './cn'
import { useToastStore, type ToastTone } from './toast-store'

// Tùy chỉnh phong cách với nền đậm nổi bật hơn cho từng tone
const STYLE: Record<ToastTone, string> = {
  success: 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/20',
  error: 'border-rose-600 bg-rose-600 text-white shadow-rose-600/20', // Nền đỏ đậm, chữ trắng cực kỳ nổi bật
  info: 'border-sky-600 bg-sky-600 text-white shadow-sky-600/20',
}

const ICON = { 
  success: CheckCircle2, 
  error: XCircle, 
  info: Info 
}

/** Vùng hiển thị thông báo kết quả thao tác; gắn một lần ở gốc ứng dụng. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md transition-all', 
              STYLE[t.tone]
            )}
          >
            {/* Icon màu trắng đồng bộ với chữ trên nền đậm */}
            <Icon className="mt-0.5 size-4 shrink-0 text-white" aria-hidden="true" />

            {/* Nội dung thông báo màu trắng, dễ đọc */}
            <p className="flex-1 font-medium leading-relaxed text-white">{t.message}</p>

            <button 
              type="button" 
              aria-label="Đóng thông báo" 
              onClick={() => dismiss(t.id)} 
              className="text-white/80 hover:text-white transition-opacity p-0.5 rounded-md hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}