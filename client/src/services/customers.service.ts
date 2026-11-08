import { ApiClientError, apiRequest } from '../lib/api-client'
import { INITIAL_CUSTOMERS, mockDb } from '../lib/mock-db'
import type {
  ApiSuccessResponse,
  CreateCustomerRequest,
  CustomerItem,
  GetCustomersParams,
  PaginatedData,
} from '../types/api'

const PHONE_REGEX = /^[0-9]{10,11}$/

function enrichCustomer(raw: CustomerItem): CustomerItem {
  const template = INITIAL_CUSTOMERS.find(
    (c) => c.customerCode === raw.customerCode || c.phoneNumber === raw.phoneNumber
  )
  return {
    ...template,
    ...raw,
    tier: raw.tier ?? {
      id: 1,
      tierCode: 'BRONZE',
      tierName: 'Hạng Đồng',
      discountRate: '0.00',
    },
    joinedAt: raw.joinedAt ?? template?.joinedAt ?? '08/11/2026',
    completedOrdersCount: raw.completedOrdersCount ?? template?.completedOrdersCount ?? 0,
    lastOrderText: raw.lastOrderText ?? template?.lastOrderText ?? 'Chưa phát sinh đơn',
    lastOrderCode: raw.lastOrderCode ?? template?.lastOrderCode ?? '—',
    lastOrderBranch: raw.lastOrderBranch ?? template?.lastOrderBranch ?? 'Chi nhánh Q.1',
    pointHistories: raw.pointHistories ?? template?.pointHistories ?? [],
    orderHistories: raw.orderHistories ?? template?.orderHistories ?? [],
  }
}

