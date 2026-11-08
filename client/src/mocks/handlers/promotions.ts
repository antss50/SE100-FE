import { z } from 'zod'
import type { LoyaltyConfigData, PromotionItem, PromotionReportData } from '../../types/api'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody, sameText } from '../http'
import type { MockRoute } from '../router'
import { SEED_LOYALTY_CONFIG } from '../seed/loyalty'

// GĐ0: chuyển nguyên logic mock cũ (5 loại khuyến mãi cũ). Đổi sang 7 loại theo KHUYEN_MAI.md ở GĐ3.

const promotionTypes = ['PERCENT_ORDER', 'FIXED_ORDER', 'BUY_X_GET_Y', 'COMBO', 'STEP_DISCOUNT'] as const
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')

const promotionFields = {
  promotionName: z.string().trim().min(1, 'Vui lòng nhập tên chương trình'),
  promotionType: z.enum(promotionTypes),
  voucherCode: z.string().trim().min(1, 'Vui lòng nhập mã voucher'),
  applyScope: z.enum(['ALL', 'PRODUCT', 'BRAND', 'CATEGORY']),
  startDate: isoDate,
  endDate: isoDate,
  usageLimit: z.number().int().positive('Tổng lượt dùng phải lớn hơn 0'),
  limitPerCustomer: z.number().int().positive('Lượt dùng mỗi khách phải lớn hơn 0'),
  minOrderValue: z.number().min(0).optional(),
  discountType: z.enum(['PERCENT', 'FIXED_AMOUNT']).optional(),
  discountValue: z.number().optional(),
  maxDiscountAmount: z.number().optional(),
}
const createSchema = z.object(promotionFields).passthrough()
const updateSchema = z.object(promotionFields).partial().passthrough()

