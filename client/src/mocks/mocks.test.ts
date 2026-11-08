import { beforeEach, describe, expect, it } from 'vitest'
import { handleMockRequest, resetMockDb } from './index'

type Json = { success: boolean; errorCode?: string; data?: Record<string, unknown> & { accessToken?: string } }

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await handleMockRequest(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { status: res.status, json: (await res.json()) as Json }
}

async function login(username: string, password = 'Password@123') {
  const { json } = await call('POST', '/auth/login', { username, password })
  return json.data?.accessToken as string
}

beforeEach(() => resetMockDb())

describe('mock adapter', () => {
  it('đăng nhập trả token và quyền theo ma trận', async () => {
    const { status, json } = await call('POST', '/auth/login', { username: 'cashier01', password: 'Password@123' })
    expect(status).toBe(200)
    const user = json.data?.user as { permissions: string[] }
    expect(user.permissions).toContain('POS_CHECKOUT')
    expect(user.permissions).not.toContain('USER_MANAGE')
  })

  it('body sai schema thì 400 COMMON_VALIDATION_FAILED', async () => {
    const { status, json } = await call('POST', '/auth/login', { username: '' })
    expect(status).toBe(400)
    expect(json.errorCode).toBe('COMMON_VALIDATION_FAILED')
  })

  it('luật 46: sai mật khẩu 5 lần thì khóa tạm, kể cả nhập đúng sau đó', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await call('POST', '/auth/login', { username: 'manager01', password: 'sai' })).status).toBe(401)
    }
    const fifth = await call('POST', '/auth/login', { username: 'manager01', password: 'sai' })
    expect(fifth.json.errorCode).toBe('AUTH_ACCOUNT_TEMP_LOCKED')
    const after = await call('POST', '/auth/login', { username: 'manager01', password: 'Password@123' })
    expect(after.status).toBe(403)
  })

  it('newstaff phải đổi mật khẩu lần đầu (luật 47)', async () => {
    const { json } = await call('POST', '/auth/login', { username: 'newstaff', password: 'Password@123' })
    const user = json.data?.user as { mustChangePassword: boolean } | undefined
    expect(user?.mustChangePassword).toBe(true)
  })

  it('chưa đăng nhập thì 401, thiếu quyền thì 403', async () => {
    expect((await call('GET', '/users')).status).toBe(401)
    const token = await login('manager01')
    const res = await call('GET', '/users', undefined, token)
    expect(res.status).toBe(403)
    expect(res.json.errorCode).toBe('AUTH_FORBIDDEN')
    expect((await call('GET', '/users', undefined, await login('admin'))).status).toBe(200)
  })

  it('luật 48: không tự khóa chính mình', async () => {
    const token = await login('admin')
    const res = await call('POST', '/users/1/lock', {}, token)
    expect(res.json.errorCode).toBe('AUTH_CANNOT_LOCK_SELF')
  })

  it('luật 52: khóa tài khoản thì phiên của người đó mất hiệu lực', async () => {
    const cashierToken = await login('cashier01')
    expect((await call('GET', '/users/me', undefined, cashierToken)).status).toBe(200)
    await call('POST', '/users/3/lock', { reason: 'test' }, await login('admin'))
    expect((await call('GET', '/users/me', undefined, cashierToken)).status).toBe(401)
  })

  it('luật 35: mỗi thu ngân tối đa 1 ca mở', async () => {
    const token = await login('cashier01')
    expect((await call('POST', '/shifts/open', { openingCash: 2_000_000 }, token)).status).toBe(201)
    const again = await call('POST', '/shifts/open', { openingCash: 0 }, token)
    expect(again.status).toBe(409)
    expect(again.json.errorCode).toBe('POS_SHIFT_ALREADY_OPEN')
  })

  it('Manager không được mở ca (chỉ xem)', async () => {
    const res = await call('POST', '/shifts/open', { openingCash: 0 }, await login('manager01'))
    expect(res.status).toBe(403)
  })

  it('lỗi giữa chừng thì không ghi gì (giao dịch)', async () => {
    const token = await login('admin')
    const before = await call('GET', '/customers?pageSize=100', undefined, token)
    const total = (before.json.data as { totalItems: number }).totalItems
    const dup = await call('POST', '/customers', { fullName: 'A', phoneNumber: '0918234567' }, token)
    expect(dup.json.errorCode).toBe('CUS_PHONE_DUPLICATED')
    const after = await call('GET', '/customers?pageSize=100', undefined, token)
    expect((after.json.data as { totalItems: number }).totalItems).toBe(total)
  })

  it('API không tồn tại thì 404', async () => {
    expect((await call('GET', '/khong-co')).status).toBe(404)
  })

  it('quyền vai trò trong mock RBAC seed từ domain/permissions', async () => {
    const res = await call('GET', '/rbac/roles', undefined, await login('admin'))
    const roles = res.json.data as unknown as { roleCode: string; permissionIds: number[] }[]
    expect(roles.map((r) => r.roleCode)).toEqual(['ADMIN', 'STORE_MANAGER', 'INVENTORY_STAFF', 'CASHIER'])
    expect(roles.every((r) => r.permissionIds.length > 0)).toBe(true)
  })
})
