import type { CartInput, CashierShift, CompleteOrderRequest, OrderRecord, ReturnOrderRecord } from '../../types/pos'
import type { MockTables, MockTransaction } from '../db'
import { createReturn } from '../handlers/returns'
import { saveDraft } from '../handlers/orders'
import { writeAudit } from '../audit'
import { completeSale, exchangeCreditOf } from '../sales-complete'
import { priceCart } from '../sales-engine'
import { summarizeShift } from '../sales-views'
import { addDays, addMinutes, toDateOnly, toIsoLocal } from '../time'
import type { MockUser } from './users'

/** Các bảng mà bán hàng, đổi trả, ca làm thay đổi (để hoàn nguyên khi một bước seed lỗi). */
const TOUCHED_TABLES = [
  'orders',
  'returns',
  'shifts',
  'customers',
  'batches',
  'stockMovements',
  'products',
  'counters',
  'auditLogs',
] as const satisfies readonly (keyof MockTables)[]

type CartItems = { productId: number; quantity: number }[]

interface SaleSpec {
  items: CartItems
  customerId?: number | null
  voucherCode?: string | null
  pointsRequested?: number
  exchangeReturnId?: number | null
  method: 'CASH' | 'BANK_TRANSFER' | 'CARD'
}

/**
 * Đơn mẫu dựng bằng chính các hàm "máy chủ" (completeSale, createReturn, saveDraft), nên tồn lô, thẻ kho,
 * chi tiêu và điểm khách khớp nhau như khi chạy thật. Ngày tính tương đối so với `today`.
 * Một bước lỗi thì bị hoàn nguyên và bỏ qua, seed không bao giờ làm sập ứng dụng.
 */
