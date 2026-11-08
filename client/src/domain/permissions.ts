// Ma trận phân quyền — nguồn: docs/DANH_GIA_USECASE.md mục 4.
// Đây là danh sách quyền duy nhất của hệ thống (luật 51: quyền có sẵn trong code,
// không thêm/xóa trên giao diện). Mock RBAC seed từ chính các hằng số ở file này.
// Hàm thuần: không React, không gọi API.

export const SYSTEM_ROLES = ['ADMIN', 'STORE_MANAGER', 'INVENTORY_STAFF', 'CASHIER'] as const
export type SystemRole = (typeof SYSTEM_ROLES)[number]

export type PermissionModule =
  | 'AUTH'
  | 'PRODUCT'
  | 'INVENTORY'
  | 'SUPPLIER'
  | 'CUSTOMER'
  | 'PROMOTION'
  | 'POS'
  | 'REPORT'
  | 'SYSTEM'

export const PERMISSION_MODULE_TITLES: Record<PermissionModule, string> = {
  AUTH: 'Tài khoản & phân quyền',
  PRODUCT: 'Sản phẩm, danh mục, thương hiệu',
  INVENTORY: 'Kho, lô & hạn dùng',
  SUPPLIER: 'Nhà cung cấp',
  CUSTOMER: 'Khách hàng & điểm thưởng',
  PROMOTION: 'Khuyến mãi',
  POS: 'Bán hàng, đổi trả & ca',
  REPORT: 'Báo cáo & dashboard',
  SYSTEM: 'Hệ thống',
}

interface PermissionDefinition {
  module: PermissionModule
  name: string
  /** Mã UC liên quan, để đối chiếu với ma trận. */
  uc: string
}

