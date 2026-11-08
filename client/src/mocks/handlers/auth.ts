import { z } from 'zod'
import type { AuthUser, LoginResponseData, RefreshTokenResponseData } from '../../types/api'
import type { MockTransaction } from '../db'
import { MockHttpError, failAndCommit, ok, parseBody, sameText } from '../http'
import { permissionsOfUser, type MockRoute } from '../router'
import type { MockUser } from '../seed/users'
import { addMinutes, toIsoLocal } from '../time'

/** Luật 46: sai 5 lần thì khóa 15 phút. */
export const MAX_FAILED_LOGIN = 5
export const TEMP_LOCK_MINUTES = 15
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

const refreshSchema = z.object({ refreshToken: z.string().min(1, 'Thiếu refresh token') })

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(1, 'Vui lòng nhập mật khẩu mới'),
})

const logoutSchema = z.object({ refreshToken: z.string().optional() }).optional()

export function toAuthUser(db: MockTransaction, user: MockUser): AuthUser {
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    mustChangePassword: Boolean(user.mustChangePassword),
    roles: user.roles,
    permissions: permissionsOfUser(db, user),
  }
}

function issueTokens(db: MockTransaction, userId: number, now: Date) {
  const seq = db.nextSeq('session')
  return {
    accessToken: `mock-at-${userId}-${seq}`,
    refreshToken: `mock-rt-${userId}-${seq}`,
    userId,
    createdAt: toIsoLocal(now),
  }
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const authRoutes: MockRoute[] = [
  {
    method: 'POST',
    path: '/auth/login',
    public: true,
    handler: ({ db, body, now }) => {
      const input = parseBody(loginSchema, body)
      const users = db.read('users')
      const user = users.find(
        (u) =>
          sameText(u.username, input.username) ||
          sameText(u.employeeCode, input.username) ||
          sameText(u.employeeCode.replace('-', ''), input.username)
      )
      if (!user) {
        throw new MockHttpError(401, 'AUTH_INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không chính xác')
      }
      if (user.status === 'LOCKED') {
        throw new MockHttpError(403, 'AUTH_ACCOUNT_LOCKED', 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên')
      }
      if (user.lockedUntil && new Date(user.lockedUntil) > now) {
        throw new MockHttpError(
          403,
          'AUTH_ACCOUNT_TEMP_LOCKED',
          `Tài khoản tạm khóa do nhập sai ${MAX_FAILED_LOGIN} lần. Thử lại sau ${formatTime(user.lockedUntil)}`
        )
      }

      const expected = db.read('passwords')[String(user.id)]
      if (input.password !== expected) {
        const failed = (user.failedLoginCount ?? 0) + 1
        db.touch('users')
        if (failed >= MAX_FAILED_LOGIN) {
          user.failedLoginCount = 0
          user.lockedUntil = toIsoLocal(addMinutes(now, TEMP_LOCK_MINUTES))
          return failAndCommit(
            403,
            'AUTH_ACCOUNT_TEMP_LOCKED',
            `Tài khoản tạm khóa ${TEMP_LOCK_MINUTES} phút do nhập sai ${MAX_FAILED_LOGIN} lần`
          )
        }
        user.failedLoginCount = failed
        return failAndCommit(
          401,
          'AUTH_INVALID_CREDENTIALS',
          `Tên đăng nhập hoặc mật khẩu không chính xác (sai ${failed}/${MAX_FAILED_LOGIN})`
        )
      }

      user.failedLoginCount = 0
      user.lockedUntil = null
      user.lastLoginAt = toIsoLocal(now)
      db.touch('users')
      const session = issueTokens(db, user.id, now)
      db.write('sessions', [...db.read('sessions'), session])
      const data: LoginResponseData = {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: toAuthUser(db, user),
      }
      return ok(data, 'Đăng nhập thành công')
    },
  },
  {
    method: 'POST',
    path: '/auth/refresh-token',
    public: true,
    handler: ({ db, body, now }) => {
      const input = parseBody(refreshSchema, body)
      const sessions = db.read('sessions')
      const current = sessions.find((s) => s.refreshToken === input.refreshToken)
      const user = current && db.read('users').find((u) => u.id === current.userId)
      if (!current || !user || user.status === 'LOCKED') {
        throw new MockHttpError(401, 'AUTH_REFRESH_TOKEN_INVALID', 'Refresh token không hợp lệ hoặc đã hết hạn')
      }
      const next = issueTokens(db, current.userId, now)
      db.write('sessions', [...sessions.filter((s) => s !== current), next])
      const data: RefreshTokenResponseData = { accessToken: next.accessToken, refreshToken: next.refreshToken }
      return ok(data, 'Làm mới token thành công')
    },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    public: true,
    handler: ({ db, body, accessToken }) => {
      const input = parseBody(logoutSchema, body)
      const sessions = db.read('sessions')
      db.write(
        'sessions',
        sessions.filter((s) => s.accessToken !== accessToken && s.refreshToken !== input?.refreshToken)
      )
      return ok(null, 'Đăng xuất thành công')
    },
  },
  {
    method: 'POST',
    path: '/auth/change-password',
    handler: ({ db, body, user }) => {
      const input = parseBody(changePasswordSchema, body)
      const me = db.read('users').find((u) => u.id === user?.id)
      const passwords = db.read('passwords')
      if (!me || passwords[String(me.id)] !== input.oldPassword) {
        throw new MockHttpError(400, 'AUTH_OLD_PASSWORD_INCORRECT', 'Mật khẩu hiện tại không đúng')
      }
      if (!PASSWORD_POLICY.test(input.newPassword)) {
        throw new MockHttpError(
          422,
          'AUTH_PASSWORD_POLICY_VIOLATED',
          'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số'
        )
      }
      passwords[String(me.id)] = input.newPassword
      db.touch('passwords')
      me.mustChangePassword = false
      db.touch('users')
      return ok(null, 'Đổi mật khẩu thành công')
    },
  },
]
