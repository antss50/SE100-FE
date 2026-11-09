import { calculateReturn, type Promotion as DomainPromotion, type StoredLine } from '../domain/pricing'
import type {
  CashierShift,
  OrderRecord,
  RefundMethod,
  ReturnItemInput,
  ReturnQuote,
  ReturnQuoteRequest,
  ReturnableOrder,
} from '../types/pos'
import { daysUntilExpiry } from '../domain/stock/batch'
import type { MockTransaction } from './db'
import { MockHttpError } from './http'
import { buildUsageIndex, toDomainPromotions } from './promotion-engine'
import { domainProducts } from './sales-engine'
import { cashInDrawer } from './sales-views'
import { todayOf } from './stock-ledger'

export function findOrderForReturn(db: MockTransaction, orderId: number): OrderRecord {
  const order = db.read('orders').find((o) => o.id === orderId)
  if (!order) throw new MockHttpError(404, 'POS_ORDER_NOT_FOUND', 'Không tìm thấy hóa đơn gốc')
  if (order.status !== 'COMPLETED') {
    throw new MockHttpError(422, 'RET_ORDER_NOT_COMPLETED', 'Chỉ trả hàng cho hóa đơn đã hoàn tất')
  }
  return order
}

/** Σ số lượng và tiền đã xử lý theo từng dòng gốc ở các phiếu trả trước (kể cả dòng GIFT_CHARGE). */
export function returnHistory(db: MockTransaction, orderId: number): Map<number, { quantity: number; amount: number }> {
  const history = new Map<number, { quantity: number; amount: number }>()
  for (const r of db.read('returns')) {
    if (r.originalOrderId !== orderId || r.status !== 'COMPLETED') continue
    for (const l of r.lines) {
      const prev = history.get(l.orderDetailId) ?? { quantity: 0, amount: 0 }
      history.set(l.orderDetailId, { quantity: prev.quantity + l.quantity, amount: prev.amount + l.refundAmount })
    }
  }
  return history
}

/** Thông tin để màn tạo phiếu trả: số còn trả được từng dòng, hạn đổi trả. */
export function describeReturnable(db: MockTransaction, order: OrderRecord, now: Date): ReturnableOrder {
  const history = returnHistory(db, order.id)
  const policy = db.read('returnPolicies').find((p) => p.id === order.policyId) ?? db.read('returnPolicies')[0]
  const maxReturnDays = policy?.maxReturnDays ?? 7
  const days = daysSince(order, now)
  return {
    order,
    maxReturnDays,
    daysSincePurchase: days,
    expired: days > maxReturnDays,
    lines: order.lines.map((l) => {
      const returned = history.get(l.id)?.quantity ?? 0
      return { ...l, returnedQuantity: returned, returnableQuantity: l.quantity - returned }
    }),
  }
}

function daysSince(order: OrderRecord, now: Date): number {
  return daysUntilExpiry(todayOf(now), (order.completedAt ?? order.createdAt).slice(0, 10))
}

export interface EvaluatedReturn {
  order: OrderRecord
  quote: ReturnQuote
  items: ReturnItemInput[]
  /** Hình thức hoàn thực tế sau khi xét két (luật 23). */
  refundMethod: RefundMethod
}

/**
 * Kiểm luật đổi trả (14-23) rồi tính tiền bằng `domain/pricing/returns` (không tính lại khuyến mãi).
 * `shift` là ca hiện tại của người xử lý, dùng để xét két có đủ tiền mặt hay không.
 */
