import { z } from 'zod'
import type { DestroyReasonCode, ProductItem } from '../../types/api'
import type { Disposal, DisposalDetail, DisposalIssueType, DisposalLine } from '../../types/inventory'
import type { StockReferenceType } from '../../types/stock'
import { writeAudit } from '../audit'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
import type { MockUser } from '../seed/users'
import { toDateOnly, toIsoLocal } from '../time'
import {
  adjustBlockedQty,
  applyStockChange,
  assertBatchNotLocked,
  findBatchById,
  nextTableId,
} from '../stock-ledger'

const ISSUE_TYPES = ['DESTROY', 'TESTER', 'RETURN_TO_SUPPLIER'] as const
const REASON_CODES = ['EXPIRED', 'NEAR_EXPIRY', 'DAMAGED', 'RECALL', 'RETURN_DEFECT', 'TESTER_USE'] as const

const createSchema = z.object({
  issueType: z.enum(ISSUE_TYPES, { error: 'Loại phiếu chỉ gồm xuất hủy, xuất tester hoặc trả nhà cung cấp' }),
  reasonCode: z.enum(REASON_CODES, { error: 'Vui lòng chọn mã lý do' }),
  reason: z.string().trim().min(1, 'Vui lòng nhập diễn giải lý do'),
  lines: z
    .array(
      z.object({
        batchId: z.number().int().positive(),
        quantity: z.number({ error: 'Số lượng phải là số' }).int('Số lượng phải là số nguyên').min(1, 'Số lượng phải lớn hơn 0'),
        itemReason: z.string().trim().max(255).optional(),
      })
    )
    .min(1, 'Chọn ít nhất một lô'),
})

const rejectSchema = z.object({ reason: z.string().trim().min(1, 'Vui lòng nhập lý do từ chối') })

/** Loại phiếu → `reference_type` của thẻ kho (DATABASE.md mục 13). */
const MOVEMENT_TYPE: Record<DisposalIssueType, StockReferenceType> = {
  DESTROY: 'DISPOSAL',
  TESTER: 'TESTER',
  RETURN_TO_SUPPLIER: 'SUPPLIER_RETURN',
}

function findDisposal(db: MockTransaction, id: string): DisposalDetail {
  const found = db.read('disposals').find((d) => String(d.id) === id || d.disposalCode === id)
  if (!found) throw notFound('STK_DISPOSAL_NOT_FOUND', 'Không tìm thấy phiếu xuất kho')
  return found
}

function toHeader(d: DisposalDetail): Disposal {
  const { lines: _lines, ...header } = d
  void _lines
  return header
}

function nextDisposalCode(db: MockTransaction, now: Date): string {
  const prefix = `DISP${toDateOnly(now).replaceAll('-', '')}-`
  const used = db.read('disposals').filter((d) => d.disposalCode.startsWith(prefix)).length
  return `${prefix}${String(used + 1).padStart(2, '0')}`
}

function assertWaiting(d: DisposalDetail): void {
  if (d.status !== 'WAITING_APPROVAL') {
    throw new MockHttpError(409, 'STK_DISPOSAL_NOT_WAITING', 'Phiếu không ở trạng thái chờ duyệt')
  }
}

/** Duyệt phiếu xuất kho trong giao dịch hiện tại và tự động ngừng kinh doanh các sản phẩm đính kèm nếu đã hết tồn. */
export function approveDisposalInTx(
  db: MockTransaction,
  disposal: DisposalDetail,
  user: MockUser | null,
  now: Date
): DisposalDetail {
  assertWaiting(disposal)
  for (const line of disposal.lines) {
    const batch = findBatchById(db, line.batchId)
    assertBatchNotLocked(batch)
    line.unitCost = batch.costPrice
    adjustBlockedQty(db, batch, -line.quantity)
    applyStockChange(db, {
      batch,
      change: -line.quantity,
      referenceType: MOVEMENT_TYPE[disposal.issueType],
      referenceId: disposal.id,
      reason: `${disposal.disposalCode}: ${disposal.reason}`,
      userId: user?.id,
      now,
    })
  }
  disposal.status = 'APPROVED'
  disposal.approvedBy = user?.id ?? null
  disposal.approvedByName = user?.fullName ?? null
  disposal.approvedAt = toIsoLocal(now)
  disposal.totalCost = disposal.lines.reduce((n, l) => n + l.quantity * (l.unitCost ?? 0), 0)
  db.touch('disposals')

  if (disposal.discontinueProductIds && disposal.discontinueProductIds.length > 0) {
    const products = db.read('products')
    const allDisposals = db.read('disposals')
    for (const pid of disposal.discontinueProductIds) {
      const stillWaiting = allDisposals.some(
        (d) => d.status === 'WAITING_APPROVAL' && d.lines.some((l) => l.productId === pid)
      )
      const target = products.find((p) => p.id === pid)
      if (target && !stillWaiting && (target.currentStock ?? 0) === 0) {
        target.status = 'DISCONTINUED'
        db.touch('products')
      }
    }
  }
  return disposal
}