export const customersService = {
  // UC-CUS-01: GET /api/v1/customers
  async getCustomers(
    params: GetCustomersParams = {}
  ): Promise<ApiSuccessResponse<PaginatedData<CustomerItem>>> {
    const query = new URLSearchParams()
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.tierId) query.set('tierId', String(params.tierId))
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))

    const qs = query.toString()
    const res = await apiRequest<PaginatedData<CustomerItem>>(
      `/customers${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      () => {
        let all = mockDb.getCustomers().map(enrichCustomer)

        if (params.keyword?.trim()) {
          const kw = params.keyword.trim().toLowerCase()
          all = all.filter(
            (c) =>
              c.customerCode.toLowerCase().includes(kw) ||
              c.phoneNumber.includes(kw) ||
              c.fullName.toLowerCase().includes(kw) ||
              (c.email && c.email.toLowerCase().includes(kw))
          )
        }

        if (params.tierId) {
          all = all.filter((c) => c.tier?.id === params.tierId)
        }

        if (params.status && params.status !== 'ALL') {
          all = all.filter((c) => c.status === params.status)
        }

        if (params.sortBy === 'SPENT_ASC') {
          all = [...all].sort(
            (a, b) => parseFloat(a.totalSpent) - parseFloat(b.totalSpent)
          )
        } else if (params.sortBy === 'POINTS_DESC') {
          all = [...all].sort((a, b) => b.rewardPoints - a.rewardPoints)
        } else {
          all = [...all].sort(
            (a, b) => parseFloat(b.totalSpent) - parseFloat(a.totalSpent)
          )
        }

        const page = params.page ?? 1
        const pageSize = params.pageSize ?? 20
        const start = (page - 1) * pageSize
        const items = all.slice(start, start + pageSize)

        return {
          success: true,
          message: 'Lấy danh sách khách hàng thành công',
          data: {
            items,
            page,
            pageSize,
            totalItems: all.length,
          },
        }
      }
    )

    return {
      ...res,
      data: {
        ...res.data,
        items: res.data.items.map(enrichCustomer),
      },
    }
  },

  // UC-CUS-02: POST /api/v1/customers
  async createCustomer(
    payload: CreateCustomerRequest & { status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<ApiSuccessResponse<CustomerItem>> {
    const cleanPhone = payload.phoneNumber.replace(/\s+/g, '')
    const requestBody: CreateCustomerRequest = {
      fullName: payload.fullName.trim(),
      phoneNumber: cleanPhone,
      email: payload.email?.trim() || undefined,
      dateOfBirth: payload.dateOfBirth || undefined,
      gender: payload.gender || 'FEMALE',
      address: payload.address?.trim() || undefined,
      skinType: payload.skinType || 'COMBINATION',
      note: payload.note || undefined,
    }

    return apiRequest<CustomerItem>(
      '/customers',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (!PHONE_REGEX.test(cleanPhone)) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'VALIDATION_ERROR',
            message: 'Số điện thoại không hợp lệ (10-11 số)',
          })
        }

        const customers = mockDb.getCustomers()
        const duplicate = customers.find(
          (c) => c.phoneNumber.replace(/\s+/g, '') === cleanPhone
        )
        if (duplicate) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'CUS_PHONE_DUPLICATED',
            message: 'Số điện thoại đã tồn tại',
          })
        }

        const nextId = customers.reduce((max, c) => Math.max(max, c.id), 0) + 1
        const nextCode = `KH-${String(nextId).padStart(4, '0')}`
        const created: CustomerItem = {
          id: nextId,
          customerCode: nextCode,
          phoneNumber: cleanPhone,
          fullName: requestBody.fullName,
          email: requestBody.email,
          dateOfBirth: requestBody.dateOfBirth,
          gender: requestBody.gender,
          address: requestBody.address,
          skinType: requestBody.skinType,
          note: requestBody.note,
          rewardPoints: 0,
          totalSpent: '0.00',
          status: payload.status ?? 'ACTIVE',
          joinedAt: new Date().toLocaleDateString('vi-VN'),
          completedOrdersCount: 0,
          lastOrderText: 'Mới đăng ký hôm nay',
          lastOrderCode: '—',
          lastOrderBranch: 'Chi nhánh Q.1',
          tier: {
            id: 1,
            tierCode: 'BRONZE',
            tierName: 'Hạng Đồng',
            discountRate: '0.00',
          },
          pointHistories: [],
          orderHistories: [],
        }

        mockDb.saveCustomers([created, ...customers])

        return {
          success: true,
          message: 'Thêm khách hàng thành công',
          data: created,
        }
      }
    )
  },

  // UC-CUS-03: GET /api/v1/customers/:customerCode
  async getCustomerByCode(
    customerCode: string
  ): Promise<ApiSuccessResponse<CustomerItem>> {
    const res = await apiRequest<CustomerItem>(
      `/customers/${encodeURIComponent(customerCode)}`,
      { method: 'GET' },
      () => {
        const customers = mockDb.getCustomers()
        const found = customers.find(
          (c) =>
            c.customerCode.toLowerCase() === customerCode.toLowerCase() ||
            String(c.id) === customerCode
        )
        if (!found) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'CUS_NOT_FOUND',
            message: 'Không tìm thấy khách hàng',
          })
        }
        return {
          success: true,
          message: 'Lấy thông tin khách hàng thành công',
          data: enrichCustomer(found),
        }
      }
    )

    return {
      ...res,
      data: enrichCustomer(res.data),
    }
  },

  findDuplicateByPhone(phoneNumber: string): CustomerItem | undefined {
    const clean = phoneNumber.replace(/\s+/g, '')
    if (clean.length < 9) return undefined
    return mockDb
      .getCustomers()
      .find((c) => c.phoneNumber.replace(/\s+/g, '') === clean)
  },

  async toggleCustomerStatus(customerCode: string): Promise<CustomerItem> {
    const customers = mockDb.getCustomers()
    const target = customers.find(
      (c) => c.customerCode.toLowerCase() === customerCode.toLowerCase()
    )
    if (!target) {
      throw new ApiClientError(404, {
        success: false,
        errorCode: 'CUS_NOT_FOUND',
        message: 'Không tìm thấy khách hàng',
      })
    }
    target.status = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    mockDb.saveCustomers(customers)
    return enrichCustomer(target)
  },

  async updateCustomer(
    customerCode: string,
    updates: Partial<CustomerItem>
  ): Promise<CustomerItem> {
    const customers = mockDb.getCustomers()
    const target = customers.find(
      (c) => c.customerCode.toLowerCase() === customerCode.toLowerCase()
    )
    if (!target) {
      throw new ApiClientError(404, {
        success: false,
        errorCode: 'CUS_NOT_FOUND',
        message: 'Không tìm thấy khách hàng',
      })
    }
    Object.assign(target, updates)
    mockDb.saveCustomers(customers)
    return enrichCustomer(target)
  },
}

