import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lock, X } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, ConfirmDialog, DataTable, ErrorState, LoadingState, Modal, PageHeader, toast, type Column } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { inventoryChecksService } from '../../services/inventory-checks.service'
import type { InventoryCheckLine } from '../../types/inventory'
import { getErrorMessage } from '../../utils/error'
import { formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { CheckCountingForm } from './CheckCountingForm'
import { InventoryCheckStatusBadge } from './InventoryCheckStatusBadge'

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}

/** STK-04 (nhập kết quả) và STK-05 (duyệt / từ chối). */
export function InventoryCheckDetailPage() {
  const { checkId = '' } = useParams()
  const queryClient = useQueryClient()
  const canCreate = useCan('STOCK_CHECK_CREATE')
  const canApprove = useCan('STOCK_ADJUST_APPROVE')
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.inventoryChecks.detail(checkId),
    queryFn: () => inventoryChecksService.get(checkId),
  })
  const check = data?.data

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryChecks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }
  const approve = useMutation({
    mutationFn: () => inventoryChecksService.approve(Number(checkId)),
    onSuccess: () => {
      toast.success('Đã duyệt, tồn kho được điều chỉnh')
      setApproveOpen(false)
      refresh()
    },
    onError: (e) => {
      setApproveOpen(false)
      toast.error(getErrorMessage(e))
    },
  })
  const reject = useMutation({
    mutationFn: () => inventoryChecksService.reject(Number(checkId), reason.trim()),
    onSuccess: () => {
      toast.success('Đã từ chối phiếu kiểm kho')
      setRejectOpen(false)
      setReason('')
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
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
    { key: 'note', header: 'Giải trình', render: (l) => l.note ?? '—' },
  ]
  const counting = check.status === 'IN_PROGRESS' && canCreate
  const waiting = check.status === 'WAITING_APPROVAL'
  const snapshotTotal = check.lines.reduce((n, l) => n + l.snapshotQty, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Phiếu kiểm kê ${check.checkCode}`}
        description="Kiểm tra kết quả và giải trình khi quyết định phê duyệt điều chỉnh tồn."
        breadcrumbs={[{ label: 'Kiểm kê kho', to: '/inventory-checks' }, { label: check.checkCode }]}
        actions={<InventoryCheckStatusBadge status={check.status} />}
      />

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">Thông tin phiếu</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Người lập" value={check.createdByName} />
          <Info label="Thời điểm chụp tồn" value={formatDateTime(check.snapshotAt)} />
          <Info label="Gửi duyệt lúc" value={formatDateTime(check.submittedAt)} />
          <Info label={check.status === 'REJECTED' ? 'Từ chối bởi' : 'Duyệt bởi'} value={check.approvedByName ? `${check.approvedByName} · ${formatDateTime(check.approvedAt)}` : '—'} />
        </dl>
        <p className="mt-4 text-sm text-muted">Phạm vi: {check.scopeNote ?? '—'}</p>
      </section>

      {check.status === 'IN_PROGRESS' && (
        <div className="flex gap-2 rounded-xl border border-info/30 bg-info-soft p-3 text-sm text-info">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{check.lineCount} lô đang khóa trong phiếu này. Tồn sổ sách đã chụp lúc {formatDateTime(check.snapshotAt)} và không cập nhật theo tồn hiện tại.</span>
        </div>
      )}
      {waiting && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          Chờ phê duyệt, chưa có bút toán điều chỉnh tồn kho. Duyệt phiếu sẽ cộng phần chênh lệch vào tồn hiện tại của từng lô.
        </div>
      )}
      {check.status === 'REJECTED' && check.rejectReason && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <strong>Lý do từ chối:</strong> {check.rejectReason}
        </div>
      )}
      {check.status === 'NO_DIFFERENCE' && (
        <div className="rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success">
          Số đếm khớp sổ sách ở mọi lô nên phiếu tự hoàn tất, không cần duyệt.
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

      {waiting && canApprove && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-muted">Đang chờ quản lý duyệt. Chưa có bút toán điều chỉnh tồn kho.</p>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<X className="size-4" aria-hidden="true" />} onClick={() => setRejectOpen(true)}>
              Từ chối
            </Button>
            <Button icon={<Check className="size-4" aria-hidden="true" />} onClick={() => setApproveOpen(true)}>
              Duyệt phiếu
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={approveOpen}
        title="Duyệt điều chỉnh tồn kho?"
        message="Hệ thống cộng phần chênh lệch vào tồn hiện tại của từng lô và ghi thẻ kho. Không hoàn tác được."
        confirmLabel="Duyệt phiếu"
        loading={approve.isPending}
        onConfirm={() => approve.mutate()}
        onCancel={() => setApproveOpen(false)}
      />
      <Modal
        open={rejectOpen}
        title="Từ chối phiếu kiểm kho"
        onClose={() => setRejectOpen(false)}
        busy={reject.isPending}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>
              Hủy
            </Button>
            <Button variant="danger" loading={reject.isPending} disabled={reason.trim() === ''} onClick={() => reject.mutate()}>
              Từ chối phiếu
            </Button>
          </>
        }
      >
        <FieldShell id="reject-reason" label="Lý do từ chối" required hint="Bắt buộc. Tồn kho không bị điều chỉnh.">
          <textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </FieldShell>
      </Modal>
    </div>
  )
}
