// Kiểm mock adapter qua đúng đường mà màn hình dùng: apiRequest (lib/api-client) → mocks.
// Tiêu chí: CLAUDE.md mục 5.1–5.3, docs/API-CONTRACT.md, QUY_TAC_NGHIEP_VU luật 46.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../app/store'
import { ApiClientError, USE_MOCK, apiRequest } from '../lib/api-client'
import type { LoginResponseData } from '../types/api'
import { buildSeed } from './db'
import { installMockGlobals, resetMockDb } from './index'

const PASSWORD = 'Password@123'

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) })
const patch = (body: unknown = {}): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) })

async function loginAs(username: string): Promise<LoginResponseData> {
  const res = await apiRequest<LoginResponseData>('/auth/login', post({ username, password: PASSWORD }))
  useAuthStore.getState().setSession(res.data)
  return res.data
}

/** Gọi và trả lỗi ApiClientError (fail nếu request thành công). */
async function failing(endpoint: string, init?: RequestInit): Promise<ApiClientError> {
  try {
    await apiRequest(endpoint, init)
  } catch (err) {
    if (err instanceof ApiClientError) return err
    throw err
  }
  throw new Error(`Mong đợi ${endpoint} trả lỗi nhưng lại thành công`)
}

async function expectError(endpoint: string, init: RequestInit | undefined, status: number, errorCode: string) {
  const err = await failing(endpoint, init)
  expect({ status: err.status, errorCode: err.errorCode }).toEqual({ status, errorCode })
  expect(err.message.length).toBeGreaterThan(0)
  return err
}

