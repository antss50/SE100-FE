import { useState } from 'react'
import { X } from 'lucide-react'
import { Button, Input, toast } from '../../components/ui'
import { customersService } from '../../services/customers.service'
import { getErrorMessage } from '../../utils/error'

export interface VoucherCustomer {
  id: number
  name: string
  phone: string | null
}

interface VoucherCustomerFieldProps {
  value: VoucherCustomer | null
  onChange: (customer: VoucherCustomer | null) => void
  disabled?: boolean
}

/** PROM-02 (D43): voucher riêng 1 khách. Tìm khách theo SĐT; để trống = voucher chung. */
export function VoucherCustomerField({ value, onChange, disabled }: VoucherCustomerFieldProps) {
  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)

  const search = async () => {
    if (!phone.trim()) return
    setSearching(true)
    try {
      const found = await customersService.findByPhone(phone)
      if (!found || found.id === undefined) {
        toast.error('Không tìm thấy khách hàng với số điện thoại này')
        return
      }
      onChange({ id: found.id, name: found.fullName, phone: found.phoneNumber })
      setPhone('')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium text-ink">Chỉ dành cho khách (không bắt buộc)</p>
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-line bg-accent-soft px-3 py-2 text-sm">
          <span>
            {value.name} {value.phone ? `· ${value.phone}` : ''} — chỉ khách này dùng được voucher
          </span>
          {!disabled && (
            <button
              type="button"
              aria-label="Bỏ chọn khách"
              className="rounded-md p-1 text-muted hover:bg-black/5"
              onClick={() => onChange(null)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <Input
            label="Số điện thoại khách"
            containerClassName="flex-1"
            value={phone}
            disabled={disabled}
            hint="Để trống = voucher chung cho mọi khách"
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void search()
              }
            }}
          />
          <Button type="button" variant="secondary" loading={searching} disabled={disabled} onClick={() => void search()}>
            Tìm khách
          </Button>
        </div>
      )}
    </div>
  )
}
