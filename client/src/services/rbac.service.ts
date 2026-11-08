import { apiRequest } from '../lib/api-client'
import type {
  ApiSuccessResponse,
  AuditLogItem,
  PaginatedData,
  RbacPermissionsGrouped,
  RbacRole,
  UpdateRolePermissionsRequest,
  UpdateRolePermissionsResponseData,
} from '../types/api'

export const rbacService = {
  /** AUTH-05: GET /rbac/roles */
  getRoles(): Promise<ApiSuccessResponse<RbacRole[]>> {
    return apiRequest<RbacRole[]>('/rbac/roles', { method: 'GET' })
  },

  /** AUTH-05: GET /rbac/permissions (nhóm theo module) */
  getPermissions(): Promise<ApiSuccessResponse<RbacPermissionsGrouped>> {
    return apiRequest<RbacPermissionsGrouped>('/rbac/permissions', { method: 'GET' })
  },

  /** AUTH-05: PUT /rbac/roles/{roleId}/permissions */
  updateRolePermissions(
    roleId: number,
    payload: UpdateRolePermissionsRequest
  ): Promise<ApiSuccessResponse<UpdateRolePermissionsResponseData>> {
    return apiRequest<UpdateRolePermissionsResponseData>(`/rbac/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  /** AUTH-05: POST /rbac/roles/reset-default */
  async resetDefaultMatrix(): Promise<RbacRole[]> {
    const res = await apiRequest<RbacRole[]>('/rbac/roles/reset-default', { method: 'POST', body: '{}' })
    return res.data
  },

  /** AUTH-06: GET /audit-logs */
  async getAuditLogs(params: { roleCode?: string; page?: number; pageSize?: number } = {}): Promise<AuditLogItem[]> {
    const query = new URLSearchParams()
    if (params.roleCode) query.set('roleCode', params.roleCode)
    query.set('page', String(params.page ?? 1))
    query.set('pageSize', String(params.pageSize ?? 50))
    const res = await apiRequest<PaginatedData<AuditLogItem>>(`/audit-logs?${query}`, { method: 'GET' })
    return res.data.items
  },
}
