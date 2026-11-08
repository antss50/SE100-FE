import { useAuthStore } from '../app/store'
import { ApiClientError, apiRequest } from '../lib/api-client'
import {
  INITIAL_PERMISSIONS_GROUPED,
  INITIAL_ROLES,
  mockDb,
} from '../lib/mock-db'
import type {
  ApiSuccessResponse,
  AuditLogItem,
  RbacPermissionsGrouped,
  RbacRole,
  UpdateRolePermissionsRequest,
  UpdateRolePermissionsResponseData,
} from '../types/api'

function enrichRole(role: RbacRole): RbacRole {
  const template = INITIAL_ROLES.find(
    (r) => r.roleCode === role.roleCode || r.id === role.id
  )
  return {
    ...template,
    ...role,
    permissionIds: role.permissionIds ?? template?.permissionIds ?? [],
  }
}

export const rbacService = {
  // UC-RBAC-01: GET /api/v1/rbac/roles
  async getRoles(): Promise<ApiSuccessResponse<RbacRole[]>> {
    const res = await apiRequest<RbacRole[]>(
      '/rbac/roles',
      { method: 'GET' },
      () => ({
        success: true,
        data: mockDb.getRoles(),
      })
    )

    return {
      ...res,
      data: res.data.map(enrichRole),
    }
  },

  // UC-RBAC-02: GET /api/v1/rbac/permissions
  async getPermissions(): Promise<ApiSuccessResponse<RbacPermissionsGrouped>> {
    const res = await apiRequest<RbacPermissionsGrouped>(
      '/rbac/permissions',
      { method: 'GET' },
      () => ({
        success: true,
        data: INITIAL_PERMISSIONS_GROUPED,
      })
    )

    // Merge backend permissions with UI group metadata if needed
    const data = res.data && Object.keys(res.data).length > 0 ? res.data : INITIAL_PERMISSIONS_GROUPED
    return {
      ...res,
      data,
    }
  },

  // UC-RBAC-03: PUT /api/v1/rbac/roles/:roleId/permissions
  async updateRolePermissions(
    roleId: number,
    payload: UpdateRolePermissionsRequest
  ): Promise<ApiSuccessResponse<UpdateRolePermissionsResponseData>> {
    return apiRequest<UpdateRolePermissionsResponseData>(
      `/rbac/roles/${roleId}/permissions`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      () => {
        const roles = mockDb.getRoles()
        const target = roles.find((r) => r.id === roleId)
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'ROLE_NOT_FOUND',
            message: 'Không tìm thấy vai trò',
          })
        }

        if (target.roleCode === 'ADMIN' || roleId === 1) {
          throw new ApiClientError(400, {
            success: false,
            errorCode: 'CANNOT_MODIFY_ADMIN',
            message: 'Không thể thay đổi quyền của Quản trị viên hệ thống',
          })
        }

        target.permissionIds = payload.permissionIds
        mockDb.saveRoles(roles)

        const currentUser = useAuthStore.getState().user
        const now = new Date()
        mockDb.prependAuditLog({
          id: `log-${Date.now()}`,
          timestamp: now.toLocaleTimeString('vi-VN', { hour12: false }),
          date: now.toLocaleDateString('vi-VN'),
          actorName: currentUser?.fullName || 'Quản trị viên',
          roleCode: currentUser?.roles?.[0] || 'ADMIN',
          actionTitle: `Cập nhật quyền hạn vai trò ${target.roleName}`,
          referenceCode: `RBAC-${target.roleCode}`,
          detailNote: `(Tổng số quyền được cấp: ${payload.permissionIds.length} quyền)`,
          riskStatus: 'Cần đối soát',
          ipAndTerminal: '192.168.1.104 (POS-MGR)',
        })

        return {
          success: true,
          message: 'Cập nhật quyền hạn cho vai trò thành công',
          data: {
            roleId,
            totalPermissions: payload.permissionIds.length,
          },
        }
      }
    )
  },

  resetDefaultMatrix(): RbacRole[] {
    return mockDb.resetRoles()
  },

  getAuditLogs(): AuditLogItem[] {
    return mockDb.getAuditLogs()
  },
}

