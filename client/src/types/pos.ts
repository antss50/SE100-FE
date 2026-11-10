/** Kiểu dữ liệu bán hàng, ca, đổi trả (DATABASE.md mục 25-30). */
import type { ShiftInfo } from './api'

export type OrderStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD'
export type OrderLineType = 'NORMAL' | 'GIFT'
export type ReturnReason = 'DEFECTIVE' | 'CHANGE_OF_MIND'
export type RefundMethod = 'CASH' | 'BANK_TRANSFER' | 'EXCHANGE'
export type ItemCondition = 'INTACT' | 'DAMAGED_OR_OPENED'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Quẹt thẻ',
}

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DEFECTIVE: 'Hàng lỗi, hư, hết hạn',
  CHANGE_OF_MIND: 'Khách đổi ý',
}

/** Một dòng ORDER_DETAILS (mỗi dòng gắn một lô). */
export interface OrderLine {
  id: number
  productId: number
  sku: string
  productName: string
  batchId: number
  lotCode: string
  expDate: string
  quantity: number
  unitPrice: number
  costPrice: number
  taxRate: number
  taxAmount: number
  lineType: OrderLineType
  linePromotionId: number | null
  promoGroupNo: number | null
  lineDiscount: number
  tierDiscount: number
  orderDiscount: number
  pointsDiscount: number
  lineTotal: number
}

/** Mục trong giỏ: `batchId` có giá trị = thu ngân đổi lô thủ công (luật 27). */
export interface CartItemInput {
  productId: number
  quantity: number
  batchId?: number | null
}

export interface CartInput {
  items: CartItemInput[]
  customerId: number | null
  voucherCode: string | null
  pointsRequested: number
  /** Đơn mua hàng đổi của phiếu trả này (POS-04). */
  exchangeReturnId?: number | null
}

/** Bảng ORDERS (kèm dòng chi tiết); đơn nháp lưu thêm giỏ hàng. */
export interface OrderRecord {
  id: number
  orderCode: string
  shiftId: number
  cashierId: number
  cashierName: string
  customerId: number | null
  customerName: string | null
  customerPhone: string | null
  policyId: number
  orderPromotionId: number | null
  orderPromotionName: string | null
  voucherCode: string | null
  subtotalAmount: number
  lineDiscountAmount: number
  tierDiscountAmount: number
  orderDiscountAmount: number
  pointsUsed: number
  pointsDiscountAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  exchangeReturnId: number | null
  exchangeCreditAmount: number
  paymentMethod: PaymentMethod | null
  amountReceived: number | null
  changeDue: number | null
  status: OrderStatus
  createdAt: string
  completedAt: string | null
  /** Điểm đã tích của đơn (POINT_HISTORIES EARN), cần khi thu hồi lúc trả hàng. */
  pointsEarned: number
  lines: OrderLine[]
  /** Chỉ đơn nháp. */
  draftCart: (CartInput & { amountReceived?: number | null }) | null
}

/** Danh sách đơn: bỏ dòng chi tiết cho nhẹ. */
export type OrderListItem = Omit<OrderRecord, 'lines' | 'draftCart'> & { lineCount: number }

/** Một lô được phân bổ cho dòng khi bán (FEFO hoặc thủ công). */
export interface LotAllocation {
  batchId: number
  lotCode: string
  expDate: string
  quantity: number
  /** true = lô do thu ngân chọn tay, khác lô FEFO đầu tiên. */
  overridden: boolean
}

export interface QuoteLine {
  key: string
  productId: number
  sku: string
  productName: string
  quantity: number
  unitPrice: number
  lineType: OrderLineType
  linePromotionId: number | null
  linePromotionName: string | null
  promoGroupNo: number | null
  lineDiscount: number
  tierDiscount: number
  orderDiscount: number
  pointsDiscount: number
  lineTotal: number
  taxAmount: number
  allocations: LotAllocation[]
}

export interface QuoteIssue {
  productId: number
  message: string
}

export interface OrderQuote {
  lines: QuoteLine[]
  subtotalAmount: number
  lineDiscountAmount: number
  tierDiscountAmount: number
  orderPromotionId: number | null
  orderPromotionName: string | null
  orderDiscountAmount: number
  pointsUsed: number
  pointsDiscountAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  exchangeCreditAmount: number
  /** Tiền khách phải nộp = totalAmount − exchangeCreditAmount. */
  amountDue: number
  messages: string[]
  issues: QuoteIssue[]
  /** Điểm sẽ được tích khi hoàn tất (nếu có khách đang hoạt động). */
  pointsToEarn: number
  maxRedeemablePoints: number
}

export interface CompleteOrderRequest extends CartInput {
  paymentMethod: PaymentMethod
  amountReceived?: number | null
  /** Id đơn nháp đang hoàn tất (nếu có). */
  draftId?: number | null
}

