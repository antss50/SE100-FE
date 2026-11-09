import { z } from 'zod'
import { expiryStatusForProduct, sellableQty } from '../../domain/stock/batch'
import type { CartInput, OrderRecord, PosLot, PosProduct } from '../../types/pos'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
import type { MockUser } from '../seed/users'
import { currentShiftOf, completeSale, exchangeCreditOf, nextOrderCode } from '../sales-complete'
import { isPosSellable, priceCart, sellableBatches, sellableTotal } from '../sales-engine'
import { amountDueOf, toOrderListItem, toReturnListItem } from '../sales-views'
import { todayOf } from '../stock-ledger'
import { toIsoLocal } from '../time'

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        quantity: z.number().int().positive('Số lượng phải lớn hơn 0'),
        batchId: z.number().int().nullish(),
      })
    )
    .default([]),
  customerId: z.number().int().nullable().default(null),
  voucherCode: z.string().trim().nullable().default(null),
  pointsRequested: z.number().int().min(0).default(0),
  exchangeReturnId: z.number().int().nullish(),
})

const completeSchema = cartSchema.extend({
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD'], { error: 'Chọn phương thức thanh toán' }),
  amountReceived: z.number().min(0).nullish(),
  draftId: z.number().int().nullish(),
})

const canSeeAll = (permissions: string[]) => permissions.includes('POS_SHIFT_HANDOVER_CONFIRM')

/** Kiểm quyền dùng voucher / điểm (PROMOTION_APPLY_VOUCHER, LOYALTY_REDEEM). */
function assertCartPermissions(cart: CartInput, permissions: string[]) {
  if (cart.voucherCode && !permissions.includes('PROMOTION_APPLY_VOUCHER')) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Bạn không có quyền áp mã voucher')
  }
  if (cart.pointsRequested > 0 && !permissions.includes('LOYALTY_REDEEM')) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Bạn không có quyền dùng điểm thưởng')
  }
}

function toPosProduct(db: MockTransaction, productId: number, now: Date): PosProduct | null {
  const p = db.read('products').find((x) => x.id === productId)
  if (!p || p.id === undefined || !isPosSellable(p)) return null
  const lots = sellableBatches(db, p.id, now)
  const total = sellableTotal(db, p.id, now)
  if (total <= 0) return null
  const today = todayOf(now)
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode ?? null,
    productName: p.productName,
    brandName: p.brandName ?? null,
    categoryName: p.categoryName ?? null,
    retailPrice: p.retailPrice,
    sellableQty: total,
    firstLotCode: lots[0]?.lotCode ?? null,
    firstLotExpDate: lots[0]?.expDate ?? null,
    nearExpiry: lots[0] ? expiryStatusForProduct(lots[0].expDate, today, p) === 'NEAR_EXPIRY' : false,
  }
}

function findOrder(db: MockTransaction, id: string): OrderRecord {
  const order = db.read('orders').find((o) => String(o.id) === id)
  if (!order) throw notFound('POS_ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng')
  return order
}

