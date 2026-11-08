import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse, CurrentShiftResponseData, ShiftInfo } from '../types/api'

export const shiftsService = {
  /** GET /shifts/current — ca đang mở của người đăng nhập. */
  getCurrentShift(): Promise<ApiSuccessResponse<CurrentShiftResponseData>> {
    return apiRequest<CurrentShiftResponseData>('/shifts/current', { method: 'GET' })
  },

  /** POS-01: POST /shifts/open */
  openShift(openingCash: number): Promise<ApiSuccessResponse<ShiftInfo>> {
    return apiRequest<ShiftInfo>('/shifts/open', { method: 'POST', body: JSON.stringify({ openingCash }) })
  },

  /** POS-05 (tạm, GĐ5 bổ sung kiểm đếm): POST /shifts/{shiftId}/close */
  closeShift(shiftId: number): Promise<ApiSuccessResponse<ShiftInfo>> {
    return apiRequest<ShiftInfo>(`/shifts/${shiftId}/close`, { method: 'POST', body: JSON.stringify({}) })
  },
}
