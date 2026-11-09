import { Gift, Minus, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePosStore } from '../pos-store'
import type { OrderQuote, QuoteLine } from '../../../types/pos'
import { formatCurrency } from '../../../utils/format'
import { formatDate } from '../../../utils/format'
import { LotPickerModal } from './LotPickerModal'

interface CartPanelProps {
  quote: OrderQuote | undefined
  disabled: boolean
}

/** Giỏ hàng: số lượng, lô được chọn (FEFO hoặc đổi tay), khuyến mãi áp trên từng dòng, quà tặng. */
export function CartPanel({ quote, disabled }: CartPanelProps) {
  const items = usePosStore((s) => s.items)
  const names = usePosStore((s) => s.names)
  const setQuantity = usePosStore((s) => s.setQuantity)
  const removeProduct = usePosStore((s) => s.removeProduct)
  const reset = usePosStore((s) => s.reset)
  const [pickLot, setPickLot] = useState<{ productId: number; name: string } | null>(null)

  const byProduct = useMemo(() => {
    const map = new Map<number, QuoteLine[]>()
    for (const l of quote?.lines ?? []) map.set(l.productId, [...(map.get(l.productId) ?? []), l])
    return map
  }, [quote])
  const gifts = (quote?.lines ?? []).filter((l) => l.lineType === 'GIFT')
  const count = items.reduce((n, i) => n + i.quantity, 0)

  return (
    <section className="rounded-2xl border border-line bg-white" aria-label="Giỏ hàng">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-base font-bold text-ink">
          Giỏ hàng <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{count} món</span>
        </h2>
        {items.length > 0 && !disabled && (
          <button type="button" onClick={reset} className="text-xs font-semibold text-danger hover:underline">
            Xóa giỏ
          </button>
        )}
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Chưa có sản phẩm. Quét mã hoặc chọn từ danh sách.</li>}
        {items.map((item) => {
          const lines = (byProduct.get(item.productId) ?? []).filter((l) => l.lineType === 'NORMAL')
          const name = lines[0]?.productName ?? names[item.productId] ?? `Sản phẩm #${item.productId}`
          const gross = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
          const net = lines.reduce((s, l) => s + l.lineTotal, 0)
          const allocations = lines.flatMap((l) => l.allocations)
          const promoNames = [...new Set(lines.map((l) => l.linePromotionName).filter((n): n is string => Boolean(n)))]
          const lots = new Map<string, { qty: number; exp: string; overridden: boolean }>()
          for (const a of allocations) {
            const prev = lots.get(a.lotCode)
            lots.set(a.lotCode, { qty: (prev?.qty ?? 0) + a.quantity, exp: a.expDate, overridden: a.overridden })
          }
          return (
            <li key={item.productId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{name}</p>
                <button
                  type="button"
                  aria-label={`Bỏ ${name} khỏi giỏ`}
                  disabled={disabled}
                  onClick={() => removeProduct(item.productId)}
                  className="rounded-lg p-1 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {lots.size === 0
                  ? 'Đang tính lô...'
                  : [...lots].map(([code, l]) => (
                      <span key={code} className="mr-2">
                        Lô {code} ×{l.qty} · HSD {formatDate(l.exp)}
                        {l.overridden ? ' (đổi tay)' : ''}
                      </span>
                    ))}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setPickLot({ productId: item.productId, name })}
                    className="font-semibold text-accent hover:underline"
                  >
                    Đổi lô
                  </button>
                )}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <div className="inline-flex items-center rounded-xl border border-line">
                  <button
                    type="button"
                    aria-label={`Giảm số lượng ${name}`}
                    disabled={disabled}
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    className="p-2 text-ink-soft hover:bg-card"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold" aria-label={`Số lượng ${name}`}>
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Tăng số lượng ${name}`}
                    disabled={disabled}
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    className="p-2 text-ink-soft hover:bg-card"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="text-right">
                  {gross !== net && gross > 0 && <p className="text-xs text-muted line-through">{formatCurrency(gross)}</p>}
                  <p className="text-sm font-bold text-ink">{lines.length ? formatCurrency(net) : '—'}</p>
                </div>
              </div>
              {promoNames.length > 0 && (
                <p className="mt-1 text-xs font-medium text-success">T1 · {promoNames.join(', ')}</p>
              )}
            </li>
          )
        })}
        {gifts.map((g) => (
          <li key={g.key} className="flex items-center gap-2 bg-success-soft/40 px-4 py-2.5 text-sm">
            <Gift className="size-4 text-success" aria-hidden="true" />
            <span className="flex-1">
              <span className="font-semibold">{g.productName}</span> ×{g.quantity} · quà tặng
              {g.linePromotionName ? ` (${g.linePromotionName})` : ''}
            </span>
            <span className="font-bold text-success">0 đ</span>
          </li>
        ))}
      </ul>
      {pickLot && <LotPickerModal productId={pickLot.productId} productName={pickLot.name} onClose={() => setPickLot(null)} />}
    </section>
  )
}
