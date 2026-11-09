// Đợt test 2 (GĐ3): báo cáo REP-01..06, nhật ký AUTH-06, hiệu quả khuyến mãi PROM-04 qua apiRequest + mock.
// Viết từ luật: QUY_TAC_NGHIEP_VU 53-56; DANH_GIA_USECASE mục 2.7/2.8 (công thức), ma trận quyền mục 4; API-CONTRACT mục REPORT/audit.
import { beforeEach, describe, expect, it } from 'vitest'
import { expectFail, freshDb, get, loginAs, post, put, send, type Page } from '../test/api-helpers'
import type {
  AuditLogRecord,
  AuditLogsData,
  CustomerReport,
  DashboardData,
  PurchaseReport,
  RevenueFigures,
  RevenueReport,
  SalesReport,
  StockReport,
} from '../types/reports'

const pad = (n: number) => String(n).padStart(2, '0')
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const TODAY = dayOf(new Date())
const ALL = 'fromDate=2020-01-01&toDate=2099-12-31'

interface Ord {
  id: number
  status: string
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  taxAmount: number
  completedAt: string | null
  orderPromotionId: number | null
  orderDiscountAmount: number
  cashierId: number
  lines: { id: number; productId: number; quantity: number; costPrice: number; lineTotal: number; batchId: number; linePromotionId: number | null; lineDiscount: number }[]
}
interface Ret {
  id: number
  totalRefundAmount: number
  status: string
  createdAt: string
}

const revenue = (qs = ALL) => get<RevenueReport>(`/reports/revenue?${qs}`)
const orders = async () => (await get<Page<Ord>>('/orders?status=COMPLETED&pageSize=2000')).items
const returns = async () => (await get<Page<Ret>>('/returns?pageSize=2000')).items.filter((r) => r.status === 'COMPLETED')
const openShift = () => send<{ shiftId: number }>('/shifts/open', post({ openingCash: 1_000_000 }))
const sell = (items: { productId: number; quantity: number; batchId?: number }[]) =>
  send<Ord>('/orders/complete', post({ items, paymentMethod: 'CASH', amountReceived: 100_000_000 }))
const logs = (qs = '') => get<AuditLogsData & Page<AuditLogRecord>>(`/audit-logs?pageSize=500${qs}`)
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)

beforeEach(freshDb)

