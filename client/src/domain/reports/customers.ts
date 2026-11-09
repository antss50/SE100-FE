/**
 * Báo cáo khách hàng (REP-06): khách mới theo kỳ, phân bổ hạng, top chi tiêu, điểm tích/dùng/thu hồi.
 * "Khách quay lại" (retention, DANH_GIA_USECASE 2.7 mục 8): người mua trong kỳ đã có đơn COMPLETED trước `fromDate`.
 */
import type { CustomerItem } from '../../types/api'
import type { OrderRecord, ReturnOrderRecord } from '../../types/pos'
import type { CustomerReport, CustomerTierRow, CustomerTopRow, ReportGranularity, ReportRange } from '../../types/reports'
import { dateOf, inRange, listPeriods, periodLabel, periodStart } from './period'
import { completedOrdersIn, returnsIn } from './revenue'

export interface CustomerSource {
  customers: readonly CustomerItem[]
  orders: readonly OrderRecord[]
  returns: readonly ReturnOrderRecord[]
}

/** `joinedAt` có thể là `dd/MM/yyyy` (seed cũ) hoặc `YYYY-MM-DD`; trả `null` nếu không đọc được. */
export function joinedDateOf(joinedAt: string | undefined): string | null {
  if (!joinedAt) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(joinedAt)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const vn = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(joinedAt)
  return vn ? `${vn[3]}-${vn[2]}-${vn[1]}` : null
}

export function buildCustomerReport(
  src: CustomerSource,
  range: ReportRange,
  granularity: ReportGranularity,
  topLimit = 10
): CustomerReport {
  const orders = completedOrdersIn(src.orders, range)
  const returns = returnsIn(src.returns, range)
  const customerById = new Map(src.customers.map((c) => [c.id, c]))
  const orderById = new Map(src.orders.map((o) => [o.id, o]))

  const periods = new Map(
    listPeriods(range, granularity).map((start) => [start, { periodStart: start, label: periodLabel(start, granularity), newCustomers: 0 }])
  )
  let newCustomers = 0
  for (const c of src.customers) {
    const joined = joinedDateOf(c.joinedAt)
    if (!joined || !inRange(joined, range)) continue
    newCustomers += 1
    const point = periods.get(periodStart(joined, granularity))
    if (point) point.newCustomers += 1
  }

  const spent = new Map<number, CustomerTopRow>()
  for (const o of orders) {
    if (o.customerId === null) continue
    const c = customerById.get(o.customerId)
    const row = spent.get(o.customerId) ?? {
      customerId: o.customerId,
      customerCode: c?.customerCode ?? '',
      fullName: o.customerName ?? c?.fullName ?? '',
      tierName: c?.tier.tierName ?? '',
      orderCount: 0,
      spent: 0,
    }
    row.orderCount += 1
    row.spent += o.totalAmount
    spent.set(o.customerId, row)
  }
  for (const r of returns) {
    const customerId = orderById.get(r.originalOrderId)?.customerId
    if (customerId === null || customerId === undefined) continue
    const row = spent.get(customerId)
    if (row) row.spent -= r.totalRefundAmount
  }

  const buyerIds = new Set(spent.keys())
  const earlier = new Set(
    src.orders
      .filter((o) => o.status === 'COMPLETED' && o.customerId !== null && o.completedAt !== null && dateOf(o.completedAt) < range.fromDate)
      .map((o) => o.customerId as number)
  )

  const tiers = new Map<string, CustomerTierRow>()
  for (const c of src.customers) {
    const row = tiers.get(c.tier.tierCode) ?? { tierCode: c.tier.tierCode, tierName: c.tier.tierName, customerCount: 0, totalSpent: 0 }
    row.customerCount += 1
    row.totalSpent += Number(c.totalSpent) || 0
    tiers.set(c.tier.tierCode, row)
  }
  const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']

  let pointsEarned = 0
  let pointsRedeemed = 0
  let pointsRevoked = 0
  for (const c of src.customers) {
    for (const h of c.pointHistories ?? []) {
      if (!inRange(dateOf(h.createdAt), range)) continue
      if (h.actionType === 'EARN') pointsEarned += h.pointsChanged
      else if (h.actionType === 'REDEEM') pointsRedeemed += Math.abs(h.pointsChanged)
      else if (h.actionType === 'REVOKE') pointsRevoked += Math.abs(h.pointsChanged)
    }
  }

  return {
    range,
    granularity,
    summary: {
      totalCustomers: src.customers.length,
      newCustomers,
      activeBuyers: buyerIds.size,
      returningBuyers: [...buyerIds].filter((id) => earlier.has(id)).length,
      pointsEarned,
      pointsRedeemed,
      pointsRevoked,
    },
    byTier: [...tiers.values()].sort((a, b) => tierOrder.indexOf(a.tierCode) - tierOrder.indexOf(b.tierCode)),
    topSpenders: [...spent.values()].sort((a, b) => b.spent - a.spent).slice(0, topLimit),
    series: [...periods.values()],
  }
}
