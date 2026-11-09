// Đợt test 1 (GĐ2 bán hàng): ca, POS, thanh toán, đổi trả qua apiRequest + mock.
// Viết từ luật: QUY_TAC_NGHIEP_VU 9-23, 34-41, 47; KHUYEN_MAI.md; API-CONTRACT mục POS.
import { beforeEach, describe, expect, it } from 'vitest'
import { expectFail, fails, freshDb, get, loginAs, peek, post, put, send, type Page } from '../test/api-helpers'

interface Alloc {
  batchId: number
  quantity: number
  lotCode: string
}
interface Quote {
  lines: { productId: number; quantity: number; lineTotal: number; allocations: Alloc[] }[]
  totalAmount: number
  amountDue: number
  discountAmount: number
  orderDiscountAmount: number
  pointsUsed: number
  pointsToEarn: number
  maxRedeemablePoints: number
  issues: { productId: number; message: string }[]
  messages: string[]
}
interface Order {
  id: number
  status: string
  totalAmount: number
  amountDue?: number
  pointsEarned: number
  lines: { id: number; productId: number; quantity: number; lineTotal: number; batchId: number }[]
}
interface Batch {
  id: number
  onHandQty: number
  blockedQty: number
}
interface Cust {
  id: number
  customerCode: string
  rewardPoints: number
  totalSpent: string
  tier: { tierCode: string }
}
interface ReturnRec {
  id: number
  totalRefundAmount: number
  refundMethod: string
  pointsRevoked: number
}

type Cart = { items: { productId: number; quantity: number; batchId?: number }[]; customerId?: number | null; voucherCode?: string | null; pointsRequested?: number }

const quote = (cart: Cart) => send<Quote>('/orders/quote', post(cart))
const cash = (cart: Cart, amountReceived = 100_000_000) =>
  send<Order>('/orders/complete', post({ ...cart, paymentMethod: 'CASH', amountReceived }))
const openShift = (openingCash = 1_000_000) => send<{ shiftId: number }>('/shifts/open', post({ openingCash }))
const batchOnHand = (id: number) =>
  peek(async () => {
    const items = (await get<Page<Batch>>('/stock/batches?pageSize=200')).items
    return items.find((b) => b.id === id) as Batch
  })
const customerOf = async (code: string) => (await get<Page<Cust>>(`/customers?keyword=${code}`)).items.find((c) => c.customerCode === code) as Cust
const asRole = async (user: string, fn: () => Promise<void>) => {
  await loginAs(user)
  await fn()
}

beforeEach(freshDb)

describe('POS-01/05 ca bán hàng', () => {
  it('chưa mở ca: hoàn tất đơn bị chặn 409; mở ca xong bán được', async () => {
    await loginAs('cashier01')
    expect((await get<{ hasOpenShift: boolean }>('/shifts/current')).hasOpenShift).toBe(false)
    await expectFail('/orders/complete', post({ items: [{ productId: 5, quantity: 1 }], paymentMethod: 'CASH', amountReceived: 1_000_000 }), 409, 'POS_SHIFT_NOT_OPEN')
    await openShift()
    expect((await cash({ items: [{ productId: 5, quantity: 1 }] })).status).toBe('COMPLETED')
  })

  it('mỗi thu ngân chỉ 1 ca OPEN (luật 35); quản lý không mở ca', async () => {
    await loginAs('cashier01')
    await openShift()
    await expectFail('/shifts/open', post({ openingCash: 0 }), 409, 'POS_SHIFT_ALREADY_OPEN')
    await loginAs('manager01')
    await expectFail('/shifts/open', post({ openingCash: 0 }), 403, 'AUTH_FORBIDDEN')
  })

  it('chốt ca chặn khi còn đơn nháp ; lệch tiền bắt buộc giải trình (luật 37)', async () => {
    await loginAs('cashier01')
    const shift = await openShift(1_000_000)
    const draft = await send<Order>('/orders/drafts', post({ items: [{ productId: 5, quantity: 1 }] }))
    await expectFail(`/shifts/${shift.shiftId}/close`, post({ actualCash: 1_000_000 }), 422, 'POS_SHIFT_HAS_DRAFT')
    await send(`/orders/${draft.id}/cancel`, post({}))
    await expectFail(`/shifts/${shift.shiftId}/close`, post({ actualCash: 990_000 }), 422, 'POS_SHIFT_NOTE_REQUIRED')
    const closed = await send<{ shift: { status: string; differenceAmount: number; expectedCash: number } }>(
      `/shifts/${shift.shiftId}/close`,
      post({ actualCash: 990_000, note: 'Thiếu 10k trả khách' })
    )
    expect(closed.shift).toMatchObject({ status: 'CLOSED', expectedCash: 1_000_000, differenceAmount: -10_000 })
  })

  it('kỳ vọng két = đầu ca + tiền mặt thu; chốt đúng số thì không cần giải trình', async () => {
    await loginAs('cashier01')
    const shift = await openShift(500_000)
    const order = await cash({ items: [{ productId: 5, quantity: 1 }] })
    const closed = await send<{ shift: { expectedCash: number; differenceAmount: number } }>(
      `/shifts/${shift.shiftId}/close`,
      post({ actualCash: 500_000 + order.totalAmount })
    )
    expect(closed.shift).toMatchObject({ expectedCash: 500_000 + order.totalAmount, differenceAmount: 0 })
  })

  it('xác nhận bàn giao: chỉ Manager, ca đã đóng, 1 lần', async () => {
    await loginAs('cashier01')
    const shift = await openShift()
    await expectFail(`/shifts/${shift.shiftId}/confirm-handover`, post({}), 403, 'AUTH_FORBIDDEN')
    await send(`/shifts/${shift.shiftId}/close`, post({ actualCash: 1_000_000 }))
    await loginAs('manager01')
    await send(`/shifts/${shift.shiftId}/confirm-handover`, post({}))
    await expectFail(`/shifts/${shift.shiftId}/confirm-handover`, post({}), 409, 'POS_HANDOVER_ALREADY_CONFIRMED')
  })
})

