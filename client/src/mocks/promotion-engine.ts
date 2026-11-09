import type { Promotion as DomainPromotion } from '../domain/pricing'
import type { PromotionPhase, PromotionRecord, PromotionView } from '../types/promotions'
import type { MockTransaction } from './db'

/** Giai đoạn theo ngày: sắp diễn ra, đang chạy, đã kết thúc (không lưu trong CSDL). */
export function phaseOf(p: Pick<PromotionRecord, 'startAt' | 'endAt'>, now: Date): PromotionPhase {
  const t = now.getTime()
  if (t < new Date(p.startAt).getTime()) return 'UPCOMING'
  if (t > new Date(p.endAt).getTime()) return 'ENDED'
  return 'RUNNING'
}

export interface UsageIndex {
  /** Số đơn COMPLETED đã dùng khuyến mãi. */
  used: Map<number, number>
  /** promotionId → (customerId → số đơn). */
  byCustomer: Map<number, Map<number, number>>
  /** FLASH_PRICE: số lượng đã bán giá khuyến mãi. */
  sold: Map<number, number>
}

/**
 * Lượt dùng đếm từ ORDERS.order_promotion_id và ORDER_DETAILS.line_promotion_id của đơn COMPLETED
 * (KHUYEN_MAI.md mục 3.6: không có bảng PROMOTION_USAGES).
 */
export function buildUsageIndex(db: MockTransaction): UsageIndex {
  const used = new Map<number, number>()
  const byCustomer = new Map<number, Map<number, number>>()
  const sold = new Map<number, number>()
  for (const order of db.read('orders')) {
    if (order.status !== 'COMPLETED') continue
    const promoIds = new Set<number>()
    if (order.orderPromotionId !== null) promoIds.add(order.orderPromotionId)
    for (const line of order.lines) {
      if (line.linePromotionId === null) continue
      promoIds.add(line.linePromotionId)
      if (line.lineType === 'NORMAL') sold.set(line.linePromotionId, (sold.get(line.linePromotionId) ?? 0) + line.quantity)
    }
    for (const id of promoIds) {
      used.set(id, (used.get(id) ?? 0) + 1)
      if (order.customerId !== null) {
        const perCustomer = byCustomer.get(id) ?? new Map<number, number>()
        perCustomer.set(order.customerId, (perCustomer.get(order.customerId) ?? 0) + 1)
        byCustomer.set(id, perCustomer)
      }
    }
  }
  return { used, byCustomer, sold }
}

export function toView(db: MockTransaction, p: PromotionRecord, now: Date, usage: UsageIndex): PromotionView {
  const usedCount = usage.used.get(p.id) ?? 0
  const tierName =
    p.minTierId === null ? null : (db.read('loyaltyConfig').tiers.find((_, i) => i + 1 === p.minTierId)?.tierName ?? null)
  const customer = p.customerId === null ? null : db.read('customers').find((c) => c.id === p.customerId)
  return {
    ...p,
    phase: phaseOf(p, now),
    usedCount,
    locked: usedCount > 0,
    minTierName: tierName,
    customerName: customer?.fullName ?? null,
  }
}

/** Chuyển bản ghi lưu trữ sang kiểu của `domain/pricing` kèm số liệu lượt dùng của khách hiện tại. */
export function toDomainPromotions(
  db: MockTransaction,
  customerId: number | null,
  usage: UsageIndex
): DomainPromotion[] {
  return db.read('promotions').map((p) => ({
    id: p.id,
    name: p.promotionName,
    type: p.promotionType,
    status: p.status,
    voucherCode: p.voucherCode,
    customerId: p.customerId,
    applyScope: p.applyScope,
    brandIds: p.brandIds,
    categoryIds: p.categoryIds,
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscountAmount: p.maxDiscountAmount,
    fixedPrice: p.fixedPrice,
    comboPrice: p.comboPrice,
    buyQuantity: p.buyQuantity,
    isRepeatable: p.isRepeatable,
    minOrderValue: p.minOrderValue,
    minTierRank: p.minTierId,
    startAt: new Date(p.startAt),
    endAt: new Date(p.endAt),
    dailyStart: p.dailyStartTime,
    dailyEnd: p.dailyEndTime,
    weekdays: p.weekdays ? p.weekdays.split(',').map(Number) : null,
    usageLimit: p.usageLimit,
    limitPerCustomer: p.limitPerCustomer,
    maxQuantity: p.maxQuantity,
    items: p.items,
    steps: p.steps.map((s) => ({
      minOrderValue: s.minOrderValue,
      discountType: s.discountType,
      discountValue: s.discountValue,
      maxDiscountAmount: s.maxDiscountAmount,
    })),
    usedCount: usage.used.get(p.id) ?? 0,
    usedByCustomer: customerId === null ? 0 : (usage.byCustomer.get(p.id)?.get(customerId) ?? 0),
    soldQuantity: usage.sold.get(p.id) ?? 0,
  }))
}
