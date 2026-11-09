// Tiện ích test dùng chung: gọi API qua apiRequest + mock (đúng đường màn hình dùng).
import { expect } from 'vitest'
import { useAuthStore } from '../app/store'
import { ApiClientError, apiRequest } from '../lib/api-client'
import type { LoginResponseData } from '../types/api'
import { resetMockDb } from '../mocks/index'

export const PASSWORD = 'Password@123'
export const post = (body: unknown = {}, headers?: Record<string, string>): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers,
})
export const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) })
export const patch = (body: unknown = {}): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) })

export function freshDb(): void {
  useAuthStore.getState().clearSession()
  resetMockDb()
}

let currentUser = ''

/** Chạy fn bằng tài khoản khác (mặc định admin) rồi quay lại tài khoản đang dùng. */
export async function peek<T>(fn: () => Promise<T>, user = 'admin'): Promise<T> {
  const back = currentUser
  await loginAs(user)
  try {
    return await fn()
  } finally {
    if (back) await loginAs(back)
  }
}

export async function loginAs(username: string): Promise<void> {
  currentUser = username
  const res = await apiRequest<LoginResponseData>('/auth/login', post({ username, password: PASSWORD }))
  useAuthStore.getState().setSession(res.data)
}

export async function get<T>(endpoint: string): Promise<T> {
  return (await apiRequest<T>(endpoint)).data
}

export async function send<T>(endpoint: string, init: RequestInit): Promise<T> {
  return (await apiRequest<T>(endpoint, init)).data
}

export async function fails(endpoint: string, init?: RequestInit): Promise<ApiClientError> {
  try {
    await apiRequest(endpoint, init)
  } catch (err) {
    if (err instanceof ApiClientError) return err
    throw err
  }
  throw new Error(`Mong đợi ${endpoint} lỗi nhưng thành công`)
}

export async function expectFail(endpoint: string, init: RequestInit | undefined, status: number, errorCode: string) {
  const err = await fails(endpoint, init)
  expect({ status: err.status, errorCode: err.errorCode }).toEqual({ status, errorCode })
  return err
}

export interface Page<T> {
  items: T[]
  totalItems: number
}
