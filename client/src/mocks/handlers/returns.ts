import { z } from 'zod'
import type { ReturnLineRecord, ReturnOrderRecord } from '../../types/pos'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import { recordPoints } from '../loyalty'
import { describeReturnable, evaluateReturn, findOrderForReturn } from '../returns-engine'
import type { MockRoute } from '../router'
import { currentShiftOf } from '../sales-complete'
import { toReturnListItem } from '../sales-views'
import type { MockUser } from '../seed/users'
import { adjustBlockedQty, applyStockChange, assertBatchNotLocked, findBatchById } from '../stock-ledger'
import { toDateOnly, toIsoLocal } from '../time'

const quoteSchema = z.object({
  originalOrderId: z.number().int(),
  reason: z.enum(['DEFECTIVE', 'CHANGE_OF_MIND'], { error: 'Chọn lý do trả hàng' }),
  items: z
    .array(
      z.object({
        orderDetailId: z.number().int(),
        quantity: z.number().int().positive('Số lượng trả phải lớn hơn 0'),
        condition: z.enum(['INTACT', 'DAMAGED_OR_OPENED']),
      })
    )
    .default([]),
})
const createSchema = quoteSchema.extend({
  note: z.string().trim().optional(),
  refundMethod: z.enum(['CASH', 'BANK_TRANSFER', 'EXCHANGE']),
})

const canSeeAll = (permissions: string[]) => permissions.includes('POS_SHIFT_HANDOVER_CONFIRM')

export function createReturn(db: MockTransaction, input: z.infer<typeof createSchema>, user: MockUser, now: Date): ReturnOrderRecord {
  const shift = currentShiftOf(db, user.id)
  const { order, quote, refundMethod } = evaluateReturn(db, input, shift, now)
  const returns = db.read('returns')
  const returnId = db.nextSeq('return', returns.reduce((m, r) => Math.max(m, r.id), 0) + 1)
  const day = toDateOnly(now).replaceAll('-', '')
  const returnCode = `RET${day}-${String(db.nextSeq(`returnCode${day}`)).padStart(4, '0')}`
  const products = db.read('products')
  const conditionOf = new Map(input.items.map((i) => [i.orderDetailId, i.condition]))

  const lines: ReturnLineRecord[] = []
  for (const l of quote.lines) {
    const source = order.lines.find((x) => x.id === l.orderDetailId)
    if (!source) continue
    const product = products.find((p) => p.id === source.productId)
    if (l.kind === 'RETURN') {
      // Nhận hàng về: cộng tồn lô gốc kèm thẻ kho; hàng lỗi/đã mở cộng cả blocked_qty (luật 14).
      const batch = findBatchById(db, source.batchId)
      assertBatchNotLocked(batch)
      applyStockChange(db, {
        batch,
        change: l.quantity,
        referenceType: 'RETURN',
        referenceId: returnId,
        reason: `Nhận hàng trả ${returnCode}`,
        userId: user.id,
        now,
      })
      if (l.toBlocked) adjustBlockedQty(db, batch, l.quantity)
    }
    lines.push({
      id: db.nextSeq('returnDetail'),
      orderDetailId: source.id,
      productId: source.productId,
      sku: product?.sku ?? '',
      productName: source.productName,
      batchId: source.batchId,
      lotCode: source.lotCode,
      quantity: l.quantity,
      lineKind: l.kind,
      refundAmount: l.refundAmount,
      unitCost: source.costPrice,
      itemCondition: l.kind === 'RETURN' ? (conditionOf.get(source.id) ?? 'INTACT') : 'INTACT',
    })
  }

  const record: ReturnOrderRecord = {
    id: returnId,
    returnCode,
    originalOrderId: order.id,
    originalOrderCode: order.orderCode,
    shiftId: shift.shiftId,
    processedBy: user.id,
    processedByName: user.fullName,
    returnReason: input.reason,
    returnNote: input.note || null,
    totalRefundAmount: quote.totalRefund,
    refundMethod,
    pointsRevoked: quote.pointsRevoked,
    status: 'COMPLETED',
    createdAt: toIsoLocal(now),
    lines,
    exchangeOrderId: null,
    exchangeOrderCode: null,
  }
  returns.push(record)
  db.touch('returns')

  // Thu hồi điểm theo tỷ lệ tiền hoàn, trừ tổng chi tiêu, không hạ hạng (luật 21).
  const customer = order.customerId === null ? undefined : db.read('customers').find((c) => c.id === order.customerId)
  if (customer && quote.totalRefund > 0) {
    const revoke = Math.min(customer.rewardPoints, quote.pointsRevoked)
    recordPoints(customer, {
      actionType: 'REVOKE',
      pointsChanged: -revoke,
      orderCode: order.orderCode,
      returnCode,
      description: `Thu hồi ${revoke} điểm do trả hàng ${returnCode} (đơn ${order.orderCode})`,
      now,
    })
    customer.totalSpent = Math.max(0, parseFloat(customer.totalSpent) - quote.totalRefund).toFixed(2)
    db.touch('customers')
  }
  return record
}

export const returnRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/orders/:id/returnable',
    permission: 'POS_RETURN',
    handler: ({ db, params, now }) => {
      const order = findOrderForReturn(db, Number(params.id))
      return ok(describeReturnable(db, order, now), 'Lấy dòng hàng có thể trả thành công')
    },
  },
  {
    method: 'POST',
    path: '/returns/quote',
    permission: 'POS_RETURN',
    handler: ({ db, body, user, now }) => {
      const input = parseBody(quoteSchema, body)
      const shift = db.read('shifts').find((s) => s.cashierId === user?.id && s.status === 'OPEN') ?? null
      return ok(evaluateReturn(db, input, shift, now).quote, 'Tính tiền trả hàng thành công')
    },
  },
  {
    method: 'POST',
    path: '/returns',
    permission: 'POS_RETURN',
    handler: ({ db, body, user, now }) => {
      const input = parseBody(createSchema, body)
      if (!user) throw new MockHttpError(401, 'AUTH_UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ')
      return ok(createReturn(db, input, user, now), 'Đã lập phiếu trả hàng', 201)
    },
  },
  {
    method: 'GET',
    path: '/returns',
    permission: 'POS_VIEW',
    handler: ({ db, query, user, permissions }) => {
      const kw = keywordOf(query)
      const reason = query.get('reason')
      const items = db
        .read('returns')
        .filter(
          (r) =>
            (canSeeAll(permissions) || r.processedBy === user?.id) &&
            (!kw || r.returnCode.toLowerCase().includes(kw) || r.originalOrderCode.toLowerCase().includes(kw)) &&
            (!reason || reason === 'ALL' || r.returnReason === reason)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toReturnListItem)
      return ok(paginate(items, query, 10), 'Lấy danh sách phiếu trả thành công')
    },
  },
  {
    method: 'GET',
    path: '/returns/:id',
    permission: 'POS_VIEW',
    handler: ({ db, params, user, permissions }) => {
      const ret = db.read('returns').find((r) => String(r.id) === params.id)
      if (!ret) throw notFound('RET_NOT_FOUND', 'Không tìm thấy phiếu trả')
      if (!canSeeAll(permissions) && ret.processedBy !== user?.id) {
        throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Bạn chỉ được xem phiếu trả do mình lập')
      }
      return ok(ret, 'Lấy chi tiết phiếu trả thành công')
    },
  },
]
