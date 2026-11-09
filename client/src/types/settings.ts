/** Cấu hình hệ thống (SYSTEM_SETTINGS) và chính sách đổi trả (RETURN_POLICIES.max_return_days). */

export type SettingKey =
  | 'POINT_EARN_AMOUNT'
  | 'POINT_REDEEM_VALUE'
  | 'POINT_MAX_REDEEM_PERCENT'
  | 'STORE_NAME'
  | 'STORE_ADDRESS'
  | 'STORE_PHONE'

export interface SettingItem {
  key: SettingKey
  value: string
  description: string
  /** `number` hoặc `text`: kiểu ô nhập. */
  kind: 'number' | 'text'
}

export interface SettingsData {
  settings: SettingItem[]
  /** RETURN_POLICIES.max_return_days của chính sách mặc định. */
  maxReturnDays: number
}

export interface UpdateSettingsRequest {
  settings: Partial<Record<SettingKey, string>>
  maxReturnDays?: number
}

/** Thông tin cửa hàng in trên hóa đơn (mọi người dùng đã đăng nhập đọc được). */
export interface StoreInfo {
  name: string
  address: string
  phone: string
}
