import { z } from 'zod'
import type { CurrentShiftResponseData } from '../../types/api'
import type { CashierShift, ShiftDetail } from '../../types/pos'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody } from '../http'
import type { MockRoute } from '../router'
import { summarizeShift, toOrderListItem, toReturnListItem } from '../sales-views'
import { toDateOnly, toIsoLocal } from '../time'
import { writeAudit } from '../audit'

const openShiftSchema = z.object({
  openingCash: z
    .number({ error: 'Số tiền đầu ca phải là số' })
    .int('Số tiền đầu ca phải là số nguyên')
    .min(0, 'Số tiền đầu ca không được âm'),
})

const closeShiftSchema = z.object({
  actualCash: z
    .number({ error: 'Số tiền thực đếm phải là số' })
    .int('Số tiền thực đếm phải là số nguyên')
    .min(0, 'Số tiền thực đếm không được âm'),
  note: z.string().trim().optional(),
})

/** Thu ngân chỉ thấy ca của mình; quản lý (có quyền xác nhận bàn giao) thấy mọi ca. */
const canSeeAll = (permissions: string[]) => permissions.includes('POS_SHIFT_HANDOVER_CONFIRM')

function findShift(db: MockTransaction, id: string): CashierShift {
  const shift = db.read('shifts').find((s) => String(s.shiftId) === id)
  if (!shift) throw notFound('POS_SHIFT_NOT_FOUND', 'Không tìm thấy ca làm việc')
  return shift
}

function assertVisible(shift: CashierShift, userId: number | undefined, permissions: string[]) {
  if (!canSeeAll(permissions) && shift.cashierId !== userId) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Bạn chỉ được xem ca của chính mình')
  }
}

