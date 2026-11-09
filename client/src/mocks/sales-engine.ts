import {
  calculateOrder,
  type Customer as DomainCustomer,
  type PricedLine,
  type PricingResult,
  type Product as DomainProduct,
} from '../domain/pricing'
import { compareFefo, sellableQty } from '../domain/stock/batch'
import type { CustomerItem, ProductItem } from '../types/api'
import type { CartInput, LotAllocation, OrderQuote, QuoteLine } from '../types/pos'
import type { Batch } from '../types/stock'
import type { MockTransaction } from './db'
import { MockHttpError } from './http'
import { loyaltySettings, tierRankOf } from './loyalty'
import { buildUsageIndex, toDomainPromotions } from './promotion-engine'
import { todayOf } from './stock-ledger'

/** Sản phẩm được phép bán ở POS: đang kinh doanh và không phải tester hãng (luật 34). */
export const isPosSellable = (p: ProductItem): boolean => p.status === 'ACTIVE' && p.isSellable !== false

/** Các lô bán được của sản phẩm theo FEFO (còn hạn, không khóa, onHand − blocked > 0; luật 24-26). */
export function sellableBatches(db: MockTransaction, productId: number, now: Date): Batch[] {
  const today = todayOf(now)
  return db
    .read('batches')
    .filter((b) => b.productId === productId && sellableQty(b, today) > 0)
    .sort(compareFefo)
}

export const sellableTotal = (db: MockTransaction, productId: number, now: Date): number => {
  const today = todayOf(now)
  return sellableBatches(db, productId, now).reduce((n, b) => n + sellableQty(b, today), 0)
}

function domainProducts(db: MockTransaction): Map<number, DomainProduct> {
  const brands = db.read('brands')
  const categories = db.read('categories')
  const batches = db.read('batches')
  const map = new Map<number, DomainProduct>()
  for (const p of db.read('products')) {
    if (p.id === undefined) continue
    const own = batches.filter((b) => b.productId === p.id && b.onHandQty > 0)
    const onHand = own.reduce((n, b) => n + b.onHandQty, 0)
    const avgCost = onHand > 0 ? Math.round(own.reduce((s, b) => s + b.costPrice * b.onHandQty, 0) / onHand) : 0
    map.set(p.id, {
      id: p.id,
      retailPrice: p.retailPrice,
      costPrice: avgCost,
      brandId: brands.find((b) => b.brandCode === p.brandCode)?.id ?? 0,
      categoryId: categories.find((c) => c.categoryCode === p.categoryCode)?.id ?? 0,
      isSellable: p.isSellable !== false,
      taxRate: p.taxRate,
    })
  }
  return map
}

export function toDomainCustomer(c: CustomerItem): DomainCustomer {
  return {
    id: c.id,
    tierRank: tierRankOf(c),
    tierDiscountRate: Number(c.tier.discountRate ?? 0),
    points: c.rewardPoints,
  }
}

export interface EngineResult {
  quote: OrderQuote
  pricing: PricingResult
  /** Phân bổ lô cho từng dòng `pricing.lines` (cùng thứ tự). */
  allocations: LotAllocation[][]
  customer: CustomerItem | null
  /** Các dòng đã đổi lô thủ công khác lô FEFO đầu tiên (ghi OVERRIDE_FEFO, luật 27). */
  overrides: { productId: number; lotCode: string }[]
}

const INVALID_VOUCHER_HINTS = ['không hợp lệ hoặc đã hết lượt', 'cần đơn từ']

/**
 * Tính giá + phân bổ lô FEFO cho một giỏ hàng. Chỉ đọc, không ghi: dùng cho xem giá lúc bán
 * và tính lại lúc hoàn tất. Giá luôn do `domain/pricing` tính, không có công thức khác.
 */
