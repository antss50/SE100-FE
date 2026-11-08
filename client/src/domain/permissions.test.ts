import { describe, expect, it } from 'vitest'
import {
  ADMIN_LOCKED_PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  SYSTEM_ROLES,
  defaultPermissionsForRoles,
  hasPermission,
  isPermissionCode,
  type PermissionCode,
} from './permissions'

const can = (role: (typeof SYSTEM_ROLES)[number], code: PermissionCode) =>
  DEFAULT_ROLE_PERMISSIONS[role].includes(code)

describe('danh sách quyền', () => {
  it('mã quyền dạng MODULE_ACTION viết hoa, không trùng', () => {
    for (const code of ALL_PERMISSIONS) expect(code).toMatch(/^[A-Z]+(_[A-Z]+)+$/)
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
  })

  it('mọi quyền gán cho role đều có trong danh sách', () => {
    for (const role of SYSTEM_ROLES) {
      for (const code of DEFAULT_ROLE_PERMISSIONS[role]) expect(isPermissionCode(code)).toBe(true)
    }
  })

  it('mỗi quyền có tên hiển thị tiếng Việt và module', () => {
    for (const code of ALL_PERMISSIONS) {
      expect(PERMISSION_DEFINITIONS[code].name.length).toBeGreaterThan(0)
      expect(PERMISSION_DEFINITIONS[code].module.length).toBeGreaterThan(0)
    }
  })

  it('ADMIN có quyền quản trị không bỏ được (luật 49)', () => {
    for (const code of ADMIN_LOCKED_PERMISSIONS) expect(can('ADMIN', code)).toBe(true)
  })
})

