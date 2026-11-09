import { StatusBadge, type StatusTone } from '../../components/ui'
import type { InventoryCheckStatus } from '../../types/inventory'

const META: Record<InventoryCheckStatus, { tone: StatusTone; label: string }> = {
  IN_PROGRESS: { tone: 'info', label: 'Đang kiểm kê' },
  WAITING_APPROVAL: { tone: 'warning', label: 'Chờ duyệt' },
  APPROVED: { tone: 'success', label: 'Đã duyệt' },
  REJECTED: { tone: 'danger', label: 'Từ chối' },
  CANCELLED: { tone: 'neutral', label: 'Đã hủy' },
  NO_DIFFERENCE: { tone: 'success', label: 'Hoàn tất, không chênh lệch' },
}

export function InventoryCheckStatusBadge({ status }: { status: InventoryCheckStatus }) {
  const meta = META[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}
