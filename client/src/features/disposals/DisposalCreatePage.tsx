import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button, ConfirmDialog, NumberInput, PageHeader, Select, cn, toast } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { disposalsService } from '../../services/disposals.service'
import type { DisposalIssueType, DisposalReasonCode } from '../../types/inventory'
import type { StockBatchItem } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatDate, formatNumber } from '../../utils/format'
import { LotPicker } from '../stock/LotPicker'
import { ISSUE_TYPE_HINT, ISSUE_TYPE_LABEL, REASONS_BY_TYPE, REASON_LABEL } from './disposal-meta'

const schema = z.object({
  issueType: z.enum(['DESTROY', 'TESTER', 'RETURN_TO_SUPPLIER']),
  reasonCode: z.string().min(1, 'Vui lòng chọn mã lý do'),
  reason: z.string().trim().min(1, 'Vui lòng nhập diễn giải lý do'),
}).superRefine(({ issueType, reasonCode }, ctx) => {
  if (!REASONS_BY_TYPE[issueType].includes(reasonCode as DisposalReasonCode)) {
    ctx.addIssue({ code: 'custom', path: ['reasonCode'], message: 'Mã lý do không phù hợp với loại phiếu' })
  }
})
type FormValues = z.infer<typeof schema>

interface LineEntry {
  quantity: string
  itemReason: string
}

const TYPES: DisposalIssueType[] = ['DESTROY', 'TESTER', 'RETURN_TO_SUPPLIER']

