import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { returnsService } from '../../services/returns.service'
import { RETURN_REASON_LABELS } from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { REFUND_METHOD_LABELS } from './ReturnsListPage'

/** POS-04: chi tiết phiếu trả. Phiếu đã hoàn tất không sửa, không xóa (luật 41). */
export function ReturnDetailPage() {
  const { id = '' } = useParams()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.returns.detail(id),
    queryFn: () => returnsService.detail(id),
  })
  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
  const r = data.data

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.returnCode}
        description={`Lập lúc ${formatDateTime(r.createdAt)} bởi ${r.processedByName}`}
        breadcrumbs={[{ label: 'Bán hàng & POS' }, { label: 'Đổi trả hàng', to: '/returns' }, { label: r.returnCode }]}
      />
      <p className="inline-flex items-center gap-1 text-xs text-muted">
        <Lock className="size-3.5" aria-hidden="true" />
        Chứng từ đã hoàn tất không sửa, không xóa
      </p>
      <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs font-semibold text-muted">Hóa đơn gốc</p>
          <Link to={`/orders/${r.originalOrderId}`} className="font-mono font-bold text-accent hover:underline">
            {r.originalOrderCode}
          </Link>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">Lý do</p>
          <p>{RETURN_REASON_LABELS[r.returnReason]}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">Hình thức</p>
          <StatusBadge tone={r.refundMethod === 'EXCHANGE' ? 'info' : 'accent'}>{REFUND_METHOD_LABELS[r.refundMethod]}</StatusBadge>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">{r.refundMethod === 'EXCHANGE' ? 'Giá trị quy đổi' : 'Tiền hoàn'}</p>
          <p className="text-xl font-extrabold text-accent">{formatCurrency(r.totalRefundAmount)}</p>
        </div>
      </section>
      {r.returnNote && <p className="rounded-2xl border border-line bg-white p-4 text-sm">Ghi chú: {r.returnNote}</p>}
      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Dòng hàng của phiếu trả</caption>
          <thead className="bg-card text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Sản phẩm</th>
              <th className="px-2 py-2">Loại dòng</th>
              <th className="px-2 py-2 text-right">SL</th>
              <th className="px-2 py-2">Tình trạng</th>
              <th className="px-4 py-2 text-right">Tiền</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <p className="font-semibold">{l.productName}</p>
                  <p className="text-xs text-muted">Lô {l.lotCode}</p>
                </td>
                <td className="px-2 py-2.5">{l.lineKind === 'RETURN' ? 'Nhận hàng về' : 'Trừ giá trị quà'}</td>
                <td className="px-2 py-2.5 text-right">{l.quantity}</td>
                <td className="px-2 py-2.5">{l.lineKind === 'RETURN' ? (l.itemCondition === 'INTACT' ? 'Còn nguyên seal' : 'Đã mở / hư hỏng') : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${l.refundAmount < 0 ? 'text-danger' : ''}`}>{formatCurrency(l.refundAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-muted">
        Điểm thu hồi: {r.pointsRevoked}.
        {r.exchangeOrderCode ? ` Đã mua hàng đổi ở đơn ${r.exchangeOrderCode}.` : r.refundMethod === 'EXCHANGE' ? ' Chưa lập đơn mua hàng đổi.' : ''}
      </p>
    </div>
  )
}
