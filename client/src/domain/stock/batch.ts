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

/** Giá trị chuyển tiếp cho sản phẩm cũ chưa có cấu hình riêng. */
export const DEFAULT_EXPIRY_WARNING_DAYS = 60

export interface ExpiryWarningProduct {
  expiryWarningDays?: number
  expiryWarningValue?: number
  expiryWarningUnit?: ExpiryUnit
}

export type ExpiryUnit = 'days' | 'months' | 'years'

function addExpiryUnit(date: string, value: number, unit: ExpiryUnit): string {
  const [year, month, day] = date.split('-').map(Number)
  if (unit === 'days') return new Date(Date.UTC(year, month - 1, day + value)).toISOString().slice(0, 10)
  const monthsToAdd = value * (unit === 'years' ? 12 : 1)
  const targetMonth = month - 1 + monthsToAdd
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function expiryWarningLimitDate(product: ExpiryWarningProduct | undefined, today: string): string {
  const value = product?.expiryWarningValue
  const unit = product?.expiryWarningUnit
  if (Number.isFinite(value) && (value as number) >= 0 && unit) return addExpiryUnit(today, value as number, unit)
  return addExpiryUnit(today, expiryWarningDaysForProduct(product), 'days')
}

export function expiryStatusForProduct(expDate: string, today: string, product?: ExpiryWarningProduct): ExpiryStatus {
  if (expDate < today) return 'EXPIRED'
  if (expDate > today && expDate <= expiryWarningLimitDate(product, today)) return 'NEAR_EXPIRY'
  return 'OK'
}

export function expiryWarningDaysForProduct(product?: ExpiryWarningProduct): number {
  const value = product?.expiryWarningDays
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : DEFAULT_EXPIRY_WARNING_DAYS
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
 * cận hạn khi còn từ 1 đến `warningDays` ngày. Ngày hết hạn vẫn bán được
 * đến hết ngày, nên không được gộp vào cảnh báo cận hạn.
 */
export function expiryStatus(expDate: string, today: string, warningDays: number): ExpiryStatus {
  const days = daysUntilExpiry(expDate, today)
  if (days < 0) return 'EXPIRED'
  if (days > 0 && days <= warningDays) return 'NEAR_EXPIRY'
  return 'OK'
}

/** Ngày HSD tối đa tính từ NSX theo tháng lịch; ngày cuối tháng được làm tròn về ngày hợp lệ cuối cùng. */
export function maxExpiryDate(mfgDate: string, shelfLifeMonths: number): string {
  const [year, month, day] = mfgDate.split('-').map(Number)
  const targetMonth = month - 1 + shelfLifeMonths
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function maxExpiryDateForProduct(
  mfgDate: string,
  product: { shelfLifeMonths?: number | null; shelfLifeValue?: number | null; shelfLifeUnit?: ExpiryUnit | null },
): string | undefined {
  const { shelfLifeValue, shelfLifeUnit } = product
  if (Number.isFinite(shelfLifeValue) && (shelfLifeValue as number) > 0 && shelfLifeUnit) {
    return addExpiryUnit(mfgDate, shelfLifeValue as number, shelfLifeUnit)
  }
  return product.shelfLifeMonths ? maxExpiryDate(mfgDate, product.shelfLifeMonths) : undefined
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
