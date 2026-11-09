import { Banknote, CreditCard, FileClock, Landmark, Printer, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useCan } from '../../../app/usePermission'
import { Button } from '../../../components/ui'
import { PAYMENT_METHOD_LABELS, type OrderQuote, type PaymentMethod } from '../../../types/pos'
import { formatCurrency } from '../../../utils/format'
import { usePosStore } from '../pos-store'

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = { CASH: Banknote, BANK_TRANSFER: Landmark, CARD: CreditCard }

interface PaymentPanelProps {
  quote: OrderQuote | undefined
  quoting: boolean
  disabled: boolean
  completing: boolean
  savingDraft: boolean
  onComplete: () => void
  onSaveDraft: () => void
  onReturn: () => void
}

/** POS-03: tổng tiền, voucher, phương thức thanh toán (1 phương thức/đơn, luật 38), chặn hoàn tất khi tiền mặt thiếu (luật 39). */
export function PaymentPanel({ quote, quoting, disabled, completing, savingDraft, onComplete, onSaveDraft, onReturn }: PaymentPanelProps) {
  const canVoucher = useCan('PROMOTION_APPLY_VOUCHER')
  const itemCount = usePosStore((s) => s.items.length)
  const voucherCode = usePosStore((s) => s.voucherCode)
  const setVoucher = usePosStore((s) => s.setVoucher)
  const method = usePosStore((s) => s.paymentMethod)
  const setPayment = usePosStore((s) => s.setPayment)
  const received = usePosStore((s) => s.amountReceived)
  const setReceived = usePosStore((s) => s.setReceived)
  const exchangeReturnId = usePosStore((s) => s.exchangeReturnId)
  const [voucherInput, setVoucherInput] = useState(voucherCode)

  const due = quote?.amountDue ?? 0
  const receivedNumber = Number(received) || 0
  const cashShort = method === 'CASH' && receivedNumber < due
  const hasIssues = (quote?.issues.length ?? 0) > 0
  const canComplete = !disabled && itemCount > 0 && Boolean(quote) && !quoting && !hasIssues && !cashShort && due >= 0
  const tier1 = [...new Set((quote?.lines ?? []).map((l) => l.linePromotionName).filter((n): n is string => Boolean(n)))]

  const row = (label: string, value: number, tone?: 'discount') => (
    <div className="flex justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={tone === 'discount' && value > 0 ? 'font-semibold text-success' : 'font-semibold text-ink'}>
        {tone === 'discount' && value > 0 ? '−' : ''}
        {formatCurrency(value)}
      </span>
    </div>
  )

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-4" aria-label="Thanh toán">
      {canVoucher && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setVoucher(voucherInput.trim().toUpperCase())
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Mã voucher</span>
            <input
              value={voucherInput}
              disabled={disabled}
              onChange={(e) => setVoucherInput(e.target.value)}
              placeholder="Mã voucher"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm uppercase outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <Button type="submit" variant="secondary" size="sm" disabled={disabled}>
            Áp mã
          </Button>
        </form>
      )}
      <div className="rounded-xl bg-accent-soft/60 p-3 text-xs" aria-label="Khuyến mãi đang áp dụng">
        <p className="mb-1.5 font-bold text-accent">Khuyến mãi 4 tầng</p>
        <ul className="space-y-1 text-ink-soft">
          <li>T1 · {tier1.length ? tier1.join('; ') : 'Chưa có khuyến mãi dòng hàng'}</li>
          <li>T2 · Hạng thẻ: {quote && quote.tierDiscountAmount > 0 ? `−${formatCurrency(quote.tierDiscountAmount)}` : 'không có'}</li>
          <li>T3 · {quote?.orderPromotionName ? `${quote.orderPromotionName}: −${formatCurrency(quote.orderDiscountAmount)}` : 'Chưa đạt khuyến mãi đơn hàng'}</li>
          <li>T4 · Điểm: {quote && quote.pointsUsed > 0 ? `−${formatCurrency(quote.pointsDiscountAmount)}` : 'không dùng'}</li>
        </ul>
        {quote?.messages.map((m) => (
          <p key={m} className="mt-1.5 font-medium text-warning">
            {m}
          </p>
        ))}
        {quote?.issues.map((i) => (
          <p key={i.message} className="mt-1.5 font-semibold text-danger">
            {i.message}
          </p>
        ))}
      </div>

      <div className="space-y-1.5">
        {row('Tổng tiền hàng', quote?.subtotalAmount ?? 0)}
        {row('Giảm khuyến mãi dòng hàng', quote?.lineDiscountAmount ?? 0, 'discount')}
        {row('Giảm hạng thẻ', quote?.tierDiscountAmount ?? 0, 'discount')}
        {row('Giảm hóa đơn', quote?.orderDiscountAmount ?? 0, 'discount')}
        {row('Dùng điểm thành viên', quote?.pointsDiscountAmount ?? 0, 'discount')}
        {exchangeReturnId !== null && row('Trừ giá trị hàng đổi', quote?.exchangeCreditAmount ?? 0, 'discount')}
        <p className="text-xs text-muted">Đã gồm VAT {formatCurrency(quote?.taxAmount ?? 0)}</p>
      </div>

      <div className="rounded-xl bg-accent-soft p-4 text-center">
        <p className="text-xs font-semibold uppercase text-accent">Tổng tiền phải trả</p>
        <p className="mt-1 text-3xl font-extrabold text-accent" aria-live="polite">
          {formatCurrency(due)}
        </p>
        {quote && quote.pointsToEarn > 0 && <p className="mt-1 text-xs text-muted">Tích {quote.pointsToEarn} điểm khi hoàn tất</p>}
      </div>

      <div role="radiogroup" aria-label="Phương thức thanh toán" className="grid grid-cols-3 gap-2">
        {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => {
          const Icon = METHOD_ICONS[m]
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              disabled={disabled}
              onClick={() => setPayment(m)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold ${method === m ? 'border-accent bg-accent text-white' : 'border-line bg-white text-ink-soft hover:bg-card'}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {PAYMENT_METHOD_LABELS[m]}
            </button>
          )
        })}
      </div>
      {method === 'CASH' && (
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ink-soft" htmlFor="pos-received">
            Tiền khách đưa (đ)
          </label>
          <input
            id="pos-received"
            type="number"
            min={0}
            value={received}
            disabled={disabled}
            onChange={(e) => setReceived(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
          <p aria-live="polite" className={`text-xs font-semibold ${cashShort ? 'text-danger' : 'text-success'}`}>
            {cashShort
              ? `Khách đưa thiếu ${formatCurrency(due - receivedNumber)}, chưa thể hoàn tất`
              : `Tiền thừa trả khách: ${formatCurrency(receivedNumber - due)}`}
          </p>
        </div>
      )}

      <Button
        className="w-full"
        icon={<Printer className="size-4" aria-hidden="true" />}
        disabled={!canComplete}
        loading={completing}
        onClick={onComplete}
      >
        In hóa đơn và hoàn tất (F9)
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<FileClock className="size-4" aria-hidden="true" />} disabled={disabled || itemCount === 0} loading={savingDraft} onClick={onSaveDraft}>
          Lưu đơn nháp
        </Button>
        <Button variant="secondary" icon={<Undo2 className="size-4" aria-hidden="true" />} onClick={onReturn}>
          Đổi trả (F4)
        </Button>
      </div>
    </section>
  )
}