beforeEach(() => {
  useAuthStore.getState().clearSession()
  resetMockDb()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('VITE_USE_MOCK', () => {
  it('môi trường test bật mock và apiRequest không gọi fetch', async () => {
    expect(USE_MOCK).toBe(true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await loginAs('admin')
    await apiRequest('/products')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('AUTH-01: đăng nhập 5 tài khoản seed', () => {
  it.each([
    ['admin', 'ADMIN'],
    ['manager01', 'STORE_MANAGER'],
    ['cashier01', 'CASHIER'],
    ['inventory01', 'INVENTORY_STAFF'],
    ['newstaff', 'CASHIER'],
  ])('%s đăng nhập được với Password@123, vai trò %s', async (username, role) => {
    const res = await apiRequest<LoginResponseData>('/auth/login', post({ username, password: PASSWORD }))
    expect(res.success).toBe(true)
    expect(typeof res.data.accessToken).toBe('string')
    expect(typeof res.data.refreshToken).toBe('string')
    expect(res.data.user.username).toBe(username)
    expect(res.data.user.roles).toEqual([role])
    expect(res.data.user.permissions.length).toBeGreaterThan(0)
  })

  it('newstaff có mustChangePassword = true, tài khoản khác false (luật 47 — ghi nhận dữ liệu)', async () => {
    expect((await loginAs('newstaff')).user.mustChangePassword).toBe(true)
    expect((await loginAs('cashier01')).user.mustChangePassword).toBe(false)
  })

  it('đăng nhập bằng mã nhân viên LUM-084 và LUM084 (API-CONTRACT)', async () => {
    expect((await loginAs('LUM-084')).user.username).toBe('cashier01')
    expect((await loginAs('LUM084')).user.username).toBe('cashier01')
  })

  it('sai mật khẩu → 401 AUTH_INVALID_CREDENTIALS; tài khoản không tồn tại cũng 401', async () => {
    await expectError('/auth/login', post({ username: 'admin', password: 'sai' }), 401, 'AUTH_INVALID_CREDENTIALS')
    await expectError('/auth/login', post({ username: 'khongco', password: PASSWORD }), 401, 'AUTH_INVALID_CREDENTIALS')
  })

  it('tài khoản LOCKED (trang.bui) không đăng nhập được: 403 AUTH_ACCOUNT_LOCKED', async () => {
    await expectError('/auth/login', post({ username: 'trang.bui', password: PASSWORD }), 403, 'AUTH_ACCOUNT_LOCKED')
  })

  it('body thiếu trường → 400 COMMON_VALIDATION_FAILED kèm errors theo trường', async () => {
    const err = await expectError('/auth/login', post({ username: 'admin' }), 400, 'COMMON_VALIDATION_FAILED')
    expect(err.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'password' })]))
  })
})

describe('luật 46: sai mật khẩu 5 lần khóa tạm 15 phút', () => {
  const T0 = new Date('2026-11-08T09:00:00+07:00')
  const wrong = () => apiRequest('/auth/login', post({ username: 'cashier01', password: 'sai-mat-khau' }))

  it('lần 1–4 trả 401, lần 5 trả 403 AUTH_ACCOUNT_TEMP_LOCKED; mật khẩu đúng vẫn bị chặn trong 15 phút', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T0)
    for (let i = 1; i <= 4; i++) {
      await expectError('/auth/login', post({ username: 'cashier01', password: 'sai' }), 401, 'AUTH_INVALID_CREDENTIALS')
    }
    await expectError('/auth/login', post({ username: 'cashier01', password: 'sai' }), 403, 'AUTH_ACCOUNT_TEMP_LOCKED')
    await expectError('/auth/login', post({ username: 'cashier01', password: PASSWORD }), 403, 'AUTH_ACCOUNT_TEMP_LOCKED')

    vi.setSystemTime(new Date(T0.getTime() + 14 * 60_000 + 59_000))
    await expectError('/auth/login', post({ username: 'cashier01', password: PASSWORD }), 403, 'AUTH_ACCOUNT_TEMP_LOCKED')

    vi.setSystemTime(new Date(T0.getTime() + 15 * 60_000 + 1_000))
    expect((await loginAs('cashier01')).user.username).toBe('cashier01')
  })

  it('đăng nhập đúng xóa bộ đếm: 4 sai + 1 đúng + 4 sai vẫn chưa bị khóa', async () => {
    for (let i = 0; i < 4; i++) await expect(wrong()).rejects.toMatchObject({ status: 401 })
    await loginAs('cashier01')
    for (let i = 0; i < 4; i++) await expect(wrong()).rejects.toMatchObject({ status: 401 })
    await loginAs('cashier01')
  })

  it('khóa tạm theo từng tài khoản: tài khoản khác vẫn đăng nhập được', async () => {
    for (let i = 0; i < 5; i++) await wrong().catch(() => undefined)
    expect((await loginAs('manager01')).user.username).toBe('manager01')
  })
})

describe('phiên: 401 khi thiếu/sai token, đăng xuất thu hồi phiên', () => {
  it.each(['/products', '/customers', '/promotions', '/users', '/rbac/roles', '/shifts/current', '/users/me', '/loyalty-config'])(
    'không có token: GET %s → 401 AUTH_UNAUTHORIZED',
    async (endpoint) => {
      await expectError(endpoint, undefined, 401, 'AUTH_UNAUTHORIZED')
    }
  )

  it('token giả → 401 và apiRequest xóa phiên phía máy', async () => {
    useAuthStore.setState({ accessToken: 'token-gia', refreshToken: null, isAuthenticated: true })
    await expectError('/products', undefined, 401, 'AUTH_UNAUTHORIZED')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('đăng xuất thì access token cũ hết hiệu lực', async () => {
    const session = await loginAs('admin')
    await apiRequest('/auth/logout', post({ refreshToken: session.refreshToken }))
    useAuthStore.setState({ accessToken: session.accessToken, refreshToken: null, isAuthenticated: true })
    await expectError('/users/me', undefined, 401, 'AUTH_UNAUTHORIZED')
  })

  it('refresh token xoay vòng: token cũ dùng lại → 401 AUTH_REFRESH_TOKEN_INVALID', async () => {
    const session = await loginAs('admin')
    const res = await apiRequest<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh-token',
      post({ refreshToken: session.refreshToken })
    )
    expect(res.data.refreshToken).not.toBe(session.refreshToken)
    await expectError('/auth/refresh-token', post({ refreshToken: session.refreshToken }), 401, 'AUTH_REFRESH_TOKEN_INVALID')
  })
})

describe('403 AUTH_FORBIDDEN theo ma trận quyền', () => {
  it.each<[string, string, RequestInit | undefined]>([
    ['inventory01', '/customers', undefined],
    ['inventory01', '/promotions', undefined],
    ['inventory01', '/shifts/current', undefined],
    ['cashier01', '/users', undefined],
    ['cashier01', '/rbac/roles', undefined],
    ['cashier01', '/audit-logs', undefined],
    ['cashier01', '/promotions/WELCOME10/report', undefined],
    ['cashier01', '/products', post({})],
    ['cashier01', '/customers/KH-2024-001/deactivate', post({})],
    ['cashier01', '/loyalty-config', put({ amountPerPoint: 1 })],
    ['manager01', '/users', undefined],
    ['manager01', '/rbac/roles', undefined],
    ['manager01', '/audit-logs', undefined],
    ['manager01', '/shifts/open', post({ openingCash: 0 })],
  ])('%s gọi %s → 403', async (username, endpoint, init) => {
    await loginAs(username)
    await expectError(endpoint, init, 403, 'AUTH_FORBIDDEN')
  })

  it('thu ngân thêm khách được (CUS-02 thêm/sửa) và đọc cấu hình điểm (D17)', async () => {
    await loginAs('cashier01')
    const created = await apiRequest<{ customerCode: string }>('/customers', post({ fullName: 'Khách Test', phoneNumber: '0900000001' }))
    expect(created.success).toBe(true)
    expect((await apiRequest('/loyalty-config')).success).toBe(true)
  })
})

describe('envelope và errorCode mẫu theo module (API-CONTRACT.md)', () => {
  it('PRODUCT: danh sách trả PaginatedData, pageSize mặc định 20', async () => {
    await loginAs('admin')
    const res = await apiRequest<{ items: unknown[]; page: number; pageSize: number; totalItems: number }>('/products')
    expect(res.success).toBe(true)
    expect(Object.keys(res.data).sort()).toEqual(['items', 'page', 'pageSize', 'totalItems'])
    expect(res.data.page).toBe(1)
    expect(res.data.pageSize).toBe(20)
    expect(res.data.totalItems).toBeGreaterThan(0)
  })

  it('PRODUCT: 404 PROD_NOT_FOUND, 409 PROD_SKU_DUPLICATED, 404 PROD_BRAND_NOT_FOUND, 409 PROD_CATEGORY_HAS_PRODUCTS', async () => {
    await loginAs('admin')
    await expectError('/products/KHONG-CO', undefined, 404, 'PROD_NOT_FOUND')
    await expectError(
      '/products',
      post({
        sku: 'SKU-EL-ANR50',
        productName: 'Trùng',
        categoryCode: 'CAT_SKINCARE',
        brandCode: 'EL',
        unit: 'Chai',
        retailPrice: 100_000,
        taxRate: 0.1,
      }),
      409,
      'PROD_SKU_DUPLICATED'
    )
    await expectError('/brands/KHONG-CO', undefined, 404, 'PROD_BRAND_NOT_FOUND')
    await expectError('/categories/CAT_SKINCARE/deactivate', patch(), 409, 'PROD_CATEGORY_HAS_PRODUCTS')
  })

  it('PRODUCT: giá bán ≤ 0 → 400 COMMON_VALIDATION_FAILED (không phải 422, D14)', async () => {
    await loginAs('admin')
    await expectError(
      '/products',
      post({ sku: 'SKU-NEW', productName: 'A', categoryCode: 'CAT_SKINCARE', brandCode: 'EL', unit: 'Chai', retailPrice: 0, taxRate: 0 }),
      400,
      'COMMON_VALIDATION_FAILED'
    )
  })

  it('CUSTOMER: tạo mới 201 hạng BRONZE 0 điểm; 404 CUS_NOT_FOUND; 409 CUS_PHONE_DUPLICATED', async () => {
    await loginAs('manager01')
    const created = await apiRequest<{ customerCode: string; tierCode?: string; points?: number; tier?: { tierCode: string } }>(
      '/customers',
      post({ fullName: 'Nguyễn Văn Test', phoneNumber: '0900000002' })
    )
    expect(created.success).toBe(true)
    expect(JSON.stringify(created.data)).toContain('BRONZE')
    await expectError('/customers/KH-KHONG-CO', undefined, 404, 'CUS_NOT_FOUND')
    await expectError('/customers', post({ fullName: 'Trùng', phoneNumber: '0918234567' }), 409, 'CUS_PHONE_DUPLICATED')
  })

  it('PROMOTION: 404 PROM_NOT_FOUND; ngày bắt đầu > kết thúc → 422 PROM_DATE_RANGE_INVALID', async () => {
    await loginAs('manager01')
    await expectError('/promotions/KHONGCO', put({ promotionName: 'x' }), 404, 'PROM_NOT_FOUND')
    await expectError(
      '/promotions',
      post({
        voucherCode: 'TESTDATE',
        promotionName: 'Sai ngày',
        promotionType: 'PERCENT_ORDER',
        applyScope: 'ALL',
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderValue: 0,
        startDate: '2026-12-31',
        endDate: '2026-12-01',
        usageLimit: 10,
        limitPerCustomer: 1,
      }),
      422,
      'PROM_DATE_RANGE_INVALID'
    )
  })

  it('AUTH: đổi mật khẩu sai cũ → 400 AUTH_OLD_PASSWORD_INCORRECT; yếu → 422 AUTH_PASSWORD_POLICY_VIOLATED', async () => {
    await loginAs('cashier01')
    await expectError('/auth/change-password', post({ oldPassword: 'sai', newPassword: 'NewPass@123' }), 400, 'AUTH_OLD_PASSWORD_INCORRECT')
    await expectError('/auth/change-password', post({ oldPassword: PASSWORD, newPassword: 'abc' }), 422, 'AUTH_PASSWORD_POLICY_VIOLATED')
  })

  it('USER: 404 USER_NOT_FOUND, 409 USER_EXISTED, 422 AUTH_CANNOT_LOCK_SELF, 409 USER_NOT_LOCKED; tài khoản mới phải đổi mật khẩu', async () => {
    const admin = await loginAs('admin')
    await expectError('/users/9999', undefined, 404, 'USER_NOT_FOUND')
    const body = {
      employeeCode: 'LUM-900',
      username: 'test.user',
      password: 'Temp@1234',
      fullName: 'Người Thử',
      email: 'test.user@lumina.vn',
      phoneNumber: '0900000003',
      roleIds: [4],
    }
    const created = await apiRequest<{ id: number }>('/users', post(body))
    expect(created.data.id).toBeGreaterThan(0)
    await expectError('/users', post(body), 409, 'USER_EXISTED')
    await expectError(`/users/${admin.user.id}/lock`, post({}), 422, 'AUTH_CANNOT_LOCK_SELF')
    await expectError('/users/2/unlock', post({}), 409, 'USER_NOT_LOCKED')
    useAuthStore.getState().clearSession()
    const fresh = await apiRequest<LoginResponseData>('/auth/login', post({ username: 'test.user', password: 'Temp@1234' }))
    expect(fresh.data.user.mustChangePassword).toBe(true)
  })

  it('RBAC: bỏ USER_MANAGE của ADMIN → 422 AUTH_ADMIN_PERMISSION_REQUIRED; role không có → 404 ROLE_NOT_FOUND', async () => {
    await loginAs('admin')
    await expectError('/rbac/roles/1/permissions', put({ permissionIds: [] }), 422, 'AUTH_ADMIN_PERMISSION_REQUIRED')
    await expectError('/rbac/roles/999/permissions', put({ permissionIds: [] }), 404, 'ROLE_NOT_FOUND')
  })

  it('POS: mở ca 201; chốt ca người khác → 403 POS_SHIFT_NOT_OWNER; chốt lại → 409 POS_SHIFT_NOT_OPEN; tiền âm → 400', async () => {
    await loginAs('cashier01')
    await expectError('/shifts/open', post({ openingCash: -1 }), 400, 'COMMON_VALIDATION_FAILED')
    const shift = await apiRequest<{ shiftId: number }>('/shifts/open', post({ openingCash: 1_000_000 }))
    await loginAs('newstaff')
    await expectError(`/shifts/${shift.data.shiftId}/close`, post({}), 403, 'POS_SHIFT_NOT_OWNER')
    await loginAs('cashier01')
    await apiRequest(`/shifts/${shift.data.shiftId}/close`, post({}))
    await expectError(`/shifts/${shift.data.shiftId}/close`, post({}), 409, 'POS_SHIFT_NOT_OPEN')
  })

  it('API không có → 404 COMMON_NOT_FOUND', async () => {
    await loginAs('admin')
    await expectError('/khong-co-api', undefined, 404, 'COMMON_NOT_FOUND')
  })
})

describe('reset() và seed tất định', () => {
  const snapshot = () => {
    const out: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) as string
      if (key.startsWith('se100_mock_') && !key.startsWith('se100_mock_meta')) out[key] = localStorage.getItem(key) as string
    }
    return out
  }

  it('khóa localStorage có dạng se100_mock_<bảng>_v2', () => {
    const keys = Object.keys(snapshot())
    expect(keys.length).toBeGreaterThan(5)
    for (const k of keys) expect(k).toMatch(/^se100_mock_[a-zA-Z]+_v2$/)
  })

  it('window.__SE100_MOCK__.reset() đưa dữ liệu về seed và hủy phiên cũ', async () => {
    installMockGlobals()
    const seeded = snapshot()
    await loginAs('admin')
    await apiRequest('/customers', post({ fullName: 'Sẽ bị xóa', phoneNumber: '0900000009' }))
    expect(snapshot()).not.toEqual(seeded)

    window.__SE100_MOCK__?.reset()
    expect(snapshot()).toEqual(seeded)
    await expectError('/users/me', undefined, 401, 'AUTH_UNAUTHORIZED')
  })

  it('seed cùng ngày cho kết quả giống hệt nhau', () => {
    const day = new Date('2026-11-08T08:00:00+07:00')
    expect(buildSeed(day)).toEqual(buildSeed(new Date(day)))
  })

  it('hai lần reset liên tiếp cho dữ liệu giống hệt nhau', () => {
    resetMockDb()
    const first = snapshot()
    resetMockDb()
    expect(snapshot()).toEqual(first)
  })
})