/** Lưu hoặc cập nhật đơn nháp của thu ngân (dùng cả cho seed đơn mẫu). */
export function saveDraft(
  db: MockTransaction,
  input: CartInput & { draftId?: number | null },
  user: MockUser,
  now: Date
): { record: OrderRecord; existed: boolean } {
  const shift = currentShiftOf(db, user.id)
  if (input.items.length === 0) throw new MockHttpError(422, 'POS_CART_EMPTY', 'Giỏ hàng chưa có sản phẩm để lưu nháp')
  const credit = exchangeCreditOf(db, input.exchangeReturnId)
  const { quote, customer } = priceCart(db, input, now, { exchangeCreditAmount: credit })
  const orders = db.read('orders')
  const existing = input.draftId ? orders.find((o) => o.id === input.draftId && o.status === 'DRAFT') : undefined
  if (input.draftId && !existing) {
    throw new MockHttpError(409, 'POS_DRAFT_NOT_FOUND', 'Đơn nháp không còn tồn tại hoặc đã được xử lý')
  }
  const cart: CartInput = {
    items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity, batchId: i.batchId ?? null })),
    customerId: input.customerId,
    voucherCode: input.voucherCode,
    pointsRequested: input.pointsRequested,
    exchangeReturnId: input.exchangeReturnId ?? null,
  }
  const record: OrderRecord = {
    id: existing?.id ?? db.nextSeq('order', orders.reduce((m, o) => Math.max(m, o.id), 0) + 1),
    orderCode: existing?.orderCode ?? nextOrderCode(db, now),
    shiftId: shift.shiftId,
    cashierId: user.id ?? 0,
    cashierName: user.fullName,
    customerId: customer?.id ?? null,
    customerName: customer?.fullName ?? null,
    customerPhone: customer?.phoneNumber ?? null,
    policyId: db.read('returnPolicies')[0]?.id ?? 1,
    orderPromotionId: quote.orderPromotionId,
    orderPromotionName: quote.orderPromotionName,
    voucherCode: input.voucherCode,
    subtotalAmount: quote.subtotalAmount,
    lineDiscountAmount: quote.lineDiscountAmount,
    tierDiscountAmount: quote.tierDiscountAmount,
    orderDiscountAmount: quote.orderDiscountAmount,
    pointsUsed: quote.pointsUsed,
    pointsDiscountAmount: quote.pointsDiscountAmount,
    discountAmount: quote.discountAmount,
    taxAmount: quote.taxAmount,
    totalAmount: quote.totalAmount,
    exchangeReturnId: cart.exchangeReturnId ?? null,
    exchangeCreditAmount: credit,
    paymentMethod: null,
    amountReceived: null,
    changeDue: null,
    status: 'DRAFT',
    createdAt: existing?.createdAt ?? toIsoLocal(now),
    completedAt: null,
    pointsEarned: 0,
    lines: [],
    draftCart: cart,
  }
  if (existing) Object.assign(existing, record)
  else orders.push(record)
  db.touch('orders')
  return { record, existed: Boolean(existing) }
}

