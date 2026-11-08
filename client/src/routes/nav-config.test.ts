import { describe, expect, it } from 'vitest'
import { DEFAULT_ROLE_PERMISSIONS } from '../domain/permissions'
import { NAV_ITEMS, homePathFor, visibleNavGroups } from './nav-config'

const pathsOf = (role: keyof typeof DEFAULT_ROLE_PERMISSIONS) =>
  visibleNavGroups(DEFAULT_ROLE_PERMISSIONS[role]).flatMap((g) => g.items.map((i) => i.to))

describe('menu theo quyền', () => {
  it('đường dẫn menu không trùng', () => {
    const paths = NAV_ITEMS.map((i) => i.to)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('đủ 5 nhóm theo thiết kế LUMINA POS', () => {
    expect(visibleNavGroups(DEFAULT_ROLE_PERMISSIONS.ADMIN).map((g) => g.section)).toEqual([
      '1. TỔNG QUAN',
      '2. KHO & HÀNG HÓA',
      '3. BÁN HÀNG & POS',
      '4. CHĂM SÓC & CS BÁN HÀNG',
      '5. HỆ THỐNG',
    ])
  })

  it('ADMIN thấy mọi mục', () => {
    expect(pathsOf('ADMIN')).toEqual(NAV_ITEMS.map((i) => i.to))
  })

  it('thu ngân không thấy kho, nhà cung cấp, quản trị; về POS sau đăng nhập', () => {
    const paths = pathsOf('CASHIER')
    for (const p of ['/', '/purchase-orders', '/inventory-checks', '/suppliers', '/users', '/rbac', '/loyalty']) {
      expect(paths).not.toContain(p)
    }
    expect(paths).toContain('/pos')
    expect(paths).toContain('/stock')
    expect(homePathFor(DEFAULT_ROLE_PERMISSIONS.CASHIER)).toBe('/pos')
  })

  it('NV kho thấy dashboard (widget kho) và mục kho, không thấy POS/khách hàng', () => {
    const paths = pathsOf('INVENTORY_STAFF')
    expect(paths).toContain('/')
    expect(paths).toContain('/purchase-orders')
    expect(paths).not.toContain('/pos')
    expect(paths).not.toContain('/customers')
    expect(paths).not.toContain('/promotions')
  })

  it('Manager không thấy tài khoản, phân quyền, nhật ký; thấy cấu hình hệ thống', () => {
    const paths = pathsOf('STORE_MANAGER')
    expect(paths).not.toContain('/users')
    expect(paths).not.toContain('/rbac')
    expect(paths).not.toContain('/audit-logs')
    expect(paths).not.toContain('/pos')
    expect(paths).toContain('/settings')
  })

  it('không có quyền gì thì không có trang chủ', () => {
    expect(homePathFor([])).toBeNull()
  })
})
