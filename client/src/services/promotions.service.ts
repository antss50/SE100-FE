import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, LoyaltyConfigData, PaginatedData } from '../types/api'
import type { GetPromotionsParams, PromotionInput, PromotionStatus, PromotionView } from '../types/promotions'
import { toQueryString } from './query'

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
  list(params: GetPromotionsParams = {}): Promise<ApiSuccessResponse<PaginatedData<PromotionView>>> {
    return apiRequest<PaginatedData<PromotionView>>(`/promotions${toQueryString(params)}`, { method: 'GET' })
  },

  /** PROM-01: GET /promotions/{id} */
  get(id: number): Promise<ApiSuccessResponse<PromotionView>> {
    return apiRequest<PromotionView>(`/promotions/${id}`, { method: 'GET' })
  },

  /** PROM-02: POST /promotions */
  create(payload: PromotionInput & { status?: 'DRAFT' | 'ACTIVE' }): Promise<ApiSuccessResponse<PromotionView>> {
    return apiRequest<PromotionView>('/promotions', { method: 'POST', body: JSON.stringify(payload) })
  },

  /** PROM-02: PUT /promotions/{id} */
  update(id: number, payload: PromotionInput & { status?: 'DRAFT' | 'ACTIVE' }): Promise<ApiSuccessResponse<PromotionView>> {
    return apiRequest<PromotionView>(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
  },

  /** PROM-02: PATCH /promotions/{id}/status */
  setStatus(id: number, status: Extract<PromotionStatus, 'ACTIVE' | 'PAUSED'>): Promise<ApiSuccessResponse<PromotionView>> {
    return apiRequest<PromotionView>(`/promotions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  },
}
