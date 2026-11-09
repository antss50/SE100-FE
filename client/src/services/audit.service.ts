import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse } from '../types/api'
import type { AuditLogsData, GetAuditLogsParams } from '../types/reports'
import { toQueryString } from './query'

export const auditService = {
  /** AUTH-06: GET /audit-logs */
  list(params: GetAuditLogsParams): Promise<ApiSuccessResponse<AuditLogsData>> {
    return apiRequest<AuditLogsData>(`/audit-logs${toQueryString(params)}`, { method: 'GET' })
  },
}