/**
 * Lập (và tự động duyệt nếu user có quyền `STOCK_DISPOSAL_APPROVE`) phiếu xuất hủy toàn bộ
 * tồn kho còn lại của sản phẩm để phục vụ nghiệp vụ ngừng kinh doanh.
 */
export function disposeProductStockForDeactivate(
  db: MockTransaction,
  input: {
    product: ProductItem
    reasonCode: DestroyReasonCode
    reason: string
    canApprove: boolean
    user: MockUser | null
    now: Date
  }
): { disposalId: number; disposalCode: string; disposalStatus: 'WAITING_APPROVAL' | 'APPROVED' } {
  const { product, reasonCode, reason, canApprove, user, now } = input
  const productId = product.id
  if (!productId) {
    throw new MockHttpError(422, 'PROD_INVALID_ID', 'Sản phẩm không hợp lệ')
  }

  const activeBatches = db.read('batches').filter((b) => b.productId === productId && b.onHandQty > 0)
  for (const batch of activeBatches) {
    assertBatchNotLocked(batch)
  }

  const pendingForProduct = db
    .read('disposals')
    .filter((d) => d.status === 'WAITING_APPROVAL' && d.lines.some((l) => l.productId === productId))

  if (pendingForProduct.some((d) => d.lines.some((l) => l.productId !== productId))) {
    throw new MockHttpError(
      409,
      'STK_BATCH_PENDING_DISPOSAL',
      'Sản phẩm có lô đang nằm trong phiếu xuất chờ duyệt chung với sản phẩm khác. Vui lòng xử lý phiếu xuất đó trước.'
    )
  }

  if (canApprove) {
    let lastApproved: DisposalDetail | null = null
    for (const pending of pendingForProduct) {
      lastApproved = approveDisposalInTx(db, pending, user, now)
    }

    const remainingBatches = db.read('batches').filter((b) => b.productId === productId && b.onHandQty > 0)
    if (remainingBatches.length > 0) {
      const disposals = db.read('disposals')
      const id = nextTableId(db, 'disposal', disposals.reduce((m, d) => Math.max(m, d.id), 0))
      let lineId = disposals.reduce((m, d) => Math.max(m, ...d.lines.map((l) => l.id), 0), 0)
      const disposalCode = nextDisposalCode(db, now)
      const lines: DisposalLine[] = remainingBatches.map((batch) => {
        const qty = batch.onHandQty
        const blockedAddedQty = Math.max(0, qty - batch.blockedQty)
        const unitCost = batch.costPrice
        if (batch.blockedQty > 0) {
          adjustBlockedQty(db, batch, -batch.blockedQty)
        }
        applyStockChange(db, {
          batch,
          change: -qty,
          referenceType: 'DISPOSAL',
          referenceId: id,
          reason: `${disposalCode}: ${reason}`,
          userId: user?.id,
          now,
        })
        lineId += 1
        return {
          id: lineId,
          batchId: batch.id,
          productId,
          sku: product.sku,
          productName: product.productName,
          lotCode: batch.lotCode,
          expDate: batch.expDate,
          quantity: qty,
          blockedAddedQty,
          unitCost,
          itemReason: 'Xuất hủy toàn bộ tồn để ngừng kinh doanh',
        }
      })

      const created: DisposalDetail = {
        id,
        disposalCode,
        issueType: 'DESTROY',
        reasonCode,
        status: 'APPROVED',
        reason,
        requestedBy: user?.id ?? 0,
        requestedByName: user?.fullName ?? '',
        createdAt: toIsoLocal(now),
        approvedBy: user?.id ?? null,
        approvedByName: user?.fullName ?? null,
        approvedAt: toIsoLocal(now),
        rejectReason: null,
        lineCount: lines.length,
        totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
        totalCost: lines.reduce((n, l) => n + l.quantity * (l.unitCost ?? 0), 0),
        discontinueProductIds: [productId],
        lines,
      }
      db.write('disposals', [...disposals, created])
      lastApproved = created
    }

    product.status = 'DISCONTINUED'
    db.touch('products')

    if (!lastApproved) {
      throw new MockHttpError(422, 'STK_INSUFFICIENT_STOCK', 'Không tìm thấy lô tồn kho cần xuất hủy')
    }
    writeAudit(db, user, now, {
      action: 'APPROVE_DISPOSAL',
      module: 'STOCK',
      entityType: 'DISPOSAL',
      entityId: lastApproved.id,
      details: { after: { disposalCode: lastApproved.disposalCode, sku: product.sku, reasonCode } },
    })
    return {
      disposalId: lastApproved.id,
      disposalCode: lastApproved.disposalCode,
      disposalStatus: 'APPROVED',
    }
  }

  // User chỉ có quyền lập phiếu (INVENTORY_STAFF): cách ly hàng chờ Quản lý duyệt
  for (const pending of pendingForProduct) {
    const ids = new Set(pending.discontinueProductIds ?? [])
    ids.add(productId)
    pending.discontinueProductIds = [...ids]
  }
  if (pendingForProduct.length > 0) db.touch('disposals')

  const disposals = db.read('disposals')
  let lineId = disposals.reduce((m, d) => Math.max(m, ...d.lines.map((l) => l.id), 0), 0)
  const lines: DisposalLine[] = []
  for (const batch of activeBatches) {
    const pendingQty = pendingForProduct
      .flatMap((d) => d.lines)
      .filter((l) => l.batchId === batch.id)
      .reduce((n, l) => n + l.quantity, 0)
    const qty = batch.onHandQty - pendingQty
    if (qty <= 0) continue
    const freeBlocked = batch.blockedQty - pendingQty
    const added = Math.max(0, qty - freeBlocked)
    if (added > 0) adjustBlockedQty(db, batch, added)
    lineId += 1
    lines.push({
      id: lineId,
      batchId: batch.id,
      productId,
      sku: product.sku,
      productName: product.productName,
      lotCode: batch.lotCode,
      expDate: batch.expDate,
      quantity: qty,
      blockedAddedQty: added,
      unitCost: null,
      itemReason: 'Cách ly chờ xuất hủy để ngừng kinh doanh',
    })
  }

  if (lines.length > 0) {
    const id = nextTableId(db, 'disposal', disposals.reduce((m, d) => Math.max(m, d.id), 0))
    const created: DisposalDetail = {
      id,
      disposalCode: nextDisposalCode(db, now),
      issueType: 'DESTROY',
      reasonCode,
      status: 'WAITING_APPROVAL',
      reason,
      requestedBy: user?.id ?? 0,
      requestedByName: user?.fullName ?? '',
      createdAt: toIsoLocal(now),
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      rejectReason: null,
      lineCount: lines.length,
      totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
      totalCost: null,
      discontinueProductIds: [productId],
      lines,
    }
    db.write('disposals', [...disposals, created])
    writeAudit(db, user, now, {
      action: 'CREATE_DISPOSAL',
      module: 'STOCK',
      entityType: 'DISPOSAL',
      entityId: created.id,
      details: { after: { disposalCode: created.disposalCode, sku: product.sku, reasonCode } },
    })
    return {
      disposalId: created.id,
      disposalCode: created.disposalCode,
      disposalStatus: 'WAITING_APPROVAL',
    }
  }

  const targetPending = pendingForProduct[pendingForProduct.length - 1]
  if (!targetPending) {
    throw new MockHttpError(422, 'STK_INSUFFICIENT_STOCK', 'Không tìm thấy lô tồn kho cần xuất hủy')
  }
  return {
    disposalId: targetPending.id,
    disposalCode: targetPending.disposalCode,
    disposalStatus: 'WAITING_APPROVAL',
  }
}

