import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, ConfirmDialog, PageHeader, toast } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { inventoryChecksService } from '../../services/inventory-checks.service'
import type { StockBatchItem } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatNumber } from '../../utils/format'
import { LotPicker } from '../stock/LotPicker'

/** STK-04, bước 1: chọn phạm vi và các lô cần kiểm. Bắt đầu kiểm = chụp tồn + khóa lô (luật 32). */
export function InventoryCheckCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const initialIds = (location.state as { batchIds?: number[] } | null)?.batchIds ?? []
  const [scopeNote, setScopeNote] = useState('')
  const [selected, setSelected] = useState<StockBatchItem[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleChange = useCallback((items: StockBatchItem[]) => setSelected(items), [])

  const start = useMutation({
    mutationFn: () => inventoryChecksService.create({ scopeNote: scopeNote.trim() || undefined, batchIds: selected.map((b) => b.id) }),
    onSuccess: (res) => {
      toast.success(`Đã bắt đầu kiểm kê ${res.data.checkCode}`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryChecks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      navigate(`/inventory-checks/${res.data.id}`, { replace: true })
    },
    onError: (e) => {
      setConfirmOpen(false)
      toast.error(getErrorMessage(e))
    },
  })

  const totalQty = selected.reduce((n, b) => n + (b.onHandQty ?? 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tạo phiếu kiểm kê"
        description="Chọn các lô cần kiểm trước khi chụp tồn sổ sách."
        breadcrumbs={[{ label: 'Kiểm kê kho', to: '/inventory-checks' }, { label: 'Tạo phiếu' }]}
        actions={
          <Button variant="secondary" onClick={() => navigate('/inventory-checks')}>
            Danh sách phiếu
          </Button>
        }
      />
      <section className="rounded-2xl border border-line bg-white p-5">
        <FieldShell id="scope-note" label="Ghi chú phạm vi" hint="Mô tả khu vực, nhóm sản phẩm hoặc mục đích kiểm kê.">
          <input
            id="scope-note"
            value={scopeNote}
            maxLength={255}
            onChange={(e) => setScopeNote(e.target.value)}
            placeholder="Ví dụ: Kiểm kê nhóm chống nắng cuối tháng"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </FieldShell>
      </section>

      <LotPicker
        initialIds={initialIds}
        onChange={handleChange}
        disabledReason={(b) => (b.lockedByCheckId ? 'Đang bị khóa bởi phiếu kiểm kho khác' : null)}
      />

      <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Bắt đầu kiểm kê = chụp tồn + khóa lô.</strong> Tồn sổ sách được ghi tại thời điểm bấm và các lô đã chọn bị khóa,
          không bán và không nhập thêm cho tới khi gửi duyệt hoặc hủy phiếu. Số lượng thực tế nhập ở bước tiếp theo.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
        <p className="text-sm text-muted">
          Phạm vi đã chọn: <strong className="text-ink">{selected.length} lô</strong> · {formatNumber(totalQty)} sản phẩm theo sổ sách
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/inventory-checks')}>
            Hủy
          </Button>
          <Button icon={<Lock className="size-4" aria-hidden="true" />} disabled={selected.length === 0} onClick={() => setConfirmOpen(true)}>
            Bắt đầu kiểm kê
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Bắt đầu kiểm kê?"
        message={`Hệ thống chụp tồn và khóa ${selected.length} lô đã chọn. Các lô này tạm không bán được cho tới khi gửi duyệt hoặc hủy phiếu.`}
        confirmLabel="Bắt đầu kiểm kê"
        loading={start.isPending}
        onConfirm={() => start.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