/** STK-06: lập phiếu xuất hủy / tester / trả NCC. Lập phiếu là cách ly hàng ngay, chưa trừ tồn. */
export function DisposalCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const state = (useLocation().state as { batchIds?: number[]; issueType?: DisposalIssueType } | null) ?? {}
  const [selected, setSelected] = useState<StockBatchItem[]>([])
  const [entries, setEntries] = useState<Record<number, LineEntry>>({})
  const [lineError, setLineError] = useState<string | null>(null)
  const [confirmValues, setConfirmValues] = useState<FormValues | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      issueType: state.issueType ?? 'DESTROY',
      reasonCode: state.issueType === 'TESTER' ? 'TESTER_USE' : '',
      reason: '',
    },
  })
  const issueType = useWatch({ control, name: 'issueType' })

  useEffect(() => {
    // Đổi loại phiếu: mã lý do cũ có thể không còn hợp lệ.
    setValue('reasonCode', REASONS_BY_TYPE[issueType].length === 1 ? REASONS_BY_TYPE[issueType][0] : '')
  }, [issueType, setValue])

  const handleChange = useCallback((items: StockBatchItem[]) => {
    setSelected(items)
    setEntries((cur) => Object.fromEntries(items.map((b) => [b.id, cur[b.id] ?? { quantity: '', itemReason: '' }])))
  }, [])

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      disposalsService.create({
        issueType: values.issueType,
        reasonCode: values.reasonCode as DisposalReasonCode,
        reason: values.reason.trim(),
        lines: selected.map((b) => ({
          batchId: b.id,
          quantity: Number(entries[b.id]?.quantity),
          itemReason: entries[b.id]?.itemReason.trim() || undefined,
        })),
      }),
    onSuccess: (res) => {
      toast.success(`Đã lập phiếu ${res.data.disposalCode}, hàng được cách ly chờ duyệt`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.disposals.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      navigate(`/disposals/${res.data.id}`, { replace: true })
    },
    onError: (e) => {
      setConfirmValues(null)
      toast.error(getErrorMessage(e))
    },
  })

  /** SL xuất là số nguyên > 0 và không vượt tồn thực tế của lô. */
  const validateLines = (): boolean => {
    if (selected.length === 0) {
      setLineError('Chọn ít nhất một lô cần xuất')
      return false
    }
    for (const b of selected) {
      const q = Number(entries[b.id]?.quantity)
      if (!Number.isInteger(q) || q < 1) {
        setLineError(`Lô ${b.lotCode}: số lượng xuất phải là số nguyên lớn hơn 0`)
        return false
      }
      if (q > (b.onHandQty ?? 0)) {
        setLineError(`Lô ${b.lotCode}: số lượng xuất vượt tồn thực tế (${b.onHandQty})`)
        return false
      }
    }
    setLineError(null)
    return true
  }

  const totalQty = selected.reduce((n, b) => n + (Number(entries[b.id]?.quantity) || 0), 0)

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={handleSubmit((values) => {
        if (validateLines()) setConfirmValues(values)
      })}
    >
      <PageHeader
        title="Tạo phiếu xuất đặc biệt"
        description="Chọn loại phiếu, lý do và các lô cần xuất. Hàng được cách ly ngay khi lập phiếu; quản lý duyệt mới trừ tồn."
        breadcrumbs={[{ label: 'Xuất hủy & Xuất đặc biệt', to: '/disposals' }, { label: 'Tạo phiếu' }]}
        actions={
          <Button variant="secondary" onClick={() => navigate('/disposals')}>
            Danh sách phiếu
          </Button>
        }
      />

      <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-bold text-ink">Loại phiếu & thông tin đề nghị</h2>
        <div role="radiogroup" aria-label="Loại phiếu" className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t}
              className={cn(
                'cursor-pointer rounded-xl border p-3 text-sm transition',
                issueType === t ? 'border-accent bg-accent-soft' : 'border-line hover:bg-card'
              )}
            >
              <input type="radio" value={t} className="sr-only" {...register('issueType')} />
              <span className="block font-semibold text-ink">{ISSUE_TYPE_LABEL[t]}</span>
              <span className="mt-1 block text-xs text-muted">{ISSUE_TYPE_HINT[t]}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Mã lý do"
            required
            placeholder="Chọn mã lý do"
            options={REASONS_BY_TYPE[issueType].map((c) => ({ value: c, label: REASON_LABEL[c] }))}
            error={errors.reasonCode?.message}
            {...register('reasonCode')}
          />
          <FieldShell id="disposal-reason" label="Diễn giải lý do" required error={errors.reason?.message}>
            <input
              id="disposal-reason"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              {...register('reason')}
            />
          </FieldShell>
        </div>
      </section>

      <LotPicker
        initialIds={state.batchIds}
        onChange={handleChange}
        disabledReason={(b) => {
          if (b.lockedByCheckId) return 'Đang khóa kiểm kho, không thể chọn'
          if (!b.isSellable && issueType === 'RETURN_TO_SUPPLIER') return 'Tester hãng chỉ xuất bằng phiếu tester hoặc hủy'
          return null
        }}
      />

      {selected.length > 0 && (
        <section className="rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line p-4 text-sm font-bold text-ink">Số lượng xuất ({selected.length} lô)</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-accent-soft/60 text-left text-xs font-semibold text-muted">
                  <th className="px-4 py-2">Sản phẩm / Mã lô</th>
                  <th className="px-4 py-2">HSD</th>
                  <th className="px-4 py-2 text-right">Tồn kho</th>
                  <th className="px-4 py-2 text-right">SL xuất</th>
                  <th className="px-4 py-2">Ghi chú / điều kiện</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((b) => (
                  <tr key={b.id} className="border-t border-line align-top">
                    <td className="px-4 py-2">
                      <p className="font-medium">{b.productName}</p>
                      <p className="font-mono text-xs text-muted">
                        {b.sku} · {b.lotCode}
                      </p>
                    </td>
                    <td className="px-4 py-2">{formatDate(b.expDate)}</td>
                    <td className="px-4 py-2 text-right">{formatNumber(b.onHandQty)}</td>
                    <td className="w-28 px-4 py-2">
                      <NumberInput
                        type="number"
                        min={1}
                        max={b.onHandQty}
                        aria-label={`Số lượng xuất lô ${b.lotCode}`}
                        value={entries[b.id]?.quantity ?? ''}
                        onChange={(e) => setEntries((cur) => ({ ...cur, [b.id]: { ...cur[b.id], quantity: e.target.value } }))}
                        className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        aria-label={`Ghi chú lô ${b.lotCode}`}
                        maxLength={255}
                        value={entries[b.id]?.itemReason ?? ''}
                        onChange={(e) => setEntries((cur) => ({ ...cur, [b.id]: { ...cur[b.id], itemReason: e.target.value } }))}
                        className="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {lineError && (
        <p role="alert" className="text-sm text-danger">
          {lineError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
        <p className="text-sm text-muted">
          Đã chọn {selected.length} lô · tổng SL xuất {formatNumber(totalQty)}. Phiếu gửi duyệt sẽ cách ly hàng ngay, chưa trừ tồn.
        </p>
        <Button type="submit" icon={<Send className="size-4" aria-hidden="true" />} loading={create.isPending}>
          Gửi duyệt
        </Button>
      </div>

      <ConfirmDialog
        open={confirmValues !== null}
        title="Gửi phiếu chờ duyệt?"
        message="Hàng trong phiếu được cách ly ngay (không bán được) cho tới khi quản lý duyệt hoặc từ chối."
        confirmLabel="Gửi duyệt"
        loading={create.isPending}
        onConfirm={() => confirmValues && create.mutate(confirmValues)}
        onCancel={() => setConfirmValues(null)}
      />
    </form>
  )
}
