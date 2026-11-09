import { ApiClientError } from '../lib/api-client'

/** Thông báo lỗi tiếng Việt cho toast từ lỗi API hoặc lỗi bất kỳ. */
export function getErrorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại'): string {
  if (error instanceof ApiClientError) return cleanErrorMessage(error.message)
  if (error instanceof Error && error.message) return cleanErrorMessage(error.message)
  return fallback
}

/** Ẩn mã lỗi kỹ thuật trong ngoặc khỏi thông báo hiển thị cho người dùng. */
export function cleanErrorMessage(message: string): string {
  return message
    .replace(/\s*\([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\)/g, '')
    .replace(/\s*\(HTTP\s+\d{3}\)/gi, '')
    .trim()
}

export function getErrorCode(error: unknown): string | null {
  return error instanceof ApiClientError ? error.errorCode : null
}