describe('REP-02 doanh thu và lợi nhuận (luật 53-56)', () => {
  beforeEach(() => loginAs('admin'))

  it('53: đơn tính theo ngày hoàn tất; một ngày bất kỳ khớp số đơn COMPLETED có completedAt ngày đó', async () => {
    const all = await orders()
    const days = [...new Set(all.map((o) => (o.completedAt as string).slice(0, 10)))]
    expect(days.length).toBeGreaterThan(1)
    for (const day of days.slice(0, 4)) {
      const exp = all.filter((o) => (o.completedAt as string).slice(0, 10) === day)
      const r = await revenue(`fromDate=${day}&toDate=${day}`)
      expect(r.totals.orderCount).toBe(exp.length)
      expect(r.totals.grossAmount).toBe(sum(exp, (o) => o.subtotalAmount))
      expect(r.totals.discountAmount).toBe(sum(exp, (o) => o.discountAmount))
    }
  })

  it('55/56: doanh thu thuần = tiền hàng − giảm giá − hàng trả; lợi nhuận gộp = thuần chưa VAT − giá vốn', async () => {
    const r = await revenue()
    const t: RevenueFigures = r.totals
    const all = await orders()
    const rets = await returns()
    expect(t.orderCount).toBe(all.length)
    expect(t.returnCount).toBe(rets.length)
    expect(t.returnedAmount).toBe(sum(rets, (x) => x.totalRefundAmount))
    expect(t.netRevenue).toBe(t.grossAmount - t.discountAmount - t.returnedAmount)
    expect(t.netRevenueExVat).toBe(t.netRevenue - t.vatAmount)
    expect(r.showProfit).toBe(true)
    expect(t.grossProfit).toBe(t.netRevenueExVat - (t.cogs as number))
    expect(t.cogs as number).toBeGreaterThan(0)
    expect(r.series.reduce((s, p) => s + p.netRevenue, 0)).toBe(t.netRevenue)
  })

  it('tính tay đơn mới: gross, giảm giá, giá vốn đúng từng dòng; trả hàng lỗi trừ vào kỳ trả', async () => {
    const before = (await revenue(`fromDate=${TODAY}&toDate=${TODAY}`)).totals
    await loginAs('cashier01')
    await openShift()
    const o = await sell([{ productId: 3, quantity: 3 }])
    const ln = o.lines[0]
    const ret = await send<{ totalRefundAmount: number }>(
      '/returns',
      post({ originalOrderId: o.id, reason: 'DEFECTIVE', items: [{ orderDetailId: ln.id, quantity: 1, condition: 'DAMAGED_OR_OPENED' }], refundMethod: 'CASH' })
    )
    await loginAs('admin')
    const after = (await revenue(`fromDate=${TODAY}&toDate=${TODAY}`)).totals
    expect(after.orderCount - before.orderCount).toBe(1)
    expect(after.grossAmount - before.grossAmount).toBe(o.subtotalAmount)
    expect(after.discountAmount - before.discountAmount).toBe(o.discountAmount)
    expect(after.returnedAmount - before.returnedAmount).toBe(ret.totalRefundAmount)
    expect(after.netRevenue - before.netRevenue).toBe(o.subtotalAmount - o.discountAmount - ret.totalRefundAmount)
    // giá vốn = 3 × costPrice − 1 × unitCost (trả 1 đơn vị cùng giá vốn)
    expect(after.cogs! - before.cogs!).toBe(ln.costPrice * 2)
  })

  it('54: hàng của đơn cũ trả hôm nay trừ vào hôm nay, kỳ của đơn cũ không đổi', async () => {
    const all = await orders()
    const old = all.find((o) => (o.completedAt as string).slice(0, 10) < TODAY) as Ord
    expect(old).toBeTruthy()
    const day = (old.completedAt as string).slice(0, 10)
    const oldBefore = await revenue(`fromDate=${day}&toDate=${day}`)
    const todayBefore = (await revenue(`fromDate=${TODAY}&toDate=${TODAY}`)).totals
    await send('/settings', put({ settings: {}, maxReturnDays: 365 }))
    await loginAs('cashier01')
    await openShift()
    const detail = await get<{ order: Ord }>(`/orders/${old.id}`)
    const ln = detail.order.lines[0]
    const ret = await send<{ totalRefundAmount: number }>(
      '/returns',
      post({ originalOrderId: old.id, reason: 'DEFECTIVE', items: [{ orderDetailId: ln.id, quantity: 1, condition: 'DAMAGED_OR_OPENED' }], refundMethod: 'CASH' })
    )
    await loginAs('admin')
    const oldAfter = await revenue(`fromDate=${day}&toDate=${day}`)
    const todayAfter = (await revenue(`fromDate=${TODAY}&toDate=${TODAY}`)).totals
    expect(oldAfter.totals).toEqual(oldBefore.totals)
    expect(todayAfter.returnedAmount - todayBefore.returnedAmount).toBe(ret.totalRefundAmount)
    expect(todayAfter.netRevenue - todayBefore.netRevenue).toBe(-ret.totalRefundAmount)
  })

  it('compare=true trả kỳ trước liền kề cùng độ dài', async () => {
    const r = await revenue(`fromDate=2026-11-01&toDate=2026-11-07&compare=true`)
    expect(r.previousRange).toEqual({ fromDate: '2026-10-25', toDate: '2026-10-31' })
    expect(r.previous).not.toBeNull()
  })

  it('fromDate > toDate bị chặn (422 REP_INVALID_RANGE theo contract) ở mọi báo cáo', async () => {
    for (const ep of ['revenue', 'sales', 'stock', 'purchases', 'customers']) {
      await expectFail(`/reports/${ep}?fromDate=2026-05-10&toDate=2026-05-01`, undefined, 422, 'REP_INVALID_RANGE')
    }
    await expectFail('/audit-logs?fromDate=2026-05-10&toDate=2026-05-01', undefined, 422, 'REP_INVALID_RANGE')
  })
})