export const shiftRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/shifts/current',
    permission: 'POS_VIEW',
    handler: ({ db, user }) => {
      const shift = db.read('shifts').find((s) => s.cashierId === user?.id && s.status === 'OPEN') ?? null
      const data: CurrentShiftResponseData = { hasOpenShift: Boolean(shift), shift }
      return ok(data, 'Lấy thông tin ca làm việc hiện tại thành công')
    },
  },
  {
    method: 'GET',
    path: '/shifts',
    permission: 'POS_VIEW',
    handler: ({ db, query, user, permissions }) => {
      const kw = keywordOf(query)
      const status = query.get('status')
      const items = db
        .read('shifts')
        .filter(
          (s) =>
            (canSeeAll(permissions) || s.cashierId === user?.id) &&
            (!status || status === 'ALL' || s.status === status) &&
            (!kw || s.shiftCode.toLowerCase().includes(kw) || s.cashierName.toLowerCase().includes(kw))
        )
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
        .map((s) => ({ ...s, summary: summarizeShift(db, s) }))
      return ok(paginate(items, query, 10), 'Lấy lịch sử ca thành công')
    },
  },
  {
    method: 'GET',
    path: '/shifts/:id',
    permission: 'POS_VIEW',
    handler: ({ db, params, user, permissions }) => {
      const shift = findShift(db, params.id)
      assertVisible(shift, user?.id, permissions)
      const data: ShiftDetail = {
        shift,
        summary: summarizeShift(db, shift),
        orders: db
          .read('orders')
          .filter((o) => o.shiftId === shift.shiftId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(toOrderListItem),
        returns: db
          .read('returns')
          .filter((r) => r.shiftId === shift.shiftId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(toReturnListItem),
      }
      return ok(data, 'Lấy chi tiết ca thành công')
    },
  },
  {
    method: 'POST',
    path: '/shifts/open',
    permission: 'POS_SHIFT_OPEN',
    handler: ({ db, body, user, now }) => {
      const input = parseBody(openShiftSchema, body)
      const shifts = db.read('shifts')
      if (shifts.some((s) => s.cashierId === user?.id && s.status === 'OPEN')) {
        throw new MockHttpError(409, 'POS_SHIFT_ALREADY_OPEN', 'Bạn đang có một ca làm việc chưa chốt')
      }
      const day = toDateOnly(now).replaceAll('-', '')
      const sameDay = shifts.filter((s) => s.shiftCode.startsWith(`CA${day}`)).length
      const shift: CashierShift = {
        shiftId: db.nextSeq('shift', shifts.reduce((m, s) => Math.max(m, s.shiftId), 0) + 1),
        shiftCode: `CA${day}-${String(sameDay + 1).padStart(2, '0')}`,
        cashierId: user?.id ?? 0,
        cashierName: user?.fullName ?? '',
        openedAt: toIsoLocal(now),
        openingCash: input.openingCash,
        status: 'OPEN',
        closedAt: null,
        expectedCash: null,
        actualCash: null,
        differenceAmount: null,
        note: null,
        handoverConfirmedBy: null,
        handoverConfirmedByName: null,
      }
      db.write('shifts', [...shifts, shift])
      return ok(shift, 'Mở ca làm việc thành công', 201)
    },
  },
  {
    method: 'POST',
    path: '/shifts/:id/close',
    permission: 'POS_SHIFT_CLOSE',
    handler: ({ db, params, body, user, now }) => {
      const input = parseBody(closeShiftSchema, body)
      const shift = findShift(db, params.id)
      if (shift.cashierId !== user?.id) {
        throw new MockHttpError(403, 'POS_SHIFT_NOT_OWNER', 'Chỉ thu ngân mở ca mới được chốt ca')
      }
      if (shift.status !== 'OPEN') {
        throw new MockHttpError(409, 'POS_SHIFT_NOT_OPEN', 'Ca làm việc đã được chốt')
      }
      const summary = summarizeShift(db, shift)
      if (summary.draftCount > 0) {
        throw new MockHttpError(
          422,
          'POS_SHIFT_HAS_DRAFT',
          `Ca còn ${summary.draftCount} đơn nháp, hãy hoàn tất hoặc hủy trước khi chốt ca`
        )
      }
      const difference = input.actualCash - summary.expectedCash
      if (difference !== 0 && !input.note) {
        throw new MockHttpError(422, 'POS_SHIFT_NOTE_REQUIRED', 'Tiền lệch so với kỳ vọng, vui lòng nhập giải trình')
      }
      shift.status = 'CLOSED'
      shift.closedAt = toIsoLocal(now)
      shift.expectedCash = summary.expectedCash
      shift.actualCash = input.actualCash
      shift.differenceAmount = difference
      shift.note = input.note || null
      db.touch('shifts')
      writeAudit(db, user, now, {
        action: 'CLOSE_SHIFT',
        module: 'POS',
        entityType: 'SHIFT',
        entityId: shift.shiftId,
        details: {
          note: shift.note ?? undefined,
          after: { shiftCode: shift.shiftCode, expectedCash: summary.expectedCash, actualCash: input.actualCash, differenceAmount: difference },
        },
      })
      return ok({ shift, summary }, 'Chốt ca thành công')
    },
  },
  {
    method: 'POST',
    path: '/shifts/:id/confirm-handover',
    permission: 'POS_SHIFT_HANDOVER_CONFIRM',
    handler: ({ db, params, user, now }) => {
      const shift = findShift(db, params.id)
      if (shift.status !== 'CLOSED') {
        throw new MockHttpError(409, 'POS_SHIFT_NOT_CLOSED', 'Chỉ xác nhận bàn giao cho ca đã chốt')
      }
      if (shift.handoverConfirmedBy !== null) {
        throw new MockHttpError(409, 'POS_HANDOVER_ALREADY_CONFIRMED', 'Ca này đã được xác nhận bàn giao')
      }
      shift.handoverConfirmedBy = user?.id ?? null
      shift.handoverConfirmedByName = user?.fullName ?? null
      db.touch('shifts')
      writeAudit(db, user, now, {
        action: 'CONFIRM_HANDOVER',
        module: 'POS',
        entityType: 'SHIFT',
        entityId: shift.shiftId,
        details: { note: `Ca ${shift.shiftCode}, thu ngân ${shift.cashierName}`, after: { differenceAmount: shift.differenceAmount ?? 0 } },
      })
      return ok(shift, 'Đã xác nhận bàn giao ca')
    },
  },
]
