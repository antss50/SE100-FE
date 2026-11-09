/**
 * Hiệu quả khuyến mãi (PROM-04): tính từ đơn COMPLETED, không có bảng riêng (KHUYEN_MAI.md mục 3.6).
 * Một đơn "dùng" khuyến mãi khi `orderPromotionId` hoặc một dòng có `linePromotionId` trỏ tới nó (cùng cách đếm lượt dùng ở mock).
 * Tiền giảm của khuyến mãi = `orderDiscountAmount` (nếu là khuyến mãi đơn) + Σ `lineDiscount` các dòng thuộc khuyến mãi dòng.
 */
import type { OrderRecord } from '../../types/pos'
import type { PromotionEffect, PromotionEffectCustomer, PromotionEffectDay, ReportRange } from '../../types/reports'
import { dateOf } from './period'
import { completedOrdersIn } from './revenue'

export function discountOfPromotion(order: OrderRecord, promotionId: number): number {
  let total = order.orderPromotionId === promotionId ? order.orderDiscountAmount : 0
  for (const line of order.lines) if (line.linePromotionId === promotionId) total += line.lineDiscount
  return total
}

export function orderUsesPromotion(order: OrderRecord, promotionId: number): boolean {
  return order.orderPromotionId === promotionId || order.lines.some((l) => l.linePromotionId === promotionId)
}

export function buildPromotionEffect(
  orders: readonly OrderRecord[],
  promotion: { id: number; promotionName: string },
  range: ReportRange,
  topLimit = 10
): PromotionEffect {
  const used = completedOrdersIn(orders, range).filter((o) => orderUsesPromotion(o, promotion.id))
  const days = new Map<string, PromotionEffectDay>()
  const customers = new Map<number, PromotionEffectCustomer>()
  let totalDiscount = 0
  let revenue = 0
  for (const order of used) {
    const discount = discountOfPromotion(order, promotion.id)
    totalDiscount += discount
    revenue += order.totalAmount
    const date = dateOf(order.completedAt as string)
    const day = days.get(date) ?? { date, usageCount: 0, discountAmount: 0, revenue: 0 }
    day.usageCount += 1
    day.discountAmount += discount
    day.revenue += order.totalAmount
    days.set(date, day)
    if (order.customerId !== null) {
      const c = customers.get(order.customerId) ?? {
        customerId: order.customerId,
        customerName: order.customerName ?? `Khách #${order.customerId}`,
        usageCount: 0,
        discountAmount: 0,
        revenue: 0,
      }
      c.usageCount += 1
      c.discountAmount += discount
      c.revenue += order.totalAmount
      customers.set(order.customerId, c)
    }
  }
  return {
    promotionId: promotion.id,
    promotionName: promotion.promotionName,
    range,
    usageCount: used.length,
    totalDiscount,
    revenue,
    customerCount: customers.size,
    averageOrderValue: used.length > 0 ? Math.round(revenue / used.length) : 0,
    topCustomers: [...customers.values()]
      .sort((a, b) => b.usageCount - a.usageCount || b.revenue - a.revenue || a.customerId - b.customerId)
      .slice(0, topLimit),
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}
