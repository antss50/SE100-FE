import { ApiClientError } from '../lib/api-client'

/** Thông báo lỗi tiếng Việt cho toast từ lỗi API hoặc lỗi bất kỳ. */
export function getErrorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại'): string {
  if (error instanceof ApiClientError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function getErrorCode(error: unknown): string | null {
  return error instanceof ApiClientError ? error.errorCode : null
}
