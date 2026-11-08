import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './cn'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'

const TONES: Record<StatusTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-neutral-soft text-neutral',
  accent: 'bg-accent-soft text-accent',
}

/** Nhãn trạng thái có chấm màu (theo thiết kế LUMINA). */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', TONES[tone])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}

export interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
}

/** Thẻ số liệu ở đầu trang danh sách. */
export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
        </div>
        {Icon && (
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-bright">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export interface Crumb {
  label: string
  to?: string
}

export interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: Crumb[]
  actions?: ReactNode
}

/** Tiêu đề trang: breadcrumb, tiêu đề, mô tả, nút thao tác bên phải. */
export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted">
          {breadcrumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
              {c.to ? (
                <Link to={c.to} className="hover:text-accent">
                  {c.label}
                </Link>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? 'text-accent' : undefined}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
