import { z } from 'zod'
import { ADMIN_LOCKED_PERMISSIONS } from '../../domain/permissions'
import type {
  AuditLogItem,
  RbacPermissionItem,
  RbacPermissionsGrouped,
  RbacRole,
  UpdateRolePermissionsResponseData,
} from '../../types/api'
import type { MockTransaction } from '../db'
import { MockHttpError, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
import { seedPermissions, seedRoles, type MockRole } from '../seed/rbac'
import type { MockUser } from '../seed/users'

const updateSchema = z.object({
  permissionIds: z.array(z.number().int(), { error: 'Danh sách quyền không hợp lệ' }),
})

function toRbacRole(db: MockTransaction, role: MockRole): RbacRole {
  const userCount = db.read('users').filter((u) => u.roles.includes(role.roleCode)).length
  return { ...role, _count: { userRoles: userCount } }
}

export function appendAuditLog(
  db: MockTransaction,
  actor: MockUser | null,
  now: Date,
  entry: Pick<AuditLogItem, 'actionTitle' | 'referenceCode' | 'detailNote'>
): void {
  const logs = db.read('auditLogs')
  const seq = db.nextSeq('auditLog')
  const log: AuditLogItem = {
    id: `log-m${seq}`,
    timestamp: now.toLocaleTimeString('vi-VN', { hour12: false }),
    date: now.toLocaleDateString('vi-VN'),
    actorName: actor?.fullName ?? 'Hệ thống',
    roleCode: actor?.roles[0] ?? 'SYSTEM',
    riskStatus: 'Cần đối soát',
    ipAndTerminal: '127.0.0.1 (mock)',
    ...entry,
  }
  db.write('auditLogs', [log, ...logs])
}

export const rbacRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/rbac/roles',
    permission: 'ROLE_MANAGE',
    handler: ({ db }) => ok(db.read('roles').map((r) => toRbacRole(db, r))),
  },
  {
    method: 'GET',
    path: '/rbac/permissions',
    permission: 'ROLE_MANAGE',
    handler: ({ db }) => {
      const grouped: RbacPermissionsGrouped = {}
      for (const p of db.read('permissions')) {
        const item: RbacPermissionItem = {
          id: p.id,
          permissionCode: p.permissionCode,
          permissionName: p.permissionName,
          module: p.module,
          moduleTitle: p.moduleTitle,
          immutableForRoles: ADMIN_LOCKED_PERMISSIONS.includes(p.permissionCode) ? ['ADMIN'] : undefined,
        }
        ;(grouped[p.module] ??= []).push(item)
      }
      return ok(grouped)
    },
  },
  {
    method: 'PUT',
    path: '/rbac/roles/:roleId/permissions',
    permission: 'ROLE_MANAGE',
    handler: ({ db, params, body, user, now }) => {
      const input = parseBody(updateSchema, body)
      const role = db.read('roles').find((r) => r.id === Number(params.roleId))
      if (!role) throw notFound('ROLE_NOT_FOUND', 'Không tìm thấy vai trò')
      const permissions = db.read('permissions')
      const ids = [...new Set(input.permissionIds)]
      if (ids.some((id) => !permissions.some((p) => p.id === id))) {
        throw new MockHttpError(400, 'PERMISSION_NOT_FOUND', 'Có quyền không tồn tại trong hệ thống')
      }
      if (role.roleCode === 'ADMIN') {
        const lockedIds = permissions
          .filter((p) => ADMIN_LOCKED_PERMISSIONS.includes(p.permissionCode))
          .map((p) => p.id)
        if (lockedIds.some((id) => !ids.includes(id))) {
          throw new MockHttpError(422, 'AUTH_ADMIN_PERMISSION_REQUIRED', 'Không được bỏ quyền quản trị của ADMIN')
        }
      }
      role.permissionIds = ids
      db.touch('roles')
      appendAuditLog(db, user, now, {
        actionTitle: `Cập nhật quyền hạn vai trò ${role.roleName}`,
        referenceCode: `RBAC-${role.roleCode}`,
        detailNote: `(Tổng số quyền được cấp: ${ids.length} quyền)`,
      })
      const data: UpdateRolePermissionsResponseData = { roleId: role.id, totalPermissions: ids.length }
      return ok(data, 'Cập nhật quyền hạn cho vai trò thành công')
    },
  },
  {
    method: 'POST',
    path: '/rbac/roles/reset-default',
    permission: 'ROLE_MANAGE',
    handler: ({ db, user, now }) => {
      const roles = seedRoles(seedPermissions())
      db.write('roles', roles)
      appendAuditLog(db, user, now, {
        actionTitle: 'Khôi phục ma trận phân quyền mặc định',
        referenceCode: 'RBAC-RESET',
        detailNote: '',
      })
      return ok(
        roles.map((r) => toRbacRole(db, r)),
        'Đã khôi phục ma trận phân quyền mặc định'
      )
    },
  },
  {
    method: 'GET',
    path: '/audit-logs',
    permission: 'AUDIT_LOG_VIEW',
    handler: ({ db, query }) => {
      const role = query.get('roleCode')
      const items = db.read('auditLogs').filter((l) => !role || l.roleCode === role)
      return ok(paginate(items, query, 50))
    },
  },
]