describe('POS-02 FEFO', () => {
  beforeEach(async () => {
    await loginAs('cashier01')
    await openShift()
  })

  it('FEFO tách lô: lô gần hạn trước, hết lô thì sang lô sau', async () => {
    const q = await quote({ items: [{ productId: 3, quantity: 30 }] })
    expect(q.issues).toHaveLength(0)
    const allocs = q.lines[0].allocations
    expect(allocs.map((a) => a.batchId)).toEqual([15, 16])
    expect(allocs[0].quantity).toBe(25) // lô 15: tồn 26, cách ly 1
    expect(allocs[1].quantity).toBe(5)
  })

  it('lô hết hạn không được bán; thiếu tồn ghi vào issues', async () => {
    const q = await quote({ items: [{ productId: 4, quantity: 56 }] })
    expect(q.lines[0].allocations.every((a) => a.batchId !== 1)).toBe(true)
    const over = await quote({ items: [{ productId: 4, quantity: 57 }] })
    expect(over.issues.length).toBeGreaterThan(0)
    // lô chọn tay đã hết hạn: quay về FEFO + thông báo, không bán lô hết hạn (ghi chú KIEN-THUC, a08b76f)
    const manual = await quote({ items: [{ productId: 4, quantity: 1, batchId: 1 }] })
    expect(manual.lines[0].allocations.every((a) => a.batchId !== 1)).toBe(true)
    await expectFail(
      '/orders/complete',
      post({ items: [{ productId: 4, quantity: 57 }], paymentMethod: 'CASH', amountReceived: 99_999_999 }),
      422,
      'POS_INSUFFICIENT_STOCK'
    )
  })

  it('SKU tester không bán: không có trong danh sách POS, quote → 422', async () => {
    const list = await get<Page<{ sku: string }>>('/pos/products?pageSize=100')
    expect(list.items.some((p) => p.sku.endsWith('-TST'))).toBe(false)
    await expectFail('/orders/quote', post({ items: [{ productId: 9, quantity: 1 }] }), 422, 'POS_PRODUCT_NOT_SELLABLE')
  })

  it('POS không lộ tồn thực/giá vốn', async () => {
    const list = await get<Page<Record<string, unknown>>>('/pos/products?pageSize=100')
    for (const p of list.items) {
      expect(p).not.toHaveProperty('onHandQty')
      expect(p).not.toHaveProperty('costPrice')
      expect(p).not.toHaveProperty('blockedQty')
    }
  })

  it('đổi lô tay khác lô FEFO đầu → ghi audit OVERRIDE_FEFO', async () => {
    await cash({ items: [{ productId: 3, quantity: 1, batchId: 16 }] })
    await loginAs('admin')
    const logs = await get<Page<unknown>>('/audit-logs?pageSize=100')
    expect(JSON.stringify(logs.items)).toContain('OVERRIDE_FEFO')
  })
})

