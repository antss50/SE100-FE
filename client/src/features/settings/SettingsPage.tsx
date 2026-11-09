import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button, ErrorState, Input, LoadingState, PageHeader, toast } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { settingsService } from '../../services/settings.service'
import type { SettingKey, SettingsData } from '../../types/settings'
import { getErrorMessage } from '../../utils/error'

const wholeNumber = (min: number, max?: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'Phải là số nguyên không âm')
    .refine((v) => Number(v) >= min, `Phải từ ${min} trở lên`)
    .refine((v) => max === undefined || Number(v) <= max, `Không được vượt quá ${max}`)

const schema = z.object({
  EXPIRY_WARNING_DAYS: wholeNumber(0, 3650),
  POINT_EARN_AMOUNT: wholeNumber(1),
  POINT_REDEEM_VALUE: wholeNumber(1),
  POINT_MAX_REDEEM_PERCENT: wholeNumber(1, 100),
  maxReturnDays: wholeNumber(0, 365),
  STORE_NAME: z.string().trim().min(1, 'Vui lòng nhập tên cửa hàng'),
  STORE_ADDRESS: z.string().trim().min(1, 'Vui lòng nhập địa chỉ'),
  STORE_PHONE: z.string().trim().min(1, 'Vui lòng nhập số điện thoại'),
})
type FormValues = z.infer<typeof schema>

const valueOf = (data: SettingsData, key: SettingKey) => data.settings.find((s) => s.key === key)?.value ?? ''

function toForm(data: SettingsData): FormValues {
  return {
    EXPIRY_WARNING_DAYS: valueOf(data, 'EXPIRY_WARNING_DAYS'),
    POINT_EARN_AMOUNT: valueOf(data, 'POINT_EARN_AMOUNT'),
    POINT_REDEEM_VALUE: valueOf(data, 'POINT_REDEEM_VALUE'),
    POINT_MAX_REDEEM_PERCENT: valueOf(data, 'POINT_MAX_REDEEM_PERCENT'),
    maxReturnDays: String(data.maxReturnDays),
    STORE_NAME: valueOf(data, 'STORE_NAME'),
    STORE_ADDRESS: valueOf(data, 'STORE_ADDRESS'),
    STORE_PHONE: valueOf(data, 'STORE_PHONE'),
  }
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-muted">{description}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/** AUTH-07: cấu hình hệ thống (SYSTEM_SETTINGS và thời hạn đổi trả). Các tham số chỉnh được, không phải luật cố định. */
export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => settingsService.get() })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data) reset(toForm(data.data))
  }, [data, reset])

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      settingsService.update({
        maxReturnDays: Number(v.maxReturnDays),
        settings: {
          EXPIRY_WARNING_DAYS: v.EXPIRY_WARNING_DAYS,
          POINT_EARN_AMOUNT: v.POINT_EARN_AMOUNT,
          POINT_REDEEM_VALUE: v.POINT_REDEEM_VALUE,
          POINT_MAX_REDEEM_PERCENT: v.POINT_MAX_REDEEM_PERCENT,
          STORE_NAME: v.STORE_NAME,
          STORE_ADDRESS: v.STORE_ADDRESS,
          STORE_PHONE: v.STORE_PHONE,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã lưu cấu hình hệ thống')
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6" noValidate>
      <PageHeader
        title="Cấu hình hệ thống"
        description="Tham số chỉnh được của cửa hàng. Luật cố định (FEFO, đổi trả, ca...) không chỉnh ở đây."
        breadcrumbs={[{ label: 'Hệ thống' }, { label: 'Cấu hình hệ thống' }]}
        actions={
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Lưu cấu hình
          </Button>
        }
      />
      <Section title="Kho và hạn dùng" description="Cảnh báo cận hạn trên màn tồn kho và POS.">
        <Input label="Số ngày cảnh báo cận hạn" inputMode="numeric" hint="Lô còn ít hơn số ngày này là cận hạn" error={errors.EXPIRY_WARNING_DAYS?.message} {...register('EXPIRY_WARNING_DAYS')} />
      </Section>
      <Section title="Điểm thưởng" description="Tích điểm chạy ngay khi hoàn tất đơn; điểm dùng trừ trên phần tiền còn lại sau 3 tầng khuyến mãi.">
        <Input label="Số tiền để được 1 điểm (đ)" inputMode="numeric" error={errors.POINT_EARN_AMOUNT?.message} {...register('POINT_EARN_AMOUNT')} />
        <Input label="Giá trị 1 điểm khi đổi (đ)" inputMode="numeric" error={errors.POINT_REDEEM_VALUE?.message} {...register('POINT_REDEEM_VALUE')} />
        <Input label="Điểm dùng tối đa (% giá trị đơn)" inputMode="numeric" error={errors.POINT_MAX_REDEEM_PERCENT?.message} {...register('POINT_MAX_REDEEM_PERCENT')} />
      </Section>
      <Section title="Chính sách đổi trả" description="Hàng lỗi hoàn tiền hoặc đổi, khách đổi ý chỉ đổi hàng là luật cố định; chỉ thời hạn chỉnh được.">
        <Input label="Thời hạn đổi trả (ngày kể từ ngày mua)" inputMode="numeric" error={errors.maxReturnDays?.message} {...register('maxReturnDays')} />
      </Section>
      <Section title="Thông tin cửa hàng" description="In trên hóa đơn.">
        <Input label="Tên cửa hàng" required error={errors.STORE_NAME?.message} {...register('STORE_NAME')} />
        <Input label="Số điện thoại" required error={errors.STORE_PHONE?.message} {...register('STORE_PHONE')} />
        <Input label="Địa chỉ" required containerClassName="sm:col-span-2" error={errors.STORE_ADDRESS?.message} {...register('STORE_ADDRESS')} />
      </Section>
    </form>
  )
}
