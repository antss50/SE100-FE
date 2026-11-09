import type { CustomerItem, CustomerTierCode, CustomerTierInfo } from '../types/api'
import type { MockTransaction } from './db'
import { toIsoLocal } from './time'

/** Tham số điểm đọc từ SYSTEM_SETTINGS (DATABASE.md mục 7). */
export interface LoyaltySettings {
  earnAmount: number
  redeemValue: number
  maxRedeemPercent: number
}

export function loyaltySettings(db: MockTransaction): LoyaltySettings {
  const s = db.read('systemSettings')
  const num = (key: string, fallback: number) => {
    const v = Number(s[key])
    return Number.isFinite(v) && v > 0 ? v : fallback
  }
  return {
    earnAmount: num('POINT_EARN_AMOUNT', 10000),
    redeemValue: num('POINT_REDEEM_VALUE', 100),
    maxRedeemPercent: num('POINT_MAX_REDEEM_PERCENT', 50),
  }
}

/** Chiết khấu hiện hành của một hạng (CUSTOMER_TIERS.discount_rate, dạng 0-1); CUS-05 chỉnh được. */
export function tierDiscountRateOf(db: MockTransaction, code: CustomerTierCode): number {
  const pct = db.read('loyaltyConfig').tiers.find((t) => t.tier === code)?.discountPercent ?? 0
  return pct / 100
}

const TIER_ORDER: CustomerTierCode[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']
const TIER_NAMES: Record<CustomerTierCode, string> = {
  BRONZE: 'Hạng Đồng',
  SILVER: 'Hạng Bạc',
  GOLD: 'Hạng Vàng',
  DIAMOND: 'Hạng Kim Cương',
}

/** Hạng theo tổng chi tiêu (luật 45): hạng có mốc cao nhất không vượt quá chi tiêu. */
export function tierForSpend(db: MockTransaction, totalSpent: number): CustomerTierInfo {
  const tiers = db.read('loyaltyConfig').tiers
  let picked = tiers[0]
  for (const t of tiers) if (totalSpent >= t.minSpend && t.minSpend >= picked.minSpend) picked = t
  const code = picked.tier
  return {
    id: TIER_ORDER.indexOf(code) + 1,
    tierCode: code,
    tierName: TIER_NAMES[code],
    discountRate: tierDiscountRateOf(db, code).toFixed(2),
  }
}

export const tierRankOf = (c: Pick<CustomerItem, 'tier'>): number => c.tier.id ?? TIER_ORDER.indexOf(c.tier.tierCode) + 1

/** Ghi một dòng lịch sử điểm vào hồ sơ khách và cập nhật số dư (POINT_HISTORIES). */
export function recordPoints(
  customer: CustomerItem,
  entry: {
    actionType: 'EARN' | 'REDEEM' | 'REVOKE' | 'ADJUST'
    pointsChanged: number
    orderCode?: string
    returnCode?: string
    description: string
    now: Date
  }
): void {
  if (entry.pointsChanged === 0) return
  customer.rewardPoints = Math.max(0, customer.rewardPoints + entry.pointsChanged)
  const histories = customer.pointHistories ?? (customer.pointHistories = [])
  histories.unshift({
    id: histories.reduce((m, h) => Math.max(m, h.id ?? 0), 0) + 1,
    orderId: entry.orderCode,
    returnId: entry.returnCode,
    actionType: entry.actionType,
    pointsChanged: entry.pointsChanged,
    balanceAfter: customer.rewardPoints,
    createdAt: toIsoLocal(entry.now),
    description: entry.description,
  })
}
