/** Kiểu dữ liệu kho: lô, thẻ kho, phiếu nhập (DATABASE.md mục 12, 13, 19, 20). */

export type PurchaseOrderStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'

export type StockReferenceType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'CHECK_ADJUST'
  | 'DISPOSAL'
  | 'TESTER'
  | 'SUPPLIER_RETURN'

/** Bảng BATCHES (lưu trong mock). `productId` là PRODUCTS.id. */
export interface Batch {
  id: number
  productId: number
  lotCode: string
  mfgDate?: string | null
  expDate: string
  costPrice: number
  onHandQty: number
  blockedQty: number
  lockedByCheckId?: number | null
  createdAt: string
}

/** Bảng STOCK_MOVEMENTS (thẻ kho). */
export interface StockMovement {
  id: number
  batchId: number
  referenceType: StockReferenceType
  referenceId: number
  quantityChange: number
  balanceAfter: number
  reason?: string | null
  createdBy?: number | null
  createdAt: string
}

export interface PurchaseOrderLine {
  id: number
  productId: number
  sku: string
  productName: string
  lotCode: string
  mfgDate?: string | null
  expDate: string
  quantity: number
  unitCost: number
  lineTotal: number
  /** NULL khi còn nháp; gán khi xác nhận. */
  batchId?: number | null
  /** Cờ chỉ có khi xem chi tiết phiếu nháp: lô đã tồn tại trong kho. */
  existingBatch?: boolean
}

export interface PurchaseOrder {
  id: number
  poCode: string
  supplierId: number
  supplierCode: string
  supplierName: string
  supplierInvoiceNo?: string | null
  totalAmount: number
  status: PurchaseOrderStatus
  note?: string | null
  createdBy: number
  createdByName: string
  createdAt: string
  confirmedAt?: string | null
  lineCount: number
  totalQuantity: number
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  lines: PurchaseOrderLine[]
}

export type PurchaseWarningType = 'ROTATE_SHELF' | 'NEAR_EXPIRY' | 'EXPIRED' | 'COST_AVERAGED'

/** Cảnh báo khi xem trước / xác nhận phiếu nhập (luật 29, 31). */
export interface PurchaseWarning {
  type: PurchaseWarningType
  lineId?: number
  sku: string
  lotCode: string
  message: string
}

export interface PurchaseOrderLineInput {
  productId: number
  lotCode: string
  mfgDate?: string
  expDate: string
  quantity: number
  unitCost: number
}

export interface PurchaseOrderInput {
  supplierId: number
  supplierInvoiceNo?: string
  note?: string
  lines: PurchaseOrderLineInput[]
}

export interface GetPurchaseOrdersParams {
  keyword?: string
  status?: PurchaseOrderStatus | 'ALL'
  supplierId?: number
  page?: number
  pageSize?: number
}

export interface ConfirmPurchaseOrderResult {
  order: PurchaseOrderDetail
  warnings: PurchaseWarning[]
}
