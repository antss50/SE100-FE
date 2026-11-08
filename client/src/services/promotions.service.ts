import { apiRequest } from '../lib/api-client'
import type {
  ApiSuccessResponse,
  CreatePromotionRequest,
  LoyaltyConfigData,
  PaginatedData,
  PromotionItem,
  PromotionReportData,
} from '../types/api'
import { toQueryString } from './query'

const code = (voucherCode: string) => encodeURIComponent(voucherCode)

export const promotionsService = {
  /** CUS-05: GET /loyalty-config */
  getLoyaltyConfig(): Promise<ApiSuccessResponse<LoyaltyConfigData>> {
    return apiRequest<LoyaltyConfigData>('/loyalty-config', { method: 'GET' })
  },

  /** CUS-05: PUT /loyalty-config */
  updateLoyaltyConfig(payload: LoyaltyConfigData): Promise<ApiSuccessResponse<LoyaltyConfigData>> {
    const body = {
      amountPerPoint: Number(payload.amountPerPoint),
      redemptionValuePerPoint: payload.redemptionValuePerPoint,
      tiers: payload.tiers.map((t) => ({ tier: t.tier, minSpend: Number(t.minSpend) })),
    }
    return apiRequest<LoyaltyConfigData>('/loyalty-config', { method: 'PUT', body: JSON.stringify(body) })
  },

  /** PROM-01: GET /promotions */
  getPromotions(
    params: { page?: number; pageSize?: number; keyword?: string; status?: string } = {}
  ): Promise<ApiSuccessResponse<PaginatedData<PromotionItem>>> {
    return apiRequest<PaginatedData<PromotionItem>>(`/promotions${toQueryString(params)}`, { method: 'GET' })
  },

  /** PROM-02: POST /promotions */
  createPromotion(payload: CreatePromotionRequest): Promise<ApiSuccessResponse<PromotionItem>> {
    return apiRequest<PromotionItem>('/promotions', { method: 'POST', body: JSON.stringify(payload) })
  },

  /** PROM-02: PUT /promotions/{voucherCode} */
  updatePromotion(
    voucherCode: string,
    payload: Partial<CreatePromotionRequest>
  ): Promise<ApiSuccessResponse<PromotionItem>> {
    return apiRequest<PromotionItem>(`/promotions/${code(voucherCode)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  /** PROM-02: PATCH /promotions/{voucherCode}/pause (đảo ACTIVE ↔ PAUSED) */
  togglePausePromotion(voucherCode: string): Promise<ApiSuccessResponse<{ voucherCode: string; status: string }>> {
    return apiRequest<{ voucherCode: string; status: string }>(`/promotions/${code(voucherCode)}/pause`, {
      method: 'PATCH',
    })
  },

  /** PROM-04: GET /promotions/{voucherCode}/report */
  getPromotionReport(voucherCode: string): Promise<ApiSuccessResponse<PromotionReportData>> {
    return apiRequest<PromotionReportData>(`/promotions/${code(voucherCode)}/report`, { method: 'GET' })
  },
}
