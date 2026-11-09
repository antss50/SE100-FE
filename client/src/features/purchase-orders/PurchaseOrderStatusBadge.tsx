import { StatusBadge } from '../../components/ui'
import type { PurchaseOrderStatus } from '../../types/stock'

const META: Record<PurchaseOrderStatus, { tone: 'neutral' | 'success' | 'danger'; label: string }> = {
  DRAFT: { tone: 'neutral', label: 'Nháp' },
  COMPLETED: { tone: 'success', label: 'Hoàn tất' },
  CANCELLED: { tone: 'danger', label: 'Đã hủy' },
}

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const meta = META[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}
