import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ConfirmDialog, NumberInput, toast } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { inventoryChecksService } from '../../services/inventory-checks.service'
import type { InventoryCheckDetail } from '../../types/inventory'
import { getErrorMessage } from '../../utils/error'
import { formatDate, formatNumber } from '../../utils/format'

interface Entry {
  counted: string
  note: string
}

const parseCount = (value: string): number | null => {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** Nhân viên kho được phân công nhập số lượng thực tế và ghi chú, bấm Hoàn tất kiểm kê (không cần bước duyệt). */
export function CheckCountingForm({ check }: { check: InventoryCheckDetail }) {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<Record<number, Entry>>(() =>
    Object.fromEntries(check.lines.map((l) => [l.id, { counted: l.countedQty === null ? '' : String(l.countedQty), note: l.note ?? '' }]))
  )
  const [cancelOpen, setCancelOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)

  const payload = () => ({
    lines: check.lines.map((l) => ({ lineId: l.id, countedQty: parseCount(entries[l.id].counted), note: entries[l.id].note })),
  })
  const filled = check.lines.filter((l) => parseCount(entries[l.id].counted) !== null).length
  const complete = filled === check.lines.length
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryChecks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }

  const save = useMutation({
    mutationFn: () => inventoryChecksService.saveCounts(check.id, payload()),
    onSuccess: () => {
      toast.success('Đã lưu nháp kết quả kiểm đếm')
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const submit = useMutation({
    mutationFn: () => inventoryChecksService.submit(check.id, payload()),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã hoàn tất kiểm kê')
      setCompleteOpen(false)
      refresh()
    },
    onError: (e) => {
      setCompleteOpen(false)
      toast.error(getErrorMessage(e))
    },
  })
  const cancel = useMutation({
    mutationFn: () => inventoryChecksService.cancel(check.id),
    onSuccess: () => {
      toast.success('Đã hủy phiếu, các lô được mở khóa')
      setCancelOpen(false)
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const busy = save.isPending || submit.isPending || cancel.isPending

  const set = (id: number, patch: Partial<Entry>) => setEntries((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }))

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
        <h2 className="text-sm font-bold text-ink">Nhập kết quả kiểm kê</h2>
        <div className="flex flex-1 items-center gap-3">
          <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-accent-soft" role="progressbar" aria-valuenow={filled} aria-valuemax={check.lines.length}>
            <div className="h-full bg-accent" style={{ width: `${(filled / Math.max(1, check.lines.length)) * 100}%` }} />
          </div>
          <span className="text-xs text-muted">
            Đã nhập {filled}/{check.lines.length} lô
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-accent-soft/60 text-left text-xs font-semibold text-muted">
              <th className="px-4 py-2">Sản phẩm / Mã lô</th>
              <th className="px-4 py-2">Hạn sử dụng</th>
              <th className="px-4 py-2 text-right">Tồn đã chụp</th>
              <th className="px-4 py-2 text-right">Thực tế</th>
              <th className="px-4 py-2 text-right">Chênh lệch</th>
              <th className="px-4 py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {check.lines.map((l) => {
              const counted = parseCount(entries[l.id].counted)
              const diff = counted === null ? null : counted - l.snapshotQty
              return (
                <tr key={l.id} className="border-t border-line align-top">
                  <td className="px-4 py-2">
                    <p className="font-medium">{l.productName}</p>
                    <p className="font-mono text-xs text-muted">
                      {l.sku} · {l.lotCode}
                    </p>
                  </td>
                  <td className="px-4 py-2">{formatDate(l.expDate)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(l.snapshotQty)}</td>
                  <td className="w-32 px-4 py-2">
                    <NumberInput
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="Chưa nhập"
                      aria-label={`Số đếm thực tế lô ${l.lotCode}`}
                      value={entries[l.id].counted}
                      onChange={(e) => set(l.id, { counted: e.target.value })}
                      className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {diff === null ? <span className="text-muted">—</span> : <span className={diff < 0 ? 'text-danger' : diff > 0 ? 'text-success' : ''}>{diff > 0 ? `+${diff}` : diff}</span>}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={entries[l.id].note}
                      maxLength={255}
                      aria-label={`Ghi chú lô ${l.lotCode}`}
                      placeholder="Ghi chú (tùy chọn)"
                      onChange={(e) => set(l.id, { note: e.target.value })}
                      className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line p-4 text-xs text-muted">
        Chênh lệch = số thực tế − tồn đã chụp. Ô để trống là chưa nhập (không tính là 0 hay chênh lệch âm); số 0 là kết quả đếm hợp lệ.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
        <p className="text-sm text-muted">
          {complete ? 'Đã nhập đủ số đếm, sẵn sàng hoàn tất kiểm kê.' : `Chưa thể hoàn tất: còn ${check.lines.length - filled} lô chưa nhập số đếm.`}
        </p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={() => setCancelOpen(true)} disabled={busy}>
            Hủy phiếu
          </Button>
          <Button variant="secondary" onClick={() => save.mutate()} loading={save.isPending} disabled={busy}>
            Lưu nháp
          </Button>
          <Button icon={<CheckCircle2 className="size-4" aria-hidden="true" />} onClick={() => setCompleteOpen(true)} loading={submit.isPending} disabled={busy || !complete}>
            Hoàn tất kiểm kê
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={completeOpen}
        title="Hoàn tất kiểm kê?"
        message="Hệ thống sẽ mở khóa các lô và tự động điều chỉnh tồn kho nếu có chênh lệch. Thao tác này không hoàn tác được."
        confirmLabel="Hoàn tất kiểm kê"
        loading={submit.isPending}
        onConfirm={() => submit.mutate()}
        onCancel={() => setCompleteOpen(false)}
      />
      <ConfirmDialog
        open={cancelOpen}
        tone="danger"
        title="Hủy phiếu kiểm kho?"
        message="Phiếu bị hủy sẽ không điều chỉnh tồn và các lô được mở khóa."
        confirmLabel="Hủy phiếu"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setCancelOpen(false)}
      />
    </section>
  )
}
