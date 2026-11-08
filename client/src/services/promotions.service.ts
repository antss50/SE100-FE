import { ApiClientError, apiRequest } from '../lib/api-client'
import {
  INITIAL_LOYALTY_CONFIG,
  INITIAL_PROMOTIONS,
  mockDb,
} from '../lib/mock-db'
import type {
  ApiSuccessResponse,
  CreatePromotionRequest,
  LoyaltyConfigData,
  PaginatedData,
  PromotionItem,
  PromotionReportData,
} from '../types/api'

function enrichPromotion(raw: PromotionItem): PromotionItem {
  const template = INITIAL_PROMOTIONS.find(
    (p) => p.voucherCode.toLowerCase() === raw.voucherCode.toLowerCase()
  )
  let summaryTitle = raw.valueSummaryTitle || template?.valueSummaryTitle
  let summarySub = raw.valueSummarySub || template?.valueSummarySub

  if (!summaryTitle) {
    if (raw.promotionType === 'PERCENT_ORDER' || raw.discountType === 'PERCENT') {
      summaryTitle = `${raw.discountValue ?? 10}%`
      summarySub = `Áp dụng với hóa đơn từ ${(raw.minOrderValue ?? 0).toLocaleString('vi-VN')} VNĐ`
    } else if (
      raw.promotionType === 'FIXED_ORDER' ||
      raw.discountType === 'FIXED_AMOUNT'
    ) {
      summaryTitle = `-${(raw.discountValue ?? 50000).toLocaleString('vi-VN')} đ`
      summarySub = `Giảm trực tiếp trên tổng hóa đơn`
    } else if (raw.promotionType === 'BUY_X_GET_Y') {
      summaryTitle = 'Mua X tặng Y sản phẩm'
      summarySub = 'Tự động giảm 100% sản phẩm quà tặng'
    } else if (raw.promotionType === 'COMBO') {
      summaryTitle = 'Gói Combo ưu đãi trọn bộ'
      summarySub = 'Áp dụng khi mua đủ sản phẩm trong gói'
    } else {
      summaryTitle = 'Giảm giá theo bậc thang'
      summarySub = 'Tự động chọn bậc cao nhất đơn hàng chạm ngưỡng'
    }
  }

  return {
    ...template,
    ...raw,
    minTierLabel: raw.minTierLabel || template?.minTierLabel || 'Đồng',
    valueSummaryTitle: summaryTitle,
    valueSummarySub: summarySub,
  }
}

