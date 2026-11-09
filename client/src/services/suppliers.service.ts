import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse } from '../types/api'
import type {
  GetSuppliersParams,
  SupplierInput,
  SupplierItem,
  SupplierListData,
  SupplierProductItem,
} from '../types/suppliers'
import { toQueryString } from './query'

const json = (body: unknown) => JSON.stringify(body)

export const suppliersService = {
  /** SUPP-02: GET /suppliers */
  list(params: GetSuppliersParams = {}): Promise<ApiSuccessResponse<SupplierListData>> {
    return apiRequest<SupplierListData>(`/suppliers${toQueryString(params)}`, { method: 'GET' })
  },
  /** SUPP-02: GET /suppliers/{id} */
  get(id: number | string): Promise<ApiSuccessResponse<SupplierItem>> {
    return apiRequest<SupplierItem>(`/suppliers/${id}`, { method: 'GET' })
  },
  /** SUPP-02: GET /suppliers/{id}/products */
  products(id: number | string): Promise<ApiSuccessResponse<SupplierProductItem[]>> {
    return apiRequest<SupplierProductItem[]>(`/suppliers/${id}/products`, { method: 'GET' })
  },
  /** SUPP-01: POST /suppliers */
  create(input: SupplierInput): Promise<ApiSuccessResponse<SupplierItem>> {
    return apiRequest<SupplierItem>('/suppliers', { method: 'POST', body: json(input) })
  },
  /** SUPP-01: PUT /suppliers/{id} */
  update(id: number, input: SupplierInput): Promise<ApiSuccessResponse<SupplierItem>> {
    return apiRequest<SupplierItem>(`/suppliers/${id}`, { method: 'PUT', body: json(input) })
  },
  /** SUPP-01: POST /suppliers/{id}/deactivate */
  deactivate(id: number, acknowledgeDraft = false): Promise<ApiSuccessResponse<SupplierItem>> {
    return apiRequest<SupplierItem>(`/suppliers/${id}/deactivate`, {
      method: 'POST',
      body: json({ acknowledgeDraft }),
    })
  },
  /** SUPP-01: POST /suppliers/{id}/activate */
  activate(id: number): Promise<ApiSuccessResponse<SupplierItem>> {
    return apiRequest<SupplierItem>(`/suppliers/${id}/activate`, { method: 'POST' })
  },
}
