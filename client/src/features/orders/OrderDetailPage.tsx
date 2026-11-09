import { useQuery } from '@tanstack/react-query'
import { Lock, Printer, Undo2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, ErrorState, LoadingState, PageHeader, StatusBadge, toast } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { ordersService } from '../../services/orders.service'
import { settingsService } from '../../services/settings.service'
import { RETURN_REASON_LABELS } from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'
import { buildReceiptHtml, printReceipt } from '../pos/receipt'
import { OrderStatusBadge, PaymentMethodLabel } from './order-ui'

/** POS-03: chi tiết đơn hàng. Chứng từ COMPLETED chỉ xem, không có nút sửa/xóa (luật 41). */
export function OrderDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const canReturn = useCan('POS_RETURN')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersService.detail(id),
  })
  const store = useQuery({ queryKey: queryKeys.settings.store, queryFn: () => settingsService.store() }).data?.data

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
  const { order, returns, returnedQuantities, shiftCode } = data.data
  const completed = order.status === 'COMPLETED'
  const due = order.totalAmount - order.exchangeCreditAmount

  const print = () => {
    if (!printReceipt(buildReceiptHtml(order, store))) {
      toast.error('Không in được hóa đơn. Đơn hàng không bị ảnh hưởng.')
    }
  }
  const summaryRow = (label: string, value: number, discount = false) =>
    (value !== 0 || !discount) && (
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold">
          {discount ? '−' : ''}
          {formatCurrency(value)}
        </span>
      </div>
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.orderCode}
        description={completed ? `Hoàn tất lúc ${formatDateTime(order.completedAt)} · Ca ${shiftCode} · Thu ngân ${order.cashierName}` : `Tạo lúc ${formatDateTime(order.createdAt)}`}
        breadcrumbs={[{ label: 'Bán hàng & POS' }, { label: 'Lịch sử đơn hàng', to: '/orders' }, { label: order.orderCode }]}
        actions={
          completed && (
            <>
              <Button variant="secondary" icon={<Printer className="size-4" aria-hidden="true" />} onClick={print}>
                In lại hóa đơn
              </Button>
              {canReturn && (
                <Button icon={<Undo2 className="size-4" aria-hidden="true" />} onClick={() => navigate(`/returns/new?orderId=${order.id}`)}>
                  Trả / đổi hàng
                </Button>
              )}
            </>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        {completed && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Lock className="size-3.5" aria-hidden="true" />
            Chứng từ đã hoàn tất không sửa, không xóa
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-x-auto rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line p-4 text-base font-bold text-ink">Chi tiết sản phẩm và lô hàng</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Dòng hàng của đơn</caption>
            <thead className="bg-card text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-2 py-2 text-right">SL</th>
                <th className="px-2 py-2 text-right">Đơn giá</th>
                <th className="px-2 py-2 text-right">Giảm</th>
                <th className="px-2 py-2 text-right">Thành tiền</th>
                <th className="px-4 py-2 text-right">Đã trả</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">
                      {l.productName} {l.lineType === 'GIFT' && <StatusBadge tone="success">Quà tặng</StatusBadge>}
                    </p>
                    <p className="text-xs text-muted">
                      {l.sku} · Lô {l.lotCode} · HSD {formatDate(l.expDate)}
                    </p>
                  </td>
                  <td className="px-2 py-3 text-right">{l.quantity}</td>
                  <td className="px-2 py-3 text-right">{formatCurrency(l.unitPrice)}</td>
                  <td className="px-2 py-3 text-right text-xs text-muted">
                    {l.lineDiscount + l.tierDiscount + l.orderDiscount + l.pointsDiscount > 0
                      ? `−${formatCurrency(l.lineDiscount + l.tierDiscount + l.orderDiscount + l.pointsDiscount)}`
                      : '—'}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold">{formatCurrency(l.lineTotal)}</td>
                  <td className="px-4 py-3 text-right">
                    {returnedQuantities[l.id] ?? 0}/{l.quantity}
                  </td>
                </tr>
              ))}
              {order.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Đơn nháp chưa có dòng hàng chốt lô.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <aside className="space-y-4">
          <section className="space-y-2 rounded-2xl border border-line bg-white p-4">
            <h2 className="text-base font-bold text-ink">Tổng kết thanh toán</h2>
            {summaryRow('Tạm tính', order.subtotalAmount)}
            {summaryRow('T1 · Khuyến mãi dòng hàng', order.lineDiscountAmount, true)}
            {summaryRow('T2 · Hạng thẻ', order.tierDiscountAmount, true)}
            {summaryRow(`T3 · ${order.orderPromotionName ?? 'Giảm hóa đơn'}`, order.orderDiscountAmount, true)}
            {summaryRow(`T4 · ${order.pointsUsed} điểm`, order.pointsDiscountAmount, true)}
            {order.exchangeCreditAmount > 0 && summaryRow('Trừ giá trị hàng đổi', order.exchangeCreditAmount, true)}
            <div className="flex justify-between border-t border-line pt-3">
              <span className="font-bold">Tổng thanh toán</span>
              <span className="text-xl font-extrabold text-accent">{formatCurrency(due)}</span>
            </div>
            <p className="text-xs text-muted">Đã gồm VAT {formatCurrency(order.taxAmount)}</p>
            <p className="text-sm">
              Phương thức: <PaymentMethodLabel method={order.paymentMethod} />
              {order.amountReceived !== null && ` · khách đưa ${formatCurrency(order.amountReceived)}, thừa ${formatCurrency(order.changeDue ?? 0)}`}
            </p>
          </section>
          <section className="space-y-1 rounded-2xl border border-line bg-white p-4 text-sm">
            <h2 className="text-base font-bold text-ink">Khách hàng</h2>
            {order.customerName ? (
              <>
                <p className="font-semibold">{order.customerName}</p>
                <p className="text-muted">{order.customerPhone}</p>
                <p className="text-muted">Điểm tích đơn này: {order.pointsEarned} · đã dùng {order.pointsUsed}</p>
              </>
            ) : (
              <p className="text-muted">Khách vãng lai</p>
            )}
          </section>
          <section className="space-y-2 rounded-2xl border border-line bg-white p-4 text-sm">
            <h2 className="text-base font-bold text-ink">Phiếu đổi trả</h2>
            {returns.length === 0 ? (
              <p className="text-muted">Chưa có phiếu trả hoặc đổi cho đơn này.</p>
            ) : (
              returns.map((r) => (
                <p key={r.id}>
                  <span className="font-mono font-semibold">{r.returnCode}</span> · {RETURN_REASON_LABELS[r.returnReason]} · {formatCurrency(r.totalRefundAmount)}
                </p>
              ))
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
