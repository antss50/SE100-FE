import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, DataTable, PageHeader, Pagination, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { inventoryChecksService } from '../../services/inventory-checks.service'
import type { InventoryCheck, InventoryCheckStatus } from '../../types/inventory'
import { getErrorMessage } from '../../utils/error'
import { formatDateTime, formatNumber } from '../../utils/format'
import { InventoryCheckStatusBadge } from './InventoryCheckStatusBadge'

const PAGE_SIZE = 10

/** STK-04, STK-05: danh sách phiếu kiểm kho. */
export function InventoryChecksListPage() {
  const navigate = useNavigate()
  const canCreate = useCan('STOCK_CHECK_CREATE')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<InventoryCheckStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const params = { keyword, status, page, pageSize: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.inventoryChecks.list(params),
    queryFn: () => inventoryChecksService.list(params),
    placeholderData: (prev) => prev,
  })

  const columns: Column<InventoryCheck>[] = [
    { key: 'code', header: 'Mã phiếu', render: (c) => <span className="font-mono font-semibold">{c.checkCode}</span> },
    { key: 'scope', header: 'Phạm vi', render: (c) => c.scopeNote ?? '—' },
    { key: 'by', header: 'Người lập', render: (c) => c.createdByName },
    { key: 'snapshot', header: 'Chụp tồn lúc', render: (c) => formatDateTime(c.snapshotAt) },
    { key: 'lines', header: 'Số lô', align: 'right', render: (c) => formatNumber(c.lineCount) },
    {
      key: 'diff',
      header: 'Lô chênh lệch',
      align: 'right',
      render: (c) => (c.submittedAt ? formatNumber(c.differenceLineCount) : '—'),
    },
    {
      key: 'total',
      header: 'Chênh lệch ròng',
      align: 'right',
      render: (c) =>
        c.submittedAt ? (
          <span className={c.totalDifference < 0 ? 'font-semibold text-danger' : c.totalDifference > 0 ? 'font-semibold text-success' : ''}>
            {c.totalDifference > 0 ? '+' : ''}
            {formatNumber(c.totalDifference)}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'status', header: 'Trạng thái', render: (c) => <InventoryCheckStatusBadge status={c.status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiểm kê kho"
        description="Chụp tồn, khóa lô, nhập số đếm thực tế và gửi quản lý duyệt điều chỉnh."
        breadcrumbs={[{ label: 'Kho & hàng hóa' }, { label: 'Kiểm kê kho' }]}
        actions={
          canCreate && (
            <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => navigate('/inventory-checks/new')}>
              Tạo phiếu kiểm kê
            </Button>
          )
        }
      />
      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="min-w-64 flex-1">
            <span className="sr-only">Tìm phiếu kiểm kho</span>
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo mã phiếu hoặc phạm vi..."
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc trạng thái</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as InventoryCheckStatus | 'ALL')
                setPage(1)
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="IN_PROGRESS">Đang kiểm kê</option>
              <option value="WAITING_APPROVAL">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="NO_DIFFERENCE">Không chênh lệch</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Danh sách phiếu kiểm kho"
          columns={columns}
          rows={data?.data.items}
          rowKey={(c) => c.id}
          loading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="Chưa có phiếu kiểm kho"
          onRowClick={(c) => navigate(`/inventory-checks/${c.id}`)}
        />
        {data && (
          <div className="border-t border-line p-4">
            <Pagination page={data.data.page} pageSize={data.data.pageSize} totalItems={data.data.totalItems} onPageChange={setPage} unit="phiếu" />
          </div>
        )}
      </div>
    </div>
  )
}