export function evaluateReturn(
  db: MockTransaction,
  req: ReturnQuoteRequest & { refundMethod?: RefundMethod },
  shift: CashierShift | null,
  now: Date
): EvaluatedReturn {
  const order = findOrderForReturn(db, req.originalOrderId)
  const info = describeReturnable(db, order, now)
  if (info.expired) {
    throw new MockHttpError(
      422,
      'RET_EXPIRED',
      `Đã quá thời hạn đổi trả ${info.maxReturnDays} ngày (mua cách đây ${info.daysSincePurchase} ngày)`
    )
  }
  if (req.items.length === 0) throw new MockHttpError(422, 'RET_NO_ITEMS', 'Chọn ít nhất một sản phẩm để trả')
  if (req.reason === 'CHANGE_OF_MIND' && req.items.some((i) => i.condition === 'DAMAGED_OR_OPENED')) {
    throw new MockHttpError(422, 'RET_SEAL_BROKEN', 'Khách đổi ý chỉ nhận hàng còn nguyên seal; hàng đã mở thì từ chối, không lập phiếu')
  }
  const ids = req.items.map((i) => i.orderDetailId)
  if (new Set(ids).size !== ids.length) throw new MockHttpError(422, 'RET_DUPLICATE_LINE', 'Mỗi dòng hàng chỉ chọn một lần')
  for (const item of req.items) {
    const line = info.lines.find((l) => l.id === item.orderDetailId)
    if (!line) throw new MockHttpError(404, 'RET_LINE_NOT_FOUND', 'Dòng hàng không thuộc hóa đơn gốc')
    if (item.quantity <= 0 || item.quantity > line.returnableQuantity) {
      throw new MockHttpError(
        422,
        'RET_QUANTITY_EXCEEDED',
        `${line.productName}: chỉ còn trả được tối đa ${line.returnableQuantity}`
      )
    }
  }

  const usage = buildUsageIndex(db)
  const promotions = new Map<number, DomainPromotion>(toDomainPromotions(db, null, usage).map((p) => [p.id, p]))
  const stored: StoredLine[] = order.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    lineType: l.lineType,
    linePromotionId: l.linePromotionId,
    promoGroupNo: l.promoGroupNo,
    lineDiscount: l.lineDiscount,
    tierDiscount: l.tierDiscount,
    orderDiscount: l.orderDiscount,
    pointsDiscount: l.pointsDiscount,
    lineTotal: l.lineTotal,
    taxAmount: l.taxAmount,
    orderDetailId: l.id,
    batchId: l.batchId,
  }))
  let result
  try {
    result = calculateReturn({
      order: { totalAmount: order.totalAmount, pointsEarned: order.pointsEarned },
      lines: stored,
      history: returnHistory(db, order.id),
      items: req.items,
      reason: req.reason,
      promotions,
      products: domainProducts(db),
    })
  } catch (e) {
    throw new MockHttpError(422, 'RET_INVALID', e instanceof Error ? e.message : 'Phiếu trả không hợp lệ')
  }

  // Đổi ý chỉ đổi hàng; hàng lỗi hoàn tiền hoặc đổi. Két thiếu tiền mặt thì hoàn chuyển khoản (luật 23).
  let refundMethod: RefundMethod = req.reason === 'CHANGE_OF_MIND' ? 'EXCHANGE' : (req.refundMethod ?? 'CASH')
  if (req.reason === 'CHANGE_OF_MIND' && req.refundMethod && req.refundMethod !== 'EXCHANGE') {
    throw new MockHttpError(422, 'RET_REFUND_NOT_ALLOWED', 'Khách đổi ý chỉ được đổi hàng, không hoàn tiền')
  }
  let cashShortfall = false
  if (refundMethod === 'CASH' && shift && cashInDrawer(db, shift) < result.totalRefund) {
    refundMethod = 'BANK_TRANSFER'
    cashShortfall = true
  }
  const names = new Map(order.lines.map((l) => [l.id, l.productName]))
  const quote: ReturnQuote = {
    lines: result.lines.map((l) => ({ ...l, productName: names.get(l.orderDetailId) ?? '' })),
    totalRefund: result.totalRefund,
    pointsRevoked: result.pointsRevoked,
    messages: result.messages,
    refundMethod,
    cashShortfall,
  }
  return { order, quote, items: req.items, refundMethod }
}