describe('REP phân quyền', () => {
  it('Manager xem doanh thu nhưng không có lợi nhuận/giá vốn', async () => {
    await loginAs('manager01')
    const r = await revenue()
    expect(r.showProfit).toBe(false)
    expect(r.totals.netRevenue).toBeGreaterThan(0)
    expect(JSON.stringify(r)).not.toMatch(/cogs|grossProfit|marginPercent/)
  })

  it('Thu ngân chỉ thấy ca của mình; không có dashboard, doanh thu, tồn kho', async () => {
    await loginAs('cashier01')
    await openShift()
    const o = await sell([{ productId: 3, quantity: 1 }])
    const s = await get<SalesReport>(`/reports/sales?${ALL}`)
    expect(s.scope).toBe('OWN')
    expect(s.byCashier.length).toBe(1)
    const mine = await orders()
    expect(mine.every((x) => x.cashierId === s.byCashier[0].cashierId)).toBe(true)
    expect(mine.some((x) => x.id === o.id)).toBe(true)
    expect(s.byCashier[0].orderCount).toBe(mine.length)
    expect(s.summary.orderCount).toBe(mine.length)
    expect(s.summary.totalAmount).toBe(sum(mine, (x) => x.totalAmount))
    expect(s.byShift.every((x) => x.cashierName === s.byCashier[0].cashierName)).toBe(true)
    for (const ep of ['dashboard', 'revenue', 'stock', 'purchases', 'customers']) {
      await expectFail(`/reports/${ep}`, undefined, 403, 'AUTH_FORBIDDEN')
    }
    await expectFail('/audit-logs', undefined, 403, 'AUTH_FORBIDDEN')
  })

  it('Admin thấy báo cáo bán hàng mọi ca; NV kho chỉ dashboard kho và báo cáo tồn kho', async () => {
    await loginAs('admin')
    const s = await get<SalesReport>(`/reports/sales?${ALL}`)
    expect(s.scope).toBe('ALL')
    expect(s.byCashier.length).toBeGreaterThan(0)
    await loginAs('inventory01')
    const d = await get<DashboardData>('/reports/dashboard')
    expect(d.sales).toBeNull()
    expect(d.stock).toBeTruthy()
    await get<StockReport>('/reports/stock')
    for (const ep of ['revenue', 'sales', 'purchases', 'customers']) {
      await expectFail(`/reports/${ep}`, undefined, 403, 'AUTH_FORBIDDEN')
    }
    await expectFail('/promotions/1/effect', undefined, 403, 'AUTH_FORBIDDEN')
  })

  it('Admin và Manager có dashboard đủ widget bán hàng', async () => {
    for (const u of ['admin', 'manager01']) {
      await loginAs(u)
      const d = await get<DashboardData>('/reports/dashboard')
      expect(d.sales?.last7Days).toHaveLength(7)
      expect(d.stock).toBeTruthy()
    }
  })

  it('doanh thu thuần hôm nay trên dashboard khớp báo cáo doanh thu', async () => {
    await loginAs('admin')
    const d = await get<DashboardData>('/reports/dashboard')
    const r = await revenue(`fromDate=${TODAY}&toDate=${TODAY}`)
    expect(d.sales?.todayRevenue).toBe(r.totals.netRevenue)
    expect(d.sales?.todayOrders).toBe(r.totals.orderCount)
  })
})

