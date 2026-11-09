import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, PaginatedData } from '../types/api'
import type {
  GetInventoryChecksParams,
  InventoryCheck,
  InventoryCheckCountInput,
  InventoryCheckCreateInput,
  InventoryCheckDetail,
} from '../types/inventory'
import { toQueryString } from './query'

const json = (body: unknown) => JSON.stringify(body)

export const inventoryChecksService = {
  /** STK-04, STK-05: GET /inventory-checks */
  list(params: GetInventoryChecksParams = {}): Promise<ApiSuccessResponse<PaginatedData<InventoryCheck>>> {
    return apiRequest<PaginatedData<InventoryCheck>>(`/inventory-checks${toQueryString(params)}`, { method: 'GET' })
  },
  /** STK-04, STK-05: GET /inventory-checks/{id} */
  get(id: number | string): Promise<ApiSuccessResponse<InventoryCheckDetail>> {
    return apiRequest<InventoryCheckDetail>(`/inventory-checks/${id}`, { method: 'GET' })
  },
  /** STK-04: POST /inventory-checks (bắt đầu kiểm: chụp tồn + khóa lô) */
  create(input: InventoryCheckCreateInput): Promise<ApiSuccessResponse<InventoryCheckDetail>> {
    return apiRequest<InventoryCheckDetail>('/inventory-checks', { method: 'POST', body: json(input) })
  },
  /** STK-04: PUT /inventory-checks/{id}/counts (lưu nháp số đếm) */
  saveCounts(id: number, input: InventoryCheckCountInput): Promise<ApiSuccessResponse<InventoryCheckDetail>> {
    return apiRequest<InventoryCheckDetail>(`/inventory-checks/${id}/counts`, { method: 'PUT', body: json(input) })
  },
  /** STK-04: POST /inventory-checks/{id}/submit (gửi duyệt; không chênh lệch thì tự hoàn tất) */
  submit(id: number, input: InventoryCheckCountInput): Promise<ApiSuccessResponse<InventoryCheckDetail>> {
    return apiRequest<InventoryCheckDetail>(`/inventory-checks/${id}/submit`, { method: 'POST', body: json(input) })
  },
  /** STK-04: POST /inventory-checks/{id}/cancel */
  cancel(id: number): Promise<ApiSuccessResponse<InventoryCheckDetail>> {
    return apiRequest<InventoryCheckDetail>(`/inventory-checks/${id}/cancel`, { method: 'POST' })
  },
  /** STK-05: POST /inventory-checks/{id}/approve */
  approve(id: number): Promise<ApiSuccessResponse<InventoryCheckDetail>> {
    return apiRequest<InventoryCheckDetail>(`/inventory-checks/${id}/approve`, { method: 'POST' })
  },
  /** STK-05: POST /inventory-checks/{id}/reject */
  reject(id: number, reason: string): Promise<ApiSuccessResponse<InventoryCheckDetail>> {
    return apiRequest<InventoryCheckDetail>(`/inventory-checks/${id}/reject`, { method: 'POST', body: json({ reason }) })
  },
}
