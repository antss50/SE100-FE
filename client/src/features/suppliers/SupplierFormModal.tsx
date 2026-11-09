import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button, Input, Modal, toast } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { suppliersService } from '../../services/suppliers.service'
import type { SupplierItem } from '../../types/suppliers'
import { getErrorMessage } from '../../utils/error'

const schema = z.object({
  supplierName: z.string().trim().min(1, 'Vui lòng nhập tên nhà cung cấp'),
  taxCode: z.string().trim().optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[0-9 ]{10,13}$/, 'Số điện thoại không hợp lệ (10–11 số)'),
  email: z.union([z.email('Email không hợp lệ'), z.literal('')]).optional(),
  address: z.string().trim().min(1, 'Vui lòng nhập địa chỉ'),
  contactPerson: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  supplierName: '',
  taxCode: '',
  phoneNumber: '',
  email: '',
  address: '',
  contactPerson: '',
  note: '',
}

interface SupplierFormModalProps {
  open: boolean
  /** Có giá trị thì sửa, không thì thêm mới. */
  supplier?: SupplierItem | null
  onClose: () => void
  onSaved?: (supplier: SupplierItem) => void
}

/** SUPP-01: thêm / sửa nhà cung cấp. Mã NCC do hệ thống sinh nên không có ô nhập. */
export function SupplierFormModal({ open, supplier, onClose, onSaved }: SupplierFormModalProps) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    reset(
      supplier
        ? {
            supplierName: supplier.supplierName,
            taxCode: supplier.taxCode ?? '',
            phoneNumber: supplier.phoneNumber,
            email: supplier.email ?? '',
            address: supplier.address,
            contactPerson: supplier.contactPerson ?? '',
            note: supplier.note ?? '',
          }
        : EMPTY
    )
  }, [open, supplier, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      supplier ? suppliersService.update(supplier.id, values) : suppliersService.create(values),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã lưu nhà cung cấp')
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      onSaved?.(res.data)
      onClose()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      size="lg"
      title={supplier ? `Sửa nhà cung cấp ${supplier.supplierCode}` : 'Thêm nhà cung cấp'}
      description="Không quản lý công nợ. Ngừng hợp tác chỉ ẩn nhà cung cấp khỏi phiếu nhập mới, không xóa dữ liệu."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button type="submit" form="supplier-form" loading={mutation.isPending}>
            {supplier ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'}
          </Button>
        </>
      }
    >
      <form
        id="supplier-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        <Input
          label="Tên công ty"
          required
          containerClassName="sm:col-span-2"
          error={errors.supplierName?.message}
          {...register('supplierName')}
        />
        <Input label="Mã số thuế" error={errors.taxCode?.message} {...register('taxCode')} />
        <Input label="Người đại diện liên hệ" error={errors.contactPerson?.message} {...register('contactPerson')} />
        <Input
          label="Số điện thoại"
          required
          inputMode="tel"
          error={errors.phoneNumber?.message}
          {...register('phoneNumber')}
        />
        <Input label="Email đặt hàng" type="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Địa chỉ"
          required
          containerClassName="sm:col-span-2"
          error={errors.address?.message}
          {...register('address')}
        />
        <FieldShell id="supplier-note" label="Ghi chú chính sách chiết khấu" className="sm:col-span-2">
          <textarea
            id="supplier-note"
            rows={3}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            {...register('note')}
          />
        </FieldShell>
      </form>
    </Modal>
  )
}
