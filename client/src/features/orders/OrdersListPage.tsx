import { useQuery } from '@tanstack/react-query'
import { Banknote, ReceiptText, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable, PageHeader, Pagination, StatCard, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { ordersService } from '../../services/orders.service'
import type { OrderListItem, OrderStatus, PaymentMethod } from '../../types/pos'
import { PAYMENT_METHOD_LABELS } from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime, formatNumber } from '../../utils/format'
import { OrderStatusBadge, PaymentMethodLabel, customerLabel } from './order-ui'

const PAGE_SIZE = 10

/** POS-03: lịch sử đơn hàng. Thu ngân chỉ thấy đơn do mình lập; quản lý thấy mọi đơn. */
export function OrdersListPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [method, setMethod] = useState<PaymentMethod | 'ALL'>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const params = { keyword, status, paymentMethod: method, fromDate, toDate, page, pageSize: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => ordersService.list(params),
    placeholderData: (prev) => prev,
  })
  const summary = data?.data.summary
  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }

  const columns: Column<OrderListItem>[] = [
    { key: 'code', header: 'Mã hóa đơn', render: (o) => <span className="font-mono text-sm font-semibold text-accent">{o.orderCode}</span> },
    { key: 'time', header: 'Thời gian', render: (o) => formatDateTime(o.completedAt ?? o.createdAt) },
    { key: 'customer', header: 'Khách hàng', render: (o) => customerLabel(o) },
    { key: 'cashier', header: 'Thu ngân', render: (o) => o.cashierName },
    { key: 'method', header: 'Phương thức', render: (o) => <PaymentMethodLabel method={o.paymentMethod} /> },
    {
      key: 'total',
      header: 'Tổng thanh toán',
      align: 'right',
      render: (o) => (
        <span className={o.status === 'CANCELLED' ? 'text-muted line-through' : 'font-semibold'}>
          {formatCurrency(o.totalAmount - o.exchangeCreditAmount)}
        </span>
      ),
    },
    { key: 'status', header: 'Trạng thái', render: (o) => <OrderStatusBadge status={o.status} /> },
  ]
  const selectClass = 'rounded-xl border border-line bg-white px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch sử đơn hàng"
        description="Chứng từ đã hoàn tất không sửa, không xóa; sai thì lập phiếu trả (chứng từ ngược)."
        breadcrumbs={[{ label: 'Bán hàng & POS' }, { label: 'Lịch sử đơn hàng' }]}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Đơn hoàn tất" value={formatNumber(summary?.completedCount)} icon={ReceiptText} />
        <StatCard label="Doanh thu (tiền hàng − giảm giá)" value={formatCurrency(summary?.totalRevenue)} icon={Banknote} />
        <StatCard label="Tiền mặt thu" value={formatCurrency(summary?.cashCollected)} icon={Banknote} />
      </div>
      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Tìm đơn hàng</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(e) => reset(setKeyword)(e.target.value)}
              placeholder="Tìm theo mã hóa đơn, SĐT hoặc tên khách..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc trạng thái</span>
            <select value={status} onChange={(e) => reset(setStatus)(e.target.value as OrderStatus | 'ALL')} className={selectClass}>
              <option value="ALL">Mọi trạng thái</option>
              <option value="COMPLETED">Hoàn tất</option>
              <option value="DRAFT">Đơn nháp</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Lọc phương thức</span>
            <select value={method} onChange={(e) => reset(setMethod)(e.target.value as PaymentMethod | 'ALL')} className={selectClass}>
              <option value="ALL">Mọi phương thức</option>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Từ ngày
            <input type="date" value={fromDate} onChange={(e) => reset(setFromDate)(e.target.value)} className={`${selectClass} ml-2`} />
          </label>
          <label className="text-xs text-muted">
            Đến ngày
            <input type="date" value={toDate} onChange={(e) => reset(setToDate)(e.target.value)} className={`${selectClass} ml-2`} />
          </label>
        </div>
        <DataTable
          caption="Danh sách đơn hàng"
          columns={columns}
          rows={data?.data.items}
          rowKey={(o) => o.id}
          loading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="Chưa có đơn hàng phù hợp"
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
        />
        {data && (
          <div className="border-t border-line p-4">
            <Pagination page={data.data.page} pageSize={data.data.pageSize} totalItems={data.data.totalItems} onPageChange={setPage} unit="đơn" />
          </div>
        )}
      </div>
    </div>
  )
}
