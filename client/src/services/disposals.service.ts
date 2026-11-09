import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, PaginatedData } from '../types/api'
import type { Disposal, DisposalCreateInput, DisposalDetail, GetDisposalsParams } from '../types/inventory'
import { toQueryString } from './query'

const json = (body: unknown) => JSON.stringify(body)

export const disposalsService = {
  /** STK-06, STK-07: GET /disposals */
  list(params: GetDisposalsParams = {}): Promise<ApiSuccessResponse<PaginatedData<Disposal>>> {
    return apiRequest<PaginatedData<Disposal>>(`/disposals${toQueryString(params)}`, { method: 'GET' })
  },
  /** STK-06, STK-07: GET /disposals/{id} */
  get(id: number | string): Promise<ApiSuccessResponse<DisposalDetail>> {
    return apiRequest<DisposalDetail>(`/disposals/${id}`, { method: 'GET' })
  },
  /** STK-06: POST /disposals (lập phiếu, cách ly ngay) */
  create(input: DisposalCreateInput): Promise<ApiSuccessResponse<DisposalDetail>> {
    return apiRequest<DisposalDetail>('/disposals', { method: 'POST', body: json(input) })
  },
  /** STK-07: POST /disposals/{id}/approve (trừ tồn) */
  approve(id: number): Promise<ApiSuccessResponse<DisposalDetail>> {
    return apiRequest<DisposalDetail>(`/disposals/${id}/approve`, { method: 'POST' })
  },
  /** STK-07: POST /disposals/{id}/reject (trả lại phần cách ly) */
  reject(id: number, reason: string): Promise<ApiSuccessResponse<DisposalDetail>> {
    return apiRequest<DisposalDetail>(`/disposals/${id}/reject`, { method: 'POST', body: json({ reason }) })
  },
}
