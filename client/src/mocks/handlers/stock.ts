import { compareFefo, daysUntilExpiry, expiryStatus, sellableQty } from '../../domain/stock/batch'
import { hasPermission } from '../../domain/permissions'
import type {
  Batch,
  FefoLookupResult,
  StockBatchDetail,
  StockBatchItem,
  StockMovementItem,
  StockSummary,
} from '../../types/stock'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate } from '../http'
import type { MockRoute } from '../router'
import { expiryWarningDays, findBatchById, referenceCodeOf, todayOf } from '../stock-ledger'

/** Người có STOCK_VIEW hoặc STOCK_EXPIRY_VIEW thấy đủ tồn, cách ly, giá vốn; người chỉ có STOCK_VIEW_AVAILABLE chỉ thấy tồn khả dụng. */
const FULL_VIEW = ['STOCK_VIEW', 'STOCK_EXPIRY_VIEW'] as const

function buildItems(db: MockTransaction, now: Date, full: boolean): StockBatchItem[] {
  const today = todayOf(now)
  const warningDays = expiryWarningDays(db)
  const products = db.read('products')
  const rank = new Map<number, number>()
  const sellable = db
    .read('batches')
    .filter((b) => sellableQty(b, today) > 0 && products.find((p) => p.id === b.productId)?.isSellable !== false)
    .sort(compareFefo)
  const counter = new Map<number, number>()
  for (const b of sellable) {
    const n = (counter.get(b.productId) ?? 0) + 1
    counter.set(b.productId, n)
    rank.set(b.id, n)
  }
  return db.read('batches').map((b) => {
    const product = products.find((p) => p.id === b.productId)
    const isSellable = product?.isSellable !== false
    const item: StockBatchItem = {
      id: b.id,
      productId: b.productId,
      sku: product?.sku ?? '',
      productName: product?.productName ?? '',
      barcode: product?.barcode ?? null,
      brandName: product?.brandName,
      categoryName: product?.categoryName,
      unit: product?.unit ?? '',
      isSellable,
      lotCode: b.lotCode,
      mfgDate: b.mfgDate ?? null,
      expDate: b.expDate,
      daysToExpiry: daysUntilExpiry(b.expDate, today),
      expiryStatus: expiryStatus(b.expDate, today, warningDays),
      availableQty: isSellable ? sellableQty(b, today) : 0,
      fefoRank: rank.get(b.id) ?? null,
    }
    if (full) {
      item.onHandQty = b.onHandQty
      item.blockedQty = b.blockedQty
      item.costPrice = b.costPrice
      item.lockedByCheckId = b.lockedByCheckId ?? null
      item.createdAt = b.createdAt
    }
    return item
  })
}

function pendingDisposalQty(db: MockTransaction, batch: Batch): number {
  return db
    .read('disposals')
    .filter((d) => d.status === 'WAITING_APPROVAL')
    .flatMap((d) => d.lines)
    .filter((l) => l.batchId === batch.id)
    .reduce((n, l) => n + l.quantity, 0)
}

