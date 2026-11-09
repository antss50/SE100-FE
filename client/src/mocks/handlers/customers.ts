import { z } from 'zod'
import type { CustomerItem } from '../../types/api'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody, sameText } from '../http'
import type { MockRoute } from '../router'
import { toDateOnly } from '../time'

const phone = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ (10–11 số)'))

const optionalText = z.string().trim().optional()

const customerFields = {
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  phoneNumber: phone,
  email: z.union([z.email('Email không hợp lệ'), z.literal('')]).optional(),
  dateOfBirth: optionalText,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: optionalText,
  skinType: z.enum(['OILY', 'COMBINATION', 'DRY', 'SENSITIVE', 'NORMAL']).optional(),
  note: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}

const createSchema = z.object(customerFields)
// Đổi trạng thái chỉ qua activate/deactivate (thu ngân sửa được nhưng không khóa được).
const updateSchema = z.object(customerFields).omit({ status: true }).partial()

const DEFAULT_TIER = { id: 1, tierCode: 'BRONZE', tierName: 'Hạng Đồng', discountRate: '0.00' } as const

function findCustomer(customers: CustomerItem[], code: string): CustomerItem {
  const found = customers.find((c) => sameText(c.customerCode, code) || String(c.id) === code)
  if (!found) throw notFound('CUS_NOT_FOUND', 'Không tìm thấy khách hàng')
  return found
}

function assertPhoneUnique(customers: CustomerItem[], phoneNumber: string, exceptId?: number) {
  if (customers.some((c) => c.id !== exceptId && c.phoneNumber.replace(/\s+/g, '') === phoneNumber)) {
    throw new MockHttpError(409, 'CUS_PHONE_DUPLICATED', 'Số điện thoại đã tồn tại')
  }
}

export const customerRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/customers',
    permission: 'CUSTOMER_VIEW',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const phoneExact = (query.get('phone') ?? '').replace(/\s+/g, '')
      const tierId = Number(query.get('tierId')) || null
      const status = query.get('status')
      const sortBy = query.get('sortBy')
      let items = db.read('customers').filter(
        (c) =>
          (!kw ||
            c.customerCode.toLowerCase().includes(kw) ||
            c.phoneNumber.includes(kw) ||
            c.fullName.toLowerCase().includes(kw) ||
            (c.email ?? '').toLowerCase().includes(kw)) &&
          (!phoneExact || c.phoneNumber.replace(/\s+/g, '') === phoneExact) &&
          (!tierId || c.tier?.id === tierId) &&
          (!status || c.status === status)
      )
      const spent = (c: CustomerItem) => parseFloat(c.totalSpent)
      items = [...items].sort((a, b) =>
        sortBy === 'SPENT_ASC'
          ? spent(a) - spent(b)
          : sortBy === 'POINTS_DESC'
            ? b.rewardPoints - a.rewardPoints
            : spent(b) - spent(a)
      )
      return ok(paginate(items, query), 'Lấy danh sách khách hàng thành công')
    },
  },
  {
    method: 'POST',
    path: '/customers',
    permission: 'CUSTOMER_EDIT',
    handler: ({ db, body, now, permissions }) => {
      const input = parseBody(createSchema, body)
      if (input.status === 'INACTIVE' && !permissions.includes('CUSTOMER_LOCK')) {
        throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Bạn không có quyền tạo hồ sơ ở trạng thái ngừng hoạt động')
      }
      const customers = db.read('customers')
      assertPhoneUnique(customers, input.phoneNumber)
      const id = customers.reduce((max, c) => Math.max(max, c.id), 0) + 1
      const created: CustomerItem = {
        id,
        customerCode: `KH${String(id).padStart(4, '0')}`,
        phoneNumber: input.phoneNumber,
        fullName: input.fullName,
        email: input.email || undefined,
        dateOfBirth: input.dateOfBirth || undefined,
        gender: input.gender ?? 'FEMALE',
        address: input.address || undefined,
        skinType: input.skinType ?? 'COMBINATION',
        note: input.note || undefined,
        rewardPoints: 0,
        totalSpent: '0.00',
        status: input.status ?? 'ACTIVE',
        joinedAt: toDateOnly(now),
        completedOrdersCount: 0,
        tier: { ...DEFAULT_TIER },
        pointHistories: [],
        orderHistories: [],
      }
      db.write('customers', [created, ...customers])
      return ok(created, 'Thêm khách hàng thành công', 201)
    },
  },
  {
    method: 'GET',
    path: '/customers/:code',
    permission: 'CUSTOMER_VIEW',
    handler: ({ db, params }) => ok(findCustomer(db.read('customers'), params.code)),
  },
  {
    method: 'PUT',
    path: '/customers/:code',
    permission: 'CUSTOMER_EDIT',
    handler: ({ db, params, body }) => {
      const input = parseBody(updateSchema, body)
      const customers = db.read('customers')
      const target = findCustomer(customers, params.code)
      if (input.phoneNumber) assertPhoneUnique(customers, input.phoneNumber, target.id)
      Object.assign(target, input)
      db.touch('customers')
      return ok(target, 'Cập nhật khách hàng thành công')
    },
  },
  ...(['activate', 'deactivate'] as const).map(
    (action): MockRoute => ({
      method: 'POST',
      path: `/customers/:code/${action}`,
      permission: 'CUSTOMER_LOCK',
      handler: ({ db, params }) => {
        const target = findCustomer(db.read('customers'), params.code)
        target.status = action === 'activate' ? 'ACTIVE' : 'INACTIVE'
        db.touch('customers')
        return ok(
          target,
          action === 'activate' ? 'Đã kích hoạt lại hồ sơ khách hàng' : 'Đã ngừng hoạt động hồ sơ khách hàng'
        )
      },
    })
  ),
]
