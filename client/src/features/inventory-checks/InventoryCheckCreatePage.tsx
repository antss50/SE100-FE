import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Lock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, ConfirmDialog, PageHeader, toast } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { inventoryChecksService } from '../../services/inventory-checks.service'
import type { InventoryCheckType } from '../../types/inventory'
import type { StockBatchItem } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatNumber } from '../../utils/format'
import { LotPicker } from '../stock/LotPicker'
import { CHECK_TYPE_LABELS } from './InventoryCheckStatusBadge'

function defaultDateTimeLocal(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** Manager lên lịch kiểm kê: chọn loại kiểm kê, thời gian kiểm, nhân viên kho và danh sách lô/sản phẩm. */
export function InventoryCheckCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const initialIds = (location.state as { batchIds?: number[] } | null)?.batchIds ?? []

  const [checkType, setCheckType] = useState<InventoryCheckType>('WAREHOUSE')
  const [scheduledAt, setScheduledAt] = useState(defaultDateTimeLocal)
  const [assignedTo, setAssignedTo] = useState('')
  const [scopeNote, setScopeNote] = useState('')
  const [selected, setSelected] = useState<StockBatchItem[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const assigneesQuery = useQuery({
    queryKey: queryKeys.inventoryChecks.assignees,
    queryFn: () => inventoryChecksService.assignees(),
  })
  const assignees = assigneesQuery.data?.data ?? []

  useEffect(() => {
    if (!assignedTo && assignees.length === 1) {
      setAssignedTo(String(assignees[0].id))
    }
  }, [assignedTo, assignees])

  const handleChange = useCallback((items: StockBatchItem[]) => setSelected(items), [])

  const start = useMutation({
    mutationFn: () =>
      inventoryChecksService.create({
        checkType,
        scheduledAt: new Date(scheduledAt).toISOString(),
        assignedTo: Number(assignedTo),
        scopeNote: scopeNote.trim() || undefined,
        batchIds: selected.map((b) => b.id),
      }),
    onSuccess: (res) => {
      toast.success(`Đã lên lịch kiểm kê ${res.data.checkCode}`)
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
  const canSubmit = Boolean(scheduledAt) && Boolean(assignedTo) && selected.length > 0
  const selectedStaff = assignees.find((a) => String(a.id) === assignedTo)

  const inputClass =
    'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lên lịch kiểm kê"
        description="Phân công nhân viên kho kiểm kê theo thời gian dự kiến và danh sách sản phẩm/lô cần kiểm."
        breadcrumbs={[{ label: 'Kiểm kê kho', to: '/inventory-checks' }, { label: 'Lên lịch kiểm kê' }]}
        actions={
          <Button variant="secondary" onClick={() => navigate('/inventory-checks')}>
            Danh sách phiếu
          </Button>
        }
      />

      <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
        <FieldShell id="check-type" label="Loại kiểm kê" required>
          <select
            id="check-type"
            value={checkType}
            onChange={(e) => setCheckType(e.target.value as InventoryCheckType)}
            className={inputClass}
          >
            <option value="WAREHOUSE">{CHECK_TYPE_LABELS.WAREHOUSE}</option>
            <option value="DISPLAY">{CHECK_TYPE_LABELS.DISPLAY}</option>
          </select>
        </FieldShell>

        <FieldShell id="check-scheduled-at" label="Thời gian dự kiến kiểm" required>
          <input
            id="check-scheduled-at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={inputClass}
          />
        </FieldShell>

        <FieldShell id="check-assignee" label="Nhân viên kiểm (Inventory Staff)" required>
          <select
            id="check-assignee"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className={inputClass}
          >
            <option value="">Chọn nhân viên kho phụ trách</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.employeeCode} · {u.fullName}
              </option>
            ))}
          </select>
        </FieldShell>

        <FieldShell id="scope-note" label="Ghi chú phạm vi" hint="Mô tả khu vực, nhóm sản phẩm hoặc mục đích kiểm kê.">
          <input
            id="scope-note"
            value={scopeNote}
            maxLength={255}
            onChange={(e) => setScopeNote(e.target.value)}
            placeholder="Ví dụ: Kiểm kê nhóm chống nắng cuối tháng"
            className={inputClass}
          />
        </FieldShell>

        {checkType === 'DISPLAY' && (
          <p className="rounded-xl border border-info/30 bg-info-soft p-3 text-xs text-info md:col-span-2">
            Loại kiểm kê hàng trưng bày đã được ghi nhận trên lịch kiểm; quy tắc tách tồn riêng quầy trưng bày sẽ hoàn thiện theo nghiệp vụ chi tiết ở bước sau.
          </p>
        )}
      </section>

      <LotPicker
        initialIds={initialIds}
        onChange={handleChange}
        disabledReason={(b) => (b.lockedByCheckId ? 'Đang bị khóa bởi phiếu kiểm kho khác' : null)}
      />

      <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Các lô được chọn sẽ bị khóa tạm thời để nhân viên kho kiểm đếm chính xác; tồn kho sẽ tự động cập nhật ngay khi nhân viên hoàn tất kiểm kê.
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
          <Button icon={<CalendarClock className="size-4" aria-hidden="true" />} disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
            Lên lịch kiểm kê
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận lên lịch kiểm kê?"
        message={`Phân công ${selectedStaff?.fullName ?? 'nhân viên kho'} kiểm ${selected.length} lô (${CHECK_TYPE_LABELS[checkType]}). Các lô này tạm khóa cho đến khi kiểm kê hoàn tất hoặc bị hủy.`}
        confirmLabel="Lên lịch kiểm kê"
        loading={start.isPending}
        onConfirm={() => start.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