export const stockRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/stock/batches',
    permission: ['STOCK_VIEW', 'STOCK_VIEW_AVAILABLE', 'STOCK_EXPIRY_VIEW'],
    handler: ({ db, query, now, permissions }) => {
      const full = hasPermission(permissions, [...FULL_VIEW])
      const kw = keywordOf(query)
      const expiry = query.get('expiry') ?? 'ALL'
      const categoryCode = query.get('categoryCode')
      const productId = Number(query.get('productId')) || null
      const products = db.read('products')
      let items = buildItems(db, now, full)
      if (!full) {
        // Thu ngân: chỉ lô bán được, không lộ tồn thực tế, cách ly, giá vốn.
        items = items.filter((i) => i.availableQty > 0)
      }
      items = items.filter((i) => {
        if (kw && ![i.sku, i.productName, i.lotCode, i.barcode ?? ''].some((v) => v.toLowerCase().includes(kw))) return false
        if (productId && i.productId !== productId) return false
        if (categoryCode && products.find((p) => p.id === i.productId)?.categoryCode !== categoryCode) return false
        if (full) {
          if (expiry === 'WARNING' && i.expiryStatus === 'OK') return false
          if ((expiry === 'NEAR_EXPIRY' || expiry === 'EXPIRED' || expiry === 'OK') && i.expiryStatus !== expiry) return false
          if (query.get('quarantined') === 'true' && !(i.blockedQty && i.blockedQty > 0)) return false
          if (query.get('inStockOnly') === 'true' && !(i.onHandQty && i.onHandQty > 0)) return false
        }
        return true
      })
      items.sort((a, b) => compareFefo({ expDate: a.expDate, id: a.id }, { expDate: b.expDate, id: b.id }))
      return ok(paginate(items, query), 'Lấy tồn kho theo lô thành công')
    },
  },
  {
    method: 'GET',
    path: '/stock/summary',
    permission: [...FULL_VIEW],
    handler: ({ db, now }) => {
      const items = buildItems(db, now, true).filter((i) => (i.onHandQty ?? 0) > 0)
      const summary: StockSummary = {
        skuCount: new Set(items.map((i) => i.productId)).size,
        lotCount: items.length,
        nearExpiryLots: items.filter((i) => i.expiryStatus === 'NEAR_EXPIRY').length,
        expiredLots: items.filter((i) => i.expiryStatus === 'EXPIRED').length,
        quarantinedUnits: items.reduce((n, i) => n + (i.blockedQty ?? 0), 0),
        quarantinedValue: items.reduce((n, i) => n + (i.blockedQty ?? 0) * (i.costPrice ?? 0), 0),
        expiryWarningDays: expiryWarningDays(db),
      }
      return ok(summary, 'Lấy tổng quan tồn kho thành công')
    },
  },
  {
    method: 'GET',
    path: '/stock/fefo',
    permission: ['STOCK_VIEW', 'STOCK_VIEW_AVAILABLE'],
    handler: ({ db, query, now, permissions }) => {
      const code = (query.get('code') ?? '').trim().toLowerCase()
      if (!code) throw new MockHttpError(400, 'COMMON_VALIDATION_FAILED', 'Vui lòng nhập mã vạch hoặc SKU')
      const product = db
        .read('products')
        .find((p) => p.barcode?.toLowerCase() === code || p.sku.toLowerCase() === code)
      if (!product?.id) throw notFound('PROD_NOT_FOUND', 'Không tìm thấy sản phẩm với mã vừa quét')
      const full = hasPermission(permissions, [...FULL_VIEW])
      const batches = buildItems(db, now, full)
        .filter((i) => i.productId === product.id && i.availableQty > 0)
        .sort((a, b) => compareFefo({ expDate: a.expDate, id: a.id }, { expDate: b.expDate, id: b.id }))
      const result: FefoLookupResult = {
        productId: product.id,
        sku: product.sku,
        productName: product.productName,
        barcode: product.barcode ?? null,
        batches,
      }
      return ok(result, 'Tra cứu lô theo FEFO thành công')
    },
  },
  {
    method: 'GET',
    path: '/stock/batches/:id',
    permission: [...FULL_VIEW],
    handler: ({ db, params, now }) => {
      const batch = findBatchById(db, Number(params.id))
      const item = buildItems(db, now, true).find((i) => i.id === batch.id) as StockBatchItem
      const product = db.read('products').find((p) => p.id === batch.productId)
      const users = db.read('users')
      const poLine = db
        .read('purchaseOrders')
        .find((o) => o.status === 'COMPLETED' && o.lines.some((l) => l.batchId === batch.id))
      const movements: StockMovementItem[] = db
        .read('stockMovements')
        .filter((m) => m.batchId === batch.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
        .map((m) => ({
          ...m,
          createdByName: users.find((u) => u.id === m.createdBy)?.fullName,
          referenceCode: referenceCodeOf(db, m),
        }))
      const detail: StockBatchDetail = {
        ...item,
        supplierName: poLine?.supplierName,
        retailPrice: product?.retailPrice ?? 0,
        pendingDisposalQty: pendingDisposalQty(db, batch),
        movements,
      }
      return ok(detail, 'Lấy chi tiết lô thành công')
    },
  },
]
