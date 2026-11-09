import {
  ArrowLeftRight,
  Award,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Clock,
  FileClock,
  LayoutDashboard,
  PackageMinus,
  PackageOpen,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  Tag,
  Truck,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { hasPermission, type PermissionRequirement } from '../domain/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Quyền để thấy mục này (mảng = một trong các quyền). */
  permission: PermissionRequirement
  /** Mã UC màn hình phục vụ. */
  uc: string
  /** Giai đoạn làm màn này (TIEN-DO.md); có giá trị = đang là trang "Đang phát triển". */
  plannedPhase?: number
  end?: boolean
}

export interface NavGroup {
  section: string
  items: NavItem[]
}

/** Sidebar theo bản LUMINA POS (`UI/Kiểm kê kho/`), đủ mục cho 40 UC. */
export const NAV_GROUPS: NavGroup[] = [
  {
    section: '1. TỔNG QUAN',
    items: [
      {
        to: '/',
        label: 'Dashboard & Cảnh báo',
        icon: LayoutDashboard,
        permission: ['REPORT_DASHBOARD', 'REPORT_DASHBOARD_STOCK'],
        uc: 'REP-01',
        end: true,
      },
    ],
  },
  {
    section: '2. KHO & HÀNG HÓA',
    items: [
      { to: '/products', label: 'Sản phẩm & Danh mục', icon: Boxes, permission: 'PRODUCT_VIEW', uc: 'PROD-01..03' },
      {
        to: '/purchase-orders',
        label: 'Nhập hàng theo lô FEFO',
        icon: PackageOpen,
        permission: 'STOCK_IMPORT_VIEW',
        uc: 'STK-01',
      },
      {
        to: '/stock',
        label: 'Tồn kho & Cận hạn',
        icon: Warehouse,
        permission: ['STOCK_VIEW', 'STOCK_VIEW_AVAILABLE', 'STOCK_EXPIRY_VIEW'],
        uc: 'STK-02, STK-03',
        plannedPhase: 2,
      },
      {
        to: '/inventory-checks',
        label: 'Kiểm kê kho',
        icon: ClipboardCheck,
        permission: 'STOCK_CHECK_VIEW',
        uc: 'STK-04, STK-05',
        plannedPhase: 2,
      },
      {
        to: '/disposals',
        label: 'Xuất hủy & Xuất đặc biệt',
        icon: PackageMinus,
        permission: 'STOCK_DISPOSAL_VIEW',
        uc: 'STK-06, STK-07',
        plannedPhase: 2,
      },
      { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck, permission: 'SUPPLIER_VIEW', uc: 'SUPP-01..03' },
    ],
  },
  {
    section: '3. BÁN HÀNG & POS',
    items: [
      { to: '/pos', label: 'Màn hình Thu ngân POS', icon: Store, permission: 'POS_CHECKOUT', uc: 'POS-02, POS-03' },
      {
        to: '/orders',
        label: 'Lịch sử đơn hàng',
        icon: ReceiptText,
        permission: 'POS_VIEW',
        uc: 'POS-03',
        plannedPhase: 4,
      },
      {
        to: '/returns',
        label: 'Đổi trả hàng',
        icon: ArrowLeftRight,
        permission: 'POS_VIEW',
        uc: 'POS-04',
        plannedPhase: 5,
      },
      { to: '/shifts', label: 'Quản lý ca', icon: Clock, permission: 'POS_VIEW', uc: 'POS-01, POS-05', plannedPhase: 5 },
    ],
  },
  {
    section: '4. CHĂM SÓC & CS BÁN HÀNG',
    items: [
      { to: '/promotions', label: 'Khuyến mãi 4 tầng', icon: Tag, permission: 'PROMOTION_VIEW', uc: 'PROM-01..04' },
      { to: '/customers', label: 'Khách hàng & Hạng thẻ', icon: Users, permission: 'CUSTOMER_VIEW', uc: 'CUS-01..03' },
      { to: '/loyalty', label: 'Cấu hình điểm & hạng', icon: Award, permission: 'LOYALTY_CONFIG', uc: 'CUS-05' },
    ],
  },
  {
    section: '5. HỆ THỐNG',
    items: [
      {
        to: '/reports',
        label: 'Báo cáo tài chính & Excel',
        icon: BarChart3,
        permission: [
          'REPORT_REVENUE',
          'REPORT_SALES',
          'REPORT_SALES_OWN_SHIFT',
          'REPORT_STOCK',
          'REPORT_PURCHASE',
          'REPORT_CUSTOMER',
        ],
        uc: 'REP-02..06',
        plannedPhase: 6,
      },
      { to: '/users', label: 'Tài khoản nhân viên', icon: UserCog, permission: 'USER_MANAGE', uc: 'AUTH-04' },
      { to: '/rbac', label: 'Phân quyền vai trò', icon: ShieldCheck, permission: 'ROLE_MANAGE', uc: 'AUTH-05' },
      {
        to: '/audit-logs',
        label: 'Nhật ký hệ thống',
        icon: FileClock,
        permission: 'AUDIT_LOG_VIEW',
        uc: 'AUTH-06',
        plannedPhase: 6,
      },
      {
        to: '/settings',
        label: 'Cấu hình hệ thống',
        icon: Settings,
        permission: 'SYSTEM_SETTINGS_MANAGE',
        uc: 'AUTH-07',
        plannedPhase: 3,
      },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

/** Các nhóm chỉ còn mục người dùng có quyền; nhóm rỗng bị bỏ. */
export function visibleNavGroups(permissions: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => hasPermission(permissions, i.permission)) })).filter(
    (g) => g.items.length > 0
  )
}

/** Ưu tiên trang chủ: dashboard, rồi màn POS (thu ngân), rồi mục đầu tiên được phép. */
const HOME_PRIORITY = ['/', '/pos']

/** Trang người dùng vào sau đăng nhập và khi mở `/` mà không có quyền dashboard. */
export function homePathFor(permissions: readonly string[]): string | null {
  const allowed = NAV_ITEMS.filter((i) => hasPermission(permissions, i.permission)).map((i) => i.to)
  return HOME_PRIORITY.find((p) => allowed.includes(p)) ?? allowed[0] ?? null
}