export const promotionsService = {
  // G10 - UC-CUS-09: GET & PUT /api/v1/loyalty-config
  async getLoyaltyConfig(): Promise<ApiSuccessResponse<LoyaltyConfigData>> {
    return apiRequest<LoyaltyConfigData>(
      '/loyalty-config',
      { method: 'GET' },
      () => ({
        success: true,
        message: 'Lấy cấu hình tích điểm thành công',
        data: mockDb.getLoyaltyConfig(),
      })
    )
  },

  async updateLoyaltyConfig(
    payload: LoyaltyConfigData
  ): Promise<ApiSuccessResponse<LoyaltyConfigData>> {
    const requestBody = {
      amountPerPoint: Number(payload.amountPerPoint),
      tiers: payload.tiers.map((t) => ({
        tier: t.tier,
        minSpend: Number(t.minSpend),
      })),
    }

    return apiRequest<LoyaltyConfigData>(
      '/loyalty-config',
      {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (
          !Number.isFinite(requestBody.amountPerPoint) ||
          requestBody.amountPerPoint <= 0
        ) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'CUS_POINT_RATE_INVALID',
            message: 'Tỷ lệ quy đổi điểm không hợp lệ',
          })
        }

        const bronze = requestBody.tiers.find((t) => t.tier === 'BRONZE')
        const silver = requestBody.tiers.find((t) => t.tier === 'SILVER')
        const gold = requestBody.tiers.find((t) => t.tier === 'GOLD')
        const diamond = requestBody.tiers.find((t) => t.tier === 'DIAMOND')

        if (
          !bronze ||
          !silver ||
          !gold ||
          !diamond ||
          bronze.minSpend !== 0 ||
          !(
            bronze.minSpend < silver.minSpend &&
            silver.minSpend < gold.minSpend &&
            gold.minSpend < diamond.minSpend
          )
        ) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'CUS_TIER_SPEND_INVALID',
            message: 'Mức chi tiêu của hạng sau phải lớn hơn hạng trước (BRONZE = 0)',
          })
        }

        const mergedTiers = INITIAL_LOYALTY_CONFIG.tiers.map((tmpl) => {
          const updated = payload.tiers.find((t) => t.tier === tmpl.tier)
          return {
            ...tmpl,
            ...updated,
            minSpend: Number(updated?.minSpend ?? tmpl.minSpend),
          }
        })

        const nextConfig: LoyaltyConfigData = {
          amountPerPoint: requestBody.amountPerPoint,
          redemptionValuePerPoint: payload.redemptionValuePerPoint ?? 100,
          tiers: mergedTiers,
        }

        mockDb.saveLoyaltyConfig(nextConfig)

        return {
          success: true,
          message: 'Lưu cấu hình thành công',
          data: nextConfig,
        }
      }
    )
  },

  // G11 - UC-PROM-01 / UC-PROM-05: GET /api/v1/promotions
  async getPromotions(params: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: string
  } = {}): Promise<ApiSuccessResponse<PaginatedData<PromotionItem>>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.status && params.status !== 'ALL') {
      query.set('status', params.status)
    }

    const qs = query.toString()
    const res = await apiRequest<PaginatedData<PromotionItem>>(
      `/promotions${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      () => {
        let all = mockDb.getPromotions().map(enrichPromotion)

        if (params.keyword?.trim()) {
          const kw = params.keyword.trim().toLowerCase()
          all = all.filter(
            (p) =>
              p.voucherCode.toLowerCase().includes(kw) ||
              p.promotionName.toLowerCase().includes(kw)
          )
        }

        if (params.status && params.status !== 'ALL') {
          all = all.filter((p) => p.status === params.status)
        }

        const page = params.page ?? 1
        const pageSize = params.pageSize ?? 20
        const start = (page - 1) * pageSize
        const items = all.slice(start, start + pageSize)

        return {
          success: true,
          message: 'Lấy danh sách thành công',
          data: {
            items,
            page,
            pageSize,
            totalItems: all.length,
          },
        }
      }
    )

    return {
      ...res,
      data: {
        ...res.data,
        items: (res.data.items || []).map(enrichPromotion),
      },
    }
  },

  // UC-PROM-02: POST /api/v1/promotions
  async createPromotion(
    payload: CreatePromotionRequest
  ): Promise<ApiSuccessResponse<PromotionItem>> {
    return apiRequest<PromotionItem>(
      '/promotions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        const promotions = mockDb.getPromotions()
        const code = payload.voucherCode.trim().toUpperCase()

        if (
          promotions.some(
            (p) => p.voucherCode.toLowerCase() === code.toLowerCase()
          )
        ) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROM_VOUCHER_DUPLICATED',
            message: 'Mã Voucher này đã tồn tại, vui lòng chọn mã khác',
          })
        }

        if (payload.startDate > payload.endDate) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'PROM_DATE_RANGE_INVALID',
            message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc',
          })
        }

        if (payload.limitPerCustomer > payload.usageLimit) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'PROM_LIMIT_PER_CUSTOMER_INVALID',
            message:
              'Số lượt sử dụng trên mỗi khách hàng không được vượt quá tổng số lượt sử dụng',
          })
        }

        if (
          (payload.promotionType === 'PERCENT_ORDER' ||
            payload.promotionType === 'FIXED_ORDER') &&
          (!payload.discountValue || payload.discountValue <= 0)
        ) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'PROM_DISCOUNT_VALUE_INVALID',
            message: 'Mức giảm không hợp lệ',
          })
        }

        const created: PromotionItem = enrichPromotion({
          voucherCode: code,
          promotionName: payload.promotionName.trim(),
          promotionType: payload.promotionType,
          applyScope: payload.applyScope,
          discountType: payload.discountType ?? null,
          discountValue: payload.discountValue ?? null,
          maxDiscountAmount: payload.maxDiscountAmount,
          minOrderValue: payload.minOrderValue ?? 0,
          startDate: payload.startDate,
          endDate: payload.endDate,
          status: 'ACTIVE',
          usedCount: 0,
          usageLimit: payload.usageLimit,
          limitPerCustomer: payload.limitPerCustomer,
          minTierLabel: 'Đồng',
        })

        mockDb.savePromotions([created, ...promotions])

        return {
          success: true,
          message: 'Tạo chương trình khuyến mãi thành công',
          data: created,
        }
      }
    )
  },

  // UC-PROM-03: PUT /api/v1/promotions/{voucherCode}
  async updatePromotion(
    voucherCode: string,
    payload: Partial<CreatePromotionRequest>
  ): Promise<ApiSuccessResponse<PromotionItem>> {
    return apiRequest<PromotionItem>(
      `/promotions/${encodeURIComponent(voucherCode)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      () => {
        const promotions = mockDb.getPromotions()
        const target = promotions.find(
          (p) => p.voucherCode.toLowerCase() === voucherCode.toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROM_NOT_FOUND',
            message: 'Không tìm thấy chương trình khuyến mãi',
          })
        }

        // Quy tắc cập nhật khi đã có đơn COMPLETED sử dụng (usedCount > 0)
        if (target.usedCount > 0) {
          const isReducingLimit =
            payload.usageLimit !== undefined &&
            payload.usageLimit < target.usageLimit
          const isShorteningEndDate =
            payload.endDate !== undefined && payload.endDate < target.endDate
          const isChangingLockedField =
            (payload.discountValue !== undefined &&
              payload.discountValue !== target.discountValue) ||
            (payload.discountType !== undefined &&
              payload.discountType !== target.discountType) ||
            (payload.applyScope !== undefined &&
              payload.applyScope !== target.applyScope)

          if (
            isReducingLimit ||
            isShorteningEndDate ||
            isChangingLockedField
          ) {
            throw new ApiClientError(409, {
              success: false,
              errorCode: 'PROM_FIELD_LOCKED',
              message:
                'Chương trình đã phát sinh giao dịch, chỉ được kéo dài ngày kết thúc hoặc tăng usageLimit',
            })
          }
        }

        Object.assign(target, {
          promotionName: payload.promotionName ?? target.promotionName,
          discountType: payload.discountType ?? target.discountType,
          discountValue: payload.discountValue ?? target.discountValue,
          minOrderValue: payload.minOrderValue ?? target.minOrderValue,
          startDate: payload.startDate ?? target.startDate,
          endDate: payload.endDate ?? target.endDate,
          usageLimit: payload.usageLimit ?? target.usageLimit,
          limitPerCustomer: payload.limitPerCustomer ?? target.limitPerCustomer,
        })

        const enriched = enrichPromotion(target)
        Object.assign(target, enriched)
        mockDb.savePromotions(promotions)

        return {
          success: true,
          message: 'Cập nhật chương trình khuyến mãi thành công',
          data: enriched,
        }
      }
    )
  },

  // UC-PROM-04: PATCH /api/v1/promotions/{voucherCode}/pause
  async togglePausePromotion(
    voucherCode: string
  ): Promise<ApiSuccessResponse<{ voucherCode: string; status: string }>> {
    return apiRequest<{ voucherCode: string; status: string }>(
      `/promotions/${encodeURIComponent(voucherCode)}/pause`,
      { method: 'PATCH' },
      () => {
        const promotions = mockDb.getPromotions()
        const target = promotions.find(
          (p) => p.voucherCode.toLowerCase() === voucherCode.toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROM_NOT_FOUND',
            message: 'Không tìm thấy chương trình khuyến mãi',
          })
        }

        if (target.status === 'PENDING' || target.status === 'EXPIRED') {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROM_STATUS_INVALID',
            message:
              'Trạng thái hiện tại không thể chuyển đổi (PENDING hoặc đã EXPIRED)',
          })
        }

        const nextStatus = target.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
        target.status = nextStatus
        mockDb.savePromotions(promotions)

        return {
          success: true,
          message:
            nextStatus === 'PAUSED'
              ? 'Tạm dừng chương trình thành công'
              : 'Kích hoạt chương trình thành công',
          data: {
            voucherCode: target.voucherCode,
            status: nextStatus,
          },
        }
      }
    )
  },

  // UC-PROM-07: GET /api/v1/promotions/{voucherCode}/report
  async getPromotionReport(
    voucherCode: string
  ): Promise<ApiSuccessResponse<PromotionReportData>> {
    return apiRequest<PromotionReportData>(
      `/promotions/${encodeURIComponent(voucherCode)}/report`,
      { method: 'GET' },
      () => {
        const promotions = mockDb.getPromotions()
        const target = promotions.find(
          (p) => p.voucherCode.toLowerCase() === voucherCode.toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROM_NOT_FOUND',
            message: 'Không tìm thấy chương trình khuyến mãi',
          })
        }

        const usage = target.usedCount || 12
        const avgOrder = 750000
        const avgDiscount = 75000

        return {
          success: true,
          message: 'Lấy báo cáo thành công',
          data: {
            totalUsage: usage,
            totalDiscountAmount: usage * avgDiscount,
            totalRevenueGenerated: usage * avgOrder,
            uniqueCustomers: Math.max(1, Math.round(usage * 0.85)),
            averageOrderValue: avgOrder,
            averageDiscountPerOrder: avgDiscount,
            usageRate: target.usageLimit ? usage / target.usageLimit : 0,
            usageByDate: [
              { date: '2026-10-04', usageCount: 3, revenue: 2250000 },
              { date: '2026-10-10', usageCount: 5, revenue: 3750000 },
              { date: '2026-10-18', usageCount: 4, revenue: 3000000 },
            ],
            orders: [
              {
                orderCode: 'HD20261001',
                customerName: 'Nguyễn Thị Thùy Dung',
                orderValue: 750000,
                discountAmount: 75000,
                paidAmount: 675000,
                usedAt: '2026-10-04T08:30:00Z',
              },
              {
                orderCode: 'HD20261015',
                customerName: 'Trần Minh Anh',
                orderValue: 1250000,
                discountAmount: 100000,
                paidAmount: 1150000,
                usedAt: '2026-10-10T14:15:00Z',
              },
            ],
            topCustomers: [
              {
                customerCode: 'KH-2024-001',
                fullName: 'Nguyễn Thị Thùy Dung',
                usageCount: 2,
              },
              {
                customerCode: 'KH-2024-042',
                fullName: 'Trần Minh Anh',
                usageCount: 1,
              },
            ],
          },
        }
      }
    )
  },
}

