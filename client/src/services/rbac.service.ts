import { apiRequest } from '../lib/api-client'
import type {
  ApiSuccessResponse,
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
}
