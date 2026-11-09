// Đợt test 1 (GĐ1 Kho): nhập kho, kiểm kho, xuất khác qua apiRequest + mock.
// Viết từ luật: QUY_TAC_NGHIEP_VU 24-33, 40, API-CONTRACT mục STOCK.
import { beforeEach, describe, expect, it } from 'vitest'
import { expectFail, freshDb, get, loginAs, post, put, send, type Page } from '../test/api-helpers'

interface Batch {
  id: number
  productId: number
  lotCode: string
  expDate: string
  onHandQty: number
  blockedQty: number
  availableQty: number
  costPrice: number
  lockedByCheckId: number | null
}
interface Movement {
  quantityChange: number
  balanceAfter: number
  referenceType: string
}
interface BatchDetail extends Batch {
  movements: Movement[]
}
interface Po {
  id: number
  status: string
  lines: { batchId: number | null }[]
}

const batches = async () => (await get<Page<Batch>>('/stock/batches?pageSize=200')).items
const batchOf = async (id: number) => (await batches()).find((b) => b.id === id) as Batch
const detail = (id: number) => get<BatchDetail>(`/stock/batches/${id}`)

const line = (productId: number, lotCode: string, expDate: string, quantity: number, unitCost: number) => ({
  productId,
  lotCode,
  expDate,
  quantity,
  unitCost,
})
const createPo = (lines: unknown[], supplierId = 1) => send<Po>('/purchase-orders', post({ supplierId, lines }))
const confirm = (id: number, key: string) =>
  send<{ order: Po; warnings: { type: string }[] }>(`/purchase-orders/${id}/confirm`, post({}, { 'Idempotency-Key': key }))

beforeEach(freshDb)

describe('Bất biến sau seed', () => {
  it('tồn lô khớp tổng thẻ kho và 0 ≤ blocked ≤ onHand (luật 28, 33)', async () => {
    await loginAs('admin')
    for (const b of await batches()) {
      const d = await detail(b.id)
      const sum = d.movements.reduce((s, m) => s + m.quantityChange, 0)
      expect({ lot: b.lotCode, sum }).toEqual({ lot: b.lotCode, sum: b.onHandQty })
      expect(b.blockedQty).toBeGreaterThanOrEqual(0)
      expect(b.blockedQty).toBeLessThanOrEqual(b.onHandQty)
    }
  })
})

