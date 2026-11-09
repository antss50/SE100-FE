import type { Batch, StockMovement, StockReferenceType } from '../types/stock'
import type { MockTransaction } from './db'
import { MockHttpError } from './http'
import { toDateOnly, toIsoLocal } from './time'

/**
 * Helper dùng chung cho mọi nghiệp vụ làm đổi tồn trong mock (nhập kho, kiểm kho,
 * xuất hủy, bán hàng, đổi trả). Mọi thay đổi `onHandQty` đi qua `applyStockChange` để
 * luôn có một dòng thẻ kho cùng giao dịch (luật 28) và giữ `0 ≤ blocked ≤ onHand`.
 */

/** Ngày thuần `YYYY-MM-DD` của thời điểm hiện tại. */
export const todayOf = (now: Date): string => toDateOnly(now)

/** Sinh id tăng dần cho bảng không đi qua `nextSeq` ở lần seed đầu. */
export function nextTableId(db: MockTransaction, counter: string, existingMax: number): number {
  return db.nextSeq(counter, existingMax + 1)
}

export function findBatchById(db: MockTransaction, batchId: number): Batch {
  const batch = db.read('batches').find((b) => b.id === batchId)
  if (!batch) throw new MockHttpError(404, 'STK_BATCH_NOT_FOUND', 'Không tìm thấy lô hàng')
  return batch
}

export function findBatchByLot(db: MockTransaction, productId: number, lotCode: string): Batch | undefined {
  return db.read('batches').find((b) => b.productId === productId && b.lotCode.toLowerCase() === lotCode.toLowerCase())
}

/** Lô đang bị khóa kiểm kho thì không nhập/xuất/bán thêm (errorCode `STK_BATCH_LOCKED`). */
export function assertBatchNotLocked(batch: Batch): void {
  if (batch.lockedByCheckId) {
    throw new MockHttpError(409, 'STK_BATCH_LOCKED', `Lô ${batch.lotCode} đang bị khóa để kiểm kho`)
  }
}

export interface StockChange {
  batch: Batch
  /** Có dấu: nhập/trả (+), bán/hủy (−), kiểm kho (±). Khác 0. */
  change: number
  referenceType: StockReferenceType
  referenceId: number
  reason?: string
  userId?: number | null
  now: Date
}

/**
 * Đổi tồn thực tế của một lô và ghi thẻ kho (`balanceAfter` = tồn lô sau biến động).
 * Ném 422 nếu tồn âm hoặc cách ly vượt tồn; lúc đó handler ném lỗi nên không ghi gì.
 */
export function applyStockChange(db: MockTransaction, input: StockChange): StockMovement {
  const { batch, change } = input
  if (!Number.isInteger(change) || change === 0) {
    throw new MockHttpError(422, 'STK_QUANTITY_INVALID', 'Số lượng biến động phải là số nguyên khác 0')
  }
  const next = batch.onHandQty + change
  if (next < 0) {
    throw new MockHttpError(422, 'STK_INSUFFICIENT_STOCK', `Lô ${batch.lotCode} không đủ tồn (còn ${batch.onHandQty})`)
  }
  if (batch.blockedQty > next) {
    throw new MockHttpError(
      422,
      'STK_BLOCKED_EXCEEDS_ON_HAND',
      `Lô ${batch.lotCode}: lượng cách ly (${batch.blockedQty}) không được vượt tồn thực tế (${next})`
    )
  }
  batch.onHandQty = next
  db.touch('batches')
  const movements = db.read('stockMovements')
  const movement: StockMovement = {
    id: nextTableId(db, 'stockMovement', movements.reduce((m, x) => Math.max(m, x.id), 0)),
    batchId: batch.id,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    quantityChange: change,
    balanceAfter: next,
    reason: input.reason ?? null,
    createdBy: input.userId ?? null,
    createdAt: toIsoLocal(input.now),
  }
  movements.push(movement)
  db.touch('stockMovements')
  syncProductStock(db, batch.productId)
  return movement
}

/** Đổi lượng cách ly của lô, giữ `0 ≤ blocked ≤ onHand`. Không phát sinh thẻ kho vì tồn thực tế không đổi. */
export function adjustBlockedQty(db: MockTransaction, batch: Batch, delta: number): void {
  const next = batch.blockedQty + delta
  if (next < 0 || next > batch.onHandQty) {
    throw new MockHttpError(
      422,
      'STK_BLOCKED_OUT_OF_RANGE',
      `Lô ${batch.lotCode}: lượng cách ly phải nằm trong khoảng 0 đến ${batch.onHandQty}`
    )
  }
  batch.blockedQty = next
  db.touch('batches')
}

/** Cập nhật tồn tổng (`currentStock`) của sản phẩm = Σ tồn thực tế các lô. */
export function syncProductStock(db: MockTransaction, productId: number): void {
  const products = db.read('products')
  const product = products.find((p) => p.id === productId)
  if (!product) return
  product.currentStock = db
    .read('batches')
    .filter((b) => b.productId === productId)
    .reduce((n, b) => n + b.onHandQty, 0)
  db.touch('products')
}

/** Mã chứng từ gốc của một dòng thẻ kho (để hiện ở cột "Mã tham chiếu"). */
export function referenceCodeOf(db: MockTransaction, movement: StockMovement): string {
  const id = movement.referenceId
  switch (movement.referenceType) {
    case 'PURCHASE':
      return db.read('purchaseOrders').find((o) => o.id === id)?.poCode ?? `PN#${id}`
    case 'CHECK_ADJUST':
      return db.read('inventoryChecks').find((c) => c.id === id)?.checkCode ?? `CHK#${id}`
    case 'DISPOSAL':
    case 'TESTER':
    case 'SUPPLIER_RETURN':
      return db.read('disposals').find((d) => d.id === id)?.disposalCode ?? `DISP#${id}`
    case 'SALE':
      return db.read('orders').find((o) => o.id === id)?.orderCode ?? `HD#${id}`
    case 'RETURN':
      return db.read('returns').find((r) => r.id === id)?.returnCode ?? `TH#${id}`
  }
}
