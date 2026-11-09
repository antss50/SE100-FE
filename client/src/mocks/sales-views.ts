import type { OrderListItem, OrderRecord, ReturnListItem, ReturnOrderRecord, ShiftSummary } from '../types/pos'
import type { CashierShift } from '../types/pos'
import type { MockTransaction } from './db'

export function toOrderListItem(order: OrderRecord): OrderListItem {
  const { lines, draftCart, ...rest } = order
  void draftCart
  return { ...rest, lineCount: lines.length }
}

export function toReturnListItem(ret: ReturnOrderRecord): ReturnListItem {
  const { lines, ...rest } = ret
  return { ...rest, lineCount: lines.length }
}

/** Tiền mặt khách phải nộp của đơn = total − exchangeCredit (ràng buộc 11, DATABASE.md mục 8). */
export const amountDueOf = (order: Pick<OrderRecord, 'totalAmount' | 'exchangeCreditAmount'>): number =>
  order.totalAmount - order.exchangeCreditAmount

/**
 * Tổng hợp tiền của ca từ đơn và phiếu trả (không lưu).
 * Tiền kỳ vọng = đầu ca + tiền mặt thu của đơn CASH − tiền chi hoàn bằng CASH.
 */
export function summarizeShift(db: MockTransaction, shift: CashierShift): ShiftSummary {
  const orders = db.read('orders').filter((o) => o.shiftId === shift.shiftId)
  const returns = db.read('returns').filter((r) => r.shiftId === shift.shiftId && r.status === 'COMPLETED')
  const completed = orders.filter((o) => o.status === 'COMPLETED')
  const byMethod = (method: string) =>
    completed.filter((o) => o.paymentMethod === method).reduce((s, o) => s + amountDueOf(o), 0)
  const cashCollected = byMethod('CASH')
  const cashRefunded = returns.filter((r) => r.refundMethod === 'CASH').reduce((s, r) => s + r.totalRefundAmount, 0)
  return {
    orderCount: completed.length,
    returnCount: returns.length,
    draftCount: orders.filter((o) => o.status === 'DRAFT').length,
    cashSales: cashCollected,
    transferSales: byMethod('BANK_TRANSFER'),
    cardSales: byMethod('CARD'),
    cashCollected,
    cashRefunded,
    expectedCash: shift.openingCash + cashCollected - cashRefunded,
    totalSales: completed.reduce((s, o) => s + o.totalAmount, 0),
    totalRefunded: returns.reduce((s, r) => s + r.totalRefundAmount, 0),
  }
}

/** Số tiền mặt hiện có trong két của ca (dùng để quyết định hoàn tiền mặt hay chuyển khoản, luật 23). */
export function cashInDrawer(db: MockTransaction, shift: CashierShift): number {
  return summarizeShift(db, shift).expectedCash
}
