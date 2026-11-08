import type { z } from 'zod'
import type { PermissionCode } from '../domain/permissions'
import type { ApiErrorResponse, ApiSuccessResponse, PaginatedData } from '../types/api'
import type { MockTransaction } from './db'
import type { MockUser } from './seed/users'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface MockResponse {
  status: number
  body: ApiSuccessResponse<unknown> | ApiErrorResponse
}

export interface MockContext {
  method: HttpMethod
  path: string
  params: Record<string, string>
  query: URLSearchParams
  /** JSON đã parse, hoặc `FormData` nguyên bản. */
  body: unknown
  headers: Headers
  db: MockTransaction
  /** Người gọi (theo token). `null` với route công khai chưa đăng nhập. */
  user: MockUser | null
  permissions: PermissionCode[]
  accessToken: string | null
  now: Date
}

/** Lỗi nghiệp vụ: router trả envelope lỗi và **không** ghi dữ liệu. */
export class MockHttpError extends Error {
  readonly status: number
  readonly errorCode: string
  readonly errors?: { field: string; message: string }[]

  constructor(
    status: number,
    errorCode: string,
    message: string,
    errors?: { field: string; message: string }[]
  ) {
    super(message)
    this.status = status
    this.errorCode = errorCode
    this.errors = errors
  }
}

export function ok<T>(data: T, message?: string, status = 200): MockResponse {
  return { status, body: { success: true, message, data } }
}

/**
 * Trả lỗi nhưng **vẫn ghi** các thay đổi đã làm (ví dụ tăng số lần đăng nhập sai).
 * Muốn hủy mọi thay đổi thì `throw new MockHttpError(...)`.
 */
export function failAndCommit(status: number, errorCode: string, message: string): MockResponse {
  return { status, body: { success: false, errorCode, message } }
}

export function notFound(errorCode: string, message: string): MockHttpError {
  return new MockHttpError(404, errorCode, message)
}

/** Kiểm body bằng Zod; sai thì 400 `COMMON_VALIDATION_FAILED` kèm danh sách lỗi theo trường. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))
    throw new MockHttpError(
      400,
      'COMMON_VALIDATION_FAILED',
      errors[0]?.message ?? 'Dữ liệu không hợp lệ',
      errors
    )
  }
  return result.data
}

export function paginate<T>(items: T[], query: URLSearchParams, defaultPageSize = 20): PaginatedData<T> {
  const page = Math.max(1, Number(query.get('page')) || 1)
  const pageSize = Math.max(1, Number(query.get('pageSize')) || defaultPageSize)
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, totalItems: items.length }
}

export const keywordOf = (query: URLSearchParams) => (query.get('keyword') ?? '').trim().toLowerCase()

export const sameText = (a: string | undefined | null, b: string | undefined | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
