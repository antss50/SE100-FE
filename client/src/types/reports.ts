/** Kiểu dữ liệu báo cáo (REP-01..06, PROM-04). Công thức: DANH_GIA_USECASE mục 2.7, luật 53-56. */
import type { PaymentMethod } from './pos'
import type { DisposalIssueType } from './inventory'

export type ReportGranularity = 'DAY' | 'WEEK' | 'MONTH'

/** Khoảng ngày `YYYY-MM-DD`, `fromDate ≤ toDate` (luật 55 mục báo cáo). */
export interface ReportRange {
  fromDate: string
  toDate: string
}

export interface ReportParams extends Partial<ReportRange> {
  granularity?: ReportGranularity
  /** `true` = kèm số kỳ trước (cùng độ dài, liền trước `fromDate`). */
  compare?: boolean
}

// ---------- REP-02 doanh thu & lợi nhuận gộp ----------

export interface RevenueFigures {
  orderCount: number
  returnCount: number
  /** Σ subtotalAmount đơn COMPLETED theo `completedAt` (luật 53). */
  grossAmount: number
  /** Σ discountAmount; tách 4 loại bên dưới. */
  discountAmount: number
  lineDiscountAmount: number
  tierDiscountAmount: number
  orderDiscountAmount: number
  pointsDiscountAmount: number
  /** Σ totalRefundAmount phiếu trả COMPLETED theo ngày trả (luật 54). */
  returnedAmount: number
  /** Tiền hàng − giảm giá − hàng bán bị trả (luật 55). */
  netRevenue: number
  /** VAT (giá đã gồm VAT) của doanh thu thuần. */
  vatAmount: number
  netRevenueExVat: number
  /** Chỉ có khi người xem có `REPORT_PROFIT` (Manager không thấy). */
  cogs?: number
  grossProfit?: number
  marginPercent?: number
}

export interface RevenuePoint extends RevenueFigures {
  /** Ngày đầu kỳ `YYYY-MM-DD`. */
  periodStart: string
  label: string
}

export interface RevenueReport {
  range: ReportRange
  granularity: ReportGranularity
  showProfit: boolean
  totals: RevenueFigures
  previousRange: ReportRange | null
  previous: RevenueFigures | null
  series: RevenuePoint[]
}

// ---------- REP-03 bán hàng ----------

export interface SalesProductRow {
  productId: number
  sku: string
  productName: string
  quantity: number
  returnedQuantity: number
  revenue: number
  returnedAmount: number
}

export interface SalesPaymentRow {
  method: PaymentMethod
  orderCount: number
  amount: number
}

export interface SalesCashierRow {
  cashierId: number
  cashierName: string
  orderCount: number
  amount: number
  returnCount: number
  returnedAmount: number
}

export interface SalesShiftRow {
  shiftId: number
  shiftCode: string
  cashierName: string
  openedAt: string
  closedAt: string | null
  status: 'OPEN' | 'CLOSED'
  orderCount: number
  amount: number
  differenceAmount: number | null
}

export interface SalesReport {
  range: ReportRange
  /** `OWN` = thu ngân chỉ thấy dữ liệu của mình (`REPORT_SALES_OWN_SHIFT`). */
  scope: 'ALL' | 'OWN'
  summary: {
    orderCount: number
    totalAmount: number
    averageOrderValue: number
    itemsSold: number
    returnCount: number
    returnedAmount: number
  }
  topProducts: SalesProductRow[]
  slowProducts: SalesProductRow[]
  byPayment: SalesPaymentRow[]
  byCashier: SalesCashierRow[]
  byShift: SalesShiftRow[]
}

// ---------- REP-04 tồn kho & hạn dùng ----------

export interface StockReportProductRow {
  productId: number
  sku: string
  productName: string
  categoryName: string
  onHandQty: number
  blockedQty: number
  availableQty: number
  value: number
  minStockAlert: number
  belowMin: boolean
}

export interface StockReportLotRow {
  batchId: number
  sku: string
  productName: string
  lotCode: string
  expDate: string
  daysToExpiry: number
  onHandQty: number
  blockedQty: number
  value: number
  daysInStock: number
}

export interface StockReportDisposalRow {
  issueType: DisposalIssueType
  count: number
  quantity: number
  totalCost: number
}

export interface StockReport {
  range: ReportRange
  summary: {
    skuCount: number
    lotCount: number
    totalQty: number
    inventoryValue: number
    blockedQty: number
    belowMinCount: number
    nearExpiryLots: number
    nearExpiryValue: number
    expiredLots: number
    expiredValue: number
    /** Giá trị hàng hủy (phiếu DESTROY đã duyệt trong kỳ): tổn thất. */
    disposalLoss: number
  }
  products: StockReportProductRow[]
  belowMinProducts: StockReportProductRow[]
  nearExpiryLots: StockReportLotRow[]
  expiredLots: StockReportLotRow[]
  disposals: StockReportDisposalRow[]
}