describe('POS-03 thanh toán', () => {
  beforeEach(async () => {
    await loginAs('cashier01')
    await openShift()
  })

  it('hoàn tất trừ tồn đúng lô, ghi thẻ kho SALE, tích điểm, cộng chi tiêu, đơn vào lịch sử', async () => {
    const c0 = await customerOf('KH0004')
    const b0 = await batchOnHand(15)
    const cart: Cart = { items: [{ productId: 3, quantity: 2 }], customerId: c0.id }
    const q = await quote(cart)
    expect(q.lines[0].allocations[0].batchId).toBe(15)
    const order = await cash(cart)
    expect(order.status).toBe('COMPLETED')
    expect((await batchOnHand(15)).onHandQty).toBe(b0.onHandQty - 2)
    const mv = await peek(() => get<{ movements: { referenceType: string; quantityChange: number }[] }>('/stock/batches/15'))
    expect(mv.movements[0]).toMatchObject({ referenceType: 'SALE', quantityChange: -2 })
    const c1 = await customerOf('KH0004')
    expect(c1.rewardPoints - c0.rewardPoints).toBe(Math.floor(order.totalAmount / 10000) - 0)
    expect(Number(c1.totalSpent) - Number(c0.totalSpent)).toBe(order.totalAmount)
    const hist = await get<Page<{ id: number }>>('/orders?pageSize=50')
    expect(hist.items.some((o) => o.id === order.id)).toBe(true)
  })

  it('tiền mặt thiếu → 422 POS_CASH_INSUFFICIENT, không trừ tồn (luật 39, 40)', async () => {
    const b0 = await batchOnHand(15)
    await expectFail(
      '/orders/complete',
      post({ items: [{ productId: 3, quantity: 2 }], paymentMethod: 'CASH', amountReceived: 1000 }),
      422,
      'POS_CASH_INSUFFICIENT'
    )
    expect((await batchOnHand(15)).onHandQty).toBe(b0.onHandQty)
  })

  it('giỏ rỗng → 422; phương thức thanh toán lạ → 400', async () => {
    await expectFail('/orders/complete', post({ items: [], paymentMethod: 'CASH', amountReceived: 1 }), 422, 'POS_CART_EMPTY')
    await expectFail('/orders/complete', post({ items: [{ productId: 5, quantity: 1 }], paymentMethod: 'MOMO' }), 400, 'COMMON_VALIDATION_FAILED')
  })

  it('chuyển khoản/thẻ không cần nhập tiền nhận', async () => {
    const o = await send<Order>('/orders/complete', post({ items: [{ productId: 5, quantity: 1 }], paymentMethod: 'CARD' }))
    expect(o.status).toBe('COMPLETED')
  })

  it('dùng điểm vượt mức tối đa → 422; dùng đúng mức được và trừ điểm', async () => {
    const c0 = await customerOf('KH0001')
    const base: Cart = { items: [{ productId: 5, quantity: 1 }], customerId: c0.id }
    await expectFail(
      '/orders/complete',
      post({ ...base, pointsRequested: c0.rewardPoints, paymentMethod: 'CASH', amountReceived: 9_999_999 }),
      422,
      'POS_POINTS_EXCEED_LIMIT'
    )
    const q0 = await quote(base)
    expect(q0.maxRedeemablePoints).toBeGreaterThan(0)
    // tối đa 50% giá trị đơn (POINT_MAX_REDEEM_PERCENT), 1 điểm = 100 đ
    expect(q0.maxRedeemablePoints * 100).toBeLessThanOrEqual(q0.totalAmount * 0.5)
    const order = await cash({ ...base, pointsRequested: q0.maxRedeemablePoints })
    expect(order.status).toBe('COMPLETED')
    const c1 = await customerOf('KH0001')
    expect(c1.rewardPoints).toBeLessThan(c0.rewardPoints + order.pointsEarned)
    expect(c1.rewardPoints).toBe(c0.rewardPoints - q0.maxRedeemablePoints + order.pointsEarned)
  })

  it('voucher tầng 3: mã không tồn tại → 422; chưa đủ hạng → 422; voucher hợp lệ không làm tổng đơn tăng', async () => {
    const bronze = await customerOf('KH0004')
    const cart: Cart = { items: [{ productId: 1, quantity: 1 }], customerId: bronze.id }
    await expectFail(
      '/orders/complete',
      post({ ...cart, voucherCode: 'KHONGCO', paymentMethod: 'CASH', amountReceived: 99_999_999 }),
      422,
      'PROM_VOUCHER_INVALID'
    )
    await expectFail(
      '/orders/complete',
      post({ ...cart, voucherCode: 'WELCOME10', paymentMethod: 'CASH', amountReceived: 99_999_999 }),
      422,
      'PROM_VOUCHER_INVALID'
    )
    const without = await quote(cart)
    const withV = await quote({ ...cart, voucherCode: 'GIAM100' })
    expect(withV.totalAmount).toBeLessThanOrEqual(without.totalAmount)
  })

  it('đơn đã hoàn tất không hủy được (luật 41)', async () => {
    const o = await cash({ items: [{ productId: 5, quantity: 1 }] })
    await expectFail(`/orders/${o.id}/cancel`, post({}), 409, 'POS_ORDER_NOT_DRAFT')
  })
})