export const PERMISSION_DEFINITIONS = {
  // PROD-01..03: Admin, Manager, NV kho ✔ — Thu ngân 👁
  PRODUCT_VIEW: { module: 'PRODUCT', name: 'Xem sản phẩm, danh mục, thương hiệu', uc: 'PROD-01..03' },
  PRODUCT_MANAGE: { module: 'PRODUCT', name: 'Thêm/sửa/ngừng sản phẩm, danh mục, thương hiệu', uc: 'PROD-01..03' },

  // STK-01: Admin, NV kho ✔ — Manager 👁
  STOCK_IMPORT_VIEW: { module: 'INVENTORY', name: 'Xem phiếu nhập kho', uc: 'STK-01' },
  STOCK_IMPORT_CREATE: { module: 'INVENTORY', name: 'Lập phiếu nhập kho theo lô', uc: 'STK-01' },
  // STK-02: Admin, Manager, NV kho ✔ — Thu ngân 👁 chỉ tồn khả dụng
  STOCK_VIEW: { module: 'INVENTORY', name: 'Tra cứu tồn kho đầy đủ (tồn, cách ly, giá vốn)', uc: 'STK-02' },
  STOCK_VIEW_AVAILABLE: { module: 'INVENTORY', name: 'Tra cứu tồn khả dụng', uc: 'STK-02' },
  // STK-03
  STOCK_EXPIRY_VIEW: { module: 'INVENTORY', name: 'Theo dõi hàng cận hạn / hết hạn', uc: 'STK-03' },
  // STK-04, STK-05
  STOCK_CHECK_VIEW: { module: 'INVENTORY', name: 'Xem phiếu kiểm kho', uc: 'STK-04' },
  STOCK_CHECK_CREATE: { module: 'INVENTORY', name: 'Lập và nhập kết quả phiếu kiểm kho', uc: 'STK-04' },
  STOCK_ADJUST_APPROVE: { module: 'INVENTORY', name: 'Duyệt điều chỉnh sau kiểm kho', uc: 'STK-05' },
  // STK-06, STK-07
  STOCK_DISPOSAL_VIEW: { module: 'INVENTORY', name: 'Xem phiếu xuất hủy / tester / trả NCC', uc: 'STK-06' },
  STOCK_DISPOSAL_CREATE: { module: 'INVENTORY', name: 'Lập phiếu xuất hủy / tester / trả NCC', uc: 'STK-06' },
  STOCK_DISPOSAL_APPROVE: { module: 'INVENTORY', name: 'Duyệt phiếu xuất hủy / tester / trả NCC', uc: 'STK-07' },

  // SUPP-01: Admin, Manager ✔ — SUPP-02..03: + NV kho 👁
  SUPPLIER_VIEW: { module: 'SUPPLIER', name: 'Tra cứu nhà cung cấp và lịch sử nhập', uc: 'SUPP-02..03' },
  SUPPLIER_MANAGE: { module: 'SUPPLIER', name: 'Thêm/sửa/ngừng nhà cung cấp', uc: 'SUPP-01' },

  // CUS-01, CUS-02 (Thu ngân thêm/sửa, không khóa), CUS-04, CUS-05
  CUSTOMER_VIEW: { module: 'CUSTOMER', name: 'Tra cứu và xem hồ sơ khách hàng', uc: 'CUS-01' },
  CUSTOMER_EDIT: { module: 'CUSTOMER', name: 'Thêm/sửa hồ sơ khách hàng', uc: 'CUS-02' },
  CUSTOMER_LOCK: { module: 'CUSTOMER', name: 'Ngừng/kích hoạt hồ sơ khách hàng', uc: 'CUS-02' },
  LOYALTY_REDEEM: { module: 'CUSTOMER', name: 'Dùng điểm thưởng khi thanh toán', uc: 'CUS-04' },
  LOYALTY_CONFIG: { module: 'CUSTOMER', name: 'Cấu hình tích điểm & hạng thẻ', uc: 'CUS-05' },

  // PROM-01..04
  PROMOTION_VIEW: { module: 'PROMOTION', name: 'Tra cứu chương trình khuyến mãi', uc: 'PROM-01' },
  PROMOTION_MANAGE: { module: 'PROMOTION', name: 'Tạo/sửa/tạm dừng khuyến mãi', uc: 'PROM-02' },
  PROMOTION_APPLY_VOUCHER: { module: 'PROMOTION', name: 'Áp dụng voucher khi bán hàng', uc: 'PROM-03' },
  PROMOTION_REPORT: { module: 'PROMOTION', name: 'Xem hiệu quả khuyến mãi', uc: 'PROM-04' },

  // POS-01..05: Admin, Thu ngân ✔ — Manager 👁 + xác nhận bàn giao ca
  POS_VIEW: { module: 'POS', name: 'Xem ca, đơn hàng, phiếu trả', uc: 'POS-01..05' },
  POS_SHIFT_OPEN: { module: 'POS', name: 'Mở ca làm việc', uc: 'POS-01' },
  POS_CHECKOUT: { module: 'POS', name: 'Lập đơn và thanh toán tại quầy', uc: 'POS-02, POS-03' },
  POS_RETURN: { module: 'POS', name: 'Đổi trả & hoàn tiền', uc: 'POS-04' },
  POS_SHIFT_CLOSE: { module: 'POS', name: 'Kiểm đếm tiền & chốt ca', uc: 'POS-05' },
  POS_SHIFT_HANDOVER_CONFIRM: { module: 'POS', name: 'Xác nhận bàn giao ca', uc: 'POS-05' },

  // REP-01..06
  REPORT_DASHBOARD: { module: 'REPORT', name: 'Xem dashboard tổng quan', uc: 'REP-01' },
  REPORT_DASHBOARD_STOCK: { module: 'REPORT', name: 'Xem widget kho trên dashboard', uc: 'REP-01' },
  REPORT_REVENUE: { module: 'REPORT', name: 'Báo cáo doanh thu', uc: 'REP-02' },
  REPORT_PROFIT: { module: 'REPORT', name: 'Báo cáo lợi nhuận gộp, giá vốn', uc: 'REP-02' },
  REPORT_SALES: { module: 'REPORT', name: 'Báo cáo bán hàng (mọi ca)', uc: 'REP-03' },
  REPORT_SALES_OWN_SHIFT: { module: 'REPORT', name: 'Báo cáo bán hàng ca của mình', uc: 'REP-03' },
  REPORT_STOCK: { module: 'REPORT', name: 'Báo cáo tồn kho & hạn dùng', uc: 'REP-04' },
  REPORT_PURCHASE: { module: 'REPORT', name: 'Báo cáo nhập hàng', uc: 'REP-05' },
  REPORT_CUSTOMER: { module: 'REPORT', name: 'Báo cáo khách hàng', uc: 'REP-06' },

  // AUTH-04..06: Admin — AUTH-07: Admin, Manager. AUTH-01..03 không cần quyền (mọi tài khoản).
  USER_MANAGE: { module: 'AUTH', name: 'Quản lý tài khoản nhân viên', uc: 'AUTH-04' },
  ROLE_MANAGE: { module: 'AUTH', name: 'Quản lý vai trò & phân quyền', uc: 'AUTH-05' },
  AUDIT_LOG_VIEW: { module: 'SYSTEM', name: 'Xem nhật ký hệ thống', uc: 'AUTH-06' },
  SYSTEM_SETTINGS_MANAGE: { module: 'SYSTEM', name: 'Cấu hình hệ thống', uc: 'AUTH-07' },
} as const satisfies Record<string, PermissionDefinition>

export type PermissionCode = keyof typeof PERMISSION_DEFINITIONS

export const ALL_PERMISSIONS = Object.keys(PERMISSION_DEFINITIONS) as PermissionCode[]

