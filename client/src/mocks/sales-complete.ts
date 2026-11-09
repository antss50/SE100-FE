import { splitByBatches } from '../domain/pricing'
import type { CustomerItem } from '../types/api'
import type { CashierShift, CompleteOrderRequest, OrderLine, OrderRecord } from '../types/pos'
import { appendAuditLog } from './handlers/rbac'
import type { MockTransaction } from './db'
import { MockHttpError } from './http'
import { recordPoints, tierForSpend, tierRankOf } from './loyalty'
import { priceCart, voucherRejection } from './sales-engine'
import type { MockUser } from './seed/users'
import { applyStockChange, assertBatchNotLocked, findBatchById } from './stock-ledger'
import { toDateOnly, toIsoLocal } from './time'

export function currentShiftOf(db: MockTransaction, userId: number | undefined): CashierShift {
  const shift = db.read('shifts').find((s) => s.cashierId === userId && s.status === 'OPEN')
  if (!shift) throw new MockHttpError(409, 'POS_SHIFT_NOT_OPEN', 'Chưa mở ca làm việc, không thể lập đơn')
  return shift
}

export function nextOrderCode(db: MockTransaction, now: Date): string {
  const day = toDateOnly(now).replaceAll('-', '')
  const seq = db.nextSeq(`orderCode${day}`)
  return `HD${day}-${String(seq).padStart(4, '0')}`
}

/** Giá trị hàng trả được trừ vào đơn đổi (DATABASE.md mục 8, ràng buộc 11-12). */
export function exchangeCreditOf(db: MockTransaction, exchangeReturnId: number | null | undefined): number {
  if (!exchangeReturnId) return 0
  const ret = db.read('returns').find((r) => r.id === exchangeReturnId)
  if (!ret) throw new MockHttpError(404, 'RET_NOT_FOUND', 'Không tìm thấy phiếu trả để đổi hàng')
  if (ret.refundMethod !== 'EXCHANGE') {
    throw new MockHttpError(422, 'RET_NOT_EXCHANGE', 'Phiếu trả này không phải phiếu đổi hàng')
  }
  if (ret.exchangeOrderId !== null) {
    throw new MockHttpError(409, 'RET_EXCHANGE_ALREADY_USED', 'Phiếu trả này đã được dùng để mua hàng đổi')
  }
  return ret.totalRefundAmount
}

/**
 * Hoàn tất đơn = một giao dịch (luật 40): tính lại giá và lô, kiểm lượt voucher, trừ tồn kèm thẻ kho,
 * ghi ORDERS/ORDER_DETAILS, tích điểm, xét hạng. Ném lỗi ở bất kỳ bước nào thì router không ghi gì.
 */
