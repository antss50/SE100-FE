/** Số liệu dashboard (REP-01): doanh thu hôm nay, 7 ngày, cảnh báo kho, chứng từ chờ duyệt. */
import type { DashboardAlertLot, DashboardData, DashboardLowStock, DashboardSalesWidget, DashboardStockWidget } from '../../types/reports'
import type { InventoryCheck, Disposal } from '../../types/inventory'
import type { CashierShift } from '../../types/pos'
import type { Batch } from '../../types/stock'
import { daysUntilExpiry } from '../stock/batch'
import { addDaysTo, periodLabel } from './period'
import { computeRevenueFigures, type RevenueSource } from './revenue'

export interface DashboardSource extends RevenueSource {
  shifts: readonly CashierShift[]
  batches: readonly Batch[]
  products: readonly {
    id?: number
    sku: string
    productName: string
    minStockAlert?: number
    isSellable?: boolean
    status: 'ACTIVE' | 'DISCONTINUED'
  }[]
  inventoryChecks: readonly Pick<InventoryCheck, 'status'>[]
  disposals: readonly Pick<Disposal, 'status'>[]
}

export function buildSalesWidget(src: DashboardSource, today: string): DashboardSalesWidget {
  const todayFigures = computeRevenueFigures(src, { fromDate: today, toDate: today })
  const yesterday = addDaysTo(today, -1)
  const yesterdayFigures = computeRevenueFigures(src, { fromDate: yesterday, toDate: yesterday })
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysTo(today, i - 6)
    const f = computeRevenueFigures(src, { fromDate: date, toDate: date })
    return { date, label: periodLabel(date, 'DAY'), netRevenue: f.netRevenue, orderCount: f.orderCount }
  })
  return {
    todayRevenue: todayFigures.netRevenue,
    todayOrders: todayFigures.orderCount,
    yesterdayRevenue: yesterdayFigures.netRevenue,
    openShifts: src.shifts.filter((s) => s.status === 'OPEN').length,
    last7Days,
  }
}

export function buildStockWidget(src: DashboardSource, today: string, warningDays: number): DashboardStockWidget {
  const productById = new Map(src.products.filter((p) => p.id !== undefined).map((p) => [p.id as number, p]))
  const inStock = src.batches.filter((b) => b.onHandQty > 0)
  const alertOf = (b: Batch): DashboardAlertLot => ({
    batchId: b.id,
    sku: productById.get(b.productId)?.sku ?? '',
    productName: productById.get(b.productId)?.productName ?? '',
    lotCode: b.lotCode,
    expDate: b.expDate,
    daysToExpiry: daysUntilExpiry(b.expDate, today),
    onHandQty: b.onHandQty,
  })
  const byExpiry = (a: DashboardAlertLot, b: DashboardAlertLot) => a.daysToExpiry - b.daysToExpiry

  const lowStock: DashboardLowStock[] = []
  for (const p of src.products) {
    if (p.id === undefined || p.isSellable === false || p.status !== 'ACTIVE') continue
    const min = p.minStockAlert ?? 0
    if (min <= 0) continue
    const onHandQty = inStock.filter((b) => b.productId === p.id).reduce((acc, b) => acc + b.onHandQty, 0)
    if (onHandQty <= min) lowStock.push({ productId: p.id, sku: p.sku, productName: p.productName, onHandQty, minStockAlert: min })
  }

  return {
    expiryWarningDays: warningDays,
    nearExpiry: inStock
      .filter((b) => b.expDate >= today && daysUntilExpiry(b.expDate, today) <= warningDays)
      .map(alertOf)
      .sort(byExpiry),
    expired: inStock
      .filter((b) => b.expDate < today)
      .map(alertOf)
      .sort(byExpiry),
    lowStock: lowStock.sort((a, b) => a.onHandQty - b.onHandQty),
  }
}

/** `canSeeSales = false` (NV kho) → chỉ có widget kho. */
export function buildDashboard(
  src: DashboardSource,
  today: string,
  warningDays: number,
  generatedAt: string,
  canSeeSales: boolean
): DashboardData {
  return {
    generatedAt,
    sales: canSeeSales ? buildSalesWidget(src, today) : null,
    stock: buildStockWidget(src, today, warningDays),
    pending: {
      waitingChecks: src.inventoryChecks.filter((c) => c.status === 'WAITING_APPROVAL').length,
      waitingDisposals: src.disposals.filter((d) => d.status === 'WAITING_APPROVAL').length,
    },
  }
}
