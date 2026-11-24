import { StatusBadge, type StatusTone } from '../../components/ui'
import type { InventoryCheckStatus, InventoryCheckType } from '../../types/inventory'

export const CHECK_TYPE_LABELS: Record<InventoryCheckType, string> = {
  WAREHOUSE: 'Trong kho (theo lô)',
  DISPLAY: 'Hàng trưng bày (theo sản phẩm)',
}

const META: Record<InventoryCheckStatus, { tone: StatusTone; label: string }> = {
  IN_PROGRESS: { tone: 'info', label: 'Đang kiểm kê' },
  COMPLETED: { tone: 'success', label: 'Hoàn tất' },
  WAITING_APPROVAL: { tone: 'warning', label: 'Chờ duyệt' },
  APPROVED: { tone: 'success', label: 'Hoàn tất' },
  REJECTED: { tone: 'danger', label: 'Từ chối' },
  CANCELLED: { tone: 'neutral', label: 'Đã hủy' },
  NO_DIFFERENCE: { tone: 'success', label: 'Hoàn tất, không chênh lệch' },
}

export function InventoryCheckStatusBadge({ status }: { status: InventoryCheckStatus }) {
  const meta = META[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}

export function InventoryCheckTypeBadge({ checkType }: { checkType?: InventoryCheckType }) {
  const type = checkType ?? 'WAREHOUSE'
  return (
    <StatusBadge tone={type === 'DISPLAY' ? 'warning' : 'neutral'}>
      {type === 'DISPLAY' ? 'Hàng trưng bày' : 'Trong kho'}
    </StatusBadge>
  )
}