// ---------- REP-05 nhập hàng ----------

export interface PurchaseSupplierRow {
  supplierId: number
  supplierName: string
  orderCount: number
  quantity: number
  amount: number
}

export interface PurchaseBrandRow {
  brandName: string
  quantity: number
  amount: number
}

export interface PurchasePoint {
  periodStart: string
  label: string
  orderCount: number
  amount: number
}

export interface PurchaseReport {
  range: ReportRange
  granularity: ReportGranularity
  summary: { orderCount: number; quantity: number; totalAmount: number; supplierCount: number }
  bySupplier: PurchaseSupplierRow[]
  byBrand: PurchaseBrandRow[]
  series: PurchasePoint[]
}

// ---------- REP-06 khách hàng ----------

export interface CustomerTierRow {
  tierCode: string
  tierName: string
  customerCount: number
  totalSpent: number
}

export interface CustomerTopRow {
  customerId: number
  customerCode: string
  fullName: string
  tierName: string
  orderCount: number
  spent: number
}

export interface CustomerPoint {
  periodStart: string
  label: string
  newCustomers: number
}

export interface CustomerReport {
  range: ReportRange
  granularity: ReportGranularity
  summary: {
    totalCustomers: number
    newCustomers: number
    activeBuyers: number
    returningBuyers: number
    pointsEarned: number
    pointsRedeemed: number
    pointsRevoked: number
  }
  byTier: CustomerTierRow[]
  topSpenders: CustomerTopRow[]
  series: CustomerPoint[]
}

// ---------- REP-01 dashboard ----------

export interface DashboardAlertLot {
  batchId: number
  sku: string
  productName: string
  lotCode: string
  expDate: string
  daysToExpiry: number
  onHandQty: number
}

export interface DashboardLowStock {
  productId: number
  sku: string
  productName: string
  onHandQty: number
  minStockAlert: number
}

export interface DashboardSalesWidget {
  todayRevenue: number
  todayOrders: number
  yesterdayRevenue: number
  openShifts: number
  last7Days: { date: string; label: string; netRevenue: number; orderCount: number }[]
}

export interface DashboardStockWidget {
  nearExpiry: DashboardAlertLot[]
  expired: DashboardAlertLot[]
  lowStock: DashboardLowStock[]
}

export interface DashboardPending {
  waitingChecks: number
  waitingDisposals: number
}

export interface DashboardData {
  generatedAt: string
  /** Vắng mặt nếu người xem chỉ có widget kho. */
  sales: DashboardSalesWidget | null
  stock: DashboardStockWidget
  pending: DashboardPending
}

// ---------- PROM-04 hiệu quả khuyến mãi ----------

export interface PromotionEffectDay {
  date: string
  usageCount: number
  discountAmount: number
  revenue: number
}

export interface PromotionEffectCustomer {
  customerId: number
  customerName: string
  usageCount: number
  discountAmount: number
  revenue: number
}

export interface PromotionEffect {
  promotionId: number
  promotionName: string
  range: ReportRange
  /** Số đơn COMPLETED có dùng khuyến mãi. */
  usageCount: number
  /** Tiền giảm do chính khuyến mãi này tạo ra. */
  totalDiscount: number
  /** Σ totalAmount của các đơn đó. */
  revenue: number
  customerCount: number
  averageOrderValue: number
  topCustomers: PromotionEffectCustomer[]
  byDay: PromotionEffectDay[]
}

// ---------- AUTH-06 nhật ký hệ thống ----------

export type AuditModule =
  | 'AUTH'
  | 'USER'
  | 'ROLE'
  | 'SETTING'
  | 'PRODUCT'
  | 'SUPPLIER'
  | 'STOCK'
  | 'POS'
  | 'CUSTOMER'
  | 'PROMOTION'

/** Bảng AUDIT_LOGS (DATABASE.md mục 6). */
export interface AuditLogRecord {
  id: number
  userId: number | null
  userName: string
  roleCode: string
  action: string
  module: AuditModule
  entityType: string | null
  entityId: string | null
  /** Giá trị trước/sau (JSON dạng chuỗi) hoặc ghi chú ngắn. */
  details: AuditDetails | null
  ipAddress: string
  createdAt: string
}

export interface AuditDetails {
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  note?: string
}

export interface GetAuditLogsParams {
  userId?: number
  action?: string
  module?: string
  fromDate?: string
  toDate?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface AuditLogsData {
  items: AuditLogRecord[]
  page: number
  pageSize: number
  totalItems: number
  /** Giá trị có thật trong nhật ký, để dựng ô lọc. */
  facets: { users: { id: number; name: string }[]; actions: string[] }
}
