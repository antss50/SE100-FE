import { z } from 'zod'
import type { LoyaltyConfigData } from '../../types/api'
import { MockHttpError, ok, parseBody } from '../http'
import { loyaltySettings } from '../loyalty'
import type { MockRoute } from '../router'
import { SEED_LOYALTY_CONFIG } from '../seed/loyalty'

const loyaltySchema = z.object({
  amountPerPoint: z.number().positive('Tỷ lệ quy đổi điểm phải lớn hơn 0'),
  redemptionValuePerPoint: z.number().positive().optional(),
  tiers: z.array(
    z.object({
      tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']),
      minSpend: z.number().min(0),
      discountPercent: z.number().min(0, '% giảm không được âm').max(100, '% giảm tối đa 100').optional(),
    })
  ),
})

/** CUS-05: tỷ lệ tích điểm và giá trị 1 điểm lưu ở SYSTEM_SETTINGS; mốc hạng ở CUSTOMER_TIERS. */
export const loyaltyRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/loyalty-config',
    handler: ({ db }) => {
      const settings = loyaltySettings(db)
      const data: LoyaltyConfigData = {
        ...db.read('loyaltyConfig'),
        amountPerPoint: settings.earnAmount,
        redemptionValuePerPoint: settings.redeemValue,
      }
      return ok(data, 'Lấy cấu hình tích điểm thành công')
    },
  },
  {
    method: 'PUT',
    path: '/loyalty-config',
    permission: 'LOYALTY_CONFIG',
    handler: ({ db, body }) => {
      const input = parseBody(loyaltySchema, body)
      const spend = (code: string) => input.tiers.find((t) => t.tier === code)?.minSpend
      const [b, s, g, d] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'].map(spend)
      if (b !== 0 || s === undefined || g === undefined || d === undefined || !(s > 0 && s < g && g < d)) {
        throw new MockHttpError(
          422,
          'CUS_TIER_SPEND_INVALID',
          'Mức chi tiêu của hạng sau phải lớn hơn hạng trước (hạng Đồng = 0)'
        )
      }
      const current = db.read('loyaltyConfig')
      const settings = db.read('systemSettings')
      settings.POINT_EARN_AMOUNT = String(input.amountPerPoint)
      if (input.redemptionValuePerPoint) settings.POINT_REDEEM_VALUE = String(input.redemptionValuePerPoint)
      db.touch('systemSettings')
      const next: LoyaltyConfigData = {
        amountPerPoint: input.amountPerPoint,
        redemptionValuePerPoint: input.redemptionValuePerPoint ?? loyaltySettings(db).redeemValue,
        tiers: SEED_LOYALTY_CONFIG.tiers.map((tmpl) => {
          const old = current.tiers.find((t) => t.tier === tmpl.tier) ?? tmpl
          const sent = input.tiers.find((t) => t.tier === tmpl.tier)
          return {
            ...old,
            minSpend: spend(tmpl.tier) ?? old.minSpend,
            discountPercent: sent?.discountPercent ?? old.discountPercent ?? 0,
          }
        }),
      }
      db.write('loyaltyConfig', next)
      return ok(next, 'Lưu cấu hình thành công')
    },
  },
]
