import type { AuditDetails, AuditLogRecord, AuditModule } from '../../types/reports'
import { addDays, toIsoLocal } from '../time'
import type { MockUser } from './users'

interface SeedEvent {
  daysAgo: number
  hour: number
  minute: number
  username: string
  action: string
  module: AuditModule
  entityType?: string
  entityId?: string
  details?: AuditDetails
}

const EVENTS: SeedEvent[] = [
  { daysAgo: 12, hour: 8, minute: 5, username: 'admin', action: 'LOGIN', module: 'AUTH', entityType: 'USER', entityId: '1' },
  {
    daysAgo: 12,
    hour: 8, minute: 20, username: 'admin', action: 'UPDATE_SETTING', module: 'SETTING', entityType: 'SYSTEM_SETTINGS',
    details: { before: { EXPIRY_WARNING_DAYS: '45' }, after: { EXPIRY_WARNING_DAYS: '60' } },
  },
  {
    daysAgo: 11, hour: 9, minute: 10, username: 'admin', action: 'CREATE_USER', module: 'USER', entityType: 'USER', entityId: '5',
    details: { after: { employeeCode: 'NV0005', fullName: 'Nhân viên mới' } },
  },
  {
    daysAgo: 10, hour: 16, minute: 0, username: 'manager01', action: 'APPROVE_CHECK', module: 'STOCK', entityType: 'INVENTORY_CHECK', entityId: '1',
    details: { note: 'Duyệt phiếu kiểm kho, điều chỉnh thiếu 1 chai' },
  },
  {
    daysAgo: 9, hour: 9, minute: 30, username: 'inventory01', action: 'CREATE_PRODUCT', module: 'PRODUCT', entityType: 'PRODUCT', entityId: '8',
    details: { after: { sku: 'SKU-ROM-JLT06', productName: 'Son Tint Bóng Rom&nd Juicy #06 Figfig' } },
  },
  {
    daysAgo: 8, hour: 10, minute: 15, username: 'inventory01', action: 'CONFIRM_PURCHASE_ORDER', module: 'STOCK', entityType: 'PURCHASE_ORDER', entityId: '5',
    details: { note: 'Xác nhận phiếu nhập, cộng tồn theo lô' },
  },
  {
    daysAgo: 7, hour: 14, minute: 0, username: 'manager01', action: 'CREATE_PROMOTION', module: 'PROMOTION', entityType: 'PROMOTION', entityId: '10',
    details: { after: { promotionName: 'Flash sale cuối tuần', promotionType: 'FLASH_PRICE' } },
  },
  {
    daysAgo: 6, hour: 8, minute: 45, username: 'cashier01', action: 'LOGIN', module: 'AUTH', entityType: 'USER', entityId: '3',
  },
  {
    daysAgo: 5, hour: 11, minute: 30, username: 'admin', action: 'UPDATE_ROLE_PERMISSIONS', module: 'ROLE', entityType: 'ROLE', entityId: '2',
    details: {
      before: { role: 'STORE_MANAGER', totalPermissions: 24 },
      after: { role: 'STORE_MANAGER', totalPermissions: 25, added: 'REPORT_STOCK', removed: '' },
    },
  },
  {
    daysAgo: 4, hour: 15, minute: 20, username: 'manager01', action: 'APPROVE_DISPOSAL', module: 'STOCK', entityType: 'DISPOSAL', entityId: '1',
    details: { note: 'Duyệt xuất tester, trừ tồn đã cách ly' },
  },
  {
    daysAgo: 3, hour: 9, minute: 0, username: 'cashier01', action: 'OPEN_SHIFT', module: 'POS', entityType: 'SHIFT', entityId: '1',
    details: { after: { openingCash: 1000000 } },
  },
  {
    daysAgo: 3, hour: 17, minute: 30, username: 'cashier01', action: 'CLOSE_SHIFT', module: 'POS', entityType: 'SHIFT', entityId: '1',
    details: { after: { differenceAmount: 0 } },
  },
  {
    daysAgo: 2, hour: 9, minute: 5, username: 'cashier01', action: 'OPEN_SHIFT', module: 'POS', entityType: 'SHIFT', entityId: '2',
    details: { after: { openingCash: 1000000 } },
  },
  {
    daysAgo: 1, hour: 8, minute: 55, username: 'manager01', action: 'LOGIN', module: 'AUTH', entityType: 'USER', entityId: '2',
  },
  {
    daysAgo: 1, hour: 18, minute: 0, username: 'manager01', action: 'LOGOUT', module: 'AUTH', entityType: 'USER', entityId: '2',
  },
]

/** Nhật ký mẫu (AUDIT_LOGS), ngày tính tương đối so với `today`; id tăng dần theo thời gian. */
export function seedAuditLogs(today: Date, users: readonly MockUser[]): AuditLogRecord[] {
  return EVENTS.map((e, index): AuditLogRecord => {
    const user = users.find((u) => u.username === e.username)
    const when = addDays(today, -e.daysAgo)
    when.setHours(e.hour, e.minute, 0, 0)
    return {
      id: index + 1,
      userId: user?.id ?? null,
      userName: user?.fullName ?? 'Hệ thống',
      roleCode: user?.roles[0] ?? 'SYSTEM',
      action: e.action,
      module: e.module,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      details: e.details ?? null,
      ipAddress: '127.0.0.1',
      createdAt: toIsoLocal(when),
    }
  })
}
