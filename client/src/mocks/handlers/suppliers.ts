import { z } from 'zod'
import type { MockTransaction } from '../db'
import type { Supplier, SupplierItem, SupplierProductItem, SupplierStats } from '../../types/suppliers'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
import { toIsoLocal } from '../time'

const phone = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ (10–11 số)'))

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))

const supplierSchema = z.object({
  supplierName: z.string().trim().min(1, 'Vui lòng nhập tên nhà cung cấp'),
  taxCode: optionalText,
  phoneNumber: phone,
  email: z.union([z.email('Email không hợp lệ'), z.literal('')]).optional(),
  address: z.string().trim().min(1, 'Vui lòng nhập địa chỉ'),
  contactPerson: optionalText,
  note: optionalText,
})

const deactivateSchema = z.object({ acknowledgeDraft: z.boolean().optional() }).optional()

function statsOf(db: MockTransaction, supplierId: number): SupplierStats {
  const orders = db.read('purchaseOrders').filter((o) => o.supplierId === supplierId)
  const completed = orders.filter((o) => o.status === 'COMPLETED')
  const products = db.read('products')
  const brands = new Set<string>()
  for (const order of completed) {
    for (const line of order.lines) {
      const brand = products.find((p) => p.id === line.productId)?.brandName
      if (brand) brands.add(brand)
    }
  }
  const last = completed.map((o) => o.confirmedAt ?? o.createdAt).sort().at(-1) ?? null
  return {
    orderCount: completed.length,
    totalPurchaseAmount: completed.reduce((sum, o) => sum + o.totalAmount, 0),
    lastPurchaseDate: last,
    brands: [...brands],
    draftOrderCount: orders.filter((o) => o.status === 'DRAFT').length,
  }
}

const withStats = (db: MockTransaction, s: Supplier): SupplierItem => ({ ...s, ...statsOf(db, s.id) })

function findSupplier(db: MockTransaction, id: string): Supplier {
  const found = db.read('suppliers').find((s) => String(s.id) === id || s.supplierCode === id)
  if (!found) throw notFound('SUPP_NOT_FOUND', 'Không tìm thấy nhà cung cấp')
  return found
}

/** SĐT, email, MST không được trùng nhà cung cấp khác (DATABASE.md mục 18). */
function assertUnique(suppliers: Supplier[], input: z.infer<typeof supplierSchema>, exceptId?: number) {
  const others = suppliers.filter((s) => s.id !== exceptId)
  if (others.some((s) => s.phoneNumber === input.phoneNumber)) {
    throw new MockHttpError(409, 'SUPP_PHONE_DUPLICATED', 'Số điện thoại đã thuộc nhà cung cấp khác')
  }
  if (input.email && others.some((s) => s.email?.toLowerCase() === input.email?.toLowerCase())) {
    throw new MockHttpError(409, 'SUPP_EMAIL_DUPLICATED', 'Email đã thuộc nhà cung cấp khác')
  }
  if (input.taxCode && others.some((s) => s.taxCode === input.taxCode)) {
    throw new MockHttpError(409, 'SUPP_TAX_CODE_DUPLICATED', 'Mã số thuế đã thuộc nhà cung cấp khác')
  }
}

