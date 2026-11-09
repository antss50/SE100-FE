import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, ConfirmDialog, DataTable, ErrorState, LoadingState, PageHeader, StatusBadge, toast, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { shiftsService } from '../../services/shifts.service'
import { RETURN_REASON_LABELS, type OrderListItem, type ReturnListItem } from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { OrderStatusBadge, PaymentMethodLabel, customerLabel } from '../orders/order-ui'
import { CashFormula, DifferenceBadge, PaymentBreakdown } from './shift-ui'

/** POS-05: chi tiết ca / biên bản chốt ca và kiểm quỹ. */
export function ShiftDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canConfirm = useCan('POS_SHIFT_HANDOVER_CONFIRM')
  const [confirming, setConfirming] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.shifts.detail(id),
    queryFn: () => shiftsService.detail(id),
  })

  const handover = useMutation({
    mutationFn: () => shiftsService.confirmHandover(Number(id)),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã xác nhận bàn giao ca')
      void queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
      setConfirming(false)
    },
    onError: (e) => {
      toast.error(getErrorMessage(e))
      setConfirming(false)
    },
  })

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
  const { shift, summary, orders, returns } = data.data
  const closed = shift.status === 'CLOSED'

  const orderColumns: Column<OrderListItem>[] = [
    { key: 'code', header: 'Mã hóa đơn', render: (o) => <span className="font-mono text-sm font-semibold">{o.orderCode}</span> },
    { key: 'time', header: 'Thời gian', render: (o) => formatDateTime(o.completedAt ?? o.createdAt) },
    { key: 'customer', header: 'Khách hàng', render: (o) => customerLabel(o) },
    { key: 'method', header: 'Phương thức', render: (o) => <PaymentMethodLabel method={o.paymentMethod} /> },
    { key: 'total', header: 'Giá trị đơn', align: 'right', render: (o) => formatCurrency(o.totalAmount) },
    { key: 'status', header: 'Trạng thái', render: (o) => <OrderStatusBadge status={o.status} /> },
  ]
  const returnColumns: Column<ReturnListItem>[] = [
    { key: 'code', header: 'Mã phiếu trả', render: (r) => <span className="font-mono text-sm font-semibold">{r.returnCode}</span> },
    { key: 'order', header: 'Hóa đơn gốc', render: (r) => r.originalOrderCode },
    { key: 'reason', header: 'Lý do', render: (r) => RETURN_REASON_LABELS[r.returnReason] },
    { key: 'method', header: 'Hình thức', render: (r) => (r.refundMethod === 'CASH' ? 'Tiền mặt' : r.refundMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Đổi hàng') },
    { key: 'amount', header: 'Giá trị', align: 'right', render: (r) => formatCurrency(r.totalRefundAmount) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Biên bản ${shift.shiftCode}`}
        description={closed ? 'Ca đã chốt sổ, không phát sinh thêm chứng từ.' : 'Ca đang mở, số liệu cập nhật theo đơn hàng.'}
        breadcrumbs={[{ label: 'Bán hàng & POS' }, { label: 'Quản lý ca', to: '/shifts' }, { label: shift.shiftCode }]}
        actions={
          canConfirm &&
          closed &&
          shift.handoverConfirmedBy === null && (
            <Button icon={<ShieldCheck className="size-4" aria-hidden="true" />} onClick={() => setConfirming(true)}>
              Xác nhận bàn giao ca
            </Button>
          )
        }
      />

      <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-muted">Thu ngân chịu trách nhiệm</p>
          <p className="mt-1 font-semibold text-ink">{shift.cashierName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">Thời gian ca</p>
          <p className="mt-1 text-sm">
            {formatDateTime(shift.openedAt)} {shift.closedAt ? `→ ${formatDateTime(shift.closedAt)}` : '(đang mở)'}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Lock className="mt-1 size-4 text-muted" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-muted">Trạng thái</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <StatusBadge tone={closed ? 'neutral' : 'success'}>{closed ? 'Đã chốt sổ' : 'Đang mở'}</StatusBadge>
              {closed && (
                <StatusBadge tone={shift.handoverConfirmedBy !== null ? 'success' : 'warning'}>
                  {shift.handoverConfirmedBy !== null ? `Đã bàn giao (${shift.handoverConfirmedByName})` : 'Chờ quản lý xác nhận bàn giao'}
                </StatusBadge>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">1. Đối soát quỹ tiền mặt</h2>
          {closed && <DifferenceBadge amount={shift.differenceAmount} />}
        </div>
        <CashFormula openingCash={shift.openingCash} summary={summary} />
        {closed && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold text-muted">Dự kiến trong két (sổ sách)</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(shift.expectedCash)}</p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold text-muted">Thực tế kiểm đếm</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(shift.actualCash)}</p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold text-muted">Chênh lệch</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(shift.differenceAmount)}</p>
            </div>
          </div>
        )}
      </section>

      {closed && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-ink">2. Giải trình chênh lệch</h2>
          <p className="mt-2 text-sm text-ink-soft">{shift.note ?? 'Không có giải trình (tiền khớp).'}</p>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-bold text-ink">3. Cơ cấu doanh thu theo phương thức thanh toán</h2>
        <PaymentBreakdown summary={summary} />
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line p-5 text-lg font-bold text-ink">4. Giao dịch trong ca ({orders.length})</h2>
        <DataTable
          caption="Giao dịch trong ca"
          columns={orderColumns}
          rows={orders}
          rowKey={(o) => o.id}
          emptyTitle="Ca chưa có đơn hàng"
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
        />
      </section>

      {returns.length > 0 && (
        <section className="rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line p-5 text-lg font-bold text-ink">5. Phiếu đổi trả trong ca ({returns.length})</h2>
          <DataTable
            caption="Phiếu trả trong ca"
            columns={returnColumns}
            rows={returns}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/returns/${r.id}`)}
          />
        </section>
      )}

      <ConfirmDialog
        open={confirming}
        title="Xác nhận bàn giao ca?"
        message={`Bạn xác nhận đã nhận bàn giao tiền và chứng từ của ca ${shift.shiftCode}.`}
        confirmLabel="Xác nhận bàn giao"
        loading={handover.isPending}
        onConfirm={() => handover.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
