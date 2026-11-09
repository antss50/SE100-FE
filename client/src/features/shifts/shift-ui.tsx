import { StatusBadge } from '../../components/ui'
import type { ShiftSummary } from '../../types/pos'
import { formatCurrency, formatNumber } from '../../utils/format'

/** Nhãn chênh lệch tiền: Khớp / Thiếu quỹ / Thừa quỹ. */
export function DifferenceBadge({ amount }: { amount: number | null }) {
  if (amount === null) return <span className="text-muted">—</span>
  if (amount === 0) return <StatusBadge tone="success">Khớp</StatusBadge>
  return (
    <StatusBadge tone={amount < 0 ? 'danger' : 'warning'}>
      {amount > 0 ? '+' : ''}
      {formatCurrency(amount)} ({amount < 0 ? 'thiếu quỹ' : 'thừa quỹ'})
    </StatusBadge>
  )
}

interface CashFormulaProps {
  openingCash: number
  summary: ShiftSummary
}

/** Công thức tiền mặt dự kiến trong két: đầu ca + thu tiền mặt − chi hoàn tiền mặt (POS-05). */
export function CashFormula({ openingCash, summary }: CashFormulaProps) {
  const cells = [
    { label: 'Tiền đầu ca', value: openingCash, sign: '', note: 'Tiền mặt nhận lúc mở ca' },
    { label: 'Thu tiền mặt bán hàng', value: summary.cashCollected, sign: '+', note: 'Đơn CASH, đã trừ giá trị hàng đổi' },
    { label: 'Chi hoàn tiền mặt', value: summary.cashRefunded, sign: '−', note: 'Phiếu trả hoàn bằng tiền mặt' },
  ]
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-card p-4">
            <p className="text-xs font-semibold text-muted">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-ink">
              {c.sign} {formatCurrency(c.value)}
            </p>
            <p className="mt-1 text-xs text-muted">{c.note}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-accent-soft p-4">
        <p className="text-sm text-ink-soft">
          {formatNumber(openingCash)} + {formatNumber(summary.cashCollected)} − {formatNumber(summary.cashRefunded)}
        </p>
        <p className="text-2xl font-bold text-accent">{formatCurrency(summary.expectedCash)}</p>
      </div>
    </div>
  )
}

/** Cơ cấu doanh thu theo phương thức thanh toán (luật 38: mỗi đơn một phương thức). */
export function PaymentBreakdown({ summary }: { summary: ShiftSummary }) {
  const rows = [
    { label: 'Tiền mặt', value: summary.cashSales },
    { label: 'Chuyển khoản', value: summary.transferSales },
    { label: 'Quẹt thẻ', value: summary.cardSales },
  ]
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs font-semibold text-muted">{r.label}</p>
          <p className="mt-1 text-xl font-bold text-ink">{formatCurrency(r.value)}</p>
          <p className="mt-1 text-xs text-muted">Tỷ trọng {total > 0 ? ((r.value / total) * 100).toFixed(1) : '0.0'}%</p>
        </div>
      ))}
    </div>
  )
}
