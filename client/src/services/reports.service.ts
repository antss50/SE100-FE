import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse } from '../types/api'
import type {
  CustomerReport,
  DashboardData,
  PromotionEffect,
  PurchaseReport,
  ReportParams,
  RevenueReport,
  SalesReport,
  StockReport,
} from '../types/reports'
import { toQueryString } from './query'

export const reportsService = {
  /** REP-02: GET /reports/revenue */
  revenue(params: ReportParams): Promise<ApiSuccessResponse<RevenueReport>> {
    return apiRequest<RevenueReport>(`/reports/revenue${toQueryString(params)}`, { method: 'GET' })
  },

  /** REP-03: GET /reports/sales */
  sales(params: ReportParams): Promise<ApiSuccessResponse<SalesReport>> {
    return apiRequest<SalesReport>(`/reports/sales${toQueryString(params)}`, { method: 'GET' })
  },

  /** REP-04: GET /reports/stock */
  stock(params: ReportParams): Promise<ApiSuccessResponse<StockReport>> {
    return apiRequest<StockReport>(`/reports/stock${toQueryString(params)}`, { method: 'GET' })
  },

  /** REP-05: GET /reports/purchases */
  purchases(params: ReportParams): Promise<ApiSuccessResponse<PurchaseReport>> {
    return apiRequest<PurchaseReport>(`/reports/purchases${toQueryString(params)}`, { method: 'GET' })
  },

  /** REP-06: GET /reports/customers */
  customers(params: ReportParams): Promise<ApiSuccessResponse<CustomerReport>> {
    return apiRequest<CustomerReport>(`/reports/customers${toQueryString(params)}`, { method: 'GET' })
  },

  /** REP-01: GET /reports/dashboard */
  dashboard(): Promise<ApiSuccessResponse<DashboardData>> {
    return apiRequest<DashboardData>('/reports/dashboard', { method: 'GET' })
  },

  /** PROM-04: GET /promotions/{id}/effect */
  promotionEffect(id: number | string, params: ReportParams): Promise<ApiSuccessResponse<PromotionEffect>> {
    return apiRequest<PromotionEffect>(`/promotions/${id}/effect${toQueryString(params)}`, { method: 'GET' })
  },
}
