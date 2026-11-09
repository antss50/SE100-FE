import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, ErrorState, LoadingState, PageHeader, toast } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { ordersService } from '../../services/orders.service'
import { returnsService } from '../../services/returns.service'
import {
  RETURN_REASON_LABELS,
  type RefundMethod,
  type ReturnItemInput,
  type ReturnReason,
} from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { usePosStore } from '../pos/pos-store'
import { ReturnLinesTable, type ReturnSelection } from './ReturnLinesTable'

const REFUND_LABELS: Record<RefundMethod, string> = {
  CASH: 'Hoàn tiền mặt',
  BANK_TRANSFER: 'Hoàn chuyển khoản',
  EXCHANGE: 'Đổi hàng (không chi tiền)',
}

/** POS-04: lập phiếu trả/đổi hàng. Nhận hàng và hoàn tiền là một giao dịch; không cần Manager duyệt, không voucher bù. */
export function ReturnCreatePage() {
  const [params, setParams] = useSearchParams()
  const orderId = Number(params.get('orderId')) || null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const startExchange = usePosStore((s) => s.startExchange)
  const [lookup, setLookup] = useState('')
  const [reason, setReason] = useState<ReturnReason>('DEFECTIVE')
  const [refund, setRefund] = useState<RefundMethod>('CASH')
  const [note, setNote] = useState('')
  const [selection, setSelection] = useState<Record<number, ReturnSelection>>({})

  const orders = useQuery({
    queryKey: queryKeys.orders.list({ keyword: lookup, status: 'COMPLETED', pageSize: 5 }),
    queryFn: () => ordersService.list({ keyword: lookup, status: 'COMPLETED', pageSize: 5 }),
    enabled: orderId === null && lookup.trim().length >= 2,
  })
  const info = useQuery({
    queryKey: queryKeys.returns.returnable(orderId ?? 0),
    queryFn: () => returnsService.returnable(orderId as number),
    enabled: orderId !== null,
  })

  const items: ReturnItemInput[] = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, s]) => s.selected)
        .map(([id, s]) => ({ orderDetailId: Number(id), quantity: s.quantity, condition: s.condition })),
    [selection]
  )
  const effectiveRefund: RefundMethod = reason === 'CHANGE_OF_MIND' ? 'EXCHANGE' : refund
  const sealBroken = reason === 'CHANGE_OF_MIND' && items.some((i) => i.condition === 'DAMAGED_OR_OPENED')
  const request = { originalOrderId: orderId ?? 0, reason, items }
  const quote = useQuery({
    queryKey: queryKeys.returns.quote(request),
    queryFn: () => returnsService.quote(request),
    enabled: orderId !== null && items.length > 0 && !sealBroken,
    retry: false,
  })

  const create = useMutation({
    mutationFn: () => returnsService.create({ ...request, note: note.trim() || undefined, refundMethod: effectiveRefund }),
    onSuccess: (res) => {
      toast.success(`Đã lập phiếu ${res.data.returnCode}`)
      for (const key of [queryKeys.returns.all, queryKeys.orders.all, queryKeys.shifts.all, queryKeys.stock.all, queryKeys.customers.all]) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
      if (res.data.refundMethod === 'EXCHANGE') {
        startExchange(res.data.id)
        toast.success('Chọn hàng mới tại màn POS: tổng phải lớn hơn hoặc bằng giá trị hàng trả')
        navigate('/pos')
      } else {
        navigate(`/returns/${res.data.id}`)
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const detail = info.data?.data
  const reasonOptions = Object.keys(RETURN_REASON_LABELS) as ReturnReason[]
  const selectClass = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lập phiếu đổi trả"
        description="Hàng lỗi: hoàn tiền hoặc đổi hàng. Khách đổi ý: chỉ đổi hàng, còn nguyên seal, trong thời hạn đổi trả."
        breadcrumbs={[{ label: 'Bán hàng & POS' }, { label: 'Đổi trả hàng', to: '/returns' }, { label: 'Lập phiếu' }]}
      />

      {orderId === null ? (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <label className="relative block">
            <span className="sr-only">Tìm hóa đơn gốc</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Nhập mã hóa đơn (HD...), tên hoặc SĐT khách"
              className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <ul className="divide-y divide-line">
            {orders.data?.data.items.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setParams({ orderId: String(o.id) })} className="flex w-full items-center justify-between py-3 text-left hover:bg-card">
                  <span>
                    <span className="font-mono font-semibold text-accent">{o.orderCode}</span>
                    <span className="ml-2 text-xs text-muted">{formatDateTime(o.completedAt)} · {o.customerName ?? 'Khách vãng lai'}</span>
                  </span>
                  <span className="font-semibold">{formatCurrency(o.totalAmount - o.exchangeCreditAmount)}</span>
                </button>
              </li>
            ))}
            {orders.data?.data.items.length === 0 && <li className="py-3 text-sm text-muted">Không tìm thấy hóa đơn hoàn tất phù hợp.</li>}
          </ul>
        </section>
      ) : info.isLoading ? (
        <LoadingState />
      ) : info.error || !detail ? (
        <ErrorState message={getErrorMessage(info.error)} onRetry={() => void info.refetch()} />
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold text-muted">Hóa đơn gốc</p>
              <p className="font-mono font-bold text-accent">{detail.order.orderCode}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Khách hàng</p>
              <p className="font-semibold">{detail.order.customerName ?? 'Khách vãng lai'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Ngày mua</p>
              <p>{formatDateTime(detail.order.completedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">Thời hạn đổi trả</p>
              <p className={detail.expired ? 'font-semibold text-danger' : ''}>
                {detail.expired ? `Đã quá hạn ${detail.maxReturnDays} ngày` : `Còn ${detail.maxReturnDays - detail.daysSincePurchase} ngày`}
              </p>
            </div>
          </section>
          {detail.expired && (
            <p role="alert" className="flex items-center gap-2 rounded-2xl bg-danger-soft p-4 text-sm font-semibold text-danger">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Quá thời hạn đổi trả, hệ thống chặn không cho lập phiếu.
            </p>
          )}

          <ReturnLinesTable
            lines={detail.lines}
            selection={selection}
            changeOfMind={reason === 'CHANGE_OF_MIND'}
            onChange={(id, next) => setSelection((s) => ({ ...s, [id]: next }))}
          />

          <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
            <FieldShell id="return-reason" label="Lý do trả hàng" required>
              <select
                id="return-reason"
                value={reason}
                onChange={(e) => {
                  const next = e.target.value as ReturnReason
                  setReason(next)
                  setRefund(next === 'CHANGE_OF_MIND' ? 'EXCHANGE' : 'CASH')
                }}
                className={selectClass}
              >
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>
                    {RETURN_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell id="return-refund" label="Hình thức xử lý" required>
              <select
                id="return-refund"
                value={effectiveRefund}
                disabled={reason === 'CHANGE_OF_MIND'}
                onChange={(e) => setRefund(e.target.value as RefundMethod)}
                className={selectClass}
              >
                {(['CASH', 'BANK_TRANSFER', 'EXCHANGE'] as RefundMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {REFUND_LABELS[m]}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell id="return-note" label="Ghi chú tình trạng sản phẩm" className="md:col-span-2">
              <textarea id="return-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={selectClass} />
            </FieldShell>
          </section>

          {sealBroken && (
            <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm font-semibold text-danger">
              Khách đổi ý chỉ nhận hàng còn nguyên seal. Hàng đã mở seal thì từ chối, không lập phiếu.
            </p>
          )}
          {quote.error && !sealBroken && (
            <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm font-semibold text-danger">
              {getErrorMessage(quote.error)}
            </p>
          )}

          <section className="space-y-3 rounded-2xl border border-line bg-white p-5" aria-label="Quyết toán">
            <h2 className="text-base font-bold text-ink">Quyết toán và thông tin hoàn tiền</h2>
            {quote.data ? (
              <>
                <ul className="space-y-1 text-sm">
                  {quote.data.data.lines.map((l) => (
                    <li key={`${l.orderDetailId}-${l.kind}`} className="flex justify-between">
                      <span>
                        {l.kind === 'RETURN' ? 'Trả' : 'Trừ giá trị quà'} {l.productName} × {l.quantity}
                        {l.toBlocked && <span className="ml-1 text-xs text-warning">(cách ly chờ xử lý)</span>}
                      </span>
                      <span className={l.refundAmount < 0 ? 'font-semibold text-danger' : 'font-semibold'}>{formatCurrency(l.refundAmount)}</span>
                    </li>
                  ))}
                </ul>
                {quote.data.data.messages.map((m) => (
                  <p key={m} className="text-xs text-warning">
                    {m}
                  </p>
                ))}
                {quote.data.data.cashShortfall && effectiveRefund === 'CASH' && (
                  <p className="text-xs font-semibold text-warning">Két không đủ tiền mặt: hệ thống sẽ hoàn bằng chuyển khoản (luật 23).</p>
                )}
                <p className="text-sm text-muted">Điểm thu hồi: {quote.data.data.pointsRevoked}. Điểm đã dùng không hoàn; không cấp voucher bù.</p>
                <div className="flex items-center justify-between rounded-xl bg-accent-soft p-4">
                  <span className="text-sm font-semibold text-ink-soft">
                    {effectiveRefund === 'EXCHANGE' ? 'Giá trị quy đổi sang đơn mua hàng đổi' : 'Tổng tiền hoàn lại'}
                  </span>
                  <span className="text-2xl font-extrabold text-accent">{formatCurrency(quote.data.data.totalRefund)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Chọn sản phẩm và số lượng để xem tiền hoàn.</p>
            )}
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/returns')}>
              Hủy
            </Button>
            <Button
              onClick={() => create.mutate()}
              loading={create.isPending}
              disabled={detail.expired || items.length === 0 || sealBroken || !quote.data}
            >
              Xác nhận trả hàng
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