export const supplierRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/suppliers',
    permission: 'SUPPLIER_VIEW',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const status = query.get('status')
      const all = db.read('suppliers').map((s) => withStats(db, s))
      const items = all.filter(
        (s) =>
          (!kw ||
            s.supplierName.toLowerCase().includes(kw) ||
            s.supplierCode.toLowerCase().includes(kw) ||
            (s.taxCode ?? '').includes(kw) ||
            s.phoneNumber.includes(kw) ||
            (s.contactPerson ?? '').toLowerCase().includes(kw) ||
            s.brands.some((b) => b.toLowerCase().includes(kw))) &&
          (!status || s.status === status)
      )
      const summary = {
        total: all.length,
        active: all.filter((s) => s.status === 'ACTIVE').length,
        inactive: all.filter((s) => s.status === 'INACTIVE').length,
        totalOrders: all.reduce((n, s) => n + s.orderCount, 0),
        totalPurchaseAmount: all.reduce((n, s) => n + s.totalPurchaseAmount, 0),
      }
      return ok({ ...paginate(items, query), summary }, 'Lấy danh sách nhà cung cấp thành công')
    },
  },
  {
    method: 'GET',
    path: '/suppliers/:id',
    permission: 'SUPPLIER_VIEW',
    handler: ({ db, params }) => ok(withStats(db, findSupplier(db, params.id)), 'Lấy chi tiết nhà cung cấp thành công'),
  },
  {
    method: 'GET',
    path: '/suppliers/:id/products',
    permission: 'SUPPLIER_VIEW',
    handler: ({ db, params }) => {
      const supplier = findSupplier(db, params.id)
      const products = db.read('products')
      const byProduct = new Map<number, SupplierProductItem>()
      const orders = db
        .read('purchaseOrders')
        .filter((o) => o.supplierId === supplier.id && o.status === 'COMPLETED')
        .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''))
      for (const order of orders) {
        for (const line of order.lines) {
          const prev = byProduct.get(line.productId)
          byProduct.set(line.productId, {
            productId: line.productId,
            sku: line.sku,
            productName: line.productName,
            brandName: products.find((p) => p.id === line.productId)?.brandName,
            totalQuantity: (prev?.totalQuantity ?? 0) + line.quantity,
            lastUnitCost: line.unitCost,
            lastPurchaseDate: order.confirmedAt ?? order.createdAt,
          })
        }
      }
      return ok([...byProduct.values()], 'Lấy sản phẩm cung ứng thành công')
    },
  },
  {
    method: 'POST',
    path: '/suppliers',
    permission: 'SUPPLIER_MANAGE',
    handler: ({ db, body, now }) => {
      const input = parseBody(supplierSchema, body)
      const suppliers = db.read('suppliers')
      assertUnique(suppliers, input)
      const id = db.nextSeq('supplier', suppliers.reduce((m, s) => Math.max(m, s.id), 0) + 1)
      const supplier: Supplier = {
        id,
        supplierCode: `NCC${String(id).padStart(3, '0')}`,
        supplierName: input.supplierName,
        taxCode: input.taxCode ?? null,
        phoneNumber: input.phoneNumber,
        email: input.email || null,
        address: input.address,
        contactPerson: input.contactPerson ?? null,
        note: input.note ?? null,
        status: 'ACTIVE',
        createdAt: toIsoLocal(now),
      }
      db.write('suppliers', [...suppliers, supplier])
      return ok(withStats(db, supplier), 'Thêm nhà cung cấp thành công', 201)
    },
  },
  {
    method: 'PUT',
    path: '/suppliers/:id',
    permission: 'SUPPLIER_MANAGE',
    handler: ({ db, params, body, now }) => {
      const input = parseBody(supplierSchema, body)
      const target = findSupplier(db, params.id)
      assertUnique(db.read('suppliers'), input, target.id)
      Object.assign(target, {
        supplierName: input.supplierName,
        taxCode: input.taxCode ?? null,
        phoneNumber: input.phoneNumber,
        email: input.email || null,
        address: input.address,
        contactPerson: input.contactPerson ?? null,
        note: input.note ?? null,
        updatedAt: toIsoLocal(now),
      })
      db.touch('suppliers')
      return ok(withStats(db, target), 'Cập nhật nhà cung cấp thành công')
    },
  },
  {
    method: 'POST',
    path: '/suppliers/:id/deactivate',
    permission: 'SUPPLIER_MANAGE',
    handler: ({ db, params, body, now }) => {
      const input = parseBody(deactivateSchema, body)
      const target = findSupplier(db, params.id)
      if (target.status === 'INACTIVE') {
        throw new MockHttpError(409, 'SUPP_ALREADY_INACTIVE', 'Nhà cung cấp đã ngừng hợp tác')
      }
      const drafts = statsOf(db, target.id).draftOrderCount
      if (drafts > 0 && !input?.acknowledgeDraft) {
        throw new MockHttpError(
          409,
          'SUPP_HAS_DRAFT_ORDERS',
          `Nhà cung cấp còn ${drafts} phiếu nhập nháp. Xác nhận để vẫn ngừng hợp tác`
        )
      }
      target.status = 'INACTIVE'
      target.updatedAt = toIsoLocal(now)
      db.touch('suppliers')
      return ok(withStats(db, target), 'Đã ngừng hợp tác với nhà cung cấp')
    },
  },
  {
    method: 'POST',
    path: '/suppliers/:id/activate',
    permission: 'SUPPLIER_MANAGE',
    handler: ({ db, params, now }) => {
      const target = findSupplier(db, params.id)
      if (target.status === 'ACTIVE') {
        throw new MockHttpError(409, 'SUPP_ALREADY_ACTIVE', 'Nhà cung cấp đang hợp tác')
      }
      target.status = 'ACTIVE'
      target.updatedAt = toIsoLocal(now)
      db.touch('suppliers')
      return ok(withStats(db, target), 'Đã khôi phục hợp tác với nhà cung cấp')
    },
  },
]
