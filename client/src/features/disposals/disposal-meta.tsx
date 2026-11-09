import { StatusBadge, type StatusTone } from '../../components/ui'
import type { DisposalIssueType, DisposalReasonCode, DisposalStatus } from '../../types/inventory'

export const ISSUE_TYPE_LABEL: Record<DisposalIssueType, string> = {
  DESTROY: 'Xuất hủy',
  TESTER: 'Xuất tester',
  RETURN_TO_SUPPLIER: 'Trả nhà cung cấp',
}

export const ISSUE_TYPE_HINT: Record<DisposalIssueType, string> = {
  DESTROY: 'Tiêu hủy hàng hết hạn, hỏng hoặc bị thu hồi.',
  TESTER: 'Đưa ra quầy làm hàng dùng thử. Nên chọn lô cận hạn nhất.',
  RETURN_TO_SUPPLIER: 'Trả hàng lỗi hoặc bị thu hồi về nhà cung cấp.',
}

export const REASON_LABEL: Record<DisposalReasonCode, string> = {
  EXPIRED: 'Hết hạn',
  NEAR_EXPIRY: 'Cận hạn',
  DAMAGED: 'Hư hỏng',
  RECALL: 'Thu hồi',
  RETURN_DEFECT: 'Hàng lỗi trả NCC và Giao sai sản phẩm và Hàng thu hồi theo lô của NCC',
  TESTER_USE: 'Dùng làm tester',
}

/** Mã lý do hợp lệ theo từng loại phiếu (gợi ý ở giao diện). */
export const REASONS_BY_TYPE: Record<DisposalIssueType, DisposalReasonCode[]> = {
  DESTROY: ['EXPIRED', 'NEAR_EXPIRY', 'DAMAGED', 'RECALL'],
  TESTER: ['TESTER_USE'],
  RETURN_TO_SUPPLIER: ['RETURN_DEFECT'],
}

const STATUS: Record<DisposalStatus, { tone: StatusTone; label: string }> = {
  WAITING_APPROVAL: { tone: 'warning', label: 'Chờ duyệt' },
  APPROVED: { tone: 'success', label: 'Đã duyệt' },
  REJECTED: { tone: 'danger', label: 'Từ chối' },
}

export function DisposalStatusBadge({ status }: { status: DisposalStatus }) {
  const meta = STATUS[status]
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
}