describe('ma trận DANH_GIA_USECASE mục 4', () => {
  it('PROD-01..03: thu ngân chỉ xem', () => {
    expect(can('CASHIER', 'PRODUCT_VIEW')).toBe(true)
    expect(can('CASHIER', 'PRODUCT_MANAGE')).toBe(false)
    for (const r of ['ADMIN', 'STORE_MANAGER', 'INVENTORY_STAFF'] as const) expect(can(r, 'PRODUCT_MANAGE')).toBe(true)
  })

  it('STK-01: Manager chỉ xem, thu ngân không có quyền', () => {
    expect(can('STORE_MANAGER', 'STOCK_IMPORT_VIEW')).toBe(true)
    expect(can('STORE_MANAGER', 'STOCK_IMPORT_CREATE')).toBe(false)
    expect(can('INVENTORY_STAFF', 'STOCK_IMPORT_CREATE')).toBe(true)
    expect(can('CASHIER', 'STOCK_IMPORT_VIEW')).toBe(false)
  })

  it('STK-02: thu ngân chỉ thấy tồn khả dụng', () => {
    expect(can('CASHIER', 'STOCK_VIEW')).toBe(false)
    expect(can('CASHIER', 'STOCK_VIEW_AVAILABLE')).toBe(true)
    expect(can('INVENTORY_STAFF', 'STOCK_VIEW')).toBe(true)
  })

  it('STK-04..07: NV kho lập phiếu nhưng không duyệt; Manager duyệt nhưng không lập', () => {
    expect(can('INVENTORY_STAFF', 'STOCK_CHECK_CREATE')).toBe(true)
    expect(can('INVENTORY_STAFF', 'STOCK_ADJUST_APPROVE')).toBe(false)
    expect(can('INVENTORY_STAFF', 'STOCK_DISPOSAL_APPROVE')).toBe(false)
    expect(can('STORE_MANAGER', 'STOCK_CHECK_CREATE')).toBe(false)
    expect(can('STORE_MANAGER', 'STOCK_ADJUST_APPROVE')).toBe(true)
    expect(can('STORE_MANAGER', 'STOCK_DISPOSAL_CREATE')).toBe(false)
    expect(can('STORE_MANAGER', 'STOCK_DISPOSAL_APPROVE')).toBe(true)
    expect(can('CASHIER', 'STOCK_EXPIRY_VIEW')).toBe(false)
  })

  it('SUPP: NV kho chỉ xem, thu ngân không có quyền', () => {
    expect(can('INVENTORY_STAFF', 'SUPPLIER_VIEW')).toBe(true)
    expect(can('INVENTORY_STAFF', 'SUPPLIER_MANAGE')).toBe(false)
    expect(can('STORE_MANAGER', 'SUPPLIER_MANAGE')).toBe(true)
    expect(can('CASHIER', 'SUPPLIER_VIEW')).toBe(false)
  })

  it('CUS: thu ngân thêm/sửa nhưng không khóa; NV kho không có quyền', () => {
    expect(can('CASHIER', 'CUSTOMER_EDIT')).toBe(true)
    expect(can('CASHIER', 'CUSTOMER_LOCK')).toBe(false)
    expect(can('CASHIER', 'LOYALTY_CONFIG')).toBe(false)
    expect(can('STORE_MANAGER', 'CUSTOMER_LOCK')).toBe(true)
    expect(can('INVENTORY_STAFF', 'CUSTOMER_VIEW')).toBe(false)
  })

  it('PROM: thu ngân chỉ xem và áp voucher', () => {
    expect(can('CASHIER', 'PROMOTION_VIEW')).toBe(true)
    expect(can('CASHIER', 'PROMOTION_APPLY_VOUCHER')).toBe(true)
    expect(can('CASHIER', 'PROMOTION_MANAGE')).toBe(false)
    expect(can('CASHIER', 'PROMOTION_REPORT')).toBe(false)
    expect(can('INVENTORY_STAFF', 'PROMOTION_VIEW')).toBe(false)
  })

  it('POS: Manager chỉ xem + xác nhận bàn giao; NV kho không có quyền', () => {
    expect(can('STORE_MANAGER', 'POS_VIEW')).toBe(true)
    expect(can('STORE_MANAGER', 'POS_CHECKOUT')).toBe(false)
    expect(can('STORE_MANAGER', 'POS_SHIFT_OPEN')).toBe(false)
    expect(can('STORE_MANAGER', 'POS_SHIFT_HANDOVER_CONFIRM')).toBe(true)
    expect(can('CASHIER', 'POS_CHECKOUT')).toBe(true)
    expect(can('CASHIER', 'POS_RETURN')).toBe(true)
    expect(can('CASHIER', 'POS_SHIFT_HANDOVER_CONFIRM')).toBe(false)
    expect(can('INVENTORY_STAFF', 'POS_VIEW')).toBe(false)
    expect(can('ADMIN', 'POS_CHECKOUT')).toBe(true)
  })

  it('REP: Manager xem doanh thu nhưng không xem lợi nhuận (REP-02)', () => {
    expect(can('STORE_MANAGER', 'REPORT_REVENUE')).toBe(true)
    expect(can('STORE_MANAGER', 'REPORT_PROFIT')).toBe(false)
    expect(can('ADMIN', 'REPORT_PROFIT')).toBe(true)
  })

  it('REP: NV kho chỉ có widget kho ở dashboard và báo cáo tồn', () => {
    expect(can('INVENTORY_STAFF', 'REPORT_DASHBOARD')).toBe(false)
    expect(can('INVENTORY_STAFF', 'REPORT_DASHBOARD_STOCK')).toBe(true)
    expect(can('INVENTORY_STAFF', 'REPORT_STOCK')).toBe(true)
    expect(can('INVENTORY_STAFF', 'REPORT_REVENUE')).toBe(false)
  })

  it('REP: thu ngân không xem dashboard, chỉ báo cáo ca của mình', () => {
    expect(can('CASHIER', 'REPORT_DASHBOARD')).toBe(false)
    expect(can('CASHIER', 'REPORT_DASHBOARD_STOCK')).toBe(false)
    expect(can('CASHIER', 'REPORT_SALES')).toBe(false)
    expect(can('CASHIER', 'REPORT_SALES_OWN_SHIFT')).toBe(true)
  })

  it('AUTH-04..06 chỉ ADMIN; AUTH-07 ADMIN và Manager', () => {
    for (const code of ['USER_MANAGE', 'ROLE_MANAGE', 'AUDIT_LOG_VIEW'] as const) {
      expect(can('ADMIN', code)).toBe(true)
      expect(can('STORE_MANAGER', code)).toBe(false)
      expect(can('INVENTORY_STAFF', code)).toBe(false)
      expect(can('CASHIER', code)).toBe(false)
    }
    expect(can('STORE_MANAGER', 'SYSTEM_SETTINGS_MANAGE')).toBe(true)
    expect(can('CASHIER', 'SYSTEM_SETTINGS_MANAGE')).toBe(false)
  })
})

describe('defaultPermissionsForRoles', () => {
  it('hợp quyền nhiều role, bỏ role lạ, không trùng', () => {
    const perms = defaultPermissionsForRoles(['CASHIER', 'INVENTORY_STAFF', 'SALES'])
    expect(perms).toContain('POS_CHECKOUT')
    expect(perms).toContain('STOCK_IMPORT_CREATE')
    expect(new Set(perms).size).toBe(perms.length)
  })

  it('không có role thì không có quyền', () => {
    expect(defaultPermissionsForRoles([])).toEqual([])
  })
})

describe('hasPermission', () => {
  it('không yêu cầu quyền thì luôn được', () => {
    expect(hasPermission([], undefined)).toBe(true)
  })

  it('một quyền', () => {
    expect(hasPermission(['POS_CHECKOUT'], 'POS_CHECKOUT')).toBe(true)
    expect(hasPermission(['POS_VIEW'], 'POS_CHECKOUT')).toBe(false)
  })

  it('mảng quyền nghĩa là cần một trong các quyền', () => {
    expect(hasPermission(['STOCK_VIEW_AVAILABLE'], ['STOCK_VIEW', 'STOCK_VIEW_AVAILABLE'])).toBe(true)
    expect(hasPermission(['POS_VIEW'], ['STOCK_VIEW', 'STOCK_VIEW_AVAILABLE'])).toBe(false)
  })

  it('không có danh sách quyền thì bị chặn', () => {
    expect(hasPermission(null, 'POS_VIEW')).toBe(false)
    expect(hasPermission(undefined, 'POS_VIEW')).toBe(false)
  })
})
