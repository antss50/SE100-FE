import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, CurrentShiftResponseData, PaginatedData } from '../types/api'
import type { CashierShift, CloseShiftRequest, GetShiftsParams, ShiftDetail, ShiftSummary } from '../types/pos'
import { toQueryString } from './query'

export type ShiftListItem = CashierShift & { summary: ShiftSummary }

export const shiftsService = {
  /** GET /shifts/current — ca đang mở của người đăng nhập. */
  getCurrentShift(): Promise<ApiSuccessResponse<CurrentShiftResponseData>> {
    return apiRequest<CurrentShiftResponseData>('/shifts/current', { method: 'GET' })
  },

  /** POS-05: GET /shifts (lịch sử ca). */
  list(params: GetShiftsParams = {}): Promise<ApiSuccessResponse<PaginatedData<ShiftListItem>>> {
    return apiRequest<PaginatedData<ShiftListItem>>(`/shifts${toQueryString(params)}`, { method: 'GET' })
  },

  /** POS-05: GET /shifts/{id} (chi tiết, biên bản ca). */
  detail(id: number | string): Promise<ApiSuccessResponse<ShiftDetail>> {
    return apiRequest<ShiftDetail>(`/shifts/${id}`, { method: 'GET' })
  },

  /** POS-01: POST /shifts/open */
  openShift(openingCash: number): Promise<ApiSuccessResponse<CashierShift>> {
    return apiRequest<CashierShift>('/shifts/open', { method: 'POST', body: JSON.stringify({ openingCash }) })
  },

  /** POS-05: POST /shifts/{id}/close */
  closeShift(id: number, payload: CloseShiftRequest): Promise<ApiSuccessResponse<{ shift: CashierShift; summary: ShiftSummary }>> {
    return apiRequest<{ shift: CashierShift; summary: ShiftSummary }>(`/shifts/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  /** POS-05: POST /shifts/{id}/confirm-handover */
  confirmHandover(id: number): Promise<ApiSuccessResponse<CashierShift>> {
    return apiRequest<CashierShift>(`/shifts/${id}/confirm-handover`, { method: 'POST', body: JSON.stringify({}) })
  },
}
