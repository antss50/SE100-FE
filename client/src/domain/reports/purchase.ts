/** Báo cáo nhập hàng (REP-05): phiếu nhập COMPLETED theo ngày xác nhận, theo NCC, thương hiệu, kỳ. */
import type { PurchaseBrandRow, PurchasePoint, PurchaseReport, PurchaseSupplierRow, ReportGranularity, ReportRange } from '../../types/reports'
import type { PurchaseOrderDetail } from '../../types/stock'
import { dateOf, inRange, listPeriods, periodLabel, periodStart } from './period'

export interface PurchaseSource {
  orders: readonly PurchaseOrderDetail[]
  products: readonly { id?: number; brandName?: string }[]
}

export function buildPurchaseReport(src: PurchaseSource, range: ReportRange, granularity: ReportGranularity): PurchaseReport {
  const orders = src.orders.filter((o) => o.status === 'COMPLETED' && o.confirmedAt && inRange(dateOf(o.confirmedAt), range))
  const brandOf = new Map(src.products.filter((p) => p.id !== undefined).map((p) => [p.id as number, p.brandName ?? 'Khác']))

  const suppliers = new Map<number, PurchaseSupplierRow>()
  const brands = new Map<string, PurchaseBrandRow>()
  const periods = new Map<string, PurchasePoint>(
    listPeriods(range, granularity).map((start) => [start, { periodStart: start, label: periodLabel(start, granularity), orderCount: 0, amount: 0 }])
  )

  for (const o of orders) {
    const supplier = suppliers.get(o.supplierId) ?? { supplierId: o.supplierId, supplierName: o.supplierName, orderCount: 0, quantity: 0, amount: 0 }
    supplier.orderCount += 1
    supplier.quantity += o.totalQuantity
    supplier.amount += o.totalAmount
    suppliers.set(o.supplierId, supplier)

    const point = periods.get(periodStart(dateOf(o.confirmedAt as string), granularity))
    if (point) {
      point.orderCount += 1
      point.amount += o.totalAmount
    }

    for (const line of o.lines) {
      const name = brandOf.get(line.productId) ?? 'Khác'
      const brand = brands.get(name) ?? { brandName: name, quantity: 0, amount: 0 }
      brand.quantity += line.quantity
      brand.amount += line.lineTotal
      brands.set(name, brand)
    }
  }

  return {
    range,
    granularity,
    summary: {
      orderCount: orders.length,
      quantity: orders.reduce((acc, o) => acc + o.totalQuantity, 0),
      totalAmount: orders.reduce((acc, o) => acc + o.totalAmount, 0),
      supplierCount: suppliers.size,
    },
    bySupplier: [...suppliers.values()].sort((a, b) => b.amount - a.amount),
    byBrand: [...brands.values()].sort((a, b) => b.amount - a.amount),
    series: [...periods.values()],
  }
}