describe('STK-01 nhập kho', () => {
  it('xác nhận phiếu tạo lô mới, ghi thẻ kho PURCHASE; xác nhận lần 2 cùng khóa không cộng hai lần (luật 30)', async () => {
    await loginAs('admin')
    const po = await createPo([line(5, 'LOT-TEST-NEW', '2029-01-01', 20, 90000)])
    const res = await confirm(po.id, 'k1')
    expect(res.order.status).toBe('COMPLETED')
    const batchId = res.order.lines[0].batchId as number
    const d = await detail(batchId)
    expect(d.onHandQty).toBe(20)
    expect(d.movements).toHaveLength(1)
    expect(d.movements[0]).toMatchObject({ referenceType: 'PURCHASE', quantityChange: 20, balanceAfter: 20 })

    await confirm(po.id, 'k1')
    expect((await detail(batchId)).onHandQty).toBe(20)
    await expectFail(`/purchase-orders/${po.id}/confirm`, post({}, { 'Idempotency-Key': 'k2' }), 409, 'STK_PO_ALREADY_CONFIRMED')
    expect((await detail(batchId)).onHandQty).toBe(20)
  })

  it('thiếu Idempotency-Key → 400', async () => {
    await loginAs('admin')
    const po = await createPo([line(5, 'LOT-TEST-NEW', '2029-01-01', 1, 1000)])
    await expectFail(`/purchase-orders/${po.id}/confirm`, post({}), 400, 'COMMON_IDEMPOTENCY_KEY_REQUIRED')
  })

  it('nhập thêm vào lô đã có: giá vốn bình quân gia quyền (luật 29)', async () => {
    await loginAs('admin')
    const before = await batchOf(15) // 26 x 380.000
    const po = await createPo([line(3, before.lotCode, before.expDate, 14, 480000)])
    await confirm(po.id, 'avg')
    const after = await batchOf(15)
    expect(after.onHandQty).toBe(40)
    expect(after.costPrice).toBe(Math.round((26 * 380000 + 14 * 480000) / 40))
  })

  it('lô đã có nhưng khác HSD → 422 STK_LOT_EXP_MISMATCH và không ghi gì (luật 40)', async () => {
    await loginAs('admin')
    const before = await batchOf(15)
    const po = await createPo([line(5, 'LOT-OK-1', '2029-02-02', 5, 1000), line(3, before.lotCode, '2030-01-01', 14, 480000)])
    await expectFail(`/purchase-orders/${po.id}/confirm`, post({}, { 'Idempotency-Key': 'mm' }), 422, 'STK_LOT_EXP_MISMATCH')
    expect((await batchOf(15)).onHandQty).toBe(before.onHandQty)
    expect((await batches()).some((b) => b.lotCode === 'LOT-OK-1')).toBe(false)
    expect((await get<Po>(`/purchase-orders/${po.id}`)).status).toBe('DRAFT')
  })

  it('trùng sản phẩm + mã lô trong cùng phiếu → 422; NCC ngừng hợp tác → 422', async () => {
    await loginAs('admin')
    await expectFail(
      '/purchase-orders',
      post({ supplierId: 1, lines: [line(5, 'DUP', '2029-01-01', 1, 1), line(5, 'DUP', '2029-01-01', 2, 1)] }),
      422,
      'STK_DUPLICATE_LOT'
    )
    await expectFail('/purchase-orders', post({ supplierId: 5, lines: [line(5, 'X1', '2029-01-01', 1, 1)] }), 422, 'STK_SUPPLIER_INACTIVE')
  })

  it('cảnh báo xoay kệ khi HSD lô mới sớm hơn lô còn tồn (luật 31)', async () => {
    await loginAs('admin')
    const warns = await send<{ type: string }[]>(
      '/purchase-orders/preview-warnings',
      post({ lines: [{ productId: 1, lotCode: 'LOT-SOM', expDate: '2027-01-01' }] })
    )
    expect(warns.map((w) => w.type)).toContain('ROTATE_SHELF')
  })

  it('phiếu hoàn tất không sửa/hủy được (luật 41)', async () => {
    await loginAs('admin')
    const po = await createPo([line(5, 'LOT-FIX', '2029-01-01', 2, 1000)])
    await confirm(po.id, 'fx')
    await expectFail(`/purchase-orders/${po.id}/cancel`, post({}), 409, 'STK_PO_NOT_EDITABLE')
  })

  it('phân quyền: Manager chỉ xem, thu ngân không thấy, Kho lập được', async () => {
    await loginAs('manager01')
    await get('/purchase-orders')
    await expectFail('/purchase-orders', post({ supplierId: 1, lines: [line(5, 'M', '2029-01-01', 1, 1)] }), 403, 'AUTH_FORBIDDEN')
    await loginAs('cashier01')
    await expectFail('/purchase-orders', undefined, 403, 'AUTH_FORBIDDEN')
    await loginAs('inventory01')
    const po = await createPo([line(5, 'LOT-KHO', '2029-01-01', 3, 1000)])
    expect(po.status).toBe('DRAFT')
  })
})

