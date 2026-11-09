/**
 * Hàm thuần cho lô hàng và hạn dùng (luật 24, 26, 29). Không React, không gọi API.
 * Ngày thuần dạng `YYYY-MM-DD` nên so sánh chuỗi là so sánh theo ngày.
 */

export type ExpiryStatus = 'OK' | 'NEAR_EXPIRY' | 'EXPIRED'

export interface BatchLike {
  expDate: string
  onHandQty: number
  blockedQty: number
  lockedByCheckId?: number | null
}

/** Số ngày từ `today` tới hạn dùng (âm nếu đã quá hạn). */
export function daysUntilExpiry(expDate: string, today: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((toUtc(expDate) - toUtc(today)) / 86_400_000)
}

/**
 * Hết hạn khi `expDate < hôm nay` (bán được đến hết ngày ghi trên hạn, luật 26);
 * cận hạn khi còn từ 0 đến `warningDays` ngày.
 */
export function expiryStatus(expDate: string, today: string, warningDays: number): ExpiryStatus {
  const days = daysUntilExpiry(expDate, today)
  if (days < 0) return 'EXPIRED'
  if (days <= warningDays) return 'NEAR_EXPIRY'
  return 'OK'
}

/** Tồn bán được của lô: `onHand − blocked`, chỉ khi còn hạn và không bị khóa kiểm kho (luật 24). */
export function sellableQty(batch: BatchLike, today: string): number {
  if (batch.expDate < today) return 0
  if (batch.lockedByCheckId) return 0
  return Math.max(0, batch.onHandQty - batch.blockedQty)
}

/** Sắp theo FEFO: hạn sớm trước; bằng hạn thì lô có mã nhỏ hơn trước để kết quả ổn định. */
export function compareFefo<T extends { expDate: string; id: number }>(a: T, b: T): number {
  return a.expDate.localeCompare(b.expDate) || a.id - b.id
}

/**
 * Giá vốn bình quân gia quyền khi nhập thêm vào lô đã có (luật 29):
 * `(onHand × costCũ + qty × costMới) / (onHand + qty)`, làm tròn tới đồng.
 */
export function weightedAverageCost(onHandQty: number, oldCost: number, addedQty: number, newCost: number): number {
  const total = onHandQty + addedQty
  if (total <= 0) return newCost
  return Math.round((onHandQty * oldCost + addedQty * newCost) / total)
}