describe('POS-04 đổi trả', () => {
  const sell = async (cart: Cart) => cash(cart)
  const ret = (orderId: number, reason: string, items: unknown[], refundMethod = 'CASH') =>
    send<ReturnRec>('/returns', post({ originalOrderId: orderId, reason, items, refundMethod }))

  beforeEach(async () => {
    await loginAs('cashier01')
    await openShift(0)
  })

  it('hàng lỗi: hoàn theo lineTotal đã lưu, nhập lại kho và cách ly (blocked tăng), két đủ hoàn tiền mặt', async () => {
    const o = await sell({ items: [{ productId: 3, quantity: 3 }] })
    const ln = o.lines[0]
    const b0 = await batchOnHand(ln.batchId)
    const r = await ret(o.id, 'DEFECTIVE', [{ orderDetailId: ln.id, quantity: 1, condition: 'DAMAGED_OR_OPENED' }])
    expect(Math.abs(r.totalRefundAmount - ln.lineTotal / 3)).toBeLessThanOrEqual(1)
    expect(r.refundMethod).toBe('CASH')
    const b1 = await batchOnHand(ln.batchId)
    expect(b1.onHandQty).toBe(b0.onHandQty + 1)
    expect(b1.blockedQty).toBe(b0.blockedQty + 1)
  })

  it('đổi ý: hàng đã mở seal → 422 RET_SEAL_BROKEN; còn nguyên seal → EXCHANGE, nhập lại kho không cách ly', async () => {
    const o = await sell({ items: [{ productId: 3, quantity: 2 }] })
    const ln = o.lines[0]
    await expectFail(
      '/returns',
      post({ originalOrderId: o.id, reason: 'CHANGE_OF_MIND', items: [{ orderDetailId: ln.id, quantity: 1, condition: 'DAMAGED_OR_OPENED' }], refundMethod: 'EXCHANGE' }),
      422,
      'RET_SEAL_BROKEN'
    )
    const b0 = await batchOnHand(ln.batchId)
    const r = await ret(o.id, 'CHANGE_OF_MIND', [{ orderDetailId: ln.id, quantity: 1, condition: 'INTACT' }], 'EXCHANGE')
    expect(r.refundMethod).toBe('EXCHANGE')
    const b1 = await batchOnHand(ln.batchId)
    expect(b1.onHandQty).toBe(b0.onHandQty + 1)
    expect(b1.blockedQty).toBe(b0.blockedQty)
  })

  it('đổi ý không được hoàn tiền mặt (luật: đổi ý chỉ đổi hàng)', async () => {
    const o = await sell({ items: [{ productId: 3, quantity: 1 }] })
    const err = await fails('/returns', post({
      originalOrderId: o.id,
      reason: 'CHANGE_OF_MIND',
      items: [{ orderDetailId: o.lines[0].id, quantity: 1, condition: 'INTACT' }],
      refundMethod: 'CASH',
    }))
    expect(err.status).toBeGreaterThanOrEqual(400)
    expect(err.status).toBeLessThan(500)
  })

  it('trả vượt số đã mua (cộng dồn các lần trả) → 422 RET_QUANTITY_EXCEEDED', async () => {
    const o = await sell({ items: [{ productId: 3, quantity: 2 }] })
    const ln = o.lines[0]
    await expectFail(
      '/returns',
      post({ originalOrderId: o.id, reason: 'DEFECTIVE', items: [{ orderDetailId: ln.id, quantity: 3, condition: 'DAMAGED_OR_OPENED' }], refundMethod: 'CASH' }),
      422,
      'RET_QUANTITY_EXCEEDED'
    )
    await ret(o.id, 'DEFECTIVE', [{ orderDetailId: ln.id, quantity: 2, condition: 'DAMAGED_OR_OPENED' }])
    await expectFail(
      '/returns',
      post({ originalOrderId: o.id, reason: 'DEFECTIVE', items: [{ orderDetailId: ln.id, quantity: 1, condition: 'DAMAGED_OR_OPENED' }], refundMethod: 'CASH' }),
      422,
      'RET_QUANTITY_EXCEEDED'
    )
  })

  it('quá hạn đổi trả (luật 16): maxReturnDays = 0 thì đơn cũ bị chặn', async () => {
    const orders = await get<Page<{ id: number; status: string; createdAt: string }>>('/orders?status=COMPLETED&pageSize=50')
    const old = orders.items.find((o) => o.createdAt.slice(0, 10) < new Date().toISOString().slice(0, 10)) as { id: number }
    const detail = await get<{ order: Order }>(`/orders/${old.id}`)
    await loginAs('admin')
    await send('/settings', put({ settings: {}, maxReturnDays: 0 }))
    await loginAs('cashier01')
    await expectFail(
      '/returns',
      post({ originalOrderId: old.id, reason: 'DEFECTIVE', items: [{ orderDetailId: detail.order.lines[0].id, quantity: 1, condition: 'DAMAGED_OR_OPENED' }], refundMethod: 'CASH' }),
      422,
      'RET_EXPIRED'
    )
  })

  it('két thiếu tiền mặt → hoàn chuyển sang BANK_TRANSFER (luật 23)', async () => {
    // ca mở với đầu ca 0, chưa thu tiền mặt: đơn cũ của cashier01 trả hàng lỗi
    const orders = await get<Page<{ id: number; paymentMethod: string; status: string }>>('/orders?status=COMPLETED&pageSize=50')
    const cashOrder = orders.items.find((o) => o.paymentMethod === 'CASH') as { id: number }
    const detail = await get<{ order: Order }>(`/orders/${cashOrder.id}`)
    const ln = detail.order.lines[0]
    const rq = await send<{ refundMethod: string; cashShortfall: boolean }>(
      '/returns/quote',
      post({ originalOrderId: cashOrder.id, reason: 'DEFECTIVE', items: [{ orderDetailId: ln.id, quantity: ln.quantity, condition: 'DAMAGED_OR_OPENED' }] })
    )
    expect(rq).toMatchObject({ refundMethod: 'BANK_TRANSFER', cashShortfall: true })
  })

  it('đổi hàng: hàng mới rẻ hơn hàng cũ bị chặn; đắt hơn thì thu phần chênh', async () => {
    const o = await sell({ items: [{ productId: 3, quantity: 1 }] }) // chống nắng 685.000
    const r = await ret(o.id, 'CHANGE_OF_MIND', [{ orderDetailId: o.lines[0].id, quantity: 1, condition: 'INTACT' }], 'EXCHANGE')
    await expectFail(
      '/orders/complete',
      post({ items: [{ productId: 5, quantity: 1 }], exchangeReturnId: r.id, paymentMethod: 'CASH', amountReceived: 9_999_999 }),
      422,
      'RET_EXCHANGE_BELOW_CREDIT'
    )
    const ex = await send<Order & { exchangeCreditAmount: number }>(
      '/orders/complete',
      post({ items: [{ productId: 1, quantity: 1 }], exchangeReturnId: r.id, paymentMethod: 'CASH', amountReceived: 99_999_999 })
    )
    expect(ex.exchangeCreditAmount).toBe(r.totalRefundAmount)
    await expectFail(
      '/orders/complete',
      post({ items: [{ productId: 1, quantity: 1 }], exchangeReturnId: r.id, paymentMethod: 'CASH', amountReceived: 99_999_999 }),
      409,
      'RET_EXCHANGE_ALREADY_USED'
    )
  })

  it('thu hồi điểm khi trả, trừ chi tiêu, KHÔNG hạ hạng (luật 20-22)', async () => {
    const c0 = await customerOf('KH0004') // Đồng, 1.885.000
    const o = await sell({ items: [{ productId: 1, quantity: 1 }], customerId: c0.id }) // ~3,4 triệu → lên Bạc
    const c1 = await customerOf('KH0004')
    expect(c1.tier.tierCode).toBe('SILVER')
    const r = await ret(o.id, 'DEFECTIVE', [{ orderDetailId: o.lines[0].id, quantity: 1, condition: 'DAMAGED_OR_OPENED' }])
    const c2 = await customerOf('KH0004')
    expect(r.pointsRevoked).toBeGreaterThan(0)
    expect(c2.rewardPoints).toBe(c1.rewardPoints - r.pointsRevoked)
    expect(Number(c2.totalSpent)).toBeLessThan(3_000_000)
    expect(c2.tier.tierCode).toBe('SILVER')
  })
})