describe('STK-04/05 kiểm kho', () => {
  const start = (ids: number[]) =>
    send<{ id: number; lines: { id: number; snapshotQty: number }[] }>('/inventory-checks', post({ batchIds: ids }))

  it('bắt đầu kiểm khóa lô: không bán được, không xuất khác được (luật 32)', async () => {
    await loginAs('inventory01')
    await start([15])
    const b = await batchOf(15)
    expect(b.lockedByCheckId).not.toBeNull()
    expect(b.availableQty).toBe(0)
    await expectFail(
      '/disposals',
      post({ issueType: 'DESTROY', reasonCode: 'DAMAGED', reason: 'x', lines: [{ batchId: 15, quantity: 1 }] }),
      409,
      'STK_BATCH_LOCKED'
    )
    await expectFail('/inventory-checks', post({ batchIds: [15] }), 409, 'STK_BATCH_LOCKED')
  })

  it('ô trống không phải 0: lưu nháp giữ null; gửi khi còn ô null → 422 STK_CHECK_INCOMPLETE', async () => {
    await loginAs('inventory01')
    const c = await start([15, 9])
    const rows = [
      { lineId: c.lines[0].id, countedQty: 5 },
      { lineId: c.lines[1].id, countedQty: null },
    ]
    const saved = await send<{ lines: { countedQty: number | null }[] }>(`/inventory-checks/${c.id}/counts`, put({ lines: rows }))
    expect(saved.lines.map((l) => l.countedQty)).toEqual([5, null])
    await expectFail(`/inventory-checks/${c.id}/submit`, post({ lines: rows }), 422, 'STK_CHECK_INCOMPLETE')
  })

  it('không chênh lệch → NO_DIFFERENCE, gỡ khóa, không đổi tồn, không thẻ kho (luật 32)', async () => {
    await loginAs('inventory01')
    const b0 = await batchOf(15)
    const m0 = (await detail(15)).movements.length
    const c = await start([15])
    const res = await send<{ status: string }>(
      `/inventory-checks/${c.id}/submit`,
      post({ lines: [{ lineId: c.lines[0].id, countedQty: c.lines[0].snapshotQty }] })
    )
    expect(res.status).toBe('NO_DIFFERENCE')
    const b1 = await batchOf(15)
    expect(b1.lockedByCheckId).toBeNull()
    expect(b1.onHandQty).toBe(b0.onHandQty)
    expect((await detail(15)).movements).toHaveLength(m0)
  })

  it('chênh lệch → chờ duyệt, tồn chưa đổi; duyệt cộng chênh lệch vào tồn hiện tại + thẻ CHECK_ADJUST', async () => {
    await loginAs('inventory01')
    const b0 = await batchOf(15)
    const c = await start([15])
    const sub = await send<{ status: string }>(
      `/inventory-checks/${c.id}/submit`,
      post({ lines: [{ lineId: c.lines[0].id, countedQty: c.lines[0].snapshotQty - 3 }] })
    )
    expect(sub.status).toBe('WAITING_APPROVAL')
    expect((await batchOf(15)).onHandQty).toBe(b0.onHandQty)
    await expectFail(`/inventory-checks/${c.id}/approve`, post({}), 403, 'AUTH_FORBIDDEN')
    await loginAs('manager01')
    const ok = await send<{ status: string }>(`/inventory-checks/${c.id}/approve`, post({}))
    expect(ok.status).toBe('APPROVED')
    expect((await batchOf(15)).onHandQty).toBe(b0.onHandQty - 3)
    expect((await detail(15)).movements[0]).toMatchObject({ referenceType: 'CHECK_ADJUST', quantityChange: -3 })
    await expectFail(`/inventory-checks/${c.id}/approve`, post({}), 409, 'STK_CHECK_NOT_WAITING')
  })

  it('từ chối cần lý do và không đổi tồn', async () => {
    await loginAs('inventory01')
    const b0 = await batchOf(15)
    const c = await start([15])
    await send(`/inventory-checks/${c.id}/submit`, post({ lines: [{ lineId: c.lines[0].id, countedQty: 1 }] }))
    await loginAs('manager01')
    await expectFail(`/inventory-checks/${c.id}/reject`, post({}), 400, 'COMMON_VALIDATION_FAILED')
    const r = await send<{ status: string }>(`/inventory-checks/${c.id}/reject`, post({ reason: 'Đếm lại' }))
    expect(r.status).toBe('REJECTED')
    expect((await batchOf(15)).onHandQty).toBe(b0.onHandQty)
  })

  it('phân quyền: thu ngân không xem phiếu kiểm; Manager xem được nhưng không lập', async () => {
    await loginAs('cashier01')
    await expectFail('/inventory-checks', undefined, 403, 'AUTH_FORBIDDEN')
    await loginAs('manager01')
    await get('/inventory-checks')
    await expectFail('/inventory-checks', post({ batchIds: [15] }), 403, 'AUTH_FORBIDDEN')
  })
})