export const disposalRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/disposals',
    permission: 'STOCK_DISPOSAL_VIEW',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const status = query.get('status')
      const issueType = query.get('issueType')
      const items = db
        .read('disposals')
        .filter(
          (d) =>
            (!kw || d.disposalCode.toLowerCase().includes(kw) || d.reason.toLowerCase().includes(kw)) &&
            (!status || d.status === status) &&
            (!issueType || d.issueType === issueType)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
        .map(toHeader)
      return ok(paginate(items, query), 'Lấy danh sách phiếu xuất kho thành công')
    },
  },
  {
    method: 'GET',
    path: '/disposals/:id',
    permission: 'STOCK_DISPOSAL_VIEW',
    handler: ({ db, params }) => ok(findDisposal(db, params.id), 'Lấy chi tiết phiếu xuất kho thành công'),
  },
  {
    // Lập phiếu: cách ly hàng ngay (luật 33), tồn thực tế chưa đổi.
    method: 'POST',
    path: '/disposals',
    permission: 'STOCK_DISPOSAL_CREATE',
    handler: ({ db, body, now, user }) => {
      const input = parseBody(createSchema, body)
      const disposals = db.read('disposals')
      const products = db.read('products')
      const id = nextTableId(db, 'disposal', disposals.reduce((m, d) => Math.max(m, d.id), 0))
      let lineId = disposals.reduce((m, d) => Math.max(m, ...d.lines.map((l) => l.id), 0), 0)
      const seen = new Set<number>()
      const lines: DisposalLine[] = input.lines.map((entry, index) => {
        if (seen.has(entry.batchId)) {
          throw new MockHttpError(422, 'STK_DUPLICATE_LOT', `Dòng ${index + 1}: lô bị chọn trùng trong phiếu`)
        }
        seen.add(entry.batchId)
        const batch = findBatchById(db, entry.batchId)
        assertBatchNotLocked(batch)
        const product = products.find((p) => p.id === batch.productId)
        if (product?.isSellable === false && input.issueType === 'RETURN_TO_SUPPLIER') {
          throw new MockHttpError(
            422,
            'STK_ISSUE_TYPE_NOT_ALLOWED',
            `SKU ${product.sku} là hàng tester của hãng, chỉ xuất được bằng phiếu tester hoặc xuất hủy`
          )
        }
        // Lượng của các phiếu khác đang chờ duyệt trên cùng lô.
        const pending = disposals
          .filter((d) => d.status === 'WAITING_APPROVAL')
          .flatMap((d) => d.lines)
          .filter((l) => l.batchId === batch.id)
          .reduce((n, l) => n + l.quantity, 0)
        if (entry.quantity > batch.onHandQty - pending) {
          throw new MockHttpError(
            422,
            'STK_INSUFFICIENT_STOCK',
            `Lô ${batch.lotCode}: chỉ còn ${Math.max(0, batch.onHandQty - pending)} có thể xuất (tồn ${batch.onHandQty}, đang chờ duyệt ${pending})`
          )
        }
        const freeBlocked = batch.blockedQty - pending
        const added = Math.max(0, entry.quantity - freeBlocked)
        if (added > 0) adjustBlockedQty(db, batch, added)
        lineId += 1
        return {
          id: lineId,
          batchId: batch.id,
          productId: batch.productId,
          sku: product?.sku ?? '',
          productName: product?.productName ?? '',
          lotCode: batch.lotCode,
          expDate: batch.expDate,
          quantity: entry.quantity,
          blockedAddedQty: added,
          unitCost: null,
          itemReason: entry.itemReason || null,
        }
      })
      const disposal: DisposalDetail = {
        id,
        disposalCode: nextDisposalCode(db, now),
        issueType: input.issueType,
        reasonCode: input.reasonCode,
        status: 'WAITING_APPROVAL',
        reason: input.reason,
        requestedBy: user?.id ?? 0,
        requestedByName: user?.fullName ?? '',
        createdAt: toIsoLocal(now),
        approvedBy: null,
        approvedByName: null,
        approvedAt: null,
        rejectReason: null,
        lineCount: lines.length,
        totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
        totalCost: null,
        lines,
      }
      db.write('disposals', [...disposals, disposal])
      return ok(disposal, 'Đã lập phiếu, hàng được cách ly chờ quản lý duyệt', 201)
    },
  },
  {
    // Duyệt: trừ tồn và cách ly, ghi thẻ kho theo loại phiếu, chụp giá vốn (luật 33).
    method: 'POST',
    path: '/disposals/:id/approve',
    permission: 'STOCK_DISPOSAL_APPROVE',
    handler: ({ db, params, now, user }) => {
      const disposal = approveDisposalInTx(db, findDisposal(db, params.id), user, now)
      return ok(disposal, 'Đã duyệt, tồn kho được trừ')
    },
  },
  {
    // Từ chối: trả lại phần đã cách ly thêm khi lập phiếu (luật 33).
    method: 'POST',
    path: '/disposals/:id/reject',
    permission: 'STOCK_DISPOSAL_APPROVE',
    handler: ({ db, params, body, now, user }) => {
      const input = parseBody(rejectSchema, body)
      const disposal = findDisposal(db, params.id)
      assertWaiting(disposal)
      for (const line of disposal.lines) {
        if (line.blockedAddedQty > 0) adjustBlockedQty(db, findBatchById(db, line.batchId), -line.blockedAddedQty)
      }
      disposal.status = 'REJECTED'
      disposal.rejectReason = input.reason
      disposal.approvedBy = user?.id ?? null
      disposal.approvedByName = user?.fullName ?? null
      disposal.approvedAt = toIsoLocal(now)
      db.touch('disposals')
      return ok(disposal, 'Đã từ chối phiếu, phần cách ly được trả lại')
    },
  },
]
