import { z } from 'zod'
import { weightedAverageCost } from '../../domain/stock/batch'
import { collectPurchaseWarnings } from '../../domain/stock/purchase-warnings'
import type { PurchaseOrder, PurchaseOrderDetail, PurchaseOrderLine, PurchaseWarning } from '../../types/stock'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
import { toDateOnly, toIsoLocal } from '../time'
import {
  applyStockChange,
  assertBatchNotLocked,
  expiryWarningDays,
  findBatchByLot,
  nextTableId,
  todayOf,
} from '../stock-ledger'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (định dạng YYYY-MM-DD)')

const lineSchema = z.object({
  productId: z.number({ error: 'Vui lòng chọn sản phẩm' }).int().positive('Vui lòng chọn sản phẩm'),
  lotCode: z.string().trim().min(1, 'Vui lòng nhập mã lô').max(50, 'Mã lô tối đa 50 ký tự'),
  mfgDate: z.union([dateOnly, z.literal('')]).optional(),
  expDate: dateOnly,
  quantity: z.number({ error: 'Số lượng phải là số' }).int('Số lượng phải là số nguyên').min(1, 'Số lượng phải lớn hơn 0'),
  unitCost: z.number({ error: 'Giá nhập phải là số' }).int('Giá nhập phải là số nguyên').min(0, 'Giá nhập không được âm'),
})

const orderSchema = z.object({
  supplierId: z.number({ error: 'Vui lòng chọn nhà cung cấp' }).int().positive('Vui lòng chọn nhà cung cấp'),
  supplierInvoiceNo: z.string().trim().max(50).optional(),
  note: z.string().trim().optional(),
  lines: z.array(lineSchema).min(1, 'Phiếu nhập phải có ít nhất một dòng'),
})

type OrderInput = z.infer<typeof orderSchema>

/** Xem trước cảnh báo chỉ cần sản phẩm, mã lô và hạn dùng (người dùng có thể chưa nhập xong số lượng). */
const previewSchema = z.object({
  lines: z.array(z.object({ productId: z.number().int().positive(), lotCode: z.string().min(1), expDate: dateOnly })).min(1),
})

function findOrder(db: MockTransaction, id: string): PurchaseOrderDetail {
  const found = db.read('purchaseOrders').find((o) => String(o.id) === id || o.poCode === id)
  if (!found) throw notFound('STK_PO_NOT_FOUND', 'Không tìm thấy phiếu nhập kho')
  return found
}

function toHeader(order: PurchaseOrderDetail): PurchaseOrder {
  const { lines: _lines, ...header } = order
  void _lines
  return header
}

/** Dòng của phiếu nháp kèm cờ lô đã có trong kho. */
function withExistingFlags(db: MockTransaction, order: PurchaseOrderDetail): PurchaseOrderDetail {
  return {
    ...order,
    lines: order.lines.map((l) => ({
      ...l,
      existingBatch: order.status === 'DRAFT' ? Boolean(findBatchByLot(db, l.productId, l.lotCode)) : undefined,
    })),
  }
}

function nextPoCode(db: MockTransaction, now: Date): string {
  const prefix = `PN${toDateOnly(now).replaceAll('-', '')}-`
  const used = db.read('purchaseOrders').filter((o) => o.poCode.startsWith(prefix)).length
  return `${prefix}${String(used + 1).padStart(2, '0')}`
}

function assertEditable(order: PurchaseOrderDetail): void {
  if (order.status !== 'DRAFT') {
    throw new MockHttpError(409, 'STK_PO_NOT_EDITABLE', 'Phiếu đã hoàn tất hoặc đã hủy, không thể sửa hay xóa (luật 41)')
  }
}