export const orderRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/pos/products',
    permission: 'POS_CHECKOUT',
    handler: ({ db, query, now }) => {
      const kw = keywordOf(query)
      const code = (query.get('code') ?? '').trim().toLowerCase()
      const items = db
        .read('products')
        .filter((p) => {
          if (code) return (p.barcode ?? '').toLowerCase() === code || p.sku.toLowerCase() === code
          return !kw || p.sku.toLowerCase().includes(kw) || p.productName.toLowerCase().includes(kw) || (p.barcode ?? '').includes(kw)
        })
        .map((p) => (p.id === undefined ? null : toPosProduct(db, p.id, now)))
        .filter((p): p is PosProduct => p !== null)
      return ok(paginate(items, query, 24), 'Lấy sản phẩm bán hàng thành công')
    },
  },
  {
    method: 'GET',
    path: '/pos/products/:id/lots',
    permission: 'POS_CHECKOUT',
    handler: ({ db, params, now }) => {
      const productId = Number(params.id)
      const today = todayOf(now)
      const product = db.read('products').find((p) => p.id === productId)
      const lots: PosLot[] = sellableBatches(db, productId, now).map((b) => ({
        batchId: b.id,
        lotCode: b.lotCode,
        expDate: b.expDate,
        sellableQty: sellableQty(b, today),
        nearExpiry: expiryStatusForProduct(b.expDate, today, product) === 'NEAR_EXPIRY',
      }))
      return ok(lots, 'Lấy danh sách lô bán được thành công')
    },
  },
  {
    method: 'POST',
    path: '/orders/quote',
    permission: 'POS_CHECKOUT',
    handler: ({ db, body, now, permissions }) => {
      const cart = parseBody(cartSchema, body)
      assertCartPermissions(cart, permissions)
      const credit = exchangeCreditOf(db, cart.exchangeReturnId)
      return ok(priceCart(db, cart, now, { exchangeCreditAmount: credit }).quote, 'Tính giá thành công')
    },
  },
  {
    method: 'POST',
    path: '/orders/complete',
    permission: 'POS_CHECKOUT',
    handler: ({ db, body, user, now, permissions }) => {
      const input = parseBody(completeSchema, body)
      assertCartPermissions(input, permissions)
      if (!user) throw new MockHttpError(401, 'AUTH_UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ')
      const order = completeSale(db, input, user, now)
      return ok(order, 'Thanh toán thành công', 201)
    },
  },
  {
    method: 'GET',
    path: '/orders/drafts',
    permission: 'POS_CHECKOUT',
    handler: ({ db, user }) => {
      const items = db
        .read('orders')
        .filter((o) => o.status === 'DRAFT' && o.cashierId === user?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toOrderListItem)
      return ok(items, 'Lấy đơn nháp thành công')
    },
  },
  {
    method: 'POST',
    path: '/orders/drafts',
    permission: 'POS_CHECKOUT',
    handler: ({ db, body, user, now, permissions }) => {
      const input = parseBody(cartSchema.extend({ draftId: z.number().int().nullish() }), body)
      assertCartPermissions(input, permissions)
      if (!user) throw new MockHttpError(401, 'AUTH_UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ')
      const { record, existed } = saveDraft(db, input, user, now)
      return ok(record, 'Đã lưu đơn nháp', existed ? 200 : 201)
    },
  },
  {
    method: 'POST',
    path: '/orders/:id/cancel',
    permission: 'POS_CHECKOUT',
    handler: ({ db, params, user }) => {
      const order = findOrder(db, params.id)
      if (order.cashierId !== user?.id) throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Chỉ thu ngân lập đơn mới được hủy đơn nháp')
      if (order.status !== 'DRAFT') {
        throw new MockHttpError(409, 'POS_ORDER_NOT_DRAFT', 'Chỉ hủy được đơn nháp; chứng từ đã hoàn tất không sửa, không xóa')
      }
      order.status = 'CANCELLED'
      order.draftCart = null
      db.touch('orders')
      return ok(toOrderListItem(order), 'Đã hủy đơn nháp')
    },
  },
  {
    method: 'GET',
    path: '/orders',
    permission: 'POS_VIEW',
    handler: ({ db, query, user, permissions }) => {
      const kw = keywordOf(query)
      const status = query.get('status')
      const method = query.get('paymentMethod')
      const from = query.get('fromDate')
      const to = query.get('toDate')
      const shiftId = Number(query.get('shiftId')) || null
      const items = db
        .read('orders')
        .filter((o) => {
          if (!canSeeAll(permissions) && o.cashierId !== user?.id) return false
          if (kw && ![o.orderCode, o.customerName ?? '', o.customerPhone ?? ''].some((v) => v.toLowerCase().includes(kw))) return false
          if (status && status !== 'ALL' && o.status !== status) return false
          if (method && method !== 'ALL' && o.paymentMethod !== method) return false
          const day = (o.completedAt ?? o.createdAt).slice(0, 10)
          if (from && day < from) return false
          if (to && day > to) return false
          return !shiftId || o.shiftId === shiftId
        })
        .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))
      const completed = items.filter((o) => o.status === 'COMPLETED')
      const summary = {
        completedCount: completed.length,
        totalRevenue: completed.reduce((s, o) => s + o.totalAmount, 0),
        cashCollected: completed.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + amountDueOf(o), 0),
      }
      return ok({ ...paginate(items.map(toOrderListItem), query, 10), summary }, 'Lấy lịch sử đơn hàng thành công')
    },
  },
  {
    method: 'GET',
    path: '/orders/:id',
    permission: 'POS_VIEW',
    handler: ({ db, params, user, permissions }) => {
      const order = findOrder(db, params.id)
      if (!canSeeAll(permissions) && order.cashierId !== user?.id) {
        throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Bạn chỉ được xem đơn hàng do mình lập')
      }
      const returns = db.read('returns').filter((r) => r.originalOrderId === order.id)
      const returned: Record<number, number> = {}
      for (const r of returns) {
        if (r.status !== 'COMPLETED') continue
        for (const l of r.lines) returned[l.orderDetailId] = (returned[l.orderDetailId] ?? 0) + (l.lineKind === 'RETURN' ? l.quantity : 0)
      }
      const shift = db.read('shifts').find((s) => s.shiftId === order.shiftId)
      return ok(
        { order, returns: returns.map(toReturnListItem), returnedQuantities: returned, shiftCode: shift?.shiftCode ?? '' },
        'Lấy chi tiết đơn hàng thành công'
      )
    },
  },
]
