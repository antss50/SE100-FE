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
  /** Chỉ số dòng trong phiếu (bắt đầu từ 0). */
  lineIndex: number
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

// ---- STK-02, STK-03: tồn kho theo lô, cận hạn ----

export type ExpiryStatus = 'OK' | 'NEAR_EXPIRY' | 'EXPIRED'

/**
 * Một lô trong màn tồn kho. Người chỉ có `STOCK_VIEW_AVAILABLE` (thu ngân) chỉ nhận
 * các trường tồn khả dụng: `onHandQty`, `blockedQty`, `costPrice` vắng mặt (luật phân quyền REP/STK-02).
 */
export interface StockBatchItem {
  id: number
  productId: number
  sku: string
  productName: string
  barcode?: string | null
  brandName?: string
  categoryName?: string
  unit: string
  isSellable: boolean
  lotCode: string
  mfgDate?: string | null
  expDate: string
  daysToExpiry: number
  expiryStatus: ExpiryStatus
  /** Tồn bán được = onHand − blocked, chỉ khi còn hạn và không bị khóa kiểm kho (luật 24). */
  availableQty: number
  /** Thứ tự FEFO trong sản phẩm (1 = xuất trước); null nếu lô không bán được. */
  fefoRank: number | null
  onHandQty?: number
  blockedQty?: number
  costPrice?: number
  lockedByCheckId?: number | null
  createdAt?: string
}

export interface StockSummary {
  /** Số SKU đang có tồn. */
  skuCount: number
  lotCount: number
  nearExpiryLots: number
  expiredLots: number
  quarantinedUnits: number
  quarantinedValue: number
  expiryWarningDays: number
}

export interface StockMovementItem extends StockMovement {
  createdByName?: string
  referenceCode?: string
}

export interface StockBatchDetail extends StockBatchItem {
  supplierName?: string
  retailPrice: number
  /** Lượng đang nằm trong phiếu xuất hủy / tester / trả NCC chờ duyệt. */
  pendingDisposalQty: number
  movements: StockMovementItem[]
}

export type StockExpiryFilter = 'ALL' | 'WARNING' | 'NEAR_EXPIRY' | 'EXPIRED' | 'OK'

export interface GetStockBatchesParams {
  keyword?: string
  expiry?: StockExpiryFilter
  categoryCode?: string
  productId?: number
  /** `true` = chỉ lô có hàng cách ly. */
  quarantined?: boolean
  /** `true` = chỉ lô còn tồn thực tế > 0. */
  inStockOnly?: boolean
  page?: number
  pageSize?: number
}

export interface FefoLookupResult {
  productId: number
  sku: string
  productName: string
  barcode?: string | null
  /** Các lô bán được, sắp theo FEFO (hạn sớm trước). */
  batches: StockBatchItem[]
}