describe('Phân quyền bán hàng (ma trận mục 4)', () => {
  it('Kho không có POS/đơn; thu ngân chỉ thấy đơn của mình, Manager thấy hết', async () => {
    await loginAs('inventory01')
    await expectFail('/orders', undefined, 403, 'AUTH_FORBIDDEN')
    await expectFail('/shifts/current', undefined, 403, 'AUTH_FORBIDDEN')
    await loginAs('cashier01')
    const mine = await get<Page<{ cashierName: string }>>('/orders?pageSize=100')
    expect(mine.items.length).toBeGreaterThan(0)
    expect(new Set(mine.items.map((o) => o.cashierName))).toEqual(new Set(['Nguyễn Thu Hà']))
    await loginAs('manager01')
    const all = await get<Page<unknown>>('/orders?pageSize=100')
    expect(all.totalItems).toBeGreaterThanOrEqual(mine.totalItems)
  })

  it('Manager không bán hàng/trả hàng; thu ngân không quản lý khuyến mãi, cấu hình hệ thống', async () => {
    await loginAs('manager01')
    await expectFail('/orders/complete', post({ items: [{ productId: 5, quantity: 1 }], paymentMethod: 'CARD' }), 403, 'AUTH_FORBIDDEN')
    await expectFail('/returns', post({ originalOrderId: 1, reason: 'DEFECTIVE', items: [], refundMethod: 'CASH' }), 403, 'AUTH_FORBIDDEN')
    await loginAs('cashier01')
    await expectFail('/promotions', post({}), 403, 'AUTH_FORBIDDEN')
    await expectFail('/settings', undefined, 403, 'AUTH_FORBIDDEN')
    await expectFail('/suppliers', undefined, 403, 'AUTH_FORBIDDEN')
  })

  it('luật 47: newstaff chưa đổi mật khẩu bị chặn mọi API ngoài /auth', async () => {
    await loginAs('newstaff')
    await expectFail('/orders', undefined, 403, 'AUTH_PASSWORD_CHANGE_REQUIRED')
    await expectFail('/shifts/current', undefined, 403, 'AUTH_PASSWORD_CHANGE_REQUIRED')
  })

  it('bất biến: sau chuỗi bán + trả, tồn lô khớp tổng thẻ kho', async () => {
    await loginAs('cashier01')
    await openShift(0)
    const o = await cash({ items: [{ productId: 3, quantity: 30 }, { productId: 4, quantity: 2 }] })
    await send('/returns', post({
      originalOrderId: o.id,
      reason: 'DEFECTIVE',
      items: [{ orderDetailId: o.lines[0].id, quantity: 2, condition: 'DAMAGED_OR_OPENED' }],
      refundMethod: 'CASH',
    }))
    await peek(async () => {
      const batches = (await get<Page<Batch>>('/stock/batches?pageSize=200')).items
      for (const b of batches) {
        const d = await get<{ movements: { quantityChange: number }[] }>(`/stock/batches/${b.id}`)
        expect(d.movements.reduce((s, m) => s + m.quantityChange, 0)).toBe(b.onHandQty)
        expect(b.blockedQty).toBeLessThanOrEqual(b.onHandQty)
      }
    })
    void asRole
  })
})
