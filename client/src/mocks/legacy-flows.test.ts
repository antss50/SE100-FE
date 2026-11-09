// Đợt test 1 (phần sửa cũ): khuyến mãi 7 loại, sản phẩm, khách hàng, cấu hình, tài khoản.
// Viết từ luật: QUY_TAC_NGHIEP_VU 9-12, 22, 42-52; KHUYEN_MAI.md; API-CONTRACT.
import { useAuthStore } from '../app/store'
import { beforeEach, describe, expect, it } from 'vitest'
import { expectFail, freshDb, get, loginAs, patch, post, put, send, type Page } from '../test/api-helpers'

beforeEach(freshDb)

const base = { startAt: '2026-11-01', endAt: '2027-12-31' }

describe('PROM-02 khuyến mãi', () => {
  it('thiếu cột bắt buộc theo loại → 422 PROM_INVALID (FLASH_PRICE không có giá, COMBO < 2 món, ORDER_TIERED không bậc, BUY_X_GET_Y thiếu quà)', async () => {
    await loginAs('manager01')
    const bad = [
      { promotionType: 'FLASH_PRICE', items: [{ productId: 1, role: 'TARGET', quantity: 1 }] },
      { promotionType: 'COMBO', comboPrice: 100000, items: [{ productId: 1, role: 'COMBO_ITEM', quantity: 1 }] },
      { promotionType: 'ORDER_TIERED', steps: [] },
      { promotionType: 'BUY_X_GET_Y', buyQuantity: 2, items: [{ productId: 1, role: 'BUY', quantity: 1 }] },
      { promotionType: 'ORDER_GIFT', minOrderValue: 1000000, items: [] },
      { promotionType: 'VOUCHER', discountType: 'PERCENT', discountValue: 10 },
    ]
    for (const b of bad) {
      const err = await send('/promotions', post({ promotionName: 'Sai', ...base, ...b })).catch((e: { status: number; errorCode: string }) => e)
      expect({ type: b.promotionType, status: (err as { status?: number }).status }).toEqual({ type: b.promotionType, status: 422 })
    }
  })

  it('tạo đủ 7 loại hợp lệ; mã voucher trùng → 409', async () => {
    await loginAs('manager01')
    const ok = [
      { promotionType: 'PRODUCT_DISCOUNT', applyScope: 'PRODUCT', discountType: 'PERCENT', discountValue: 10, items: [{ productId: 1, role: 'TARGET', quantity: 1 }] },
      { promotionType: 'FLASH_PRICE', fixedPrice: 100000, items: [{ productId: 5, role: 'TARGET', quantity: 1 }] },
      { promotionType: 'BUY_X_GET_Y', buyQuantity: 2, items: [{ productId: 3, role: 'BUY', quantity: 1 }, { productId: 5, role: 'GIFT', quantity: 1 }] },
      { promotionType: 'COMBO', comboPrice: 600000, items: [{ productId: 3, role: 'COMBO_ITEM', quantity: 1 }, { productId: 4, role: 'COMBO_ITEM', quantity: 1 }] },
      { promotionType: 'ORDER_TIERED', steps: [{ minOrderValue: 1000000, discountType: 'PERCENT', discountValue: 5 }, { minOrderValue: 3000000, discountType: 'PERCENT', discountValue: 8 }] },
      { promotionType: 'ORDER_GIFT', minOrderValue: 1000000, items: [{ productId: 5, role: 'GIFT', quantity: 1 }] },
      { promotionType: 'VOUCHER', voucherCode: 'TEST7', discountType: 'FIXED_AMOUNT', discountValue: 50000 },
    ]
    for (const b of ok) {
      const p = await send<{ id: number; status: string; locked: boolean }>('/promotions', post({ promotionName: `KM ${b.promotionType}`, ...base, ...b }))
      expect(p).toMatchObject({ status: 'DRAFT', locked: false })
    }
    await expectFail('/promotions', post({ promotionName: 'Trùng', ...base, promotionType: 'VOUCHER', voucherCode: 'TEST7', discountType: 'PERCENT', discountValue: 5 }), 409, 'PROM_VOUCHER_DUPLICATED')
  })

  it('bậc thang trùng ngưỡng bị chặn', async () => {
    await loginAs('manager01')
    const err = await send('/promotions', post({
      promotionName: 'Trùng bậc', ...base, promotionType: 'ORDER_TIERED',
      steps: [{ minOrderValue: 1000000, discountType: 'PERCENT', discountValue: 5 }, { minOrderValue: 1000000, discountType: 'PERCENT', discountValue: 8 }],
    })).catch((e: { status: number }) => e)
    expect((err as { status?: number }).status).toBe(422)
  })

  it('đã có đơn dùng (locked): đổi mức giảm → 409 PROM_FIELD_LOCKED (luật 10); đổi tên/ngày kết thúc được', async () => {
    await loginAs('manager01')
    const p = await get<Record<string, unknown> & { locked: boolean }>('/promotions/7')
    expect(p.locked).toBe(true)
    const payload = { ...p, discountValue: 20 }
    await expectFail('/promotions/7', put(payload), 409, 'PROM_FIELD_LOCKED')
    const renamed = await send<{ promotionName: string; endAt: string }>('/promotions/7', put({ ...p, promotionName: 'Đổi tên', endAt: '2027-03-01T23:59:00+07:00' }))
    expect(renamed.promotionName).toBe('Đổi tên')
  })

  it('chuyển trạng thái: DRAFT chỉ lên ACTIVE; ACTIVE ↔ PAUSED', async () => {
    await loginAs('manager01')
    await expectFail('/promotions/13/status', patch({ status: 'PAUSED' }), 409, 'PROM_STATUS_INVALID')
    const a = await send<{ status: string }>('/promotions/13/status', patch({ status: 'ACTIVE' }))
    expect(a.status).toBe('ACTIVE')
    const p = await send<{ status: string }>('/promotions/13/status', patch({ status: 'PAUSED' }))
    expect(p.status).toBe('PAUSED')
  })

  it('lượt dùng mỗi khách vượt tổng lượt → 422; giai đoạn theo ngày (UPCOMING/RUNNING/ENDED)', async () => {
    await loginAs('manager01')
    await expectFail('/promotions', post({ promotionName: 'x', ...base, promotionType: 'VOUCHER', voucherCode: 'LIM1', discountType: 'PERCENT', discountValue: 5, usageLimit: 5, limitPerCustomer: 10 }), 422, 'PROM_LIMIT_PER_CUSTOMER_INVALID')
    const list = await get<Page<{ id: number; phase: string }>>('/promotions?pageSize=50')
    const phase = (id: number) => list.items.find((p) => p.id === id)?.phase
    expect(phase(11)).toBe('UPCOMING')
    expect(phase(12)).toBe('ENDED')
    expect(phase(7)).toBe('RUNNING')
  })

  it('thu ngân xem được KM nhưng không quản lý; Kho không xem', async () => {
    await loginAs('inventory01')
    await expectFail('/promotions', undefined, 403, 'AUTH_FORBIDDEN')
    await loginAs('cashier01')
    await expectFail('/promotions/13/status', patch({ status: 'ACTIVE' }), 403, 'AUTH_FORBIDDEN')
  })
})

