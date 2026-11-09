/**
 * Doanh thu và lợi nhuận gộp (REP-02), luật 53-56:
 * - đơn COMPLETED tính theo `completedAt`; phiếu trả COMPLETED tính theo ngày trả (không loại đơn gốc);
 * - doanh thu thuần = tiền hàng − giảm giá − hàng bán bị trả;
 * - lợi nhuận gộp = doanh thu thuần chưa VAT − giá vốn (bán − trả).
 */
import type { OrderLine, OrderRecord, ReturnOrderRecord } from '../../types/pos'
import type { ReportGranularity, ReportRange, RevenueFigures, RevenuePoint } from '../../types/reports'
import { dateOf, inRange, listPeriods, periodEnd, periodLabel } from './period'

export interface RevenueSource {
  orders: readonly OrderRecord[]
  returns: readonly ReturnOrderRecord[]
}

/** Đơn COMPLETED có `completedAt` rơi trong `range`. */
export function completedOrdersIn(orders: readonly OrderRecord[], range: ReportRange): OrderRecord[] {
  return orders.filter((o) => o.status === 'COMPLETED' && o.completedAt !== null && inRange(dateOf(o.completedAt), range))
}

/** Phiếu trả COMPLETED có ngày trả rơi trong `range`. */
export function returnsIn(returns: readonly ReturnOrderRecord[], range: ReportRange): ReturnOrderRecord[] {
  return returns.filter((r) => r.status === 'COMPLETED' && inRange(dateOf(r.createdAt), range))
}

/** VAT nằm trong số tiền đã gồm thuế: `amount × rate / (1 + rate)`. */
export const vatIncluded = (amount: number, taxRate: number): number => Math.round((amount * taxRate) / (1 + taxRate))

/** Tra dòng đơn theo `(orderId, lineId)` để lấy thuế suất cho dòng trả. */
function indexLines(orders: readonly OrderRecord[]): Map<string, OrderLine> {
  const map = new Map<string, OrderLine>()
  for (const o of orders) for (const l of o.lines) map.set(`${o.id}:${l.id}`, l)
  return map
}

const sum = <T>(items: readonly T[], pick: (item: T) => number): number => items.reduce((acc, x) => acc + pick(x), 0)

/** Tính các chỉ tiêu cho đúng `range`. Luôn tính cả lợi nhuận; tầng handler quyết định có trả về không. */
export function computeRevenueFigures(src: RevenueSource, range: ReportRange): RevenueFigures {
  const orders = completedOrdersIn(src.orders, range)
  const returns = returnsIn(src.returns, range)
  const lines = indexLines(src.orders)

  const grossAmount = sum(orders, (o) => o.subtotalAmount)
  const discountAmount = sum(orders, (o) => o.discountAmount)
  const returnedAmount = sum(returns, (r) => r.totalRefundAmount)
  const netRevenue = grossAmount - discountAmount - returnedAmount

  const saleVat = sum(orders, (o) => o.taxAmount)
  const returnVat = sum(returns, (r) =>
    sum(r.lines, (l) => {
      const original = lines.get(`${r.originalOrderId}:${l.orderDetailId}`)
      return original ? vatIncluded(l.refundAmount, original.taxRate) : 0
    })
  )
  const vatAmount = saleVat - returnVat
  const netRevenueExVat = netRevenue - vatAmount

  const saleCogs = sum(orders, (o) => sum(o.lines, (l) => l.costPrice * l.quantity))
  const returnCogs = sum(returns, (r) => sum(r.lines.filter((l) => l.lineKind === 'RETURN'), (l) => l.unitCost * l.quantity))
  const cogs = saleCogs - returnCogs
  const grossProfit = netRevenueExVat - cogs

  return {
    orderCount: orders.length,
    returnCount: returns.length,
    grossAmount,
    discountAmount,
    lineDiscountAmount: sum(orders, (o) => o.lineDiscountAmount),
    tierDiscountAmount: sum(orders, (o) => o.tierDiscountAmount),
    orderDiscountAmount: sum(orders, (o) => o.orderDiscountAmount),
    pointsDiscountAmount: sum(orders, (o) => o.pointsDiscountAmount),
    returnedAmount,
    netRevenue,
    vatAmount,
    netRevenueExVat,
    cogs,
    grossProfit,
    marginPercent: netRevenueExVat > 0 ? Math.round((grossProfit / netRevenueExVat) * 1000) / 10 : 0,
  }
}

/** Chuỗi theo kỳ; mỗi kỳ giao với `range` (kỳ đầu/cuối có thể là kỳ lẻ). */
export function buildRevenueSeries(src: RevenueSource, range: ReportRange, granularity: ReportGranularity): RevenuePoint[] {
  return listPeriods(range, granularity).map((start) => {
    const end = periodEnd(start, granularity)
    const sub: ReportRange = {
      fromDate: start < range.fromDate ? range.fromDate : start,
      toDate: end > range.toDate ? range.toDate : end,
    }
    return { ...computeRevenueFigures(src, sub), periodStart: start, label: periodLabel(start, granularity) }
  })
}

/** Bỏ các chỉ tiêu lợi nhuận/giá vốn (Manager chỉ xem doanh thu: `REPORT_PROFIT`). */
export function withoutProfit<T extends RevenueFigures>(figures: T): T {
  const copy = { ...figures }
  delete copy.cogs
  delete copy.grossProfit
  delete copy.marginPercent
  return copy
}