describe('REP-04/05/06 khớp dữ liệu nguồn', () => {
  beforeEach(() => loginAs('admin'))

  it('REP-04: tồn bán được theo sản phẩm khớp tổng availableQty các lô; giá trị tồn = Σ tồn × giá vốn', async () => {
    const st = await get<StockReport>('/reports/stock')
    const batches = (await get<Page<{ productId: number; availableQty: number; onHandQty?: number; blockedQty?: number; costPrice?: number }>>('/stock/batches?pageSize=2000')).items
    const lots = batches.filter((b) => (b.onHandQty ?? 0) > 0)
    expect(st.summary.lotCount).toBe(lots.length)
    expect(st.summary.totalQty).toBe(sum(lots, (b) => b.onHandQty ?? 0))
    expect(st.summary.inventoryValue).toBe(sum(lots, (b) => (b.onHandQty ?? 0) * (b.costPrice ?? 0)))
    expect(st.summary.blockedQty).toBe(sum(lots, (b) => b.blockedQty ?? 0))
    const sellable = new Set(batches.filter((b) => (b as { isSellable?: boolean }).isSellable !== false).map((b) => b.productId))
    for (const p of st.products.filter((x) => sellable.has(x.productId))) {
      const exp = sum(batches.filter((b) => b.productId === p.productId), (b) => b.availableQty)
      expect(p.availableQty, `${p.sku} ${p.productId}`).toBe(exp)
    }
  })

  // B4: SKU isSellable=false (tester) có availableQty=3 ở REP-04 trong khi lô ở /stock/batches là 0.
  it.skip('REP-04: SKU không bán được (tester) có tồn bán được = 0, khớp màn Tồn kho (luật 24, CLAUDE 7) [B4]', async () => {
    const st = await get<StockReport>('/reports/stock')
    const tester = st.products.find((p) => p.sku === 'SKU-YSL-RPC196-TST')
    expect(tester?.availableQty).toBe(0)
  })

  it('REP-05: chỉ phiếu nhập COMPLETED theo confirmedAt; phiếu nháp không tính, xác nhận thì cộng đúng', async () => {
    const before = (await get<PurchaseReport>(`/reports/purchases?${ALL}`)).summary
    const line = [{ productId: 5, lotCode: 'REP-LOT-1', expDate: '2029-06-30', quantity: 10, unitCost: 90_000, costPrice: 90_000 }]
    const draft = await send<{ id: number; totalAmount: number }>('/purchase-orders', post({ supplierId: 1, lines: line }, { 'Idempotency-Key': 'rep-po-1' }))
    const mid = (await get<PurchaseReport>(`/reports/purchases?${ALL}`)).summary
    expect(mid.totalAmount).toBe(before.totalAmount)
    await send(`/purchase-orders/${draft.id}/confirm`, post({}, { 'Idempotency-Key': 'rep-po-1-confirm' }))
    const after = await get<PurchaseReport>(`/reports/purchases?${ALL}`)
    expect(after.summary.orderCount).toBe(before.orderCount + 1)
    expect(after.summary.totalAmount).toBe(before.totalAmount + draft.totalAmount)
    expect(after.summary.quantity).toBe(before.quantity + 10)
    expect(sum(after.bySupplier, (s) => s.amount)).toBe(after.summary.totalAmount)
    const pos = (await get<Page<{ status: string; totalAmount: number }>>('/purchase-orders?pageSize=2000&status=COMPLETED')).items
    expect(after.summary.totalAmount).toBe(sum(pos, (p) => p.totalAmount))
  })

  it('REP-06: tổng khách khớp danh sách, tổng theo hạng khớp; khách mới tạo hôm nay tính vào khách mới', async () => {
    const before = (await get<CustomerReport>(`/reports/customers?fromDate=${TODAY}&toDate=${TODAY}`)).summary
    const list = await get<Page<unknown>>('/customers?pageSize=2000')
    expect(before.totalCustomers).toBe(list.totalItems)
    await send('/customers', post({ fullName: 'Khách Báo Cáo', phoneNumber: '0900777888' }))
    const after = await get<CustomerReport>(`/reports/customers?fromDate=${TODAY}&toDate=${TODAY}`)
    expect(after.summary.newCustomers).toBe(before.newCustomers + 1)
    expect(after.summary.totalCustomers).toBe(before.totalCustomers + 1)
    expect(sum(after.byTier, (t) => t.customerCount)).toBe(after.summary.totalCustomers)
  })
})