describe('PROD-01 sản phẩm', () => {
  it('ngừng kinh doanh khi còn tồn → 409 PROD_HAS_STOCK; không có API đặt tồn = 0 (D12)', async () => {
    await loginAs('admin')
    await expectFail('/products/SKU-EL-ANR50/deactivate', patch({}), 409, 'PROD_HAS_STOCK')
    await expectFail('/products/SKU-EL-ANR50/deactivate', patch({ clearStockFirst: true }), 409, 'PROD_HAS_STOCK')
  })

  it('SKU trùng → 409; sản phẩm mới không có tồn ngừng được rồi khôi phục (DISCONTINUED ↔ ACTIVE)', async () => {
    await loginAs('admin')
    const cats = await get<Page<{ categoryCode: string }>>('/categories')
    const brands = await get<Page<{ brandCode: string }>>('/brands')
    const body = {
      sku: 'SKU-NEW-1', productName: 'SP mới', categoryCode: cats.items[0].categoryCode, brandCode: brands.items[0].brandCode,
      unit: 'Chai', retailPrice: 100000, taxRate: 0.08,
    }
    await send('/products', post(body))
    await expectFail('/products', post(body), 409, 'PROD_SKU_DUPLICATED')
    expect(await send('/products/SKU-NEW-1/deactivate', patch({}))).toMatchObject({ status: 'DISCONTINUED' })
    expect(await send('/products/SKU-NEW-1/restore', patch({}))).toMatchObject({ status: 'ACTIVE' })
  })

  it('SP ngừng kinh doanh không có trong danh sách POS', async () => {
    await loginAs('admin')
    const cats = await get<Page<{ categoryCode: string }>>('/categories')
    const brands = await get<Page<{ brandCode: string }>>('/brands')
    await send('/products', post({ sku: 'SKU-NEW-2', productName: 'SP mới 2', categoryCode: cats.items[0].categoryCode, brandCode: brands.items[0].brandCode, unit: 'Chai', retailPrice: 1000, taxRate: 0.08 }))
    await send('/products/SKU-NEW-2/deactivate', patch({}))
    await loginAs('cashier01')
    const list = await get<Page<{ sku: string }>>('/pos/products?pageSize=100')
    expect(list.items.some((p) => p.sku === 'SKU-NEW-2')).toBe(false)
  })

  it('phân quyền (ma trận PROD-01..03): Kho quản lý được, thu ngân chỉ xem', async () => {
    await loginAs('inventory01')
    await get('/products')
    await expectFail('/products/SKU-EL-ANR50/deactivate', patch({}), 409, 'PROD_HAS_STOCK') // qua được kiểm quyền
    await loginAs('cashier01')
    await get('/products')
    await expectFail('/products', post({}), 403, 'AUTH_FORBIDDEN')
    await expectFail('/products/SKU-EL-ANR50/deactivate', patch({}), 403, 'AUTH_FORBIDDEN')
  })
})

