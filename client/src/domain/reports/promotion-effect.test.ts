import { describe, expect, it } from 'vitest'
import type { OrderLine, OrderRecord } from '../../types/pos'
import { buildPromotionEffect, discountOfPromotion } from './promotion-effect'

const line = (promo: number | null, lineDiscount: number): OrderLine => ({ linePromotionId: promo, lineDiscount }) as OrderLine
const order = (p: Partial<OrderRecord>): OrderRecord =>
  ({
    id: 1,
    status: 'COMPLETED',
    completedAt: '2026-05-10T09:00:00',
    customerId: null,
    customerName: null,
    orderPromotionId: null,
    orderDiscountAmount: 0,
    totalAmount: 100_000,
    lines: [],
    ...p,
  }) as OrderRecord

const range = { fromDate: '2026-05-01', toDate: '2026-05-31' }

describe('buildPromotionEffect', () => {
  it('cộng giảm dòng và giảm đơn của đúng khuyến mãi', () => {
    expect(discountOfPromotion(order({ orderPromotionId: 7, orderDiscountAmount: 5000, lines: [line(7, 2000), line(8, 900)] }), 7)).toBe(7000)
  })

  it('chỉ tính đơn COMPLETED trong kỳ, gộp theo ngày và khách', () => {
    const orders = [
      order({ id: 1, orderPromotionId: 7, orderDiscountAmount: 10_000, customerId: 1, customerName: 'An' }),
      order({ id: 2, lines: [line(7, 4000)], customerId: 1, customerName: 'An', completedAt: '2026-05-11T09:00:00', totalAmount: 200_000 }),
      order({ id: 3, orderPromotionId: 7, orderDiscountAmount: 1, status: 'CANCELLED' }),
      order({ id: 4, orderPromotionId: 7, orderDiscountAmount: 1, completedAt: '2026-06-02T09:00:00' }),
      order({ id: 5, orderPromotionId: 8, orderDiscountAmount: 9 }),
      order({ id: 6, orderPromotionId: 7, orderDiscountAmount: 2000, customerId: 2, customerName: 'Bình' }),
    ]
    const r = buildPromotionEffect(orders, { id: 7, promotionName: 'KM' }, range)
    expect(r.usageCount).toBe(3)
    expect(r.totalDiscount).toBe(16_000)
    expect(r.revenue).toBe(400_000)
    expect(r.customerCount).toBe(2)
    expect(r.averageOrderValue).toBe(133_333)
    expect(r.topCustomers[0]).toMatchObject({ customerId: 1, usageCount: 2, discountAmount: 14_000 })
    expect(r.byDay.map((d) => [d.date, d.usageCount])).toEqual([['2026-05-10', 2], ['2026-05-11', 1]])
  })

  it('không có đơn thì toàn số 0', () => {
    const r = buildPromotionEffect([], { id: 7, promotionName: 'KM' }, range)
    expect(r).toMatchObject({ usageCount: 0, totalDiscount: 0, revenue: 0, customerCount: 0, averageOrderValue: 0, topCustomers: [], byDay: [] })
  })
})
