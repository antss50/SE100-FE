import { apiRequest } from '../lib/api-client'
import type { ApiSuccessResponse } from '../types/api'
import type { SettingsData, StoreInfo, UpdateSettingsRequest } from '../types/settings'

export const settingsService = {
  /** GET /settings/store — tên, địa chỉ, SĐT in trên hóa đơn (mọi người dùng đã đăng nhập). */
  store(): Promise<ApiSuccessResponse<StoreInfo>> {
    return apiRequest<StoreInfo>('/settings/store', { method: 'GET' })
  },
  /** AUTH-07: GET /settings */
  get(): Promise<ApiSuccessResponse<SettingsData>> {
    return apiRequest<SettingsData>('/settings', { method: 'GET' })
  },
  /** AUTH-07: PUT /settings */
  update(payload: UpdateSettingsRequest): Promise<ApiSuccessResponse<SettingsData>> {
    return apiRequest<SettingsData>('/settings', { method: 'PUT', body: JSON.stringify(payload) })
  },
}
