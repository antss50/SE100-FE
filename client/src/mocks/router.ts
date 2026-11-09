import {
  ADMIN_LOCKED_PERMISSIONS,
  hasPermission,
  isPermissionCode,
  type PermissionCode,
  type PermissionRequirement,
} from '../domain/permissions'
import { auditAfterRequest } from './audit'
import { MockTransaction } from './db'
import { MockHttpError, type HttpMethod, type MockContext, type MockResponse } from './http'
import type { MockUser } from './seed/users'

export interface MockRoute {
  method: HttpMethod
  /** Ví dụ `/products/:sku/images/:imageId`. */
  path: string
  /** `public`: không cần đăng nhập. Mặc định cần đăng nhập. */
  public?: boolean
  /** Quyền cần có (mảng = một trong các quyền). Bỏ trống = chỉ cần đăng nhập. */
  permission?: PermissionRequirement
  handler: (ctx: MockContext) => MockResponse | Promise<MockResponse>
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean)
  const b = path.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}

/** Quyền hiệu lực của user theo bảng roles hiện tại trong mock. */
export function permissionsOfUser(db: MockTransaction, user: MockUser): PermissionCode[] {
  const roles = db.read('roles').filter((r) => user.roles.includes(r.roleCode))
  const permissions = db.read('permissions')
  const ids = new Set(roles.flatMap((r) => r.permissionIds))
  const codes = new Set<PermissionCode>(
    permissions.filter((p) => ids.has(p.id)).map((p) => p.permissionCode)
  )
  if (user.roles.includes('ADMIN')) ADMIN_LOCKED_PERMISSIONS.forEach((c) => codes.add(c))
  return permissions.map((p) => p.permissionCode).filter((c) => codes.has(c) && isPermissionCode(c))
}

function bearerToken(headers: Headers): string | null {
  const value = headers.get('Authorization') ?? ''
  return value.startsWith('Bearer ') ? value.slice(7) : null
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') {
    if (!body) return undefined
    try {
      return JSON.parse(body)
    } catch {
      throw new MockHttpError(400, 'COMMON_VALIDATION_FAILED', 'Body không phải JSON hợp lệ')
    }
  }
  return body
}

export async function dispatch(
  routes: MockRoute[],
  method: HttpMethod,
  endpoint: string,
  init: RequestInit
): Promise<MockResponse> {
  const url = new URL(endpoint, 'http://mock.local')
  const path = url.pathname.replace(/\/+$/, '') || '/'

  let matched: { route: MockRoute; params: Record<string, string> } | null = null
  let pathExists = false
  for (const route of routes) {
    const params = matchPath(route.path, path)
    if (!params) continue
    pathExists = true
    if (route.method === method) {
      matched = { route, params }
      break
    }
  }
  if (!matched) {
    return pathExists
      ? { status: 405, body: { success: false, errorCode: 'COMMON_METHOD_NOT_ALLOWED', message: `Không hỗ trợ ${method} ${path}` } }
      : { status: 404, body: { success: false, errorCode: 'COMMON_NOT_FOUND', message: `Không có API ${method} ${path}` } }
  }

  const db = new MockTransaction()
  const headers = new Headers(init.headers)
  const accessToken = bearerToken(headers)
  try {
    let user: MockUser | null = null
    if (accessToken) {
      const session = db.read('sessions').find((s) => s.accessToken === accessToken)
      user = session ? (db.read('users').find((u) => u.id === session.userId) ?? null) : null
      if (user?.status === 'LOCKED') user = null
    }
    const { route, params } = matched
    if (!route.public && !user) {
      throw new MockHttpError(401, 'AUTH_UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
    }
    // Luật 47: chưa đổi mật khẩu lần đầu thì chỉ được gọi nhóm /auth.
    if (user?.mustChangePassword && !route.public && !route.path.startsWith('/auth/')) {
      throw new MockHttpError(403, 'AUTH_PASSWORD_CHANGE_REQUIRED', 'Bạn cần đổi mật khẩu lần đầu trước khi sử dụng hệ thống')
    }
    const permissions = user ? permissionsOfUser(db, user) : []
    if (!route.public && !hasPermission(permissions, route.permission)) {
      throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này')
    }

    const ctx: MockContext = {
      method,
      path,
      params,
      query: url.searchParams,
      body: parseBody(init.body),
      headers,
      db,
      user,
      permissions,
      accessToken,
      now: new Date(),
    }
    const response = await route.handler(ctx)
    if (method !== 'GET') auditAfterRequest(db, { method, path, body: ctx.body, user, now: ctx.now }, response)
    db.commit()
    return response
  } catch (err) {
    if (err instanceof MockHttpError) {
      return {
        status: err.status,
        body: { success: false, errorCode: err.errorCode, message: err.message, errors: err.errors },
      }
    }
    return {
      status: 500,
      body: {
        success: false,
        errorCode: 'COMMON_INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Lỗi không xác định trong mock',
      },
    }
  }
}