export function seedSales(db: MockTransaction, today: Date): void {
  const users = db.read('users')
  const userOf = (username: string): MockUser => {
    const found = users.find((u) => u.username === username)
    if (!found) throw new Error(`Seed bán hàng: thiếu tài khoản ${username}`)
    return found
  }
  const cashier = userOf('cashier01')
  const newStaff = userOf('newstaff')
  const manager = userOf('manager01')

  const at = (daysAgo: number, hour: number, minute = 0): Date => {
    const d = addDays(today, -daysAgo)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  const attempt = <T>(step: () => T): T | null => {
    const snapshot = TOUCHED_TABLES.map((t) => [t, structuredClone(db.read(t))] as const)
    try {
      return step()
    } catch {
      for (const [table, value] of snapshot) db.write(table, value as never)
      return null
    }
  }

  const openShift = (user: MockUser, when: Date, openingCash: number): CashierShift | null =>
    attempt(() => {
      const shifts = db.read('shifts')
      const day = toDateOnly(when).replaceAll('-', '')
      const sameDay = shifts.filter((s) => s.shiftCode.startsWith(`CA${day}`)).length
      const shift: CashierShift = {
        shiftId: db.nextSeq('shift', shifts.reduce((m, s) => Math.max(m, s.shiftId), 0) + 1),
        shiftCode: `CA${day}-${String(sameDay + 1).padStart(2, '0')}`,
        cashierId: user.id,
        cashierName: user.fullName,
        openedAt: toIsoLocal(when),
        openingCash,
        status: 'OPEN',
        closedAt: null,
        expectedCash: null,
        actualCash: null,
        differenceAmount: null,
        note: null,
        handoverConfirmedBy: null,
        handoverConfirmedByName: null,
      }
      shifts.push(shift)
      db.write('shifts', shifts)
      return shift
    })

  /** `shortfall` > 0: két thiếu tiền so với kỳ vọng (phải có giải trình, luật 37). */
  const closeShift = (shift: CashierShift | null, when: Date, shortfall: number, note: string | null) => {
    if (!shift) return
    attempt(() => {
      const summary = summarizeShift(db, shift)
      shift.status = 'CLOSED'
      shift.closedAt = toIsoLocal(when)
      shift.expectedCash = summary.expectedCash
      shift.actualCash = summary.expectedCash - shortfall
      shift.differenceAmount = shortfall === 0 ? 0 : -shortfall
      shift.note = note
      db.touch('shifts')
    })
  }

  const sell = (user: MockUser, when: Date, spec: SaleSpec): OrderRecord | null =>
    attempt(() => {
      const cart: CartInput = {
        items: spec.items.map((i) => ({ productId: i.productId, quantity: i.quantity, batchId: null })),
        customerId: spec.customerId ?? null,
        voucherCode: spec.voucherCode ?? null,
        pointsRequested: spec.pointsRequested ?? 0,
        exchangeReturnId: spec.exchangeReturnId ?? null,
      }
      const credit = exchangeCreditOf(db, cart.exchangeReturnId)
      const due = priceCart(db, cart, when, { exchangeCreditAmount: credit }).quote.amountDue
      const request: CompleteOrderRequest = {
        ...cart,
        paymentMethod: spec.method,
        amountReceived: spec.method === 'CASH' ? Math.ceil(due / 50000) * 50000 : null,
      }
      return completeSale(db, request, user, when)
    })

  const lineOf = (order: OrderRecord | null, productId: number) => order?.lines.find((l) => l.productId === productId && l.lineType === 'NORMAL')

  const giveBack = (
    user: MockUser,
    when: Date,
    order: OrderRecord | null,
    productId: number,
    reason: 'DEFECTIVE' | 'CHANGE_OF_MIND',
    refundMethod: 'CASH' | 'EXCHANGE',
    note: string
  ): ReturnOrderRecord | null => {
    const line = lineOf(order, productId)
    if (!order || !line) return null
    return attempt(() =>
      createReturn(
        db,
        {
          originalOrderId: order.id,
          reason,
          items: [
            { orderDetailId: line.id, quantity: 1, condition: reason === 'DEFECTIVE' ? 'DAMAGED_OR_OPENED' : 'INTACT' },
          ],
          note,
          refundMethod,
        },
        user,
        when
      )
    )
  }

  // Ca A (3 ngày trước): đủ 3 phương thức, có khách, voucher, dùng điểm, bậc thang + quà tặng. Két khớp.
  const shiftA = openShift(cashier, at(3, 8), 2_000_000)
  const a1 = sell(cashier, at(3, 10, 15), { method: 'CASH', customerId: 2, items: [{ productId: 3, quantity: 2 }, { productId: 5, quantity: 1 }] })
  sell(cashier, at(3, 11, 40), { method: 'BANK_TRANSFER', items: [{ productId: 2, quantity: 1 }, { productId: 4, quantity: 1 }] })
  sell(cashier, at(3, 14, 5), { method: 'CARD', customerId: 1, voucherCode: 'GIAM100', pointsRequested: 500, items: [{ productId: 7, quantity: 1 }] })
  sell(cashier, at(3, 14, 50), { method: 'BANK_TRANSFER', customerId: 6, items: [{ productId: 1, quantity: 1 }, { productId: 8, quantity: 1 }] })
  closeShift(shiftA, at(3, 15, 30), 0, null)

  // Ca B (2 ngày trước): mua 2 tặng 1, combo + voucher chào bạn mới, trả hàng lỗi. Két thiếu 20.000 đ có giải trình.
  const shiftB = openShift(cashier, at(2, 8, 30), 1_500_000)
  sell(cashier, at(2, 9, 50), { method: 'CASH', items: [{ productId: 6, quantity: 2 }] })
  sell(cashier, at(2, 13, 20), { method: 'CASH', customerId: 3, voucherCode: 'WELCOME10', items: [{ productId: 4, quantity: 1 }, { productId: 3, quantity: 1 }] })
  sell(cashier, at(2, 16), { method: 'CARD', customerId: 6, items: [{ productId: 2, quantity: 2 }] })
  giveBack(cashier, at(2, 16, 20), a1, 3, 'DEFECTIVE', 'CASH', 'Kem chống nắng bị tách lớp khi mở nắp')
  closeShift(shiftB, at(2, 17, 30), 20_000, 'Thiếu 20.000 đ, nghi trả nhầm tiền thừa cho khách ca chiều')

  // Ca C (hôm qua): đổi hàng (phiếu đổi + đơn đổi), đơn chuyển khoản có khuyến mãi. Két khớp.
  const shiftC = openShift(cashier, at(1, 8), 1_000_000)
  sell(cashier, at(1, 10), { method: 'CASH', items: [{ productId: 5, quantity: 3 }, { productId: 2, quantity: 1 }] })
  const c2 = sell(cashier, at(1, 11, 30), { method: 'CASH', customerId: 4, items: [{ productId: 4, quantity: 1 }] })
  const exchange = giveBack(cashier, at(1, 12, 10), c2, 4, 'CHANGE_OF_MIND', 'EXCHANGE', 'Khách đổi sang kem chống nắng')
  sell(cashier, at(1, 12, 20), { method: 'CASH', customerId: 4, exchangeReturnId: exchange?.id ?? null, items: [{ productId: 3, quantity: 1 }] })
  sell(cashier, at(1, 15, 10), { method: 'BANK_TRANSFER', customerId: 2, items: [{ productId: 1, quantity: 1 }] })
  closeShift(shiftC, at(1, 17), 0, null)

  // Quản lý đã xác nhận bàn giao ca A; ca B, C chờ xác nhận.
  attempt(() => {
    if (!shiftA) return
    shiftA.handoverConfirmedBy = manager.id
    shiftA.handoverConfirmedByName = manager.fullName
    db.touch('shifts')
    writeAudit(db, manager, at(3, 16), {
      action: 'CONFIRM_HANDOVER',
      module: 'POS',
      entityType: 'SHIFT',
      entityId: shiftA.shiftCode,
      details: { note: `${shiftA.shiftCode}: chênh lệch ${shiftA.differenceAmount ?? 0} đ, thu ngân ${shiftA.cashierName}` },
    })
  })

  // Hôm nay: một ca đang mở (nhân viên mới) và một đơn nháp.
  const openedAt = addMinutes(today, -90)
  const todayShift = openShift(newStaff, openedAt, 1_000_000)
  if (todayShift) {
    attempt(() =>
      saveDraft(
        db,
        {
          items: [
            { productId: 4, quantity: 2, batchId: null },
            { productId: 5, quantity: 1, batchId: null },
          ],
          customerId: null,
          voucherCode: null,
          pointsRequested: 0,
        },
        newStaff,
        addMinutes(today, -20)
      )
    )
  }

  // Văn bản "đơn gần nhất" của khách theo ngày thật thay cho "Vừa xong".
  const todayDate = toDateOnly(today)
  const dayDiff = (iso: string) =>
    Math.round((Date.parse(`${todayDate}T00:00:00`) - Date.parse(`${iso.slice(0, 10)}T00:00:00`)) / 86_400_000)
  for (const customer of db.read('customers')) {
    const last = db
      .read('orders')
      .filter((o) => o.customerId === customer.id && o.status === 'COMPLETED')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]
    if (!last?.completedAt) continue
    const days = dayDiff(last.completedAt)
    const time = last.completedAt.slice(11, 16)
    customer.lastOrderText = days <= 0 ? `Hôm nay, ${time}` : days === 1 ? `Hôm qua, ${time}` : `${days} ngày trước`
  }
}
