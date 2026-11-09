import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, PaginatedData } from '../types/api'
import type {
  FefoLookupResult,
  GetStockBatchesParams,
  StockBatchDetail,
  StockBatchItem,
  StockSummary,
} from '../types/stock'
import { toQueryString } from './query'

export const stockService = {
  /** STK-02, STK-03: GET /stock/batches (thu ngân chỉ nhận tồn khả dụng) */
  batches(params: GetStockBatchesParams = {}): Promise<ApiSuccessResponse<PaginatedData<StockBatchItem>>> {
    return apiRequest<PaginatedData<StockBatchItem>>(`/stock/batches${toQueryString(params)}`, { method: 'GET' })
  },
  /** STK-02: GET /stock/summary */
  summary(): Promise<ApiSuccessResponse<StockSummary>> {
    return apiRequest<StockSummary>('/stock/summary', { method: 'GET' })
  },
  /** STK-02: GET /stock/fefo?code= (quét barcode/SKU, trả các lô theo FEFO) */
  fefo(code: string): Promise<ApiSuccessResponse<FefoLookupResult>> {
    return apiRequest<FefoLookupResult>(`/stock/fefo${toQueryString({ code })}`, { method: 'GET' })
  },
  /** STK-02: GET /stock/batches/{id} (chi tiết lô và thẻ kho) */
  batch(id: number | string): Promise<ApiSuccessResponse<StockBatchDetail>> {
    return apiRequest<StockBatchDetail>(`/stock/batches/${id}`, { method: 'GET' })
  },
}
