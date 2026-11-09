/** Báo cáo tồn kho và hạn dùng (REP-04): tồn, giá trị tồn (Σ tồn × giá vốn), dưới định mức, cận hạn, hàng hủy. */
import type { DisposalDetail } from '../../types/inventory'
import type { ReportRange, StockReport, StockReportDisposalRow, StockReportLotRow, StockReportProductRow } from '../../types/reports'
import type { Batch } from '../../types/stock'
import { dateOf, diffDays, inRange } from './period'
import { daysUntilExpiry } from '../stock/batch'

export interface StockSource {
  batches: readonly Batch[]
  products: readonly {
    id?: number
    sku: string
    productName: string
    categoryName?: string
    minStockAlert?: number
    isSellable?: boolean
    status: 'ACTIVE' | 'DISCONTINUED'
  }[]
  disposals: readonly DisposalDetail[]
}

const sum = <T>(items: readonly T[], pick: (item: T) => number): number => items.reduce((acc, x) => acc + pick(x), 0)

export function buildStockReport(src: StockSource, range: ReportRange, today: string, warningDays: number): StockReport {
  const productById = new Map(src.products.filter((p) => p.id !== undefined).map((p) => [p.id as number, p]))
  const inStock = src.batches.filter((b) => b.onHandQty > 0)

  const lotRow = (b: Batch): StockReportLotRow => {
    const p = productById.get(b.productId)
    return {
      batchId: b.id,
      sku: p?.sku ?? '',
      productName: p?.productName ?? '',
      lotCode: b.lotCode,
      expDate: b.expDate,
      daysToExpiry: daysUntilExpiry(b.expDate, today),
      onHandQty: b.onHandQty,
      blockedQty: b.blockedQty,
      value: b.onHandQty * b.costPrice,
      daysInStock: Math.max(0, diffDays(dateOf(b.createdAt), today)),
    }
  }

  const products: StockReportProductRow[] = []
  for (const p of src.products) {
    if (p.id === undefined) continue
    const lots = inStock.filter((b) => b.productId === p.id)
    const onHandQty = sum(lots, (b) => b.onHandQty)
    const blockedQty = sum(lots, (b) => b.blockedQty)
    const sellableLots = lots.filter((b) => b.expDate >= today && !b.lockedByCheckId)
    const minStockAlert = p.minStockAlert ?? 0
    // Tồn dưới ngưỡng tính trên hàng bán được (SKU tester không bán nên không có ngưỡng).
    const availableQty = sum(sellableLots, (b) => b.onHandQty - b.blockedQty)
    const sellable = p.isSellable !== false && p.status === 'ACTIVE'
    if (onHandQty === 0 && !(sellable && minStockAlert > 0)) continue
    products.push({
      productId: p.id,
      sku: p.sku,
      productName: p.productName,
      categoryName: p.categoryName ?? '',
      onHandQty,
      blockedQty,
      availableQty,
      value: sum(lots, (b) => b.onHandQty * b.costPrice),
      minStockAlert,
      belowMin: sellable && minStockAlert > 0 && onHandQty <= minStockAlert,
    })
  }
  products.sort((a, b) => b.value - a.value)

  const nearExpiry = inStock
    .filter((b) => b.expDate >= today && daysUntilExpiry(b.expDate, today) <= warningDays)
    .map(lotRow)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
  const expired = inStock
    .filter((b) => b.expDate < today)
    .map(lotRow)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)

  const approved = src.disposals.filter((d) => d.status === 'APPROVED' && d.approvedAt && inRange(dateOf(d.approvedAt), range))
  const byType = new Map<StockReportDisposalRow['issueType'], StockReportDisposalRow>()
  for (const d of approved) {
    const row = byType.get(d.issueType) ?? { issueType: d.issueType, count: 0, quantity: 0, totalCost: 0 }
    row.count += 1
    row.quantity += d.totalQuantity
    row.totalCost += d.totalCost ?? 0
    byType.set(d.issueType, row)
  }

  return {
    range,
    expiryWarningDays: warningDays,
    summary: {
      skuCount: products.filter((p) => p.onHandQty > 0).length,
      lotCount: inStock.length,
      totalQty: sum(inStock, (b) => b.onHandQty),
      inventoryValue: sum(inStock, (b) => b.onHandQty * b.costPrice),
      blockedQty: sum(inStock, (b) => b.blockedQty),
      belowMinCount: products.filter((p) => p.belowMin).length,
      nearExpiryLots: nearExpiry.length,
      nearExpiryValue: sum(nearExpiry, (l) => l.value),
      expiredLots: expired.length,
      expiredValue: sum(expired, (l) => l.value),
      disposalLoss: byType.get('DESTROY')?.totalCost ?? 0,
    },
    products,
    belowMinProducts: products.filter((p) => p.belowMin),
    nearExpiryLots: nearExpiry,
    expiredLots: expired,
    disposals: [...byType.values()],
  }
}
