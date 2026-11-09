import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, PaginatedData } from '../types/api'
import type {
  CartInput,
  CompleteOrderRequest,
  GetOrdersParams,
  OrderListItem,
  OrderQuote,
  OrderRecord,
  PosLot,
  PosProduct,
  ReturnListItem,
} from '../types/pos'
import { toQueryString } from './query'

export interface OrderListResponse extends PaginatedData<OrderListItem> {
  summary: { completedCount: number; totalRevenue: number; cashCollected: number }
}

export interface OrderDetailResponse {
  order: OrderRecord
  returns: ReturnListItem[]
  /** orderDetailId → số lượng đã trả (chỉ dòng RETURN). */
  returnedQuantities: Record<number, number>
  shiftCode: string
}

const post = <T>(url: string, body: unknown) => apiRequest<T>(url, { method: 'POST', body: JSON.stringify(body) })

export const ordersService = {
  /** POS-02: GET /pos/products (chỉ SKU bán được, còn tồn bán được). `code` = khớp đúng barcode/SKU. */
  posProducts(params: { keyword?: string; code?: string; page?: number; pageSize?: number } = {}): Promise<ApiSuccessResponse<PaginatedData<PosProduct>>> {
    return apiRequest<PaginatedData<PosProduct>>(`/pos/products${toQueryString(params)}`, { method: 'GET' })
  },
  /** POS-02: GET /pos/products/{id}/lots (lô còn hạn, FEFO) để đổi lô thủ công. */
  posLots(productId: number): Promise<ApiSuccessResponse<PosLot[]>> {
    return apiRequest<PosLot[]>(`/pos/products/${productId}/lots`, { method: 'GET' })
  },
  /** POS-02/03: POST /orders/quote */
  quote(cart: CartInput): Promise<ApiSuccessResponse<OrderQuote>> {
    return post<OrderQuote>('/orders/quote', cart)
  },
  /** POS-03: POST /orders/complete */
  complete(payload: CompleteOrderRequest): Promise<ApiSuccessResponse<OrderRecord>> {
    return post<OrderRecord>('/orders/complete', payload)
  },
  /** POS-02: POST /orders/drafts (lưu hoặc cập nhật đơn nháp) */
  saveDraft(payload: CartInput & { draftId?: number | null }): Promise<ApiSuccessResponse<OrderRecord>> {
    return post<OrderRecord>('/orders/drafts', payload)
  },
  /** POS-02: GET /orders/drafts */
  drafts(): Promise<ApiSuccessResponse<OrderListItem[]>> {
    return apiRequest<OrderListItem[]>('/orders/drafts', { method: 'GET' })
  },
  /** POS-02: POST /orders/{id}/cancel (chỉ đơn nháp) */
  cancelDraft(id: number): Promise<ApiSuccessResponse<OrderListItem>> {
    return post<OrderListItem>(`/orders/${id}/cancel`, {})
  },
  /** POS-03: GET /orders */
  list(params: GetOrdersParams = {}): Promise<ApiSuccessResponse<OrderListResponse>> {
    return apiRequest<OrderListResponse>(`/orders${toQueryString(params)}`, { method: 'GET' })
  },
  /** POS-03: GET /orders/{id} */
  detail(id: number | string): Promise<ApiSuccessResponse<OrderDetailResponse>> {
    return apiRequest<OrderDetailResponse>(`/orders/${id}`, { method: 'GET' })
  },
}
