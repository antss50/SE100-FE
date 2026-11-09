import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { Button, ConfirmDialog, DataTable, ErrorState, LoadingState, Modal, PageHeader, toast, type Column } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { disposalsService } from '../../services/disposals.service'
import type { DisposalLine } from '../../types/inventory'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { DisposalStatusBadge, ISSUE_TYPE_LABEL, REASON_LABEL } from './disposal-meta'

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}

/** STK-06, STK-07: chi tiết phiếu xuất khác, duyệt hoặc từ chối. */
export function DisposalDetailPage() {
  const { disposalId = '' } = useParams()
  const queryClient = useQueryClient()
  const canApprove = useCan('STOCK_DISPOSAL_APPROVE')
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.disposals.detail(disposalId),
    queryFn: () => disposalsService.get(disposalId),
  })
  const disposal = data?.data

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.disposals.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }
  const approve = useMutation({
    mutationFn: () => disposalsService.approve(Number(disposalId)),
    onSuccess: () => {
      toast.success('Đã duyệt, tồn kho được trừ')
      setApproveOpen(false)
      refresh()
    },
    onError: (e) => {
      setApproveOpen(false)
      toast.error(getErrorMessage(e))
    },
  })
  const reject = useMutation({
    mutationFn: () => disposalsService.reject(Number(disposalId), reason.trim()),
    onSuccess: () => {
      toast.success('Đã từ chối, phần cách ly được trả lại')
      setRejectOpen(false)
      setReason('')
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (isLoading) return <LoadingState />
  if (error || !disposal) return <ErrorState message={getErrorMessage(error, 'Không tìm thấy phiếu xuất kho')} onRetry={() => void refetch()} />

  const columns: Column<DisposalLine>[] = [
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
    { key: 'qty', header: 'SL xuất', align: 'right', render: (l) => <span className="font-semibold">{formatNumber(l.quantity)}</span> },
    { key: 'blocked', header: 'Cách ly thêm khi lập', align: 'right', render: (l) => formatNumber(l.blockedAddedQty) },
    { key: 'cost', header: 'Giá vốn lô', align: 'right', render: (l) => (l.unitCost === null ? '—' : formatCurrency(l.unitCost)) },
    { key: 'note', header: 'Ghi chú', render: (l) => l.itemReason ?? '—' },
  ]
  const waiting = disposal.status === 'WAITING_APPROVAL'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Phiếu ${ISSUE_TYPE_LABEL[disposal.issueType].toLowerCase()} ${disposal.disposalCode}`}
        description="Xem xét đề nghị, đối chiếu lô trước khi phê duyệt."
        breadcrumbs={[{ label: 'Xuất hủy & Xuất đặc biệt', to: '/disposals' }, { label: disposal.disposalCode }]}
        actions={<DisposalStatusBadge status={disposal.status} />}
      />

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-ink">Thông tin đề nghị</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Loại phiếu" value={ISSUE_TYPE_LABEL[disposal.issueType]} />
          <Info label="Mã lý do" value={REASON_LABEL[disposal.reasonCode]} />
          <Info label="Người lập" value={disposal.requestedByName} />
          <Info label="Ngày lập" value={formatDateTime(disposal.createdAt)} />
          <Info label={disposal.status === 'REJECTED' ? 'Từ chối bởi' : 'Duyệt bởi'} value={disposal.approvedByName ? `${disposal.approvedByName} · ${formatDateTime(disposal.approvedAt)}` : '—'} />
          <Info label="Tổng giá trị vốn" value={disposal.totalCost === null ? 'Chốt khi duyệt' : formatCurrency(disposal.totalCost)} />
        </dl>
        <p className="mt-4 text-sm">
          <span className="text-muted">Diễn giải lý do: </span>
          {disposal.reason}
        </p>
      </section>

      {waiting && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          Chờ duyệt: hàng đã được cách ly nhưng chưa ghi nhận giảm tồn. Duyệt sẽ trừ tồn thực tế; từ chối sẽ trả lại phần cách ly.
        </div>
      )}
      {disposal.status === 'REJECTED' && disposal.rejectReason && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <strong>Lý do từ chối:</strong> {disposal.rejectReason}
        </div>
      )}
      {disposal.status === 'APPROVED' && disposal.issueType === 'TESTER' && (
        <div className="rounded-xl border border-info/30 bg-info-soft p-3 text-sm text-info">
          Sau khi duyệt hệ thống không theo dõi tiếp chai tester. Hạn dùng lô được in kèm để nhân viên biết khi nào thay.
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line p-4 text-sm font-bold text-ink">Danh sách lô ({disposal.lineCount})</h2>
        <DataTable caption="Các lô trong phiếu xuất" columns={columns} rows={disposal.lines} rowKey={(l) => l.id} />
        <p className="border-t border-line p-4 text-right text-lg font-bold text-accent">Tổng xuất: {formatNumber(disposal.totalQuantity)} sản phẩm</p>
      </section>

      {waiting && canApprove && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-sm text-muted">Đang chờ quyết định của quản lý.</p>
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
        title="Duyệt phiếu xuất kho?"
        message="Hệ thống trừ tồn thực tế và lượng cách ly của các lô, ghi thẻ kho và chốt giá vốn. Không hoàn tác được."
        confirmLabel="Duyệt phiếu"
        loading={approve.isPending}
        onConfirm={() => approve.mutate()}
        onCancel={() => setApproveOpen(false)}
      />
      <Modal
        open={rejectOpen}
        title="Từ chối phiếu xuất kho"
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
        <FieldShell id="disposal-reject-reason" label="Lý do từ chối" required hint="Bắt buộc. Phần cách ly thêm khi lập phiếu được trả lại.">
          <textarea
            id="disposal-reject-reason"
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
