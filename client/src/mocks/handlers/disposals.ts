import { z } from 'zod'
import type { Disposal, DisposalDetail, DisposalIssueType, DisposalLine } from '../../types/inventory'
import type { StockReferenceType } from '../../types/stock'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
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
      const disposal = findDisposal(db, params.id)
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
