import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from './cn'
import { pageWindow } from './page-window'

export interface PaginationProps {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  /** Đơn vị hiển thị, ví dụ "phiếu", "sản phẩm". */
  unit?: string
}

export function Pagination({ page, pageSize, totalItems, onPageChange, unit = 'dòng' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)
  const btn =
    'grid size-8 place-items-center rounded-lg border border-line text-xs font-semibold transition disabled:opacity-40'

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
      <span className="text-muted">
        Hiển thị {from}–{to} trong {totalItems} {unit}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Trang trước"
          className={cn(btn, 'bg-white hover:bg-card')}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              className={cn(btn, p === page ? 'border-accent-bright bg-accent-bright text-white' : 'bg-white hover:bg-card')}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          aria-label="Trang sau"
          className={cn(btn, 'bg-white hover:bg-card')}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  )
}