const STORE_MANAGER_PERMISSIONS: PermissionCode[] = [
  'PRODUCT_VIEW',
  'PRODUCT_MANAGE',
  'STOCK_IMPORT_VIEW',
  'STOCK_VIEW',
  'STOCK_EXPIRY_VIEW',
  'STOCK_CHECK_VIEW',
  'STOCK_ADJUST_APPROVE',
  'STOCK_DISPOSAL_VIEW',
  'STOCK_DISPOSAL_APPROVE',
  'SUPPLIER_VIEW',
  'SUPPLIER_MANAGE',
  'CUSTOMER_VIEW',
  'CUSTOMER_EDIT',
  'CUSTOMER_LOCK',
  'LOYALTY_REDEEM',
  'LOYALTY_CONFIG',
  'PROMOTION_VIEW',
  'PROMOTION_MANAGE',
  'PROMOTION_APPLY_VOUCHER',
  'PROMOTION_REPORT',
  'POS_VIEW',
  'POS_SHIFT_HANDOVER_CONFIRM',
  'REPORT_DASHBOARD',
  'REPORT_DASHBOARD_STOCK',
  'REPORT_REVENUE',
  'REPORT_SALES',
  'REPORT_STOCK',
  'REPORT_PURCHASE',
  'REPORT_CUSTOMER',
  'SYSTEM_SETTINGS_MANAGE',
]

const INVENTORY_STAFF_PERMISSIONS: PermissionCode[] = [
  'PRODUCT_VIEW',
  'PRODUCT_MANAGE',
  'STOCK_IMPORT_VIEW',
  'STOCK_IMPORT_CREATE',
  'STOCK_VIEW',
  'STOCK_EXPIRY_VIEW',
  'STOCK_CHECK_VIEW',
  'STOCK_CHECK_CREATE',
  'STOCK_DISPOSAL_VIEW',
  'STOCK_DISPOSAL_CREATE',
  'SUPPLIER_VIEW',
  'REPORT_DASHBOARD_STOCK',
  'REPORT_STOCK',
]

const CASHIER_PERMISSIONS: PermissionCode[] = [
  'PRODUCT_VIEW',
  'STOCK_VIEW_AVAILABLE',
  'CUSTOMER_VIEW',
  'CUSTOMER_EDIT',
  'LOYALTY_REDEEM',
  'PROMOTION_VIEW',
  'PROMOTION_APPLY_VOUCHER',
  'POS_VIEW',
  'POS_SHIFT_OPEN',
  'POS_CHECKOUT',
  'POS_RETURN',
  'POS_SHIFT_CLOSE',
  'REPORT_SALES_OWN_SHIFT',
]

/**
 * Quyền mặc định của 4 role hệ thống. ADMIN có toàn bộ quyền, trừ các quyền "hạn chế"
 * chỉ dành cho vai trò thấp hơn (tồn khả dụng, báo cáo ca của mình) vì đã có quyền đầy đủ.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, readonly PermissionCode[]> = {
  ADMIN: ALL_PERMISSIONS.filter(
    (code) => code !== 'STOCK_VIEW_AVAILABLE' && code !== 'REPORT_SALES_OWN_SHIFT'
  ),
  STORE_MANAGER: STORE_MANAGER_PERMISSIONS,
  INVENTORY_STAFF: INVENTORY_STAFF_PERMISSIONS,
  CASHIER: CASHIER_PERMISSIONS,
}

/** Quyền quản trị ADMIN không bao giờ bị bỏ (luật 49). */
export const ADMIN_LOCKED_PERMISSIONS: readonly PermissionCode[] = ['USER_MANAGE', 'ROLE_MANAGE']

export function isPermissionCode(value: string): value is PermissionCode {
  return Object.prototype.hasOwnProperty.call(PERMISSION_DEFINITIONS, value)
}

export function isSystemRole(value: string): value is SystemRole {
  return (SYSTEM_ROLES as readonly string[]).includes(value)
}

/** Hợp quyền mặc định của các role (bỏ role lạ). */
export function defaultPermissionsForRoles(roles: readonly string[]): PermissionCode[] {
  const set = new Set<PermissionCode>()
  for (const role of roles) {
    if (isSystemRole(role)) DEFAULT_ROLE_PERMISSIONS[role].forEach((p) => set.add(p))
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p))
}

export type PermissionRequirement = PermissionCode | readonly PermissionCode[]

/**
 * Kiểm quyền. Truyền mảng nghĩa là cần **một trong** các quyền.
 * Không truyền yêu cầu (undefined) nghĩa là chỉ cần đã đăng nhập.
 */
export function hasPermission(
  granted: readonly string[] | null | undefined,
  required: PermissionRequirement | undefined
): boolean {
  if (required === undefined) return true
  if (!granted || granted.length === 0) return false
  const list = typeof required === 'string' ? [required] : required
  if (list.length === 0) return true
  return list.some((code) => granted.includes(code))
}
