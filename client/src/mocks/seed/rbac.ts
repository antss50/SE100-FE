import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  PERMISSION_MODULE_TITLES,
  type PermissionCode,
  type SystemRole,
} from '../../domain/permissions'

/** Bảng PERMISSIONS: seed từ domain/permissions.ts, id theo thứ tự khai báo. */
export interface MockPermission {
  id: number
  permissionCode: PermissionCode
  permissionName: string
  module: string
  moduleTitle: string
  uc: string
}

/** Bảng ROLES + ROLE_PERMISSIONS. */
export interface MockRole {
  id: number
  roleCode: SystemRole
  roleName: string
  shortCode: string
  isSystem: boolean
  description: string
  badgeNote: string
  permissionIds: number[]
}

export function seedPermissions(): MockPermission[] {
  return ALL_PERMISSIONS.map((code, index) => {
    const def = PERMISSION_DEFINITIONS[code]
    return {
      id: index + 1,
      permissionCode: code,
      permissionName: def.name,
      module: def.module,
      moduleTitle: PERMISSION_MODULE_TITLES[def.module],
      uc: def.uc,
    }
  })
}

const ROLE_META: Omit<MockRole, 'permissionIds'>[] = [
  {
    id: 1,
    roleCode: 'ADMIN',
    roleName: 'Chủ cửa hàng',
    shortCode: 'AD',
    isSystem: true,
    description: 'Toàn quyền quản trị hệ thống',
    badgeNote: 'Cố định quyền quản trị',
  },
  {
    id: 2,
    roleCode: 'STORE_MANAGER',
    roleName: 'Quản lý',
    shortCode: 'SM',
    isSystem: true,
    description:
      'Duyệt kiểm kho, duyệt xuất hủy, quản lý khuyến mãi, khách hàng, nhà cung cấp; xác nhận bàn giao ca.',
    badgeNote: 'Không xem lợi nhuận gộp',
  },
  {
    id: 3,
    roleCode: 'INVENTORY_STAFF',
    roleName: 'Nhân viên kho',
    shortCode: 'IS',
    isSystem: true,
    description:
      'Nhập kho theo lô, theo dõi cận hạn, lập phiếu kiểm kho và phiếu xuất hủy / tester / trả NCC.',
    badgeNote: 'Kho & FEFO',
  },
  {
    id: 4,
    roleCode: 'CASHIER',
    roleName: 'Thu ngân',
    shortCode: 'CS',
    isSystem: true,
    description: 'Mở/chốt ca, bán hàng, áp voucher, dùng điểm, đổi trả hàng.',
    badgeNote: 'Bán hàng tại quầy',
  },
]

export function seedRoles(permissions: MockPermission[]): MockRole[] {
  const idOf = new Map(permissions.map((p) => [p.permissionCode, p.id]))
  return ROLE_META.map((meta) => ({
    ...meta,
    permissionIds: DEFAULT_ROLE_PERMISSIONS[meta.roleCode].map((code) => idOf.get(code) ?? 0),
  }))
}
