/** Kiểu dữ liệu kiểm kho và xuất kho khác (DATABASE.md mục 14-17). */

export type InventoryCheckStatus =
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'NO_DIFFERENCE'

export interface InventoryCheckLine {
  id: number
  batchId: number
  productId: number
  sku: string
  productName: string
  lotCode: string
  expDate: string
  /** Tồn sổ sách lúc chụp. */
  snapshotQty: number
  /** NULL khi chưa nhập: ô trống không phải là 0 (luật 32). */
  countedQty: number | null
  /** `countedQty − snapshotQty`; NULL đến khi gửi duyệt. */
  differenceQty: number | null
  note?: string | null
}

export interface InventoryCheck {
  id: number
  checkCode: string
  scopeNote?: string | null
  status: InventoryCheckStatus
  snapshotAt: string
  createdBy: number
  createdByName: string
  submittedAt?: string | null
  approvedBy?: number | null
  approvedByName?: string | null
  approvedAt?: string | null
  rejectReason?: string | null
  lineCount: number
  /** Số dòng có chênh lệch (chỉ có nghĩa sau khi gửi duyệt). */
  differenceLineCount: number
  /** Tổng chênh lệch (có dấu) sau khi gửi duyệt. */
  totalDifference: number
}

export interface InventoryCheckDetail extends InventoryCheck {
  lines: InventoryCheckLine[]
}

export interface InventoryCheckCreateInput {
  scopeNote?: string
  batchIds: number[]
}

export interface InventoryCheckCountInput {
  lines: { lineId: number; countedQty: number | null; note?: string }[]
}

export interface GetInventoryChecksParams {
  keyword?: string
  status?: InventoryCheckStatus | 'ALL'
  page?: number
  pageSize?: number
}

export type DisposalIssueType = 'DESTROY' | 'TESTER' | 'RETURN_TO_SUPPLIER'

export type DisposalReasonCode =
  | 'EXPIRED'
  | 'NEAR_EXPIRY'
  | 'DAMAGED'
  | 'RECALL'
  | 'RETURN_DEFECT'
  | 'TESTER_USE'

export type DisposalStatus = 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface DisposalLine {
  id: number
  batchId: number
  productId: number
  sku: string
  productName: string
  lotCode: string
  expDate: string
  quantity: number
  /** Lượng hệ thống cách ly thêm khi lập phiếu (trả lại nếu từ chối). */
  blockedAddedQty: number
  /** Giá vốn lô, chụp lúc duyệt. */
  unitCost: number | null
  itemReason?: string | null
}

export interface Disposal {
  id: number
  disposalCode: string
  issueType: DisposalIssueType
  reasonCode: DisposalReasonCode
  status: DisposalStatus
  reason: string
  requestedBy: number
  requestedByName: string
  createdAt: string
  approvedBy?: number | null
  approvedByName?: string | null
  approvedAt?: string | null
  rejectReason?: string | null
  lineCount: number
  totalQuantity: number
  /** Σ quantity × unitCost; NULL đến khi duyệt. */
  totalCost: number | null
}

export interface DisposalDetail extends Disposal {
  lines: DisposalLine[]
}

export interface DisposalCreateInput {
  issueType: DisposalIssueType
  reasonCode: DisposalReasonCode
  reason: string
  lines: { batchId: number; quantity: number; itemReason?: string }[]
}

export interface GetDisposalsParams {
  keyword?: string
  status?: DisposalStatus | 'ALL'
  issueType?: DisposalIssueType | 'ALL'
  page?: number
  pageSize?: number
}
