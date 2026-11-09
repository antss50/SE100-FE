import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, PaginatedData } from '../types/api'
import type {
  ConfirmPurchaseOrderResult,
  GetPurchaseOrdersParams,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderInput,
  PurchaseWarning,
} from '../types/stock'
import { toQueryString } from './query'

const json = (body: unknown) => JSON.stringify(body)

export const purchaseOrdersService = {
  /** STK-01, SUPP-03: GET /purchase-orders */
  list(params: GetPurchaseOrdersParams = {}): Promise<ApiSuccessResponse<PaginatedData<PurchaseOrder>>> {
    return apiRequest<PaginatedData<PurchaseOrder>>(`/purchase-orders${toQueryString(params)}`, { method: 'GET' })
  },
  /** STK-01: GET /purchase-orders/{id} */
  get(id: number | string): Promise<ApiSuccessResponse<PurchaseOrderDetail>> {
    return apiRequest<PurchaseOrderDetail>(`/purchase-orders/${id}`, { method: 'GET' })
  },
  /** STK-01: POST /purchase-orders (lưu nháp) */
  create(input: PurchaseOrderInput): Promise<ApiSuccessResponse<PurchaseOrderDetail>> {
    return apiRequest<PurchaseOrderDetail>('/purchase-orders', { method: 'POST', body: json(input) })
  },
  /** STK-01: PUT /purchase-orders/{id} (chỉ phiếu DRAFT) */
  update(id: number, input: PurchaseOrderInput): Promise<ApiSuccessResponse<PurchaseOrderDetail>> {
    return apiRequest<PurchaseOrderDetail>(`/purchase-orders/${id}`, { method: 'PUT', body: json(input) })
  },
  /** STK-01: POST /purchase-orders/preview-warnings (cảnh báo xoay kệ / cận hạn, không ghi dữ liệu) */
  previewWarnings(input: PurchaseOrderInput): Promise<ApiSuccessResponse<PurchaseWarning[]>> {
    return apiRequest<PurchaseWarning[]>('/purchase-orders/preview-warnings', { method: 'POST', body: json(input) })
  },
  /** STK-01: POST /purchase-orders/{id}/confirm, bắt buộc kèm Idempotency-Key (luật 30) */
  confirm(id: number, idempotencyKey: string): Promise<ApiSuccessResponse<ConfirmPurchaseOrderResult>> {
    return apiRequest<ConfirmPurchaseOrderResult>(`/purchase-orders/${id}/confirm`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  },
  /** STK-01: POST /purchase-orders/{id}/cancel (chỉ phiếu DRAFT) */
  cancel(id: number): Promise<ApiSuccessResponse<PurchaseOrderDetail>> {
    return apiRequest<PurchaseOrderDetail>(`/purchase-orders/${id}/cancel`, { method: 'POST' })
  },
}