const loyaltySchema = z.object({
  amountPerPoint: z.number().positive('Tỷ lệ quy đổi điểm phải lớn hơn 0'),
  redemptionValuePerPoint: z.number().positive().optional(),
  tiers: z.array(z.object({ tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']), minSpend: z.number().min(0) })),
})

/** Tóm tắt mức giảm để hiển thị trên thẻ khuyến mãi (logic cũ của service, chuyển vào mock). */
function withSummary(p: PromotionItem): PromotionItem {
  if (p.valueSummaryTitle) return { ...p, minTierLabel: p.minTierLabel ?? 'Đồng' }
  let title: string
  let sub: string
  if (p.promotionType === 'PERCENT_ORDER' || p.discountType === 'PERCENT') {
    title = `${p.discountValue ?? 0}%`
    sub = `Áp dụng với hóa đơn từ ${(p.minOrderValue ?? 0).toLocaleString('vi-VN')} VNĐ`
  } else if (p.promotionType === 'FIXED_ORDER' || p.discountType === 'FIXED_AMOUNT') {
    title = `-${(p.discountValue ?? 0).toLocaleString('vi-VN')} đ`
    sub = 'Giảm trực tiếp trên tổng hóa đơn'
  } else if (p.promotionType === 'BUY_X_GET_Y') {
    title = 'Mua X tặng Y sản phẩm'
    sub = 'Tự động giảm 100% sản phẩm quà tặng'
  } else if (p.promotionType === 'COMBO') {
    title = 'Gói Combo ưu đãi trọn bộ'
    sub = 'Áp dụng khi mua đủ sản phẩm trong gói'
  } else {
    title = 'Giảm giá theo bậc thang'
    sub = 'Tự động chọn bậc cao nhất đơn hàng chạm ngưỡng'
  }
  return { ...p, minTierLabel: p.minTierLabel ?? 'Đồng', valueSummaryTitle: title, valueSummarySub: sub }
}

function findPromotion(list: PromotionItem[], code: string): PromotionItem {
  const found = list.find((p) => sameText(p.voucherCode, code))
  if (!found) throw notFound('PROM_NOT_FOUND', 'Không tìm thấy chương trình khuyến mãi')
  return found
}

export const promotionRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/loyalty-config',
    handler: ({ db }) => ok(db.read('loyaltyConfig'), 'Lấy cấu hình tích điểm thành công'),
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
      const next: LoyaltyConfigData = {
        amountPerPoint: input.amountPerPoint,
        redemptionValuePerPoint: input.redemptionValuePerPoint ?? current.redemptionValuePerPoint ?? 100,
        tiers: SEED_LOYALTY_CONFIG.tiers.map((tmpl) => {
          const old = current.tiers.find((t) => t.tier === tmpl.tier) ?? tmpl
          return { ...old, minSpend: spend(tmpl.tier) ?? old.minSpend }
        }),
      }
      db.write('loyaltyConfig', next)
      return ok(next, 'Lưu cấu hình thành công')
    },
  },
  {
    method: 'GET',
    path: '/promotions',
    permission: 'PROMOTION_VIEW',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const status = query.get('status')
      const items = db
        .read('promotions')
        .filter(
          (p) =>
            (!kw || p.voucherCode.toLowerCase().includes(kw) || p.promotionName.toLowerCase().includes(kw)) &&
            (!status || p.status === status)
        )
      return ok(paginate(items, query), 'Lấy danh sách thành công')
    },
  },
  {
    method: 'POST',
    path: '/promotions',
    permission: 'PROMOTION_MANAGE',
    handler: ({ db, body }) => {
      const input = parseBody(createSchema, body)
      const promotions = db.read('promotions')
      const code = input.voucherCode.toUpperCase()
      if (promotions.some((p) => sameText(p.voucherCode, code))) {
        throw new MockHttpError(409, 'PROM_VOUCHER_DUPLICATED', 'Mã voucher này đã tồn tại, vui lòng chọn mã khác')
      }
      if (input.startDate > input.endDate) {
        throw new MockHttpError(422, 'PROM_DATE_RANGE_INVALID', 'Ngày bắt đầu không được lớn hơn ngày kết thúc')
      }
      if (input.limitPerCustomer > input.usageLimit) {
        throw new MockHttpError(
          422,
          'PROM_LIMIT_PER_CUSTOMER_INVALID',
          'Số lượt sử dụng trên mỗi khách hàng không được vượt quá tổng số lượt sử dụng'
        )
      }
      if (
        (input.promotionType === 'PERCENT_ORDER' || input.promotionType === 'FIXED_ORDER') &&
        (!input.discountValue || input.discountValue <= 0)
      ) {
        throw new MockHttpError(422, 'PROM_DISCOUNT_VALUE_INVALID', 'Mức giảm không hợp lệ')
      }
      const created = withSummary({
        voucherCode: code,
        promotionName: input.promotionName,
        promotionType: input.promotionType,
        applyScope: input.applyScope,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        maxDiscountAmount: input.maxDiscountAmount,
        minOrderValue: input.minOrderValue ?? 0,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'ACTIVE',
        usedCount: 0,
        usageLimit: input.usageLimit,
        limitPerCustomer: input.limitPerCustomer,
      })
      db.write('promotions', [created, ...promotions])
      return ok(created, 'Tạo chương trình khuyến mãi thành công', 201)
    },
  },
  {
    method: 'PUT',
    path: '/promotions/:code',
    permission: 'PROMOTION_MANAGE',
    handler: ({ db, params, body }) => {
      const input = parseBody(updateSchema, body)
      const promotions = db.read('promotions')
      const target = findPromotion(promotions, params.code)
      // Luật 10: đã có đơn dùng thì chỉ được gia hạn hoặc tăng lượt dùng.
      if (target.usedCount > 0) {
        const locked =
          (input.usageLimit !== undefined && input.usageLimit < target.usageLimit) ||
          (input.endDate !== undefined && input.endDate < target.endDate) ||
          (input.discountValue !== undefined && input.discountValue !== target.discountValue) ||
          (input.discountType !== undefined && input.discountType !== target.discountType) ||
          (input.applyScope !== undefined && input.applyScope !== target.applyScope)
        if (locked) {
          throw new MockHttpError(
            409,
            'PROM_FIELD_LOCKED',
            'Chương trình đã phát sinh giao dịch, chỉ được kéo dài ngày kết thúc hoặc tăng số lượt dùng'
          )
        }
      }
      Object.assign(target, {
        promotionName: input.promotionName ?? target.promotionName,
        discountType: input.discountType ?? target.discountType,
        discountValue: input.discountValue ?? target.discountValue,
        minOrderValue: input.minOrderValue ?? target.minOrderValue,
        startDate: input.startDate ?? target.startDate,
        endDate: input.endDate ?? target.endDate,
        usageLimit: input.usageLimit ?? target.usageLimit,
        limitPerCustomer: input.limitPerCustomer ?? target.limitPerCustomer,
        valueSummaryTitle: undefined,
        valueSummarySub: undefined,
      })
      Object.assign(target, withSummary(target))
      db.touch('promotions')
      return ok(target, 'Cập nhật chương trình khuyến mãi thành công')
    },
  },
  {
    method: 'PATCH',
    path: '/promotions/:code/pause',
    permission: 'PROMOTION_MANAGE',
    handler: ({ db, params }) => {
      const target = findPromotion(db.read('promotions'), params.code)
      if (target.status === 'PENDING' || target.status === 'EXPIRED') {
        throw new MockHttpError(409, 'PROM_STATUS_INVALID', 'Trạng thái hiện tại không cho phép tạm dừng/kích hoạt')
      }
      target.status = target.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
      db.touch('promotions')
      return ok(
        { voucherCode: target.voucherCode, status: target.status },
        target.status === 'PAUSED' ? 'Tạm dừng chương trình thành công' : 'Kích hoạt chương trình thành công'
      )
    },
  },
  {
    method: 'GET',
    path: '/promotions/:code/report',
    permission: 'PROMOTION_REPORT',
    handler: ({ db, params }) => {
      const target = findPromotion(db.read('promotions'), params.code)
      // Số liệu minh họa cố định; báo cáo thật tính từ đơn hàng ở GĐ6 (PROM-04).
      const usage = target.usedCount
      const avgOrder = 750000
      const avgDiscount = 75000
      const data: PromotionReportData = {
        totalUsage: usage,
        totalDiscountAmount: usage * avgDiscount,
        totalRevenueGenerated: usage * avgOrder,
        uniqueCustomers: Math.round(usage * 0.85),
        averageOrderValue: usage ? avgOrder : 0,
        averageDiscountPerOrder: usage ? avgDiscount : 0,
        usageRate: target.usageLimit ? usage / target.usageLimit : 0,
        usageByDate: [],
        orders: [],
        topCustomers: [],
      }
      return ok(data, 'Lấy báo cáo thành công')
    },
  },
]
