import { z } from 'zod'
import type {
  InventoryCheck,
  InventoryCheckAssignee,
  InventoryCheckDetail,
  InventoryCheckLine,
} from '../../types/inventory'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
import { toDateOnly, toIsoLocal } from '../time'
import { applyStockChange, findBatchById, nextTableId } from '../stock-ledger'

const createSchema = z.object({
  checkType: z.enum(['WAREHOUSE', 'DISPLAY'], { error: 'Vui lòng chọn loại kiểm kê' }).default('WAREHOUSE'),
  scheduledAt: z.string().trim().min(1, 'Vui lòng chọn thời gian dự kiến kiểm kê'),
  assignedTo: z.number({ error: 'Vui lòng chọn nhân viên kiểm kê' }).int().positive('Vui lòng chọn nhân viên kiểm kê'),
  scopeNote: z.string().trim().max(255, 'Ghi chú phạm vi tối đa 255 ký tự').optional(),
  batchIds: z.array(z.number().int().positive()).min(1, 'Chọn ít nhất một lô để kiểm kê'),
})

const countsSchema = z.object({
  lines: z.array(
    z.object({
      lineId: z.number().int().positive(),
      countedQty: z
        .number({ error: 'Số đếm phải là số' })
        .int('Số đếm phải là số nguyên')
        .min(0, 'Số đếm không được âm')
        .nullable(),
      note: z.string().trim().max(255).optional(),
    })
  ),
})

const rejectSchema = z.object({ reason: z.string().trim().min(1, 'Vui lòng nhập lý do từ chối') })

function findCheck(db: MockTransaction, id: string): InventoryCheckDetail {
  const found = db.read('inventoryChecks').find((c) => String(c.id) === id || c.checkCode === id)
  if (!found) throw notFound('STK_CHECK_NOT_FOUND', 'Không tìm thấy phiếu kiểm kho')
  return found
}

function assertStatus(check: InventoryCheckDetail, allowed: InventoryCheckDetail['status'][], code: string, message: string) {
  if (!allowed.includes(check.status)) throw new MockHttpError(409, code, message)
}

function assertAssignedInventoryStaff(check: InventoryCheckDetail, userId: number | undefined): void {
  if (check.assignedTo && userId !== check.assignedTo) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Chỉ nhân viên kho được phân công mới có quyền thực hiện kiểm kê phiếu này')
  }
}

/** Cập nhật các số tổng hợp lưu trong header từ các dòng. */
function refreshTotals(check: InventoryCheckDetail): void {
  const counted = check.lines.filter((l) => l.differenceQty !== null)
  check.lineCount = check.lines.length
  check.differenceLineCount = counted.filter((l) => l.differenceQty !== 0).length
  check.totalDifference = counted.reduce((n, l) => n + (l.differenceQty ?? 0), 0)
}

/** Gỡ khóa mọi lô đang bị phiếu này khóa. */
function unlockBatches(db: MockTransaction, checkId: number): void {
  for (const batch of db.read('batches')) {
    if (batch.lockedByCheckId === checkId) batch.lockedByCheckId = null
  }
  db.touch('batches')
}

function toHeader(check: InventoryCheckDetail): InventoryCheck {
  const { lines: _lines, ...header } = check
  void _lines
  return header
}

function nextCheckCode(db: MockTransaction, now: Date): string {
  const prefix = `CHK${toDateOnly(now).replaceAll('-', '')}-`
  const used = db.read('inventoryChecks').filter((c) => c.checkCode.startsWith(prefix)).length
  return `${prefix}${String(used + 1).padStart(2, '0')}`
}

