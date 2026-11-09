import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, PaginatedData } from '../types/api'
import type {
  CreateReturnRequest,
  GetReturnsParams,
  ReturnListItem,
  ReturnOrderRecord,
  ReturnQuote,
  ReturnQuoteRequest,
  ReturnableOrder,
} from '../types/pos'
import { toQueryString } from './query'

export const returnsService = {
  /** POS-04: GET /orders/{id}/returnable — dòng hàng còn trả được và hạn đổi trả. */
  returnable(orderId: number | string): Promise<ApiSuccessResponse<ReturnableOrder>> {
    return apiRequest<ReturnableOrder>(`/orders/${orderId}/returnable`, { method: 'GET' })
  },
  /** POS-04: POST /returns/quote */
  quote(payload: ReturnQuoteRequest): Promise<ApiSuccessResponse<ReturnQuote>> {
    return apiRequest<ReturnQuote>('/returns/quote', { method: 'POST', body: JSON.stringify(payload) })
  },
  /** POS-04: POST /returns */
  create(payload: CreateReturnRequest): Promise<ApiSuccessResponse<ReturnOrderRecord>> {
    return apiRequest<ReturnOrderRecord>('/returns', { method: 'POST', body: JSON.stringify(payload) })
  },
  /** POS-04: GET /returns */
  list(params: GetReturnsParams = {}): Promise<ApiSuccessResponse<PaginatedData<ReturnListItem>>> {
    return apiRequest<PaginatedData<ReturnListItem>>(`/returns${toQueryString(params)}`, { method: 'GET' })
  },
  /** POS-04: GET /returns/{id} */
  detail(id: number | string): Promise<ApiSuccessResponse<ReturnOrderRecord>> {
    return apiRequest<ReturnOrderRecord>(`/returns/${id}`, { method: 'GET' })
  },
}