export function priceCart(
  db: MockTransaction,
  cart: CartInput,
  now: Date,
  options: { exchangeCreditAmount?: number } = {}
): EngineResult {
  const products = db.read('products')
  const productById = new Map(products.map((p) => [p.id as number, p]))

  // Gộp dòng trùng sản phẩm; dòng có đổi lô thủ công giữ lô đó.
  const merged = new Map<number, { quantity: number; batchId: number | null }>()
  for (const item of cart.items) {
    const product = productById.get(item.productId)
    if (!product) throw new MockHttpError(404, 'POS_PRODUCT_NOT_FOUND', `Không tìm thấy sản phẩm #${item.productId}`)
    if (!isPosSellable(product)) {
      throw new MockHttpError(422, 'POS_PRODUCT_NOT_SELLABLE', `${product.productName} không được bán tại quầy`)
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new MockHttpError(422, 'POS_QUANTITY_INVALID', 'Số lượng phải là số nguyên lớn hơn 0')
    }
    const prev = merged.get(item.productId)
    merged.set(item.productId, {
      quantity: (prev?.quantity ?? 0) + item.quantity,
      batchId: item.batchId ?? prev?.batchId ?? null,
    })
  }

  let customer: CustomerItem | null = null
  if (cart.customerId !== null) {
    customer = db.read('customers').find((c) => c.id === cart.customerId) ?? null
    if (!customer) throw new MockHttpError(404, 'CUS_NOT_FOUND', 'Không tìm thấy khách hàng')
    if (customer.status !== 'ACTIVE') {
      throw new MockHttpError(422, 'POS_CUSTOMER_INACTIVE', 'Khách hàng đã bị khóa ưu đãi, không thể gắn vào đơn')
    }
  }

  const usage = buildUsageIndex(db)
  const cartQty = new Map([...merged].map(([id, v]) => [id, v.quantity]))
  const pricing = calculateOrder({
    cart: [...merged].map(([productId, v]) => ({ productId, quantity: v.quantity })),
    products: domainProducts(db),
    promotions: toDomainPromotions(db, customer?.id ?? null, usage),
    customer: customer ? toDomainCustomer(customer) : null,
    voucherCode: cart.voucherCode ? cart.voucherCode.trim().toUpperCase() : null,
    pointsRequested: Math.max(0, Math.floor(cart.pointsRequested)),
    now,
    settings: {
      pointRedeemValue: loyaltySettings(db).redeemValue,
      pointMaxRedeemPercent: loyaltySettings(db).maxRedeemPercent,
    },
    hasStock: (productId, quantity) => sellableTotal(db, productId, now) - (cartQty.get(productId) ?? 0) >= quantity,
  })

  const messages = [...pricing.messages]

  // Phân bổ lô: lô thu ngân chọn tay (nếu có) đứng đầu, còn lại theo FEFO.
  const today = todayOf(now)
  const remaining = new Map<number, number>()
  const orderOf = new Map<number, Batch[]>()
  const overrides: { productId: number; lotCode: string }[] = []
  const overrideBatch = new Map<number, number>()
  const issues: OrderQuote['issues'] = []
  const forProduct = (productId: number): Batch[] => {
    const existing = orderOf.get(productId)
    if (existing) return existing
    const fefo = sellableBatches(db, productId, now)
    const manualId = merged.get(productId)?.batchId ?? null
    let ordered = fefo
    if (manualId !== null) {
      const manual = db.read('batches').find((b) => b.id === manualId && b.productId === productId)
      if (!manual) throw new MockHttpError(404, 'STK_BATCH_NOT_FOUND', 'Không tìm thấy lô hàng đã chọn')
      if (manual.expDate < today) {
        throw new MockHttpError(422, 'POS_BATCH_EXPIRED', `Lô ${manual.lotCode} đã hết hạn, không được bán`)
      }
      if (sellableQty(manual, today) <= 0) {
        throw new MockHttpError(422, 'POS_BATCH_NOT_SELLABLE', `Lô ${manual.lotCode} không còn tồn bán được`)
      }
      ordered = [manual, ...fefo.filter((b) => b.id !== manual.id)]
      if (fefo[0] && fefo[0].id !== manual.id) {
        overrides.push({ productId, lotCode: manual.lotCode })
        overrideBatch.set(productId, manual.id)
      }
    }
    for (const b of ordered) remaining.set(b.id, sellableQty(b, today))
    orderOf.set(productId, ordered)
    return ordered
  }

  const allocations: LotAllocation[][] = pricing.lines.map((line) => {
    const batches = forProduct(line.productId)
    const out: LotAllocation[] = []
    let need = line.quantity
    for (const b of batches) {
      if (need <= 0) break
      const free = remaining.get(b.id) ?? 0
      if (free <= 0) continue
      const take = Math.min(free, need)
      remaining.set(b.id, free - take)
      need -= take
      out.push({ batchId: b.id, lotCode: b.lotCode, expDate: b.expDate, quantity: take, overridden: overrideBatch.get(line.productId) === b.id })
    }
    if (need > 0) {
      const name = productById.get(line.productId)?.productName ?? `#${line.productId}`
      const message = `${name}: không đủ tồn bán được (thiếu ${need})`
      if (!issues.some((i) => i.productId === line.productId && i.message === message)) {
        issues.push({ productId: line.productId, message })
      }
    }
    return out
  })

  const promotionName = (id: number | null) => (id === null ? null : (db.read('promotions').find((p) => p.id === id)?.promotionName ?? null))
  const lines: QuoteLine[] = pricing.lines.map((l: PricedLine, i) => {
    const product = productById.get(l.productId) as ProductItem
    return {
      key: `${l.productId}-${i}`,
      productId: l.productId,
      sku: product.sku,
      productName: product.productName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineType: l.lineType,
      linePromotionId: l.linePromotionId,
      linePromotionName: promotionName(l.linePromotionId),
      promoGroupNo: l.promoGroupNo,
      lineDiscount: l.lineDiscount,
      tierDiscount: l.tierDiscount,
      orderDiscount: l.orderDiscount,
      pointsDiscount: l.pointsDiscount,
      lineTotal: l.lineTotal,
      taxAmount: l.taxAmount,
      allocations: allocations[i],
    }
  })

  const settings = loyaltySettings(db)
  const credit = options.exchangeCreditAmount ?? 0
  const afterOrderLevel = pricing.totalAmount + pricing.pointsDiscountAmount
  const maxByPercent = Math.floor(((afterOrderLevel * settings.maxRedeemPercent) / 100) / settings.redeemValue)
  const quote: OrderQuote = {
    lines,
    subtotalAmount: pricing.subtotalAmount,
    lineDiscountAmount: pricing.lineDiscountAmount,
    tierDiscountAmount: pricing.tierDiscountAmount,
    orderPromotionId: pricing.orderPromotionId,
    orderPromotionName: promotionName(pricing.orderPromotionId),
    orderDiscountAmount: pricing.orderDiscountAmount,
    pointsUsed: pricing.pointsUsed,
    pointsDiscountAmount: pricing.pointsDiscountAmount,
    discountAmount: pricing.discountAmount,
    taxAmount: pricing.taxAmount,
    totalAmount: pricing.totalAmount,
    exchangeCreditAmount: credit,
    amountDue: pricing.totalAmount - credit,
    messages,
    issues,
    pointsToEarn: customer ? Math.floor(pricing.totalAmount / settings.earnAmount) : 0,
    maxRedeemablePoints: customer ? Math.max(0, Math.min(customer.rewardPoints, maxByPercent)) : 0,
  }
  return { quote, pricing, allocations, customer, overrides }
}

/** Lý do mã voucher không dùng được lúc hoàn tất (luật 12: kiểm lại lượt dùng). */
export function voucherRejection(cart: CartInput, quote: OrderQuote): string | null {
  if (!cart.voucherCode) return null
  const bad = quote.messages.find((m) => INVALID_VOUCHER_HINTS.some((h) => m.includes(h)))
  return bad ?? null
}
