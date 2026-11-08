// Đối chiếu từng ô của ma trận DANH_GIA_USECASE.md mục 4 với DEFAULT_ROLE_PERMISSIONS.
// Viết từ tài liệu: mỗi dòng ma trận → các mã quyền mà từng vai trò PHẢI có ở ô đó.
// Mã quyền không được liệt kê ở ô của vai trò thì vai trò KHÔNG được có (kiểm ở test "đúng tuyệt đối").
import { describe, expect, it } from 'vitest'
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type PermissionCode, type SystemRole } from './permissions'

type Cell = readonly PermissionCode[]
interface MatrixRow {
  uc: string
  ADMIN: Cell
  STORE_MANAGER: Cell
  INVENTORY_STAFF: Cell
  CASHIER: Cell
}

const NONE: Cell = []

/** ✔ toàn quyền · 👁 chỉ xem · — không có quyền (DANH_GIA_USECASE.md mục 4). */
const MATRIX: MatrixRow[] = [
  {
    uc: 'PROD-01..03 (✔ ✔ ✔ 👁)',
    ADMIN: ['PRODUCT_VIEW', 'PRODUCT_MANAGE'],
    STORE_MANAGER: ['PRODUCT_VIEW', 'PRODUCT_MANAGE'],
    INVENTORY_STAFF: ['PRODUCT_VIEW', 'PRODUCT_MANAGE'],
    CASHIER: ['PRODUCT_VIEW'],
  },
  {
    uc: 'STK-01 Nhập kho (✔ 👁 ✔ —)',
    ADMIN: ['STOCK_IMPORT_VIEW', 'STOCK_IMPORT_CREATE'],
    STORE_MANAGER: ['STOCK_IMPORT_VIEW'],
    INVENTORY_STAFF: ['STOCK_IMPORT_VIEW', 'STOCK_IMPORT_CREATE'],
    CASHIER: NONE,
  },
  {
    uc: 'STK-02 Tra cứu tồn (✔ ✔ ✔ 👁 chỉ tồn khả dụng)',
    ADMIN: ['STOCK_VIEW'],
    STORE_MANAGER: ['STOCK_VIEW'],
    INVENTORY_STAFF: ['STOCK_VIEW'],
    CASHIER: ['STOCK_VIEW_AVAILABLE'],
  },
  {
    uc: 'STK-03 Cận hạn (✔ ✔ ✔ —)',
    ADMIN: ['STOCK_EXPIRY_VIEW'],
    STORE_MANAGER: ['STOCK_EXPIRY_VIEW'],
    INVENTORY_STAFF: ['STOCK_EXPIRY_VIEW'],
    CASHIER: NONE,
  },
  {
    uc: 'STK-04 Lập kiểm kho (✔ 👁 ✔ —)',
    ADMIN: ['STOCK_CHECK_VIEW', 'STOCK_CHECK_CREATE'],
    STORE_MANAGER: ['STOCK_CHECK_VIEW'],
    INVENTORY_STAFF: ['STOCK_CHECK_VIEW', 'STOCK_CHECK_CREATE'],
    CASHIER: NONE,
  },
  {
    uc: 'STK-05 Duyệt kiểm kho (✔ ✔ — —)',
    ADMIN: ['STOCK_ADJUST_APPROVE'],
    STORE_MANAGER: ['STOCK_ADJUST_APPROVE'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'STK-06 Lập đề nghị hủy (✔ 👁 ✔ —)',
    ADMIN: ['STOCK_DISPOSAL_VIEW', 'STOCK_DISPOSAL_CREATE'],
    STORE_MANAGER: ['STOCK_DISPOSAL_VIEW'],
    INVENTORY_STAFF: ['STOCK_DISPOSAL_VIEW', 'STOCK_DISPOSAL_CREATE'],
    CASHIER: NONE,
  },
  {
    uc: 'STK-07 Duyệt hủy (✔ ✔ — —)',
    ADMIN: ['STOCK_DISPOSAL_APPROVE'],
    STORE_MANAGER: ['STOCK_DISPOSAL_APPROVE'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'SUPP-01 Quản lý NCC (✔ ✔ — —)',
    ADMIN: ['SUPPLIER_MANAGE'],
    STORE_MANAGER: ['SUPPLIER_MANAGE'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'SUPP-02..03 Tra cứu NCC, lịch sử (✔ ✔ 👁 —)',
    ADMIN: ['SUPPLIER_VIEW'],
    STORE_MANAGER: ['SUPPLIER_VIEW'],
    INVENTORY_STAFF: ['SUPPLIER_VIEW'],
    CASHIER: NONE,
  },
  {
    uc: 'CUS-01 Tra cứu KH (✔ ✔ — ✔)',
    ADMIN: ['CUSTOMER_VIEW'],
    STORE_MANAGER: ['CUSTOMER_VIEW'],
    INVENTORY_STAFF: NONE,
    CASHIER: ['CUSTOMER_VIEW'],
  },
  {
    uc: 'CUS-02 Quản lý KH (✔ ✔ — thêm/sửa, không khóa)',
    ADMIN: ['CUSTOMER_EDIT', 'CUSTOMER_LOCK'],
    STORE_MANAGER: ['CUSTOMER_EDIT', 'CUSTOMER_LOCK'],
    INVENTORY_STAFF: NONE,
    CASHIER: ['CUSTOMER_EDIT'],
  },
  {
    uc: 'CUS-04 Dùng điểm (✔ ✔ — ✔)',
    ADMIN: ['LOYALTY_REDEEM'],
    STORE_MANAGER: ['LOYALTY_REDEEM'],
    INVENTORY_STAFF: NONE,
    CASHIER: ['LOYALTY_REDEEM'],
  },
  {
    uc: 'CUS-05 Cấu hình điểm/hạng (✔ ✔ — —)',
    ADMIN: ['LOYALTY_CONFIG'],
    STORE_MANAGER: ['LOYALTY_CONFIG'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'PROM-01 Tra cứu KM (✔ ✔ — 👁)',
    ADMIN: ['PROMOTION_VIEW'],
    STORE_MANAGER: ['PROMOTION_VIEW'],
    INVENTORY_STAFF: NONE,
    CASHIER: ['PROMOTION_VIEW'],
  },
  {
    uc: 'PROM-02 Quản lý KM (✔ ✔ — —)',
    ADMIN: ['PROMOTION_MANAGE'],
    STORE_MANAGER: ['PROMOTION_MANAGE'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'PROM-03 Áp dụng voucher (✔ ✔ — ✔)',
    ADMIN: ['PROMOTION_APPLY_VOUCHER'],
    STORE_MANAGER: ['PROMOTION_APPLY_VOUCHER'],
    INVENTORY_STAFF: NONE,
    CASHIER: ['PROMOTION_APPLY_VOUCHER'],
  },
  {
    uc: 'PROM-04 Hiệu quả KM (✔ ✔ — —)',
    ADMIN: ['PROMOTION_REPORT'],
    STORE_MANAGER: ['PROMOTION_REPORT'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'POS-01..05 (✔ 👁 + xác nhận bàn giao ca — ✔)',
    ADMIN: ['POS_VIEW', 'POS_SHIFT_OPEN', 'POS_CHECKOUT', 'POS_RETURN', 'POS_SHIFT_CLOSE', 'POS_SHIFT_HANDOVER_CONFIRM'],
    STORE_MANAGER: ['POS_VIEW', 'POS_SHIFT_HANDOVER_CONFIRM'],
    INVENTORY_STAFF: NONE,
    // Xác nhận bàn giao là phần riêng của Manager (DANH_GIA_USECASE mục 2.6: "Manager xác nhận bàn giao").
    CASHIER: ['POS_VIEW', 'POS_SHIFT_OPEN', 'POS_CHECKOUT', 'POS_RETURN', 'POS_SHIFT_CLOSE'],
  },
  {
    uc: 'REP-01 Dashboard (✔ ✔ widget kho —)',
    ADMIN: ['REPORT_DASHBOARD', 'REPORT_DASHBOARD_STOCK'],
    STORE_MANAGER: ['REPORT_DASHBOARD', 'REPORT_DASHBOARD_STOCK'],
    INVENTORY_STAFF: ['REPORT_DASHBOARD_STOCK'],
    CASHIER: NONE,
  },
  {
    uc: 'REP-02 Doanh thu & lợi nhuận (✔ doanh thu không lợi nhuận — —)',
    ADMIN: ['REPORT_REVENUE', 'REPORT_PROFIT'],
    STORE_MANAGER: ['REPORT_REVENUE'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'REP-03 Bán hàng (✔ ✔ — ca của mình)',
    ADMIN: ['REPORT_SALES'],
    STORE_MANAGER: ['REPORT_SALES'],
    INVENTORY_STAFF: NONE,
    CASHIER: ['REPORT_SALES_OWN_SHIFT'],
  },
  {
    uc: 'REP-04 Tồn kho & hạn dùng (✔ ✔ ✔ —)',
    ADMIN: ['REPORT_STOCK'],
    STORE_MANAGER: ['REPORT_STOCK'],
    INVENTORY_STAFF: ['REPORT_STOCK'],
    CASHIER: NONE,
  },
  {
    uc: 'REP-05, REP-06 (✔ ✔ — —)',
    ADMIN: ['REPORT_PURCHASE', 'REPORT_CUSTOMER'],
    STORE_MANAGER: ['REPORT_PURCHASE', 'REPORT_CUSTOMER'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'AUTH-04..06 (✔ — — —)',
    ADMIN: ['USER_MANAGE', 'ROLE_MANAGE', 'AUDIT_LOG_VIEW'],
    STORE_MANAGER: NONE,
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
  {
    uc: 'AUTH-07 Cấu hình hệ thống (✔ ✔ — —)',
    ADMIN: ['SYSTEM_SETTINGS_MANAGE'],
    STORE_MANAGER: ['SYSTEM_SETTINGS_MANAGE'],
    INVENTORY_STAFF: NONE,
    CASHIER: NONE,
  },
]

const ROLES: SystemRole[] = ['ADMIN', 'STORE_MANAGER', 'INVENTORY_STAFF', 'CASHIER']

/** Mã quyền thuộc về một dòng ma trận (hợp các ô). */
const codesOfRow = (row: MatrixRow) => new Set(ROLES.flatMap((r) => [...row[r]]))

describe('ma trận phân quyền mục 4 — từng ô', () => {
  for (const row of MATRIX) {
    const rowCodes = [...codesOfRow(row)]
    for (const role of ROLES) {
      it(`${row.uc} · ${role}`, () => {
        const granted = DEFAULT_ROLE_PERMISSIONS[role]
        const expected = rowCodes.filter((c) => row[role].includes(c)).sort()
        const actual = rowCodes.filter((c) => granted.includes(c)).sort()
        expect(actual).toEqual(expected)
      })
    }
  }
})

describe('ma trận phân quyền mục 4 — toàn cục', () => {
  it('mọi mã quyền trong domain đều thuộc một dòng của ma trận', () => {
    const covered = new Set(MATRIX.flatMap((row) => [...codesOfRow(row)]))
    expect(ALL_PERMISSIONS.filter((c) => !covered.has(c))).toEqual([])
  })

  it('mỗi vai trò có đúng tập quyền suy ra từ ma trận, không thừa không thiếu', () => {
    for (const role of ROLES) {
      const expected = [...new Set(MATRIX.flatMap((row) => [...row[role]]))].sort()
      expect([...DEFAULT_ROLE_PERMISSIONS[role]].sort(), role).toEqual(expected)
    }
  })

  it('AUTH-01..03 không cần mã quyền (mọi vai trò đều đăng nhập, đăng xuất, đổi mật khẩu)', () => {
    expect(ALL_PERMISSIONS.filter((c) => /^AUTH_(LOGIN|LOGOUT|CHANGE)/.test(c))).toEqual([])
  })
})