export function completeSale(
  db: MockTransaction,
  input: CompleteOrderRequest,
  user: MockUser,
  now: Date
): OrderRecord {
  const shift = currentShiftOf(db, user.id)
  const orders = db.read('orders')
  const draft = input.draftId ? orders.find((o) => o.id === input.draftId) : undefined
  if (input.draftId && (!draft || draft.status !== 'DRAFT' || draft.cashierId !== user.id)) {
    throw new MockHttpError(409, 'POS_DRAFT_NOT_FOUND', 'Đơn nháp không còn tồn tại hoặc đã được xử lý')
  }
  if (input.items.length === 0) throw new MockHttpError(422, 'POS_CART_EMPTY', 'Giỏ hàng chưa có sản phẩm')

  const credit = exchangeCreditOf(db, input.exchangeReturnId)
  const { quote, pricing, allocations, customer, overrides } = priceCart(db, input, now, { exchangeCreditAmount: credit })

  if (quote.issues.length > 0) {
    throw new MockHttpError(422, 'POS_INSUFFICIENT_STOCK', quote.issues[0].message)
  }
  const rejection = voucherRejection(input, quote)
  if (rejection) throw new MockHttpError(422, 'PROM_VOUCHER_INVALID', rejection)
  if (quote.amountDue < 0) {
    throw new MockHttpError(
      422,
      'RET_EXCHANGE_BELOW_CREDIT',
      'Đơn đổi hàng phải có giá trị lớn hơn hoặc bằng giá trị hàng trả, hãy chọn thêm hàng'
    )
  }
  if (quote.pointsUsed < Math.floor(input.pointsRequested) && input.pointsRequested > 0) {
    throw new MockHttpError(422, 'POS_POINTS_EXCEED_LIMIT', 'Số điểm dùng vượt mức tối đa cho phép của đơn')
  }

  let received: number | null = null
  let change: number | null = null
  if (input.paymentMethod === 'CASH') {
    received = input.amountReceived ?? 0
    if (received < quote.amountDue) {
      throw new MockHttpError(422, 'POS_CASH_INSUFFICIENT', 'Khách đưa thiếu tiền, không thể hoàn tất đơn')
    }
    change = received - quote.amountDue
  }

  const products = db.read('products')
  const orderId = draft?.id ?? db.nextSeq('order', orders.reduce((m, o) => Math.max(m, o.id), 0) + 1)
  const orderCode = draft?.orderCode ?? nextOrderCode(db, now)

  const lines: OrderLine[] = []
  pricing.lines.forEach((line, i) => {
    const product = products.find((p) => p.id === line.productId)
    if (!product) return
    const parts = splitByBatches(
      line,
      allocations[i].map((a) => ({ batchId: a.batchId, quantity: a.quantity }))
    )
    for (const part of parts) {
      const batch = findBatchById(db, part.batchId)
      assertBatchNotLocked(batch)
      applyStockChange(db, {
        batch,
        change: -part.quantity,
        referenceType: 'SALE',
        referenceId: orderId,
        reason: line.lineType === 'GIFT' ? `Bán hàng ${orderCode} (quà tặng)` : `Bán hàng ${orderCode}`,
        userId: user.id,
        now,
      })
      lines.push({
        id: db.nextSeq('orderDetail'),
        productId: part.productId,
        sku: product.sku,
        productName: product.productName,
        batchId: batch.id,
        lotCode: batch.lotCode,
        expDate: batch.expDate,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        costPrice: batch.costPrice,
        taxRate: product.taxRate,
        taxAmount: part.taxAmount,
        lineType: part.lineType,
        linePromotionId: part.linePromotionId,
        promoGroupNo: part.promoGroupNo,
        lineDiscount: part.lineDiscount,
        tierDiscount: part.tierDiscount,
        orderDiscount: part.orderDiscount,
        pointsDiscount: part.pointsDiscount,
        lineTotal: part.lineTotal,
      })
    }
  })

  const orderPromotion = db.read('promotions').find((p) => p.id === pricing.orderPromotionId)
  const policy = db.read('returnPolicies').find((p) => p.isDefault) ?? db.read('returnPolicies')[0]
  const record: OrderRecord = {
    id: orderId,
    orderCode,
    shiftId: shift.shiftId,
    cashierId: user.id,
    cashierName: user.fullName,
    customerId: customer?.id ?? null,
    customerName: customer?.fullName ?? null,
    customerPhone: customer?.phoneNumber ?? null,
    policyId: policy?.id ?? 1,
    orderPromotionId: pricing.orderPromotionId,
    orderPromotionName: orderPromotion?.promotionName ?? null,
    voucherCode: orderPromotion?.promotionType === 'VOUCHER' ? orderPromotion.voucherCode : null,
    subtotalAmount: pricing.subtotalAmount,
    lineDiscountAmount: pricing.lineDiscountAmount,
    tierDiscountAmount: pricing.tierDiscountAmount,
    orderDiscountAmount: pricing.orderDiscountAmount,
    pointsUsed: pricing.pointsUsed,
    pointsDiscountAmount: pricing.pointsDiscountAmount,
    discountAmount: pricing.discountAmount,
    taxAmount: pricing.taxAmount,
    totalAmount: pricing.totalAmount,
    exchangeReturnId: input.exchangeReturnId ?? null,
    exchangeCreditAmount: credit,
    paymentMethod: input.paymentMethod,
    amountReceived: received,
    changeDue: change,
    status: 'COMPLETED',
    createdAt: draft?.createdAt ?? toIsoLocal(now),
    completedAt: toIsoLocal(now),
    pointsEarned: 0,
    lines,
    draftCart: null,
  }

  if (customer) applyLoyalty(db, record, customer, now)

  if (draft) Object.assign(draft, record)
  else orders.push(record)
  db.touch('orders')

  if (input.exchangeReturnId) {
    const ret = db.read('returns').find((r) => r.id === input.exchangeReturnId)
    if (ret) {
      ret.exchangeOrderId = orderId
      ret.exchangeOrderCode = orderCode
      db.touch('returns')
    }
  }

  for (const o of overrides) {
    const product = products.find((p) => p.id === o.productId)
    appendAuditLog(db, user, now, {
      actionTitle: 'Đổi lô thủ công khi bán (OVERRIDE_FEFO)',
      referenceCode: orderCode,
      detailNote: `(${product?.productName ?? `SP #${o.productId}`} bán từ lô ${o.lotCode} thay vì lô FEFO đầu tiên)`,
    })
  }
  return record
}

/** Trừ/tích điểm, cộng chi tiêu, xét hạng ngay lúc hoàn tất (luật 42-45). Hạng chỉ tăng khi bán. */
function applyLoyalty(db: MockTransaction, order: OrderRecord, customer: CustomerItem, now: Date) {
  const target = db.read('customers').find((c) => c.id === customer.id)
  if (!target || target.status !== 'ACTIVE') return
  if (order.pointsUsed > 0) {
    recordPoints(target, {
      actionType: 'REDEEM',
      pointsChanged: -order.pointsUsed,
      orderCode: order.orderCode,
      description: `Dùng ${order.pointsUsed} điểm, giảm ${order.pointsDiscountAmount.toLocaleString('vi-VN')} đ trên đơn ${order.orderCode}`,
      now,
    })
  }
  const earnAmount = Number(db.read('systemSettings').POINT_EARN_AMOUNT) || 10000
  const earned = Math.floor(order.totalAmount / earnAmount)
  order.pointsEarned = earned
  recordPoints(target, {
    actionType: 'EARN',
    pointsChanged: earned,
    orderCode: order.orderCode,
    description: `Tích điểm hóa đơn ${order.orderCode}`,
    now,
  })
  const spent = parseFloat(target.totalSpent) + order.totalAmount
  target.totalSpent = spent.toFixed(2)
  const nextTier = tierForSpend(db, spent)
  if (tierRankOf({ tier: nextTier }) > tierRankOf(target)) target.tier = nextTier
  target.completedOrdersCount = (target.completedOrdersCount ?? 0) + 1
  target.lastOrderCode = order.orderCode
  target.lastOrderText = 'Vừa xong'
  const first = order.lines.find((l) => l.lineType === 'NORMAL')
  const brand = db.read('products').find((p) => p.id === first?.productId)?.brandName ?? ''
  const histories = target.orderHistories ?? (target.orderHistories = [])
  histories.unshift({
    orderCode: order.orderCode,
    purchasedAt: order.completedAt ?? toIsoLocal(now),
    brandShort: brand,
    mainProductName: first?.productName ?? '',
    subNote: `${order.lines.filter((l) => l.lineType === 'NORMAL').length} dòng hàng`,
    totalPaid: order.totalAmount,
    pointsEarned: earned,
    status: 'COMPLETED',
  })
  db.touch('customers')
}