describe('CUS khách hàng, điểm và hạng', () => {
  it('khách mới mã KH0007, hạng Đồng, 0 điểm; SĐT trùng → 409; thu ngân thêm được nhưng không khóa', async () => {
    await loginAs('cashier01')
    const c = await send<{ customerCode: string; rewardPoints: number; tier: { tierCode: string } }>('/customers', post({ fullName: 'Khách Mới', phoneNumber: '0900111222' }))
    expect(c).toMatchObject({ customerCode: 'KH0007', rewardPoints: 0, tier: { tierCode: 'BRONZE' } })
    await expectFail('/customers', post({ fullName: 'Trùng', phoneNumber: '0900111222' }), 409, 'CUS_PHONE_DUPLICATED')
    await expectFail('/customers/KH0007/deactivate', post({}), 403, 'AUTH_FORBIDDEN')
    await loginAs('manager01')
    await send('/customers/KH0007/deactivate', post({}))
  })

  it('khách bị khóa ưu đãi không gắn được vào đơn (luật 42)', async () => {
    await loginAs('manager01')
    await send('/customers/KH0004/deactivate', post({}))
    const cust = (await get<Page<{ id: number; customerCode: string }>>('/customers?keyword=KH0004')).items[0]
    await loginAs('cashier01')
    await send('/shifts/open', post({ openingCash: 0 }))
    await expectFail('/orders/quote', post({ items: [{ productId: 5, quantity: 1 }], customerId: cust.id }), 422, 'POS_CUSTOMER_INACTIVE')
  })

  it('cấu hình hạng: sửa % giảm hạng Bạc → POS áp mức mới (D42); mốc sai → 422', async () => {
    await loginAs('manager01')
    const cfg = await get<{ amountPerPoint: number; tiers: { tier: string; minSpend: number; discountPercent: number }[] }>('/loyalty-config')
    await expectFail('/loyalty-config', put({ amountPerPoint: cfg.amountPerPoint, tiers: cfg.tiers.map((t) => (t.tier === 'BRONZE' ? { ...t, minSpend: 1 } : t)) }), 422, 'CUS_TIER_SPEND_INVALID')
    const cust = (await get<Page<{ id: number; customerCode: string }>>('/customers?keyword=KH0003')).items[0] // Bạc
    await loginAs('cashier01')
    await send('/shifts/open', post({ openingCash: 0 }))
    const cart = { items: [{ productId: 3, quantity: 1 }], customerId: cust.id }
    const q0 = await send<{ lines: { tierDiscount: number }[] }>('/orders/quote', post(cart))
    await loginAs('manager01')
    await send('/loyalty-config', put({ ...cfg, tiers: cfg.tiers.map((t) => (t.tier === 'SILVER' ? { ...t, discountPercent: 10 } : t)) }))
    await loginAs('cashier01')
    const q1 = await send<{ lines: { tierDiscount: number }[] }>('/orders/quote', post(cart))
    expect(q1.lines[0].tierDiscount).toBeGreaterThan(q0.lines[0].tierDiscount)
  })

  it('thu ngân không sửa cấu hình điểm/hạng', async () => {
    await loginAs('cashier01')
    await expectFail('/loyalty-config', put({ amountPerPoint: 1, tiers: [] }), 403, 'AUTH_FORBIDDEN')
  })
})

