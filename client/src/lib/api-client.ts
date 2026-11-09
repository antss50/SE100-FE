import { useAuthStore } from '../app/store'
import type { ApiErrorResponse, ApiSuccessResponse } from '../types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

/** Bật bằng `VITE_USE_MOCK=true`. Tắt thì chỉ gọi API thật; lỗi hiện ra, không rơi về mock. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export class ApiClientError extends Error {
  status: number
  errorCode: string
  errors?: unknown[]

  constructor(status: number, payload: ApiErrorResponse) {
    super((payload.message || 'Đã có lỗi xảy ra')
      .replace(/\s*\([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\)/g, '')
      .replace(/\s*\(HTTP\s+\d{3}\)/gi, '')
      .trim())
    this.name = 'ApiClientError'
    this.status = status
    this.errorCode = payload.errorCode || 'UNKNOWN_ERROR'
    this.errors = payload.errors
  }
}

/** Gửi request tới mock adapter hoặc server thật. Chỉ file này biết đến `mocks/`. */
async function send(endpoint: string, init: RequestInit): Promise<Response> {
  if (USE_MOCK) {
    const { handleMockRequest } = await import('../mocks')
    return handleMockRequest(endpoint, init)
  }
  return fetch(`${API_BASE_URL}${endpoint}`, init)
}

const isAuthEndpoint = (endpoint: string) =>
  endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/refresh-token')

async function tryRefreshToken(refreshToken: string): Promise<string | null> {
  const { setTokens, clearSession } = useAuthStore.getState()
  try {
    const res = await send('/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const json = res.ok ? await res.json() : null
    if (json?.success && json.data?.accessToken) {
      setTokens(json.data.accessToken, json.data.refreshToken)
      return json.data.accessToken as string
    }
  } catch {
    // Mất kết nối khi làm mới token: coi như phiên hết hạn.
  }
  clearSession()
  return null
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiSuccessResponse<T>> {
  const { accessToken, refreshToken } = useAuthStore.getState()

  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken && !isAuthEndpoint(endpoint)) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let response: Response
  try {
    response = await send(endpoint, { ...options, headers })
    if (response.status === 401 && refreshToken && !isAuthEndpoint(endpoint)) {
      const newToken = await tryRefreshToken(refreshToken)
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`)
        response = await send(endpoint, { ...options, headers })
      }
    }
  } catch {
    throw new ApiClientError(0, {
      success: false,
      errorCode: 'NETWORK_ERROR',
      message: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
    })
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new ApiClientError(response.status, {
      success: false,
      errorCode: 'HTTP_ERROR',
      message: `Máy chủ trả về dữ liệu không hợp lệ (HTTP ${response.status})`,
    })
  }

  const json = await response.json()
  if (!response.ok || json.success === false) {
    if (response.status === 401 && !isAuthEndpoint(endpoint)) {
      useAuthStore.getState().clearSession()
    }
    throw new ApiClientError(response.status, {
      success: false,
      errorCode: json.errorCode || 'HTTP_ERROR',
      message: json.message || 'Yêu cầu thất bại',
      errors: json.errors,
    })
  }

  return json as ApiSuccessResponse<T>
}
