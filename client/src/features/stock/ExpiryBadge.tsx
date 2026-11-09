import { StatusBadge } from '../../components/ui'
import type { ExpiryStatus } from '../../types/stock'

/** Nhãn hạn dùng: hết hạn (đỏ), cận hạn kèm số ngày (cam), còn hạn (xanh). */
export function ExpiryBadge({ status, days }: { status: ExpiryStatus; days: number }) {
  if (status === 'EXPIRED') return <StatusBadge tone="danger">Hết hạn</StatusBadge>
  if (status === 'NEAR_EXPIRY') return <StatusBadge tone="warning">Cận hạn · còn {days} ngày</StatusBadge>
  return <StatusBadge tone="success">Còn {days > 540 ? `${Math.floor(days / 30)} tháng` : `${days} ngày`}</StatusBadge>
}