describe('AUTH-07 cấu hình hệ thống, AUTH-04 tài khoản', () => {
  it('giá trị sai → 422; khóa lạ → 422; đổi POINT_EARN_AMOUNT đổi điểm tích (nguồn duy nhất)', async () => {
    await loginAs('admin')
    await expectFail('/settings', put({ settings: { POINT_MAX_REDEEM_PERCENT: '101' } }), 422, 'SET_VALUE_INVALID')
    await expectFail('/settings', put({ settings: { POINT_EARN_AMOUNT: '0' } }), 422, 'SET_VALUE_INVALID')
    await expectFail('/settings', put({ settings: { KHONG_CO: '1' } }), 422, 'SET_KEY_UNKNOWN')
    await send('/settings', put({ settings: { POINT_EARN_AMOUNT: '5000' } }))
    expect((await get<{ amountPerPoint: number }>('/loyalty-config')).amountPerPoint).toBe(5000)
  })

  it('cấu hình hệ thống: Admin + Manager; thu ngân/kho không. Tài khoản: chỉ Admin (ma trận AUTH-04, AUTH-07)', async () => {
    await loginAs('manager01')
    await get('/settings')
    await expectFail('/users', undefined, 403, 'AUTH_FORBIDDEN')
    await loginAs('cashier01')
    await expectFail('/settings', undefined, 403, 'AUTH_FORBIDDEN')
    await loginAs('inventory01')
    await expectFail('/settings', undefined, 403, 'AUTH_FORBIDDEN')
  })

  it('tạo nhân viên không nhập mã → tự sinh NV0007, bắt đổi mật khẩu lần đầu; không tự khóa mình (luật 48)', async () => {
    await loginAs('admin')
    const roles = await get<{ items?: { id: number }[] } | { id: number }[]>('/rbac/roles')
    const roleId = (Array.isArray(roles) ? roles : roles.items ?? [])[0].id
    const u = await send<{ employeeCode: string; id: number }>('/users', post({ username: 'nv.moi', password: 'Temp@1234', fullName: 'NV Mới', email: 'nv.moi@x.vn', phoneNumber: '0911000111', roleIds: [roleId] }))
    expect(u.employeeCode).toBe('NV0007')
    const me = await get<{ id: number }>('/users/me')
    await expectFail(`/users/${me.id}/lock`, post({}), 422, 'AUTH_CANNOT_LOCK_SELF')
  })

  it('khóa tài khoản thu hồi phiên ngay (luật 52)', async () => {
    await loginAs('cashier01')
    const cashierSession = useAuthStore.getState().user
    const token = useAuthStore.getState().accessToken
    const refresh = useAuthStore.getState().refreshToken
    const me = await get<{ id: number }>('/users/me')
    await loginAs('admin')
    await send(`/users/${me.id}/lock`, post({ reason: 'Test' }))
    useAuthStore.setState({ user: cashierSession, accessToken: token, refreshToken: refresh })
    await expectFail('/users/me', undefined, 401, 'AUTH_UNAUTHORIZED')
  })
})