describe('STK-06/07 xuất khác', () => {
  const create = (batchId: number, quantity: number, issueType = 'DESTROY', reasonCode = 'DAMAGED') =>
    send<{ id: number; lines: { blockedAddedQty: number }[] }>(
      '/disposals',
      post({ issueType, reasonCode, reason: 'Hỏng', lines: [{ batchId, quantity }] })
    )

  it('lập phiếu cách ly ngay (blocked tăng), tồn thực và thẻ kho chưa đổi (luật 33)', async () => {
    await loginAs('inventory01')
    const b0 = await batchOf(10) // onHand 43, blocked 5
    const m0 = (await detail(10)).movements.length
    const d = await create(10, 10)
    const b1 = await batchOf(10)
    expect(b1.onHandQty).toBe(b0.onHandQty)
    expect(b1.blockedQty).toBe(10)
    expect(d.lines[0].blockedAddedQty).toBe(5)
    expect(b1.availableQty).toBe(b0.availableQty - 5)
    expect((await detail(10)).movements).toHaveLength(m0)
  })

  it('duyệt trừ tồn + blocked, ghi thẻ DISPOSAL, giữ 0 ≤ blocked ≤ onHand', async () => {
    await loginAs('inventory01')
    const b0 = await batchOf(10)
    const d = await create(10, 10)
    await expectFail(`/disposals/${d.id}/approve`, post({}), 403, 'AUTH_FORBIDDEN')
    await loginAs('manager01')
    const ok = await send<{ status: string }>(`/disposals/${d.id}/approve`, post({}))
    expect(ok.status).toBe('APPROVED')
    const b1 = await batchOf(10)
    expect(b1.onHandQty).toBe(b0.onHandQty - 10)
    expect(b1.blockedQty).toBeGreaterThanOrEqual(0)
    expect(b1.blockedQty).toBeLessThanOrEqual(b1.onHandQty)
    expect((await detail(10)).movements[0]).toMatchObject({ referenceType: 'DISPOSAL', quantityChange: -10 })
  })

  it('từ chối trả lại phần đã cách ly, tồn thực không đổi, cần lý do', async () => {
    await loginAs('inventory01')
    const b0 = await batchOf(10)
    const d = await create(10, 10)
    await loginAs('manager01')
    await expectFail(`/disposals/${d.id}/reject`, post({}), 400, 'COMMON_VALIDATION_FAILED')
    await send(`/disposals/${d.id}/reject`, post({ reason: 'Không đồng ý' }))
    const b1 = await batchOf(10)
    expect(b1.blockedQty).toBe(b0.blockedQty)
    expect(b1.onHandQty).toBe(b0.onHandQty)
  })

  it('số lượng vượt tồn → 422 STK_INSUFFICIENT_STOCK', async () => {
    await loginAs('inventory01')
    await expectFail(
      '/disposals',
      post({ issueType: 'DESTROY', reasonCode: 'DAMAGED', reason: 'x', lines: [{ batchId: 10, quantity: 999 }] }),
      422,
      'STK_INSUFFICIENT_STOCK'
    )
  })

  it('SKU tester hãng chỉ xuất bằng TESTER/DESTROY, không trả NCC', async () => {
    await loginAs('inventory01')
    await expectFail(
      '/disposals',
      post({ issueType: 'RETURN_TO_SUPPLIER', reasonCode: 'RETURN_DEFECT', reason: 'x', lines: [{ batchId: 6, quantity: 1 }] }),
      422,
      'STK_ISSUE_TYPE_NOT_ALLOWED'
    )
    const t = await create(6, 1, 'TESTER', 'TESTER_USE')
    expect(t.id).toBeGreaterThan(0)
  })

  it('phân quyền: thu ngân không xem phiếu xuất; Manager không lập', async () => {
    await loginAs('cashier01')
    await expectFail('/disposals', undefined, 403, 'AUTH_FORBIDDEN')
    await loginAs('manager01')
    await expectFail(
      '/disposals',
      post({ issueType: 'DESTROY', reasonCode: 'DAMAGED', reason: 'x', lines: [{ batchId: 10, quantity: 1 }] }),
      403,
      'AUTH_FORBIDDEN'
    )
  })
})

describe('Phân quyền tồn kho: thu ngân chỉ thấy tồn khả dụng', () => {
  it('không lộ onHandQty/blockedQty/costPrice và không thấy lô không bán được', async () => {
    await loginAs('cashier01')
    const res = await get<Page<Record<string, unknown>>>('/stock/batches?pageSize=200')
    expect(res.items.length).toBeGreaterThan(0)
    for (const b of res.items) {
      expect(b).not.toHaveProperty('onHandQty')
      expect(b).not.toHaveProperty('blockedQty')
      expect(b).not.toHaveProperty('costPrice')
      expect(b.availableQty as number).toBeGreaterThan(0)
    }
    await expectFail('/stock/summary', undefined, 403, 'AUTH_FORBIDDEN')
  })
})
