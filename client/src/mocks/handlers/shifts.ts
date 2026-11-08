import { z } from 'zod'
import type { CurrentShiftResponseData } from '../../types/api'
import { MockHttpError, notFound, ok, parseBody } from '../http'
import type { MockRoute } from '../router'
import { toIsoLocal } from '../time'

// GĐ0: chỉ chuyển phần mock cũ sang adapter. Luồng ca đầy đủ (POS-01, POS-05) làm ở GĐ4–5.

const openShiftSchema = z.object({
  openingCash: z
    .number({ error: 'Số tiền đầu ca phải là số' })
    .int('Số tiền đầu ca phải là số nguyên')
    .min(0, 'Số tiền đầu ca không được âm'),
})

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
    method: 'POST',
    path: '/shifts/open',
    permission: 'POS_SHIFT_OPEN',
    handler: ({ db, body, user, now }) => {
      const input = parseBody(openShiftSchema, body)
      const shifts = db.read('shifts')
      if (shifts.some((s) => s.cashierId === user?.id && s.status === 'OPEN')) {
        throw new MockHttpError(409, 'POS_SHIFT_ALREADY_OPEN', 'Bạn đang có một ca làm việc chưa chốt')
      }
      const shift = {
        shiftId: db.nextSeq('shift'),
        cashierId: user?.id ?? 0,
        openedAt: toIsoLocal(now),
        openingCash: input.openingCash,
        status: 'OPEN' as const,
        closedAt: null,
      }
      db.write('shifts', [...shifts, shift])
      return ok(shift, 'Mở ca làm việc thành công', 201)
    },
  },
  {
    method: 'POST',
    path: '/shifts/:shiftId/close',
    permission: 'POS_SHIFT_CLOSE',
    handler: ({ db, params, user, now }) => {
      const shift = db.read('shifts').find((s) => s.shiftId === Number(params.shiftId))
      if (!shift) throw notFound('POS_SHIFT_NOT_FOUND', 'Không tìm thấy ca làm việc')
      if (shift.cashierId !== user?.id) {
        throw new MockHttpError(403, 'POS_SHIFT_NOT_OWNER', 'Chỉ thu ngân mở ca mới được chốt ca')
      }
      if (shift.status !== 'OPEN') {
        throw new MockHttpError(409, 'POS_SHIFT_NOT_OPEN', 'Ca làm việc đã được chốt')
      }
      shift.status = 'CLOSED'
      shift.closedAt = toIsoLocal(now)
      db.touch('shifts')
      return ok(shift, 'Chốt ca thành công')
    },
  },
]
