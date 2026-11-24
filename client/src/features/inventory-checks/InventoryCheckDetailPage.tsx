import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Lock } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '../../app/store'
import { useCan } from '../../app/usePermission'
import { Button, ConfirmDialog, DataTable, ErrorState, LoadingState, PageHeader, toast, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { inventoryChecksService } from '../../services/inventory-checks.service'
import type { InventoryCheckLine } from '../../types/inventory'
import { getErrorMessage } from '../../utils/error'
import { formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { CheckCountingForm } from './CheckCountingForm'
import { CHECK_TYPE_LABELS, InventoryCheckStatusBadge } from './InventoryCheckStatusBadge'

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}

/** Chi tiết phiếu kiểm kê: Manager lên lịch & theo dõi; Inventory Staff được phân công nhập số lượng & hoàn tất. */
export function InventoryCheckDetailPage() {
  const { checkId = '' } = useParams()
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const canCountPermission = useCan('STOCK_CHECK_CREATE')
  const canSchedule = useCan('STOCK_ADJUST_APPROVE')
  const [cancelOpen, setCancelOpen] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.inventoryChecks.detail(checkId),
    queryFn: () => inventoryChecksService.get(checkId),
  })
  const check = data?.data

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryChecks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }

  const cancel = useMutation({
    mutationFn: () => inventoryChecksService.cancel(Number(checkId)),
    onSuccess: () => {
      toast.success('Đã hủy lịch kiểm kê, các lô được mở khóa')
      setCancelOpen(false)
      refresh()
    },
    onError: (e) => {
      setCancelOpen(false)
      toast.error(getErrorMessage(e))
    },
  })

  if (isLoading) return <LoadingState />
  if (error || !check) return <ErrorState message={getErrorMessage(error, 'Không tìm thấy phiếu kiểm kho')} onRetry={() => void refetch()} />

  const columns: Column<InventoryCheckLine>[] = [
    {
      key: 'product',
      header: 'Sản phẩm / Mã lô',
      render: (l) => (
        <div>
          <p className="font-medium">{l.productName}</p>
          <p className="font-mono text-xs text-muted">
            {l.sku} · {l.lotCode}
          </p>
        </div>
      ),
    },
    { key: 'exp', header: 'Hạn sử dụng', render: (l) => formatDate(l.expDate) },
    { key: 'snap', header: 'Tồn đã chụp', align: 'right', render: (l) => formatNumber(l.snapshotQty) },
    { key: 'counted', header: 'Thực tế', align: 'right', render: (l) => (l.countedQty === null ? '—' : formatNumber(l.countedQty)) },
    {
      key: 'diff',
      header: 'Chênh lệch',
      align: 'right',
      render: (l) =>
        l.differenceQty === null ? (
          '—'
        ) : (
          <span className={l.differenceQty < 0 ? 'font-semibold text-danger' : l.differenceQty > 0 ? 'font-semibold text-success' : ''}>
            {l.differenceQty > 0 ? '+' : ''}
            {l.differenceQty}
          </span>
        ),
    },
    { key: 'note', header: 'Ghi chú', render: (l) => l.note ?? '—' },
  ]

  const isAssignedStaff = !check.assignedTo || currentUserId === check.assignedTo
  const counting = check.status === 'IN_PROGRESS' && canCountPermission && isAssignedStaff
  const snapshotTotal = check.lines.reduce((n, l) => n + l.snapshotQty, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Phiếu kiểm kê ${check.checkCode}`}
        description="Kiểm kê tồn kho theo lịch phân công; tồn kho được tự động cập nhật ngay khi nhân viên kho hoàn tất."
        breadcrumbs={[{ label: 'Kiểm kê kho', to: '/inventory-checks' }, { label: check.checkCode }]}
        actions={
          <div className="flex items-center gap-2">
            <InventoryCheckStatusBadge status={check.status} />
            {check.status === 'IN_PROGRESS' && !counting && canSchedule && (
              <Button variant="danger" size="sm" icon={<Ban className="size-4" aria-hidden="true" />} onClick={() => setCancelOpen(true)}>
                Hủy lịch kiểm
              </Button>
            )}
          </div>
        }
      />

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">Thông tin lịch kiểm kê</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Loại kiểm kê" value={CHECK_TYPE_LABELS[check.checkType ?? 'WAREHOUSE']} />
          <Info label="Thời gian dự kiến" value={formatDateTime(check.scheduledAt ?? check.snapshotAt)} />
          <Info label="Người lên lịch" value={check.createdByName} />
          <Info label="Nhân viên kiểm" value={check.assignedToName ?? '—'} />
          <Info label="Hoàn tất lúc" value={formatDateTime(check.submittedAt)} />
        </dl>
        <p className="mt-4 text-sm text-muted">Phạm vi: {check.scopeNote ?? '—'}</p>
      </section>

      {check.status === 'IN_PROGRESS' && (
        <div className="flex gap-2 rounded-xl border border-info/30 bg-info-soft p-3 text-sm text-info">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {counting
              ? `${check.lineCount} lô đang khóa trong phiếu này. Vui lòng nhập số lượng thực tế và ghi chú (tùy chọn), sau đó bấm Hoàn tất kiểm kê.`
              : `Phiếu đang được phân công cho nhân viên ${check.assignedToName ?? 'kho'} thực hiện kiểm kê (${check.lineCount} lô đang tạm khóa, chụp tồn lúc ${formatDateTime(check.snapshotAt)}).`}
          </span>
        </div>
      )}
      {(check.status === 'COMPLETED' || check.status === 'APPROVED') && (
        <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success">
          Kiểm kê đã hoàn tất. Tồn kho đã được tự động điều chỉnh theo số lượng thực tế.
        </div>
      )}
      {check.status === 'NO_DIFFERENCE' && (
        <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success">
          Số đếm khớp sổ sách ở mọi lô, phiếu đã hoàn tất.
        </div>
      )}
      {check.status === 'REJECTED' && check.rejectReason && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <strong>Lý do từ chối:</strong> {check.rejectReason}
        </div>
      )}

      {counting ? (
        <CheckCountingForm check={check} key={`${check.id}-${check.status}`} />
      ) : (
        <section className="rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line p-4 text-sm font-bold text-ink">Đối chiếu kết quả kiểm kê</h2>
          <DataTable caption="Kết quả kiểm kê từng lô" columns={columns} rows={check.lines} rowKey={(l) => l.id} />
          <dl className="grid gap-4 border-t border-line p-4 text-sm sm:grid-cols-4">
            <Info label="Số lô đã kiểm" value={`${check.lineCount} lô`} />
            <Info label="Số lô chênh lệch" value={check.submittedAt ? `${check.differenceLineCount} lô` : '—'} />
            <Info label="Sổ sách" value={`${formatNumber(snapshotTotal)} sản phẩm`} />
            <Info label="Tổng chênh lệch" value={check.submittedAt ? `${check.totalDifference > 0 ? '+' : ''}${check.totalDifference} sản phẩm` : '—'} />
          </dl>
        </section>
      )}

      <ConfirmDialog
        open={cancelOpen}
        tone="danger"
        title="Hủy lịch kiểm kê?"
        message="Phiếu bị hủy sẽ không điều chỉnh tồn và các lô được mở khóa."
        confirmLabel="Hủy lịch kiểm"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  )
}