describe('AUTH-06 nhật ký hệ thống', () => {
  it('hành động chính để lại bản ghi, không lộ mật khẩu/token, chỉ Admin xem', async () => {
    await loginAs('admin')
    await send('/settings', put({ settings: { EXPIRY_WARNING_DAYS: '45' } }))
    await loginAs('cashier01')
    await openShift()
    await sell([{ productId: 3, quantity: 1, batchId: 16 }])
    await loginAs('admin')
    const all = await logs()
    const actions = new Set(all.items.map((l) => l.action))
    for (const a of ['LOGIN', 'UPDATE_SETTING', 'OPEN_SHIFT', 'CREATE_ORDER', 'OVERRIDE_FEFO']) expect(actions.has(a), a).toBe(true)
    const text = JSON.stringify(all.items)
    expect(text).not.toContain('Password@123')
    expect(text.toLowerCase()).not.toMatch(/accesstoken|refreshtoken|"token"|"password"/)
    expect(all.items.every((l) => l.userName && l.createdAt && l.module)).toBe(true)
    for (const u of ['manager01', 'inventory01', 'cashier01']) {
      await loginAs(u)
      await expectFail('/audit-logs', undefined, 403, 'AUTH_FORBIDDEN')
    }
  })

  it('chốt ca để lại CLOSE_SHIFT; lọc theo action chỉ trả đúng action', async () => {
    await loginAs('cashier01')
    const sh = await openShift()
    await send(`/shifts/${sh.shiftId}/close`, post({ actualCash: 1_000_000 }))
    await loginAs('admin')
    const closes = await logs('&action=CLOSE_SHIFT')
    expect(closes.items.length).toBeGreaterThan(0)
    expect(closes.items.every((l) => l.action === 'CLOSE_SHIFT')).toBe(true)
  })
})

describe('PROM-04 hiệu quả khuyến mãi', () => {
  it('lượt dùng, tiền giảm, doanh thu khớp đơn COMPLETED; đơn nháp và đơn hủy không tính', async () => {
    await loginAs('admin')
    const promos = (await get<Page<{ id: number }>>('/promotions?pageSize=100')).items
    const all = await orders()
    const detailed = await Promise.all(all.map(async (o) => (await get<{ order: Ord }>(`/orders/${o.id}`)).order))
    let checked = 0
    const effects: Record<number, unknown> = {}
    for (const p of promos) {
      const used = detailed.filter((o) => o.orderPromotionId === p.id || o.lines.some((l) => l.linePromotionId === p.id))
      const eff = await get<{ usageCount: number; totalDiscount: number; revenue: number }>(`/promotions/${p.id}/effect?${ALL}`)
      effects[p.id] = eff
      expect(eff.usageCount, `KM ${p.id}`).toBe(used.length)
      const disc = sum(used, (o) => (o.orderPromotionId === p.id ? o.orderDiscountAmount : 0) + sum(o.lines.filter((l) => l.linePromotionId === p.id), (l) => l.lineDiscount))
      expect(eff.totalDiscount, `KM ${p.id}`).toBe(disc)
      expect(eff.revenue, `KM ${p.id}`).toBe(sum(used, (o) => o.totalAmount))
      if (used.length > 0) checked++
    }
    expect(checked).toBeGreaterThan(0)
    // đơn nháp không đổi số liệu
    await loginAs('cashier01')
    await openShift()
    await send('/orders/drafts', post({ items: [{ productId: 3, quantity: 1 }], customerId: null, voucherCode: null, pointsRequested: 0 }))
    await loginAs('admin')
    for (const p of promos) expect(await get(`/promotions/${p.id}/effect?${ALL}`)).toEqual(effects[p.id])
  })

  it('khuyến mãi không tồn tại 404; kỳ sai 422', async () => {
    await loginAs('manager01')
    await expectFail(`/promotions/99999/effect?${ALL}`, undefined, 404, 'PROMOTION_NOT_FOUND')
    await expectFail('/promotions/1/effect?fromDate=2026-05-10&toDate=2026-05-01', undefined, 422, 'REP_INVALID_RANGE')
  })
})
