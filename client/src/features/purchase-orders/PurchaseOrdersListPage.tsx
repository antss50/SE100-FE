import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, DataTable, PageHeader, Pagination, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { purchaseOrdersService } from '../../services/purchase-orders.service'
import type { PurchaseOrder, PurchaseOrderStatus } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime, formatNumber } from '../../utils/format'
import { PurchaseOrderStatusBadge } from './PurchaseOrderStatusBadge'

const PAGE_SIZE = 10

/** STK-01: danh sách phiếu nhập kho. */
export function PurchaseOrdersListPage() {
  const navigate = useNavigate()
  const canCreate = useCan('STOCK_IMPORT_CREATE')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<PurchaseOrderStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)

  const params = { keyword, status, page, pageSize: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.purchaseOrders.list(params),
    queryFn: () => purchaseOrdersService.list(params),
    placeholderData: (prev) => prev,
  })

  const columns: Column<PurchaseOrder>[] = [
    { key: 'code', header: 'Mã phiếu', render: (o) => <span className="font-mono font-semibold">{o.poCode}</span> },
    {
      key: 'supplier',
      header: 'Nhà cung cấp',
      render: (o) => (
        <div>
          <p className="font-medium">{o.supplierName}</p>
          <p className="text-xs text-muted">{o.supplierCode}</p>
        </div>
      ),
    },
    { key: 'invoice', header: 'Số hóa đơn NCC', render: (o) => o.supplierInvoiceNo ?? '—' },
    { key: 'created', header: 'Ngày tạo', render: (o) => formatDateTime(o.createdAt) },
    { key: 'by', header: 'Người lập', render: (o) => o.createdByName },
    { key: 'lines', header: 'Số lô', align: 'right', render: (o) => formatNumber(o.lineCount) },
    { key: 'qty', header: 'Số lượng', align: 'right', render: (o) => formatNumber(o.totalQuantity) },
    {
      key: 'total',
      header: 'Tổng tiền',
      align: 'right',
      render: (o) => <span className="font-semibold">{formatCurrency(o.totalAmount)}</span>,
    },
    { key: 'status', header: 'Trạng thái', render: (o) => <PurchaseOrderStatusBadge status={o.status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phiếu nhập kho theo lô"
        description="Nhập hàng từ nhà cung cấp theo từng lô và hạn dùng; hệ thống tự sắp xuất theo FEFO."
        breadcrumbs={[{ label: 'Kho & hàng hóa' }, { label: 'Phiếu nhập kho' }]}
        actions={
          canCreate && (
            <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => navigate('/purchase-orders/new')}>
              Tạo phiếu nhập kho
            </Button>
          )
        }
      />
      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Tìm phiếu nhập</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo mã phiếu, nhà cung cấp, số hóa đơn..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc trạng thái</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as PurchaseOrderStatus | 'ALL')
                setPage(1)
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="COMPLETED">Hoàn tất</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Danh sách phiếu nhập kho"
          columns={columns}
          rows={data?.data.items}
          rowKey={(o) => o.id}
          loading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="Chưa có phiếu nhập kho"
          onRowClick={(o) => navigate(`/purchase-orders/${o.id}`)}
        />
        {data && (
          <div className="border-t border-line p-4">
            <Pagination
              page={data.data.page}
              pageSize={data.data.pageSize}
              totalItems={data.data.totalItems}
              onPageChange={setPage}
              unit="phiếu"
            />
          </div>
        )}
      </div>
    </div>
  )
}
