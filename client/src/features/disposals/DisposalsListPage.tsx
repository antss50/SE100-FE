import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, DataTable, PageHeader, Pagination, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { disposalsService } from '../../services/disposals.service'
import type { Disposal, DisposalIssueType, DisposalStatus } from '../../types/inventory'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime, formatNumber } from '../../utils/format'
import { DisposalStatusBadge, ISSUE_TYPE_LABEL, REASON_LABEL } from './disposal-meta'

const PAGE_SIZE = 10

/** STK-06, STK-07: danh sách phiếu xuất hủy / tester / trả NCC. */
export function DisposalsListPage() {
  const navigate = useNavigate()
  const canCreate = useCan('STOCK_DISPOSAL_CREATE')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<DisposalStatus | 'ALL'>('ALL')
  const [issueType, setIssueType] = useState<DisposalIssueType | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const params = { keyword, status, issueType, page, pageSize: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.disposals.list(params),
    queryFn: () => disposalsService.list(params),
    placeholderData: (prev) => prev,
  })

  const columns: Column<Disposal>[] = [
    { key: 'code', header: 'Mã phiếu', render: (d) => <span className="font-mono font-semibold">{d.disposalCode}</span> },
    { key: 'type', header: 'Loại phiếu', render: (d) => ISSUE_TYPE_LABEL[d.issueType] },
    { key: 'reason', header: 'Lý do', render: (d) => <span title={d.reason}>{REASON_LABEL[d.reasonCode]}</span> },
    { key: 'by', header: 'Người lập', render: (d) => d.requestedByName },
    { key: 'created', header: 'Ngày lập', render: (d) => formatDateTime(d.createdAt) },
    { key: 'lines', header: 'Số lô', align: 'right', render: (d) => formatNumber(d.lineCount) },
    { key: 'qty', header: 'Tổng SL', align: 'right', render: (d) => formatNumber(d.totalQuantity) },
    { key: 'cost', header: 'Giá trị vốn', align: 'right', render: (d) => (d.totalCost === null ? '—' : formatCurrency(d.totalCost)) },
    { key: 'status', header: 'Trạng thái', render: (d) => <DisposalStatusBadge status={d.status} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xuất hủy, tester, trả nhà cung cấp"
        description="Lập phiếu thì hàng được cách ly ngay; quản lý duyệt mới trừ tồn, từ chối thì trả lại phần cách ly."
        breadcrumbs={[{ label: 'Kho & hàng hóa' }, { label: 'Xuất hủy & Xuất đặc biệt' }]}
        actions={
          canCreate && (
            <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => navigate('/disposals/new')}>
              Tạo phiếu xuất khác
            </Button>
          )
        }
      />
      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="min-w-64 flex-1">
            <span className="sr-only">Tìm phiếu xuất</span>
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo mã phiếu hoặc lý do..."
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc loại phiếu</span>
            <select
              value={issueType}
              onChange={(e) => {
                setIssueType(e.target.value as DisposalIssueType | 'ALL')
                setPage(1)
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">Mọi loại phiếu</option>
              <option value="DESTROY">Xuất hủy</option>
              <option value="TESTER">Xuất tester</option>
              <option value="RETURN_TO_SUPPLIER">Trả nhà cung cấp</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Lọc trạng thái</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as DisposalStatus | 'ALL')
                setPage(1)
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="WAITING_APPROVAL">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Danh sách phiếu xuất kho khác"
          columns={columns}
          rows={data?.data.items}
          rowKey={(d) => d.id}
          loading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="Chưa có phiếu xuất kho"
          onRowClick={(d) => navigate(`/disposals/${d.id}`)}
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
