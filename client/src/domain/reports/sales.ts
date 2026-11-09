/** Báo cáo bán hàng (REP-03): top sản phẩm, theo phương thức thanh toán, thu ngân, ca. */
import type { CashierShift, OrderRecord, PaymentMethod, ReturnOrderRecord } from '../../types/pos'
import type {
  ReportRange,
  SalesCashierRow,
  SalesPaymentRow,
  SalesProductRow,
  SalesReport,
  SalesShiftRow,
} from '../../types/reports'
import { dateOf, inRange } from './period'
import { completedOrdersIn, returnsIn } from './revenue'

export interface SalesSource {
  orders: readonly OrderRecord[]
  returns: readonly ReturnOrderRecord[]
  shifts: readonly CashierShift[]
  /** Danh mục SKU còn bán (để liệt kê cả hàng chưa bán được cái nào ở mục bán chậm). */
  products: readonly { id: number; sku: string; productName: string }[]
}

export interface SalesScope {
  /** Có giá trị = chỉ lấy dữ liệu của thu ngân này (`REPORT_SALES_OWN_SHIFT`). */
  onlyCashierId?: number
  topLimit?: number
}

const sum = <T>(items: readonly T[], pick: (item: T) => number): number => items.reduce((acc, x) => acc + pick(x), 0)

function productRows(orders: readonly OrderRecord[], returns: readonly ReturnOrderRecord[]): Map<number, SalesProductRow> {
  const rows = new Map<number, SalesProductRow>()
  const rowOf = (productId: number, sku: string, productName: string): SalesProductRow => {
    let row = rows.get(productId)
    if (!row) {
      row = { productId, sku, productName, quantity: 0, returnedQuantity: 0, revenue: 0, returnedAmount: 0 }
      rows.set(productId, row)
    }
    return row
  }
  for (const o of orders) {
    for (const l of o.lines) {
      if (l.lineType !== 'NORMAL') continue
      const row = rowOf(l.productId, l.sku, l.productName)
      row.quantity += l.quantity
      row.revenue += l.lineTotal
    }
  }
  for (const r of returns) {
    for (const l of r.lines) {
      if (l.lineKind !== 'RETURN') continue
      const row = rowOf(l.productId, l.sku, l.productName)
      row.returnedQuantity += l.quantity
      row.returnedAmount += l.refundAmount
    }
  }
  return rows
}

export function buildSalesReport(src: SalesSource, range: ReportRange, scope: SalesScope = {}): SalesReport {
  const own = (cashierId: number) => scope.onlyCashierId === undefined || cashierId === scope.onlyCashierId
  const orders = completedOrdersIn(src.orders, range).filter((o) => own(o.cashierId))
  const returns = returnsIn(src.returns, range).filter((r) => own(r.processedBy))
  const limit = scope.topLimit ?? 10

  const products = productRows(orders, returns)
  const sold = [...products.values()].filter((p) => p.quantity > 0).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
  const soldIds = new Set(sold.map((p) => p.productId))
  const unsold: SalesProductRow[] = src.products
    .filter((p) => !soldIds.has(p.id))
    .map((p) => ({ productId: p.id, sku: p.sku, productName: p.productName, quantity: 0, returnedQuantity: 0, revenue: 0, returnedAmount: 0 }))
  const slow = [...[...sold].reverse(), ...unsold].sort((a, b) => a.quantity - b.quantity)

  const paymentMap = new Map<PaymentMethod, SalesPaymentRow>()
  for (const o of orders) {
    if (!o.paymentMethod) continue
    const row = paymentMap.get(o.paymentMethod) ?? { method: o.paymentMethod, orderCount: 0, amount: 0 }
    row.orderCount += 1
    row.amount += o.totalAmount
    paymentMap.set(o.paymentMethod, row)
  }

  const cashierMap = new Map<number, SalesCashierRow>()
  const cashierRow = (id: number, name: string): SalesCashierRow => {
    let row = cashierMap.get(id)
    if (!row) {
      row = { cashierId: id, cashierName: name, orderCount: 0, amount: 0, returnCount: 0, returnedAmount: 0 }
      cashierMap.set(id, row)
    }
    return row
  }
  for (const o of orders) {
    const row = cashierRow(o.cashierId, o.cashierName)
    row.orderCount += 1
    row.amount += o.totalAmount
  }
  for (const r of returns) {
    const row = cashierRow(r.processedBy, r.processedByName)
    row.returnCount += 1
    row.returnedAmount += r.totalRefundAmount
  }

  const shiftIdsWithOrders = new Set(orders.map((o) => o.shiftId))
  const byShift: SalesShiftRow[] = src.shifts
    .filter((s) => own(s.cashierId) && (shiftIdsWithOrders.has(s.shiftId) || inRange(dateOf(s.openedAt), range)))
    .map((s) => {
      const shiftOrders = orders.filter((o) => o.shiftId === s.shiftId)
      return {
        shiftId: s.shiftId,
        shiftCode: s.shiftCode,
        cashierName: s.cashierName,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        orderCount: shiftOrders.length,
        amount: sum(shiftOrders, (o) => o.totalAmount),
        differenceAmount: s.differenceAmount,
      }
    })
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))

  const totalAmount = sum(orders, (o) => o.totalAmount)
  return {
    range,
    scope: scope.onlyCashierId === undefined ? 'ALL' : 'OWN',
    summary: {
      orderCount: orders.length,
      totalAmount,
      averageOrderValue: orders.length > 0 ? Math.round(totalAmount / orders.length) : 0,
      itemsSold: sum(sold, (p) => p.quantity),
      returnCount: returns.length,
      returnedAmount: sum(returns, (r) => r.totalRefundAmount),
    },
    topProducts: sold.slice(0, limit),
    slowProducts: slow.slice(0, limit),
    byPayment: [...paymentMap.values()].sort((a, b) => b.amount - a.amount),
    byCashier: [...cashierMap.values()].sort((a, b) => b.amount - a.amount),
    byShift,
  }
}
