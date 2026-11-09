import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, DataTable, PageHeader, Pagination, StatusBadge, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { returnsService } from '../../services/returns.service'
import { RETURN_REASON_LABELS, type ReturnListItem, type ReturnReason } from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime } from '../../utils/format'

const PAGE_SIZE = 10
export const REFUND_METHOD_LABELS = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', EXCHANGE: 'Đổi hàng' } as const

/** POS-04: danh sách phiếu đổi trả. */
export function ReturnsListPage() {
  const navigate = useNavigate()
  const canReturn = useCan('POS_RETURN')
  const [keyword, setKeyword] = useState('')
  const [reason, setReason] = useState<ReturnReason | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const params = { keyword, reason, page, pageSize: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.returns.list(params),
    queryFn: () => returnsService.list(params),
    placeholderData: (prev) => prev,
  })

  const columns: Column<ReturnListItem>[] = [
    { key: 'code', header: 'Mã phiếu', render: (r) => <span className="font-mono text-sm font-semibold text-accent">{r.returnCode}</span> },
    { key: 'time', header: 'Thời gian', render: (r) => formatDateTime(r.createdAt) },
    { key: 'order', header: 'Hóa đơn gốc', render: (r) => r.originalOrderCode },
    { key: 'reason', header: 'Lý do', render: (r) => RETURN_REASON_LABELS[r.returnReason] },
    { key: 'method', header: 'Hình thức', render: (r) => <StatusBadge tone={r.refundMethod === 'EXCHANGE' ? 'info' : 'accent'}>{REFUND_METHOD_LABELS[r.refundMethod]}</StatusBadge> },
    { key: 'by', header: 'Thu ngân', render: (r) => r.processedByName },
    { key: 'amount', header: 'Giá trị', align: 'right', render: (r) => <span className="font-semibold">{formatCurrency(r.totalRefundAmount)}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đổi trả hàng"
        description="Phiếu trả không cần Manager duyệt; phiếu gắn vào ca hiện tại của thu ngân."
        breadcrumbs={[{ label: 'Bán hàng & POS' }, { label: 'Đổi trả hàng' }]}
        actions={
          canReturn && (
            <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => navigate('/returns/new')}>
              Lập phiếu trả
            </Button>
          )
        }
      />
      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Tìm phiếu trả</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo mã phiếu hoặc mã hóa đơn..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc lý do</span>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as ReturnReason | 'ALL')
                setPage(1)
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">Mọi lý do</option>
              <option value="DEFECTIVE">{RETURN_REASON_LABELS.DEFECTIVE}</option>
              <option value="CHANGE_OF_MIND">{RETURN_REASON_LABELS.CHANGE_OF_MIND}</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Danh sách phiếu trả"
          columns={columns}
          rows={data?.data.items}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="Chưa có phiếu đổi trả"
          onRowClick={(r) => navigate(`/returns/${r.id}`)}
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