/** Kiểm tra nghiệp vụ chung của phiếu nhập; trả về các dòng đã gắn thông tin sản phẩm. */
function buildLines(db: MockTransaction, input: OrderInput, today: string): PurchaseOrderLine[] {
  const supplier = db.read('suppliers').find((s) => s.id === input.supplierId)
  if (!supplier) throw notFound('SUPP_NOT_FOUND', 'Không tìm thấy nhà cung cấp')
  if (supplier.status !== 'ACTIVE') {
    throw new MockHttpError(422, 'STK_SUPPLIER_INACTIVE', 'Chỉ được chọn nhà cung cấp đang hợp tác')
  }
  const products = db.read('products')
  const seen = new Set<string>()
  return input.lines.map((line, index) => {
    const product = products.find((p) => p.id === line.productId)
    if (!product) throw notFound('PROD_NOT_FOUND', `Dòng ${index + 1}: không tìm thấy sản phẩm`)
    if (product.status !== 'ACTIVE') {
      throw new MockHttpError(422, 'STK_PRODUCT_INACTIVE', `Dòng ${index + 1}: sản phẩm đã ngừng kinh doanh`)
    }
    const key = `${line.productId}|${line.lotCode.toLowerCase()}`
    if (seen.has(key)) {
      throw new MockHttpError(422, 'STK_DUPLICATE_LOT', `Dòng ${index + 1}: mã lô ${line.lotCode} bị trùng trong phiếu`)
    }
    seen.add(key)
    if (line.expDate <= today) {
      throw new MockHttpError(422, 'STK_EXP_DATE_INVALID', `Dòng ${index + 1}: hạn dùng phải sau ngày nhập`)
    }
    if (line.mfgDate && line.mfgDate > line.expDate) {
      throw new MockHttpError(422, 'STK_MFG_DATE_INVALID', `Dòng ${index + 1}: ngày sản xuất phải trước hạn dùng`)
    }
    return {
      id: 0,
      productId: product.id as number,
      sku: product.sku,
      productName: product.productName,
      lotCode: line.lotCode,
      mfgDate: line.mfgDate || null,
      expDate: line.expDate,
      quantity: line.quantity,
      unitCost: line.unitCost,
      lineTotal: line.quantity * line.unitCost,
      batchId: null,
    }
  })
}

function warningsFor(db: MockTransaction, lines: PurchaseOrderLine[], now: Date): PurchaseWarning[] {
  return collectPurchaseWarnings(lines, db.read('batches'), todayOf(now), expiryWarningDays(db))
}

function applyOrderFields(
  db: MockTransaction,
  order: PurchaseOrderDetail,
  input: OrderInput,
  lines: PurchaseOrderLine[]
): void {
  const supplier = db.read('suppliers').find((s) => s.id === input.supplierId)
  let lineId = db.read('purchaseOrders').reduce((m, o) => Math.max(m, ...o.lines.map((l) => l.id), 0), 0)
  order.supplierId = input.supplierId
  order.supplierCode = supplier?.supplierCode ?? ''
  order.supplierName = supplier?.supplierName ?? ''
  order.supplierInvoiceNo = input.supplierInvoiceNo || null
  order.note = input.note || null
  order.lines = lines.map((l) => ({ ...l, id: ++lineId }))
  order.lineCount = order.lines.length
  order.totalQuantity = order.lines.reduce((n, l) => n + l.quantity, 0)
  order.totalAmount = order.lines.reduce((n, l) => n + l.lineTotal, 0)
}