export interface GetOrdersParams {
  keyword?: string
  status?: OrderStatus | 'ALL'
  paymentMethod?: PaymentMethod | 'ALL'
  fromDate?: string
  toDate?: string
  shiftId?: number
  page?: number
  pageSize?: number
}

/** Sản phẩm bán được trên POS (tồn bán được, không lộ onHand/blocked/giá vốn). */
export interface PosProduct {
  id: number
  sku: string
  barcode: string | null
  productName: string
  brandName: string | null
  categoryName: string | null
  retailPrice: number
  sellableQty: number
  /** Lô FEFO đầu tiên (hạn gần nhất). */
  firstLotCode: string | null
  firstLotExpDate: string | null
  nearExpiry: boolean
}

export interface PosLot {
  batchId: number
  lotCode: string
  expDate: string
  sellableQty: number
  nearExpiry: boolean
}

// ---------- Ca ----------

export interface CashierShift extends ShiftInfo {
  shiftCode: string
  cashierName: string
  closedAt: string | null
  expectedCash: number | null
  actualCash: number | null
  differenceAmount: number | null
  note: string | null
  handoverConfirmedBy: number | null
  handoverConfirmedByName: string | null
}

/** Tổng hợp tiền của ca (tính từ đơn và phiếu trả, không lưu). */
export interface ShiftSummary {
  orderCount: number
  returnCount: number
  draftCount: number
  cashSales: number
  transferSales: number
  cardSales: number
  /** Tiền mặt phải nộp của đơn = total − exchangeCredit, chỉ đơn CASH. */
  cashCollected: number
  cashRefunded: number
  expectedCash: number
  totalSales: number
  totalRefunded: number
}

export interface ShiftDetail {
  shift: CashierShift
  summary: ShiftSummary
  orders: OrderListItem[]
  returns: ReturnListItem[]
}

export interface CloseShiftRequest {
  actualCash: number
  note?: string
}

export interface GetShiftsParams {
  status?: 'OPEN' | 'CLOSED' | 'ALL'
  keyword?: string
  page?: number
  pageSize?: number
}

// ---------- Đổi trả ----------

export interface ReturnLineRecord {
  id: number
  orderDetailId: number
  productId: number
  sku: string
  productName: string
  batchId: number
  lotCode: string
  quantity: number
  lineKind: 'RETURN' | 'GIFT_CHARGE'
  refundAmount: number
  unitCost: number
  itemCondition: ItemCondition
}

export interface ReturnOrderRecord {
  id: number
  returnCode: string
  originalOrderId: number
  originalOrderCode: string
  shiftId: number
  processedBy: number
  processedByName: string
  returnReason: ReturnReason
  returnNote: string | null
  totalRefundAmount: number
  refundMethod: RefundMethod
  pointsRevoked: number
  status: 'COMPLETED' | 'CANCELLED'
  createdAt: string
  lines: ReturnLineRecord[]
  /** Đơn mua hàng đổi (nếu đã hoàn tất). */
  exchangeOrderId: number | null
  exchangeOrderCode: string | null
}

export type ReturnListItem = Omit<ReturnOrderRecord, 'lines'> & { lineCount: number }

export interface ReturnItemInput {
  orderDetailId: number
  quantity: number
  condition: ItemCondition
}

export interface ReturnQuoteRequest {
  originalOrderId: number
  reason: ReturnReason
  items: ReturnItemInput[]
}

export interface ReturnQuote {
  lines: {
    orderDetailId: number
    kind: 'RETURN' | 'GIFT_CHARGE'
    quantity: number
    refundAmount: number
    toBlocked: boolean
    productName: string
  }[]
  totalRefund: number
  pointsRevoked: number
  messages: string[]
  /** Hình thức hoàn thực tế sau khi xét két (luật 23). */
  refundMethod: RefundMethod
  cashShortfall: boolean
}

export interface CreateReturnRequest extends ReturnQuoteRequest {
  note?: string
  /** Hoàn tiền: CASH hoặc BANK_TRANSFER; đổi ý bắt buộc EXCHANGE. */
  refundMethod: RefundMethod
}

/** Dòng của đơn gốc kèm số còn trả được (màn tạo phiếu trả). */
export interface ReturnableLine extends OrderLine {
  returnedQuantity: number
  returnableQuantity: number
}

export interface ReturnableOrder {
  order: OrderRecord
  lines: ReturnableLine[]
  maxReturnDays: number
  daysSincePurchase: number
  expired: boolean
}

export interface GetReturnsParams {
  keyword?: string
  reason?: ReturnReason | 'ALL'
  page?: number
  pageSize?: number
}
