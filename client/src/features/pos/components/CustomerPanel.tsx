import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, X } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { useCan } from '../../../app/usePermission'
import { Button, Input, Modal, StatusBadge, toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/query-keys'
import { customersService } from '../../../services/customers.service'
import type { OrderQuote } from '../../../types/pos'
import { getErrorMessage } from '../../../utils/error'
import { formatCurrency, formatNumber } from '../../../utils/format'
import { usePosStore } from '../pos-store'

interface CustomerPanelProps {
  phoneRef: RefObject<HTMLInputElement | null>
  quote: OrderQuote | undefined
  disabled: boolean
}

/** CUS-04: tìm khách theo SĐT (F3) hoặc tạo nhanh; dùng điểm thưởng (tối đa theo POINT_MAX_REDEEM_PERCENT, luật 44). */
export function CustomerPanel({ phoneRef, quote, disabled }: CustomerPanelProps) {
  const queryClient = useQueryClient()
  const canRedeem = useCan('LOYALTY_REDEEM')
  const customerId = usePosStore((s) => s.customerId)
  const pointsRequested = usePosStore((s) => s.pointsRequested)
  const setCustomer = usePosStore((s) => s.setCustomer)
  const setPoints = usePosStore((s) => s.setPoints)
  const [phone, setPhone] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const customer = useQuery({
    queryKey: queryKeys.customers.detail(customerId ?? 0),
    queryFn: () => customersService.getCustomerByCode(String(customerId)),
    enabled: customerId !== null,
  }).data?.data

  const search = useMutation({
    mutationFn: (value: string) => customersService.findByPhone(value),
    onSuccess: (found) => {
      if (!found) {
        setCreating(true)
        return
      }
      if (found.status !== 'ACTIVE') {
        toast.error('Khách hàng đã bị khóa ưu đãi, không thể gắn vào đơn')
        return
      }
      setCustomer(found.id)
      setPhone('')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const create = useMutation({
    mutationFn: () => customersService.createCustomer({ fullName: newName, phoneNumber: phone }),
    onSuccess: (res) => {
      toast.success('Đã tạo khách hàng mới')
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      setCustomer(res.data.id)
      setCreating(false)
      setPhone('')
      setNewName('')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const maxPoints = quote?.maxRedeemablePoints ?? 0

  return (
    <section className="rounded-2xl border border-line bg-white p-4" aria-label="Khách hàng">
      <h2 className="mb-3 text-base font-bold text-ink">Khách hàng</h2>
      {customer ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">{customer.fullName}</p>
              <p className="text-xs text-muted">
                {customer.phoneNumber} · {customer.customerCode}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusBadge tone="accent">{customer.tier.tierName}</StatusBadge>
                <span className="text-xs text-muted">Chi tiêu {formatCurrency(customer.totalSpent)}</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Bỏ khách hàng"
              disabled={disabled}
              onClick={() => setCustomer(null)}
              className="rounded-lg p-1.5 text-muted hover:bg-card"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {canRedeem && (
            <div className="rounded-xl bg-card p-3">
              <p className="text-xs text-muted">
                Điểm khả dụng <strong className="text-ink">{formatNumber(customer.rewardPoints)}</strong> · dùng tối đa{' '}
                <strong className="text-ink">{formatNumber(maxPoints)}</strong> điểm cho đơn này
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={maxPoints}
                  value={pointsRequested || ''}
                  disabled={disabled}
                  aria-label="Số điểm muốn dùng"
                  onChange={(e) => setPoints(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  placeholder="0"
                />
                <Button size="sm" variant="secondary" disabled={disabled || maxPoints === 0} onClick={() => setPoints(maxPoints)}>
                  Dùng tối đa
                </Button>
              </div>
              {quote && quote.pointsUsed > 0 && (
                <p className="mt-1.5 text-xs font-medium text-success">
                  Đã trừ {formatNumber(quote.pointsUsed)} điểm = {formatCurrency(quote.pointsDiscountAmount)}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (phone.trim()) search.mutate(phone)
          }}
          className="flex gap-2"
        >
          <label className="relative flex-1">
            <span className="sr-only">Số điện thoại khách hàng (F3)</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              ref={phoneRef}
              value={phone}
              disabled={disabled}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="SĐT khách hàng (F3), bỏ trống = khách vãng lai"
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-neutral-soft"
            />
          </label>
          <Button type="submit" variant="secondary" loading={search.isPending} disabled={disabled}>
            Tìm
          </Button>
        </form>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        size="sm"
        busy={create.isPending}
        title="Tạo khách hàng nhanh"
        description={`Chưa có khách với SĐT ${phone}. Nhập họ tên để tạo hồ sơ (hạng khởi điểm).`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={create.isPending}>
              Hủy
            </Button>
            <Button
              icon={<UserPlus className="size-4" aria-hidden="true" />}
              loading={create.isPending}
              disabled={!newName.trim()}
              onClick={() => create.mutate()}
            >
              Tạo và gắn vào đơn
            </Button>
          </>
        }
      >
        <Input label="Họ tên khách hàng" required value={newName} onChange={(e) => setNewName(e.target.value)} />
      </Modal>
    </section>
  )
}