export const purchaseOrderRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/purchase-orders',
    permission: 'STOCK_IMPORT_VIEW',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const status = query.get('status')
      const supplierId = Number(query.get('supplierId')) || null
      const items = db
        .read('purchaseOrders')
        .filter(
          (o) =>
            (!kw ||
              o.poCode.toLowerCase().includes(kw) ||
              o.supplierName.toLowerCase().includes(kw) ||
              (o.supplierInvoiceNo ?? '').toLowerCase().includes(kw)) &&
            (!status || o.status === status) &&
            (!supplierId || o.supplierId === supplierId)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
        .map(toHeader)
      return ok(paginate(items, query), 'Lấy danh sách phiếu nhập kho thành công')
    },
  },
  {
    method: 'POST',
    path: '/purchase-orders/preview-warnings',
    permission: 'STOCK_IMPORT_VIEW',
    handler: ({ db, body, now }) => {
      const input = parseBody(previewSchema, body)
      const products = db.read('products')
      const lines = input.lines.map((l) => {
        const product = products.find((p) => p.id === l.productId)
        return { ...l, sku: product?.sku ?? '', productName: product?.productName ?? '' }
      })
      const warnings = collectPurchaseWarnings(lines, db.read('batches'), todayOf(now), expiryWarningDays(db))
      return ok(warnings, 'Kiểm tra cảnh báo thành công')
    },
  },
  {
    method: 'GET',
    path: '/purchase-orders/:id',
    permission: 'STOCK_IMPORT_VIEW',
    handler: ({ db, params }) => ok(withExistingFlags(db, findOrder(db, params.id)), 'Lấy chi tiết phiếu nhập thành công'),
  },
  {
    method: 'POST',
    path: '/purchase-orders',
    permission: 'STOCK_IMPORT_CREATE',
    handler: ({ db, body, now, user }) => {
      const input = parseBody(orderSchema, body)
      const lines = buildLines(db, input, todayOf(now))
      const orders = db.read('purchaseOrders')
      const order: PurchaseOrderDetail = {
        id: nextTableId(db, 'purchaseOrder', orders.reduce((m, o) => Math.max(m, o.id), 0)),
        poCode: nextPoCode(db, now),
        supplierId: 0,
        supplierCode: '',
        supplierName: '',
        totalAmount: 0,
        status: 'DRAFT',
        createdBy: user?.id ?? 0,
        createdByName: user?.fullName ?? '',
        createdAt: toIsoLocal(now),
        confirmedAt: null,
        lineCount: 0,
        totalQuantity: 0,
        lines: [],
      }
      applyOrderFields(db, order, input, lines)
      db.write('purchaseOrders', [...orders, order])
      return ok(withExistingFlags(db, order), 'Đã lưu phiếu nhập nháp', 201)
    },
  },
  {
    method: 'PUT',
    path: '/purchase-orders/:id',
    permission: 'STOCK_IMPORT_CREATE',
    handler: ({ db, params, body, now }) => {
      const input = parseBody(orderSchema, body)
      const order = findOrder(db, params.id)
      assertEditable(order)
      applyOrderFields(db, order, input, buildLines(db, input, todayOf(now)))
      db.touch('purchaseOrders')
      return ok(withExistingFlags(db, order), 'Đã cập nhật phiếu nhập nháp')
    },
  },
  {
    method: 'POST',
    path: '/purchase-orders/:id/cancel',
    permission: 'STOCK_IMPORT_CREATE',
    handler: ({ db, params }) => {
      const order = findOrder(db, params.id)
      assertEditable(order)
      order.status = 'CANCELLED'
      db.touch('purchaseOrders')
      return ok(order, 'Đã hủy phiếu nhập nháp')
    },
  },
  {
    method: 'POST',
    path: '/purchase-orders/:id/confirm',
    permission: 'STOCK_IMPORT_CREATE',
    handler: ({ db, params, headers, now, user }) => {
      const key = headers.get('Idempotency-Key')?.trim()
      if (!key) {
        throw new MockHttpError(400, 'COMMON_IDEMPOTENCY_KEY_REQUIRED', 'Thiếu header Idempotency-Key')
      }
      const order = findOrder(db, params.id)
      const keys = db.read('idempotencyKeys')
      const scoped = `po-confirm:${key}`
      if (scoped in keys) {
        if (keys[scoped] !== order.id) {
          throw new MockHttpError(409, 'COMMON_IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key đã dùng cho chứng từ khác')
        }
        // Gửi lại cùng khóa: trả kết quả cũ, không cộng tồn lần nữa (luật 30).
        return ok({ order: withExistingFlags(db, order), warnings: [] }, 'Phiếu đã được xác nhận trước đó')
      }
      if (order.status === 'COMPLETED') {
        throw new MockHttpError(409, 'STK_PO_ALREADY_CONFIRMED', 'Phiếu đã xác nhận nhập kho, không cộng tồn lần hai')
      }
      assertEditable(order)

      const today = todayOf(now)
      const input: OrderInput = {
        supplierId: order.supplierId,
        lines: order.lines.map((l) => ({
          productId: l.productId,
          lotCode: l.lotCode,
          mfgDate: l.mfgDate ?? undefined,
          expDate: l.expDate,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      }
      buildLines(db, input, today)
      const warnings = warningsFor(db, order.lines, now)

      const batches = db.read('batches')
      for (const line of order.lines) {
        let batch = findBatchByLot(db, line.productId, line.lotCode)
        if (batch) {
          assertBatchNotLocked(batch)
          if (batch.expDate !== line.expDate) {
            throw new MockHttpError(
              422,
              'STK_LOT_EXP_MISMATCH',
              `Lô ${line.lotCode} đã có trong kho với hạn dùng khác (${batch.expDate}); cùng một lô phải cùng hạn dùng`
            )
          }
          batch.costPrice = weightedAverageCost(batch.onHandQty, batch.costPrice, line.quantity, line.unitCost)
        } else {
          batch = {
            id: nextTableId(db, 'batch', batches.reduce((m, b) => Math.max(m, b.id), 0)),
            productId: line.productId,
            lotCode: line.lotCode,
            mfgDate: line.mfgDate ?? null,
            expDate: line.expDate,
            costPrice: line.unitCost,
            onHandQty: 0,
            blockedQty: 0,
            lockedByCheckId: null,
            createdAt: toIsoLocal(now),
          }
          batches.push(batch)
        }
        applyStockChange(db, {
          batch,
          change: line.quantity,
          referenceType: 'PURCHASE',
          referenceId: order.id,
          reason: `Nhập kho theo phiếu ${order.poCode}`,
          userId: user?.id,
          now,
        })
        line.batchId = batch.id
      }
      db.touch('batches')

      order.status = 'COMPLETED'
      order.confirmedAt = toIsoLocal(now)
      db.touch('purchaseOrders')
      keys[scoped] = order.id
      db.touch('idempotencyKeys')
      return ok({ order, warnings }, 'Xác nhận nhập kho thành công')
    },
  },
]