export const inventoryCheckRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/inventory-checks/assignees',
    permission: ['STOCK_ADJUST_APPROVE', 'STOCK_CHECK_VIEW'],
    handler: ({ db }) => {
      const assignees: InventoryCheckAssignee[] = db
        .read('users')
        .filter((u) => u.status === 'ACTIVE' && u.roles.includes('INVENTORY_STAFF'))
        .map((u) => ({
          id: u.id,
          employeeCode: u.employeeCode,
          fullName: u.fullName,
          username: u.username,
        }))
      return ok(assignees, 'Lấy danh sách nhân viên kho thành công')
    },
  },
  {
    method: 'GET',
    path: '/inventory-checks',
    permission: 'STOCK_CHECK_VIEW',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const status = query.get('status')
      const items = db
        .read('inventoryChecks')
        .filter(
          (c) =>
            (!kw ||
              c.checkCode.toLowerCase().includes(kw) ||
              (c.scopeNote ?? '').toLowerCase().includes(kw) ||
              (c.assignedToName ?? '').toLowerCase().includes(kw)) &&
            (!status || c.status === status)
        )
        .sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt) || b.id - a.id)
        .map(toHeader)
      return ok(paginate(items, query), 'Lấy danh sách phiếu kiểm kho thành công')
    },
  },
  {
    method: 'GET',
    path: '/inventory-checks/:id',
    permission: 'STOCK_CHECK_VIEW',
    handler: ({ db, params }) => ok(findCheck(db, params.id), 'Lấy chi tiết phiếu kiểm kho thành công'),
  },
  {
    // Manager lên lịch kiểm: chọn loại, thời gian, nhân viên kho và danh sách lô -> chụp tồn và khóa lô.
    method: 'POST',
    path: '/inventory-checks',
    permission: 'STOCK_ADJUST_APPROVE',
    handler: ({ db, body, now, user }) => {
      const input = parseBody(createSchema, body)
      const assignee = db.read('users').find((u) => u.id === input.assignedTo)
      if (!assignee || assignee.status !== 'ACTIVE' || !assignee.roles.includes('INVENTORY_STAFF')) {
        throw new MockHttpError(422, 'STK_CHECK_ASSIGNEE_INVALID', 'Nhân viên được phân công phải là nhân viên kho đang hoạt động')
      }

      const checks = db.read('inventoryChecks')
      const id = nextTableId(db, 'inventoryCheck', checks.reduce((m, c) => Math.max(m, c.id), 0))
      const products = db.read('products')
      const uniqueIds = [...new Set(input.batchIds)]
      let lineId = checks.reduce((m, c) => Math.max(m, ...c.lines.map((l) => l.id), 0), 0)
      const lines: InventoryCheckLine[] = uniqueIds.map((batchId) => {
        const batch = findBatchById(db, batchId)
        if (batch.lockedByCheckId) {
          throw new MockHttpError(409, 'STK_BATCH_LOCKED', `Lô ${batch.lotCode} đang bị khóa bởi một phiếu kiểm kho khác`)
        }
        const product = products.find((p) => p.id === batch.productId)
        batch.lockedByCheckId = id
        lineId += 1
        return {
          id: lineId,
          batchId: batch.id,
          productId: batch.productId,
          sku: product?.sku ?? '',
          productName: product?.productName ?? '',
          lotCode: batch.lotCode,
          expDate: batch.expDate,
          snapshotQty: batch.onHandQty,
          countedQty: null,
          differenceQty: null,
          note: null,
        }
      })
      db.touch('batches')
      const check: InventoryCheckDetail = {
        id,
        checkCode: nextCheckCode(db, now),
        checkType: input.checkType,
        scheduledAt: input.scheduledAt,
        assignedTo: assignee.id,
        assignedToName: assignee.fullName,
        scopeNote: input.scopeNote || null,
        status: 'IN_PROGRESS',
        snapshotAt: toIsoLocal(now),
        createdBy: user?.id ?? 0,
        createdByName: user?.fullName ?? '',
        submittedAt: null,
        approvedBy: null,
        approvedByName: null,
        approvedAt: null,
        rejectReason: null,
        lineCount: lines.length,
        differenceLineCount: 0,
        totalDifference: 0,
        lines,
      }
      db.write('inventoryChecks', [...checks, check])
      return ok(check, 'Đã lên lịch kiểm kê, chụp tồn và phân công nhân viên kho', 201)
    },
  },
  {
    // Nhân viên kho được phân công lưu nháp số đếm & ghi chú.
    method: 'PUT',
    path: '/inventory-checks/:id/counts',
    permission: 'STOCK_CHECK_CREATE',
    handler: ({ db, params, body, user }) => {
      const input = parseBody(countsSchema, body)
      const check = findCheck(db, params.id)
      assertStatus(check, ['IN_PROGRESS'], 'STK_CHECK_NOT_IN_PROGRESS', 'Phiếu không còn ở trạng thái đang kiểm')
      assertAssignedInventoryStaff(check, user?.id)
      for (const entry of input.lines) {
        const line = check.lines.find((l) => l.id === entry.lineId)
        if (!line) throw notFound('STK_CHECK_LINE_NOT_FOUND', `Không tìm thấy dòng kiểm kê ${entry.lineId}`)
        line.countedQty = entry.countedQty
        line.note = entry.note || null
      }
      db.touch('inventoryChecks')
      return ok(check, 'Đã lưu nháp kết quả kiểm đếm')
    },
  },
  {
    // Nhân viên kho hoàn tất kiểm kê: không cần bước duyệt, tự động điều chỉnh tồn kho nếu có chênh lệch.
    method: 'POST',
    path: '/inventory-checks/:id/submit',
    permission: 'STOCK_CHECK_CREATE',
    handler: ({ db, params, body, now, user }) => {
      const check = findCheck(db, params.id)
      assertStatus(check, ['IN_PROGRESS'], 'STK_CHECK_NOT_IN_PROGRESS', 'Phiếu không còn ở trạng thái đang kiểm')
      assertAssignedInventoryStaff(check, user?.id)
      if (body !== undefined && body !== null) {
        parseBody(countsSchema, body).lines.forEach((entry) => {
          const line = check.lines.find((l) => l.id === entry.lineId)
          if (line) {
            line.countedQty = entry.countedQty
            line.note = entry.note || null
          }
        })
      }
      const missing = check.lines.filter((l) => l.countedQty === null)
      if (missing.length > 0) {
        throw new MockHttpError(
          422,
          'STK_CHECK_INCOMPLETE',
          `Còn ${missing.length} lô chưa nhập số đếm (ô trống không được hiểu là 0)`
        )
      }
      for (const line of check.lines) line.differenceQty = (line.countedQty as number) - line.snapshotQty
      refreshTotals(check)
      check.submittedAt = toIsoLocal(now)
      unlockBatches(db, check.id)

      if (check.differenceLineCount === 0) {
        check.status = 'NO_DIFFERENCE'
        db.touch('inventoryChecks')
        return ok(check, 'Không có chênh lệch, phiếu kiểm kê đã hoàn tất')
      }

      for (const line of check.lines) {
        if (!line.differenceQty) continue
        applyStockChange(db, {
          batch: findBatchById(db, line.batchId),
          change: line.differenceQty,
          referenceType: 'CHECK_ADJUST',
          referenceId: check.id,
          reason: `Điều chỉnh theo phiếu kiểm kê ${check.checkCode}${line.note ? `: ${line.note}` : ''}`,
          userId: user?.id,
          now,
        })
      }
      check.status = 'COMPLETED'
      check.approvedBy = user?.id ?? null
      check.approvedByName = user?.fullName ?? null
      check.approvedAt = toIsoLocal(now)
      db.touch('inventoryChecks')
      return ok(check, 'Đã hoàn tất kiểm kê và tự động điều chỉnh tồn kho')
    },
  },
  {
    method: 'POST',
    path: '/inventory-checks/:id/cancel',
    permission: ['STOCK_ADJUST_APPROVE', 'STOCK_CHECK_CREATE'],
    handler: ({ db, params }) => {
      const check = findCheck(db, params.id)
      assertStatus(check, ['IN_PROGRESS'], 'STK_CHECK_NOT_IN_PROGRESS', 'Chỉ hủy được phiếu đang kiểm')
      unlockBatches(db, check.id)
      check.status = 'CANCELLED'
      db.touch('inventoryChecks')
      return ok(check, 'Đã hủy phiếu kiểm kê, các lô được mở khóa')
    },
  },
  {
    method: 'POST',
    path: '/inventory-checks/:id/approve',
    permission: 'STOCK_ADJUST_APPROVE',
    handler: ({ db, params, now, user }) => {
      const check = findCheck(db, params.id)
      assertStatus(check, ['WAITING_APPROVAL'], 'STK_CHECK_NOT_WAITING', 'Phiếu không ở trạng thái chờ duyệt')
      for (const line of check.lines) {
        if (!line.differenceQty) continue
        applyStockChange(db, {
          batch: findBatchById(db, line.batchId),
          change: line.differenceQty,
          referenceType: 'CHECK_ADJUST',
          referenceId: check.id,
          reason: `Điều chỉnh theo phiếu kiểm kho ${check.checkCode}${line.note ? `: ${line.note}` : ''}`,
          userId: user?.id,
          now,
        })
      }
      check.status = 'APPROVED'
      check.approvedBy = user?.id ?? null
      check.approvedByName = user?.fullName ?? null
      check.approvedAt = toIsoLocal(now)
      db.touch('inventoryChecks')
      return ok(check, 'Đã duyệt điều chỉnh tồn kho')
    },
  },
  {
    method: 'POST',
    path: '/inventory-checks/:id/reject',
    permission: 'STOCK_ADJUST_APPROVE',
    handler: ({ db, params, body, now, user }) => {
      const input = parseBody(rejectSchema, body)
      const check = findCheck(db, params.id)
      assertStatus(check, ['WAITING_APPROVAL'], 'STK_CHECK_NOT_WAITING', 'Phiếu không ở trạng thái chờ duyệt')
      check.status = 'REJECTED'
      check.rejectReason = input.reason
      check.approvedBy = user?.id ?? null
      check.approvedByName = user?.fullName ?? null
      check.approvedAt = toIsoLocal(now)
      db.touch('inventoryChecks')
      return ok(check, 'Đã từ chối phiếu kiểm kho')
    },
  },
]
