import { z } from 'zod'
import type { SettingItem, SettingKey, SettingsData, StoreInfo } from '../../types/settings'
import { MockHttpError, ok, parseBody } from '../http'
import type { MockRoute } from '../router'
import { writeAudit } from '../audit'

const SETTING_META: Record<SettingKey, { description: string; kind: 'number' | 'text' }> = {
  POINT_EARN_AMOUNT: { description: 'Số tiền (đ) khách trả để được 1 điểm', kind: 'number' },
  POINT_REDEEM_VALUE: { description: 'Giá trị 1 điểm khi đổi (đ)', kind: 'number' },
  POINT_MAX_REDEEM_PERCENT: { description: 'Tối đa % giá trị đơn được trừ bằng điểm', kind: 'number' },
  STORE_NAME: { description: 'Tên cửa hàng in trên hóa đơn', kind: 'text' },
  STORE_ADDRESS: { description: 'Địa chỉ in trên hóa đơn', kind: 'text' },
  STORE_PHONE: { description: 'Số điện thoại in trên hóa đơn', kind: 'text' },
}
const KEYS = Object.keys(SETTING_META) as SettingKey[]

const updateSchema = z.object({
  settings: z.record(z.string(), z.string()).default({}),
  maxReturnDays: z.number().int().min(0, 'Số ngày đổi trả không được âm').max(365, 'Tối đa 365 ngày').optional(),
})

export const settingsRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/settings/store',
    handler: ({ db }) => {
      const s = db.read('systemSettings')
      const info: StoreInfo = { name: s.STORE_NAME ?? '', address: s.STORE_ADDRESS ?? '', phone: s.STORE_PHONE ?? '' }
      return ok(info, 'Lấy thông tin cửa hàng thành công')
    },
  },
  {
    method: 'GET',
    path: '/settings',
    permission: 'SYSTEM_SETTINGS_MANAGE',
    handler: ({ db }) => {
      const stored = db.read('systemSettings')
      const policy = db.read('returnPolicies').find((p) => p.isDefault) ?? db.read('returnPolicies')[0]
      const data: SettingsData = {
        settings: KEYS.map((key): SettingItem => ({ key, value: stored[key] ?? '', ...SETTING_META[key] })),
        maxReturnDays: policy?.maxReturnDays ?? 7,
      }
      return ok(data, 'Lấy cấu hình hệ thống thành công')
    },
  },
  {
    method: 'PUT',
    path: '/settings',
    permission: 'SYSTEM_SETTINGS_MANAGE',
    handler: ({ db, body, user, now }) => {
      const input = parseBody(updateSchema, body)
      const stored = db.read('systemSettings')
      const changed: string[] = []
      const changedBefore: Record<string, unknown> = {}
      const changedAfter: Record<string, unknown> = {}
      for (const [key, raw] of Object.entries(input.settings)) {
        if (!KEYS.includes(key as SettingKey)) {
          throw new MockHttpError(422, 'SET_KEY_UNKNOWN', `Không có tham số cấu hình ${key}`)
        }
        const value = raw.trim()
        const meta = SETTING_META[key as SettingKey]
        if (meta.kind === 'number') {
          const n = Number(value)
          const min = 1
          if (!Number.isInteger(n) || n < min) {
            throw new MockHttpError(422, 'SET_VALUE_INVALID', `${meta.description}: phải là số nguyên từ ${min} trở lên`)
          }
          if (key === 'POINT_MAX_REDEEM_PERCENT' && n > 100) {
            throw new MockHttpError(422, 'SET_VALUE_INVALID', 'Tỷ lệ điểm tối đa không được vượt quá 100%')
          }
        } else if (!value) {
          throw new MockHttpError(422, 'SET_VALUE_INVALID', `${meta.description}: không được để trống`)
        }
        if (stored[key] !== value) {
          changed.push(`${key}=${value}`)
          changedBefore[key] = stored[key] ?? null
          changedAfter[key] = value
        }
        stored[key] = value
      }
      db.touch('systemSettings')
      if (input.maxReturnDays !== undefined) {
        const policies = db.read('returnPolicies')
        const policy = policies.find((p) => p.isDefault) ?? policies[0]
        if (policy && policy.maxReturnDays !== input.maxReturnDays) {
          changed.push(`max_return_days=${input.maxReturnDays}`)
          changedBefore.max_return_days = policy.maxReturnDays
          changedAfter.max_return_days = input.maxReturnDays
          policy.maxReturnDays = input.maxReturnDays
          db.touch('returnPolicies')
        }
      }
      if (changed.length > 0) {
        writeAudit(db, user, now, {
          action: 'UPDATE_SETTING',
          module: 'SETTING',
          entityType: 'SYSTEM_SETTINGS',
          details: { before: changedBefore, after: changedAfter },
        })
      }
      const policy = db.read('returnPolicies').find((p) => p.isDefault) ?? db.read('returnPolicies')[0]
      const data: SettingsData = {
        settings: KEYS.map((key): SettingItem => ({ key, value: stored[key] ?? '', ...SETTING_META[key] })),
        maxReturnDays: policy?.maxReturnDays ?? 7,
      }
      return ok(data, 'Đã lưu cấu hình hệ thống')
    },
  },
]
