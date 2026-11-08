import { apiRequest } from '../lib/api-client'
import type {
  ApiSuccessResponse,
  CreateCustomerRequest,
  CustomerItem,
  GetCustomersParams,
  PaginatedData,
} from '../types/api'
import { toQueryString } from './query'

export type UpdateCustomerRequest = Partial<
  Pick<CustomerItem, 'fullName' | 'phoneNumber' | 'email' | 'dateOfBirth' | 'gender' | 'address' | 'skinType' | 'note'>
>

const cleanPhone = (phone: string) => phone.replace(/\s+/g, '')

export const customersService = {
  /** CUS-01: GET /customers */
  getCustomers(
    params: GetCustomersParams & { phone?: string } = {}
  ): Promise<ApiSuccessResponse<PaginatedData<CustomerItem>>> {
    return apiRequest<PaginatedData<CustomerItem>>(`/customers${toQueryString(params)}`, { method: 'GET' })
  },

  /** CUS-01: tìm khách theo đúng số điện thoại (GET /customers?phone=). */
  async findByPhone(phoneNumber: string): Promise<CustomerItem | null> {
    const res = await customersService.getCustomers({ phone: cleanPhone(phoneNumber), pageSize: 1 })
    return res.data.items[0] ?? null
  },

  /** CUS-02: POST /customers */
  createCustomer(
    payload: CreateCustomerRequest & { status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<ApiSuccessResponse<CustomerItem>> {
    const body = {
      ...payload,
      fullName: payload.fullName.trim(),
      phoneNumber: cleanPhone(payload.phoneNumber),
      email: payload.email?.trim() || undefined,
      address: payload.address?.trim() || undefined,
      dateOfBirth: payload.dateOfBirth || undefined,
      note: payload.note || undefined,
    }
    return apiRequest<CustomerItem>('/customers', { method: 'POST', body: JSON.stringify(body) })
  },

  /** CUS-01: GET /customers/{customerCode} */
  getCustomerByCode(customerCode: string): Promise<ApiSuccessResponse<CustomerItem>> {
    return apiRequest<CustomerItem>(`/customers/${encodeURIComponent(customerCode)}`, { method: 'GET' })
  },

  /** CUS-02: POST /customers/{code}/deactivate hoặc /activate tùy trạng thái hiện tại. */
  async toggleCustomerStatus(customer: Pick<CustomerItem, 'customerCode' | 'status'>): Promise<CustomerItem> {
    const action = customer.status === 'ACTIVE' ? 'deactivate' : 'activate'
    const res = await apiRequest<CustomerItem>(
      `/customers/${encodeURIComponent(customer.customerCode)}/${action}`,
      { method: 'POST', body: '{}' }
    )
    return res.data
  },

  /** CUS-02: PUT /customers/{code} */
  async updateCustomer(customerCode: string, updates: UpdateCustomerRequest): Promise<CustomerItem> {
    const res = await apiRequest<CustomerItem>(`/customers/${encodeURIComponent(customerCode)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return res.data
  },
}
