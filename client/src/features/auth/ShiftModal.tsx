import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useUiStore } from '../../app/store'
import { useCan } from '../../app/usePermission'
import { Button, Input, Modal, toast } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { shiftsService } from '../../services/shifts.service'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime } from '../../utils/format'

const schema = z.object({
  openingCash: z
    .number({ error: 'Nhập số tiền đầu ca' })
    .int('Số tiền phải là số nguyên')
    .min(0, 'Số tiền đầu ca không được âm'),
})
type FormValues = z.infer<typeof schema>

/** POS-01: mở ca. Khi đã có ca mở thì dẫn sang màn Quản lý ca để kiểm đếm và chốt ca (POS-05). */
export function ShiftModal() {
  const open = useUiStore((s) => s.isShiftModalOpen)
  const close = useUiStore((s) => s.closeShiftModal)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const canOpen = useCan('POS_SHIFT_OPEN')

  const { data } = useQuery({
    queryKey: queryKeys.shifts.current,
    queryFn: () => shiftsService.getCurrentShift(),
    enabled: open,
  })
  const shift = data?.data.shift ?? null

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { openingCash: 2000000 } })

  const mutation = useMutation({
    mutationFn: (v: FormValues) => shiftsService.openShift(v.openingCash),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Mở ca làm việc thành công')
      void queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
      close()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Modal
      open={open}
      onClose={close}
      busy={mutation.isPending}
      size="sm"
      title={shift ? 'Ca làm việc đang mở' : 'Mở ca làm việc'}
      description={
        shift
          ? 'Mỗi thu ngân chỉ có một ca đang mở. Chốt ca để kiểm đếm tiền trong két.'
          : 'Nhập tiền mặt có sẵn trong két đầu ca. Chưa mở ca thì không lập được đơn hàng.'
      }
      footer={
        shift ? (
          <>
            <Button variant="secondary" onClick={close}>
              Đóng
            </Button>
            <Button
              onClick={() => {
                close()
                navigate('/shifts', { state: { closeShift: true } })
              }}
            >
              Chốt ca và kiểm đếm
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
              Hủy
            </Button>
            {canOpen && (
              <Button type="submit" form="open-shift-form" loading={mutation.isPending}>
                Mở ca
              </Button>
            )}
          </>
        )
      }
    >
      {shift ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Mã ca</dt>
            <dd className="font-mono font-semibold">{shift.shiftCode}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Mở lúc</dt>
            <dd>{formatDateTime(shift.openedAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Tiền đầu ca</dt>
            <dd className="font-semibold">{formatCurrency(shift.openingCash)}</dd>
          </div>
        </dl>
      ) : canOpen ? (
        <form id="open-shift-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
          <Input
            label="Tiền mặt đầu ca (đ)"
            type="text"
            inputMode="numeric"
            formatThousands
            required
            error={errors.openingCash?.message}
            {...register('openingCash', { valueAsNumber: true })}
          />
        </form>
      ) : (
        <p className="text-sm text-muted">Tài khoản của bạn không có quyền mở ca.</p>
      )}
    </Modal>
  )
}
