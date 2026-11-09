import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button, Input, Modal, toast } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { shiftsService } from '../../services/shifts.service'
import type { CashierShift, ShiftSummary } from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency } from '../../utils/format'

const schema = z.object({
  actualCash: z.number({ error: 'Nhập số tiền thực đếm' }).int('Phải là số nguyên').min(0, 'Không được âm'),
  note: z.string().trim(),
})
type FormValues = z.infer<typeof schema>

interface CloseShiftModalProps {
  open: boolean
  shift: CashierShift
  summary: ShiftSummary
  onClose: () => void
}

/** POS-05: kiểm đếm tiền và chốt ca. Lệch tiền thì bắt buộc giải trình (luật 37); còn đơn nháp thì không chốt (luật 36). */
export function CloseShiftModal({ open, shift, summary, onClose }: CloseShiftModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { note: '' },
  })
  const actual = watch('actualCash')
  const entered = typeof actual === 'number' && Number.isFinite(actual)
  const difference = entered ? actual - summary.expectedCash : 0
  const hasDraft = summary.draftCount > 0

  const mutation = useMutation({
    mutationFn: (v: FormValues) => shiftsService.closeShift(shift.shiftId, { actualCash: v.actualCash, note: v.note || undefined }),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Chốt ca thành công')
      void queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
      onClose()
      navigate(`/shifts/${shift.shiftId}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const submit = (v: FormValues) => {
    if (difference !== 0 && !v.note) {
      setError('note', { message: 'Tiền lệch so với kỳ vọng, bắt buộc nhập giải trình' })
      return
    }
    mutation.mutate(v)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      title={`Kiểm đếm và chốt ca ${shift.shiftCode}`}
      description="Đếm tiền mặt thực tế trong két rồi nhập vào ô bên dưới. Ca đã chốt không phát sinh thêm chứng từ."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button type="submit" form="close-shift-form" loading={mutation.isPending} disabled={hasDraft}>
            Xác nhận chốt ca
          </Button>
        </>
      }
    >
      <form id="close-shift-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {hasDraft && (
          <p className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Ca còn {summary.draftCount} đơn nháp. Hoàn tất hoặc hủy các đơn nháp trước khi chốt ca (luật 36).
          </p>
        )}
        <div className="rounded-xl bg-card p-4">
          <p className="text-xs font-semibold text-muted">Tiền mặt kỳ vọng (sổ sách)</p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatCurrency(summary.expectedCash)}</p>
          <p className="mt-1 text-xs text-muted">
            {formatCurrency(shift.openingCash)} đầu ca + {formatCurrency(summary.cashCollected)} thu − {formatCurrency(summary.cashRefunded)} chi hoàn
          </p>
        </div>
        <Input
          label="Tiền mặt thực đếm (đ)"
          type="number"
          min={0}
          required
          error={errors.actualCash?.message}
          {...register('actualCash', { valueAsNumber: true })}
        />
        {entered && (
          <p className={difference === 0 ? 'text-sm text-success' : 'text-sm font-semibold text-danger'} aria-live="polite">
            {difference === 0
              ? 'Khớp với sổ sách.'
              : `Chênh lệch ${difference > 0 ? '+' : ''}${formatCurrency(difference)} (${difference < 0 ? 'thiếu' : 'thừa'} quỹ), cần giải trình.`}
          </p>
        )}
        <FieldShell
          id="close-shift-note"
          label="Giải trình chênh lệch"
          required={difference !== 0}
          error={errors.note?.message}
        >
          <textarea
            id="close-shift-note"
            rows={3}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            {...register('note')}
          />
        </FieldShell>
      </form>
    </Modal>
  )
}
