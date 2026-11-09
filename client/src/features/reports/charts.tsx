import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCurrency, formatNumber } from '../../utils/format'

export interface BarDatum {
  label: string
  value: number
}

const shortMoney = (v: number): string => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} tr`
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`
  return String(v)
}

/** Biểu đồ cột SVG thuần (một chuỗi số), màu theo token `accent`. Có chú thích ẩn cho trình đọc màn hình. */
export function BarChart({ data, title, money = true }: { data: BarDatum[]; title: string; money?: boolean }) {
  const width = 640
  const height = 200
  const padLeft = 44
  const padBottom = 28
  const max = Math.max(1, ...data.map((d) => d.value))
  const plotW = width - padLeft - 8
  const plotH = height - padBottom - 12
  const slot = data.length > 0 ? plotW / data.length : plotW
  const barW = Math.min(36, slot * 0.6)
  const labelEvery = Math.max(1, Math.ceil(data.length / 12))
  const fmt = money ? shortMoney : (v: number) => String(v)
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="h-auto w-full">
        {[0, 0.5, 1].map((t) => {
          const y = 12 + plotH - plotH * t
          return (
            <g key={t}>
              <line x1={padLeft} x2={width - 8} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--color-muted)">
                {fmt(Math.round(max * t))}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * plotH
          const x = padLeft + slot * i + (slot - barW) / 2
          return (
            <g key={`${d.label}-${i}`}>
              <rect x={x} y={12 + plotH - h} width={barW} height={Math.max(h, d.value > 0 ? 1 : 0)} rx="3" fill="var(--color-accent-bright)">
                <title>{`${d.label}: ${money ? formatCurrency(d.value) : formatNumber(d.value)}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="sr-only">
        {title}: {data.map((d) => `${d.label} ${d.value}`).join('; ')}
      </figcaption>
    </figure>
  )
}

/** Danh sách thanh ngang bằng CSS: nhãn, thanh tỷ lệ, giá trị. */
export function HBarList({ items, money = true, emptyText = 'Chưa có dữ liệu' }: { items: BarDatum[]; money?: boolean; emptyText?: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{item.label}</span>
            <span className="shrink-0 font-semibold text-ink">{money ? formatCurrency(item.value) : formatNumber(item.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-accent-soft">
            <div className="h-full rounded-full bg-accent-bright" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Chênh lệch so với kỳ trước: mũi tên + phần trăm. */
export function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-muted">Không đổi</span>
  const pct = previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
  const Icon = current === previous ? Minus : current > previous ? ArrowUpRight : ArrowDownRight
  const tone = current === previous ? 'text-muted' : current > previous ? 'text-success' : 'text-danger'
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {pct === null ? 'Mới' : `${pct > 0 ? '+' : ''}${pct}%`}
    </span>
  )
}

/** Khung thẻ có tiêu đề cho từng khối báo cáo. */
export function Panel({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}
