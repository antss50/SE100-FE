import { useAuthStore } from '../app/store'
import { ApiClientError, apiRequest } from '../lib/api-client'
import { getAllPermissionsFlat, mockDb } from '../lib/mock-db'
import type {
  ApiSuccessResponse,
  ChangePasswordRequest,
  CurrentShiftResponseData,
  LoginRequest,
  LoginResponseData,
  LogoutRequest,
  RefreshTokenRequest,
  RefreshTokenResponseData,
  ShiftInfo,
} from '../types/api'

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export const authService = {
  // UC-AUTH-01: POST /api/v1/auth/login
  async login(payload: LoginRequest): Promise<ApiSuccessResponse<LoginResponseData>> {
    return apiRequest<LoginResponseData>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        const username = payload.username?.trim()
        const password = payload.password

        if (!username || !password) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Tên đăng nhập và mật khẩu là bắt buộc',
          })
        }

        const users = mockDb.getUsers()
        const normalizedInput = username.toLowerCase()
        const matchedUser = users.find(
          (u) =>
            u.username.toLowerCase() === normalizedInput ||
            u.employeeCode.toLowerCase() === normalizedInput ||
            u.employeeCode.replace('-', '').toLowerCase() === normalizedInput
        )

        if (!matchedUser) {
          throw new ApiClientError(401, {
            success: false,
            errorCode: 'AUTH_INVALID_CREDENTIALS',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác',
          })
        }

        if (matchedUser.status === 'LOCKED' || (matchedUser.failedLoginCount ?? 0) >= 5) {
          throw new ApiClientError(403, {
            success: false,
            errorCode: 'AUTH_ACCOUNT_LOCKED',
            message: 'Tài khoản đang bị khóa do nhập sai quá 5 lần hoặc bị vô hiệu hóa',
          })
        }

        const passwords = mockDb.getPasswords()
        const expectedPass = passwords[matchedUser.username] || 'Password@123'

        if (password !== expectedPass && password !== 'Password@123') {
          const nextCount = (matchedUser.failedLoginCount ?? 0) + 1
          matchedUser.failedLoginCount = nextCount
          if (nextCount >= 5) {
            matchedUser.status = 'LOCKED'
            matchedUser.lockReason = 'Khóa tự động 30 phút (Sai mật khẩu 5 lần)'
            matchedUser.lockedDate = new Date().toLocaleDateString('vi-VN')
          }
          mockDb.saveUsers(users)

          if (nextCount >= 5) {
            throw new ApiClientError(403, {
              success: false,
              errorCode: 'AUTH_ACCOUNT_LOCKED',
              message: 'Tài khoản đang bị khóa do nhập sai quá 5 lần hoặc bị vô hiệu hóa',
            })
          }

          throw new ApiClientError(401, {
            success: false,
            errorCode: 'AUTH_INVALID_CREDENTIALS',
            message: `Tên đăng nhập hoặc mật khẩu không chính xác (Lần sai: ${nextCount}/5)`,
          })
        }

        // Reset failedLoginCount on success
        matchedUser.failedLoginCount = 0
        matchedUser.lastLoginAt = 'Vừa xong'
        matchedUser.isOnline = true
        mockDb.saveUsers(users)

        const roles = mockDb.getRoles()
        const allPerms = getAllPermissionsFlat()
        const userRoleObjs = roles.filter((r) => matchedUser.roles.includes(r.roleCode))
        const permIdSet = new Set<number>()
        for (const r of userRoleObjs) {
          for (const pid of r.permissionIds ?? []) {
            permIdSet.add(pid)
          }
        }
        const permissions = allPerms
          .filter((p) => permIdSet.has(p.id))
          .map((p) => p.permissionCode)

        return {
          success: true,
          message: 'Đăng nhập thành công',
          data: {
            accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_${matchedUser.id}_${Date.now()}`,
            refreshToken: `rt-${matchedUser.id}-${Date.now()}`,
            user: {
              id: matchedUser.id,
              employeeCode: matchedUser.employeeCode,
              username: matchedUser.username,
              fullName: matchedUser.fullName,
              email: matchedUser.email,
              phoneNumber: matchedUser.phoneNumber,
              mustChangePassword: Boolean(matchedUser.mustChangePassword),
              roles: matchedUser.roles,
              permissions,
            },
          },
        }
      }
    )
  },

  // UC-AUTH-02: POST /api/v1/auth/refresh-token
  async refreshToken(
    payload: RefreshTokenRequest
  ): Promise<ApiSuccessResponse<RefreshTokenResponseData>> {
    return apiRequest<RefreshTokenResponseData>(
      '/auth/refresh-token',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        if (!payload.refreshToken) {
          throw new ApiClientError(401, {
            success: false,
            errorCode: 'AUTH_REFRESH_TOKEN_INVALID',
            message: 'Refresh token không hợp lệ hoặc đã hết hạn',
          })
        }
        return {
          success: true,
          message: 'Làm mới token thành công',
          data: {
            accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refreshed_${Date.now()}`,
            refreshToken: `rt-rotated-${Date.now()}`,
          },
        }
      }
    )
  },

  // UC-AUTH-03: POST /api/v1/auth/change-password
  async changePassword(
    payload: ChangePasswordRequest
  ): Promise<ApiSuccessResponse<null>> {
    return apiRequest<null>(
      '/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        const currentUser = useAuthStore.getState().user
        const passwords = mockDb.getPasswords()
        const username = currentUser?.username || 'manager01'
        const currentPass = passwords[username] || 'Password@123'

        if (payload.oldPassword !== currentPass && payload.oldPassword !== 'Password@123') {
          throw new ApiClientError(400, {
            success: false,
            errorCode: 'AUTH_OLD_PASSWORD_INCORRECT',
            message: 'Mật khẩu hiện tại không đúng',
          })
        }

        if (!PASSWORD_POLICY_REGEX.test(payload.newPassword)) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'AUTH_PASSWORD_POLICY_VIOLATED',
            message:
              'Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số',
          })
        }

        passwords[username] = payload.newPassword
        mockDb.savePasswords(passwords)

        const users = mockDb.getUsers()
        const u = users.find((item) => item.username === username)
        if (u) {
          u.mustChangePassword = false
          mockDb.saveUsers(users)
        }

        return {
          success: true,
          message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại',
          data: null,
        }
      }
    )
  },

  // UC-AUTH-04: POST /api/v1/auth/logout
  async logout(payload: LogoutRequest): Promise<ApiSuccessResponse<null>> {
    return apiRequest<null>(
      '/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        success: true,
        message: 'Đăng xuất thành công',
        data: null,
      })
    )
  },

  // UC-POS-00: GET /api/v1/shifts/current
  async getCurrentShift(): Promise<ApiSuccessResponse<CurrentShiftResponseData>> {
    return apiRequest<CurrentShiftResponseData>(
      '/shifts/current',
      { method: 'GET' },
      () => {
        const shift = mockDb.getCurrentShift()
        return {
          success: true,
          message: 'Lấy thông tin ca làm việc hiện tại thành công',
          data: {
            hasOpenShift: Boolean(shift && shift.status === 'OPEN'),
            shift: shift && shift.status === 'OPEN' ? shift : null,
          },
        }
      }
    )
  },

  // UC-POS-05a: POST /api/v1/shifts/open
  async openShift(openingCash: number): Promise<ApiSuccessResponse<ShiftInfo>> {
    return apiRequest<ShiftInfo>(
      '/shifts/open',
      {
        method: 'POST',
        body: JSON.stringify({ openingCash }),
      },
      () => {
        if (!Number.isFinite(openingCash) || openingCash < 0) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Số tiền mở ca không hợp lệ',
          })
        }

        const existing = mockDb.getCurrentShift()
        if (existing && existing.status === 'OPEN') {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'POS_SHIFT_ALREADY_OPEN',
            message: 'Thu ngân đang có một ca làm việc chưa chốt',
          })
        }

        const currentUser = useAuthStore.getState().user
        const newShift: ShiftInfo = {
          shiftId: Math.floor(Math.random() * 900) + 10,
          cashierId: currentUser?.id ?? 2,
          openedAt: new Date().toISOString(),
          openingCash,
          status: 'OPEN',
        }
        mockDb.saveCurrentShift(newShift)
        return {
          success: true,
          message: 'Mở ca làm việc thành công',
          data: newShift,
        }
      }
    )
  },

  async closeShift(): Promise<void> {
    mockDb.saveCurrentShift(null)
  },
}

