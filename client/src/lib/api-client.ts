import { useAuthStore } from '../app/store'
import type { ApiErrorResponse, ApiSuccessResponse } from '../types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export class ApiClientError extends Error {
  status: number
  errorCode: string
  errors?: unknown[]

  constructor(status: number, payload: ApiErrorResponse) {
    super(payload.message || 'Đã có lỗi xảy ra')
    this.name = 'ApiClientError'
    this.status = status
    this.errorCode = payload.errorCode || 'UNKNOWN_ERROR'
    this.errors = payload.errors
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  fallbackHandler?: () => Promise<ApiSuccessResponse<T>> | ApiSuccessResponse<T>
): Promise<ApiSuccessResponse<T>> {
  const { accessToken, refreshToken, setTokens, clearSession } = useAuthStore.getState()

  const headers = new Headers(options.headers || {})
  if (
    !headers.has('Content-Type') &&
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh-token')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    // Try refresh token rotation on 401 if we have a real refreshToken
    if (
      response.status === 401 &&
      refreshToken &&
      !refreshToken.startsWith('demo-') &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/refresh-token')
    ) {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json()
        if (refreshJson?.success && refreshJson?.data?.accessToken) {
          setTokens(refreshJson.data.accessToken, refreshJson.data.refreshToken)
          headers.set('Authorization', `Bearer ${refreshJson.data.accessToken}`)
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          })
        } else {
          clearSession()
        }
      } else {
        clearSession()
      }
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      // Vite dev server returned index.html or non-JSON 404 -> use fallback
      if (fallbackHandler) {
        return await fallbackHandler()
      }
    }

    const json = await response.json()

    if (!response.ok || json.success === false) {
      throw new ApiClientError(response.status, {
        success: false,
        errorCode: json.errorCode || 'HTTP_ERROR',
        message: json.message || 'Yêu cầu thất bại',
        errors: json.errors,
      })
    }

    return json as ApiSuccessResponse<T>
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err
    }
    if (fallbackHandler) {
      return await fallbackHandler()
    }
    throw new ApiClientError(500, {
      success: false,
      errorCode: 'NETWORK_ERROR',
      message: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
    })
  }
}

