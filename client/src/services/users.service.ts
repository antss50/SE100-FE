import { useAuthStore } from '../app/store'
import { ApiClientError, apiRequest } from '../lib/api-client'
import { INITIAL_USERS, mockDb } from '../lib/mock-db'
import type {
  ApiSuccessResponse,
  AuthUser,
  CreateUserRequest,
  CreateUserResponseData,
  GetUsersParams,
  PaginatedData,
  UserItem,
} from '../types/api'

function enrichUserItem(raw: UserItem): UserItem {
  const template =
    INITIAL_USERS.find(
      (u) => u.id === raw.id || u.employeeCode === raw.employeeCode || u.username === raw.username
    ) || INITIAL_USERS[1]

  return {
    ...template,
    ...raw,
    weeklyRevenue: raw.weeklyRevenue ?? template.weeklyRevenue,
    activityLogs: raw.activityLogs ?? template.activityLogs,
    lastLoginAt: raw.lastLoginAt ?? 'Hôm nay 08:00',
    lastLoginDevice: raw.lastLoginDevice ?? 'Thiết bị POS Quầy 01',
    currentShiftLabel:
      raw.currentShiftLabel ??
      (raw.status === 'ACTIVE' ? 'Ca sáng (08h-15h30)' : 'Không có ca hoạt động'),
  }
}

export const usersService = {
  // UC-USER-01: GET /api/v1/users
  async getUsers(
    params: GetUsersParams = {}
  ): Promise<ApiSuccessResponse<PaginatedData<UserItem>>> {
    const query = new URLSearchParams()
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))

    const qs = query.toString()
    const res = await apiRequest<PaginatedData<UserItem>>(
      `/users${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      () => {
        let all = mockDb.getUsers().map(enrichUserItem)

        if (params.keyword?.trim()) {
          const kw = params.keyword.trim().toLowerCase()
          all = all.filter(
            (u) =>
              u.fullName.toLowerCase().includes(kw) ||
              u.employeeCode.toLowerCase().includes(kw) ||
              u.username.toLowerCase().includes(kw) ||
              u.email.toLowerCase().includes(kw) ||
              u.phoneNumber.includes(kw)
          )
        }

        if (params.role && params.role !== 'ALL') {
          all = all.filter((u) => u.roles.includes(params.role!))
        }

        if (params.status && params.status !== 'ALL') {
          all = all.filter((u) => u.status === params.status)
        }

        const page = params.page ?? 1
        const pageSize = params.pageSize ?? 20
        const start = (page - 1) * pageSize
        const items = all.slice(start, start + pageSize)

        return {
          success: true,
          message: 'Lấy danh sách người dùng thành công',
          data: {
            items,
            page,
            pageSize,
            totalItems: all.length,
          },
        }
      }
    )

    return {
      ...res,
      data: {
        ...res.data,
        items: res.data.items.map(enrichUserItem),
      },
    }
  },

  // UC-USER-02: POST /api/v1/users
  async createUser(
    payload: CreateUserRequest
  ): Promise<ApiSuccessResponse<CreateUserResponseData>> {
    return apiRequest<CreateUserResponseData>(
      '/users',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        const users = mockDb.getUsers()
        const duplicate = users.find(
          (u) =>
            u.username.toLowerCase() === payload.username.trim().toLowerCase() ||
            u.employeeCode.toLowerCase() === payload.employeeCode.trim().toLowerCase() ||
            u.email.toLowerCase() === payload.email.trim().toLowerCase()
        )

        if (duplicate) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'USER_EXISTED',
            message: 'Tên đăng nhập, mã nhân viên hoặc email đã tồn tại',
          })
        }

        const roles = mockDb.getRoles()
        const roleCodes = roles
          .filter((r) => payload.roleIds.includes(r.id))
          .map((r) => r.roleCode)

        const newId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1
        const newUser: UserItem = {
          id: newId,
          employeeCode: payload.employeeCode.trim().toUpperCase(),
          username: payload.username.trim(),
          fullName: payload.fullName.trim(),
          email: payload.email.trim(),
          phoneNumber: payload.phoneNumber.trim(),
          status: 'ACTIVE',
          roles: roleCodes.length > 0 ? roleCodes : ['CASHIER'],
          jobTitle: 'Nhân sự vận hành điểm bán',
          lastLoginAt: 'Chưa đăng nhập',
          currentShiftLabel: 'Ca sáng (08h-15h30)',
          isOnline: false,
          mustChangePassword: true,
          failedLoginCount: 0,
        }

        const passwords = mockDb.getPasswords()
        passwords[newUser.username] = payload.password
        mockDb.savePasswords(passwords)
        mockDb.saveUsers([newUser, ...users])

        return {
          success: true,
          message: 'Tạo tài khoản nhân viên thành công',
          data: {
            id: newUser.id,
            employeeCode: newUser.employeeCode,
            username: newUser.username,
          },
        }
      }
    )
  },

  // UC-USER-03: GET /api/v1/users/me
  async getMe(): Promise<ApiSuccessResponse<AuthUser>> {
    return apiRequest<AuthUser>(
      '/users/me',
      { method: 'GET' },
      () => {
        const current = useAuthStore.getState().user
        if (!current) {
          throw new ApiClientError(401, {
            success: false,
            errorCode: 'UNAUTHORIZED',
            message: 'Chưa đăng nhập',
          })
        }
        return {
          success: true,
          message: 'Lấy thông tin tài khoản thành công',
          data: current,
        }
      }
    )
  },

  // Detail & management helpers (fetches from GET /api/v1/users first, then enriches UI fields)
  async getUserById(idOrCode: string | number): Promise<UserItem> {
    try {
      const listRes = await this.getUsers({
        keyword: String(idOrCode),
        page: 1,
        pageSize: 50,
      })
      const matched = listRes.data.items.find(
        (u) =>
          String(u.id) === String(idOrCode) ||
          u.employeeCode.toLowerCase() === String(idOrCode).toLowerCase() ||
          u.username.toLowerCase() === String(idOrCode).toLowerCase()
      )
      if (matched) {
        return enrichUserItem(matched)
      }
    } catch {
      // fallback to local mock db
    }

    const users = mockDb.getUsers().map(enrichUserItem)
    const found = users.find(
      (u) =>
        String(u.id) === String(idOrCode) ||
        u.employeeCode.toLowerCase() === String(idOrCode).toLowerCase()
    )
    return found ?? enrichUserItem(users[1] ?? INITIAL_USERS[1])
  },

  async toggleUserLock(userId: number, reason?: string): Promise<UserItem> {
    const users = mockDb.getUsers()
    const target = users.find((u) => u.id === userId)
    if (!target) {
      throw new ApiClientError(404, {
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản nhân viên',
      })
    }
    if (target.roles.includes('ADMIN')) {
      throw new ApiClientError(400, {
        success: false,
        errorCode: 'CANNOT_LOCK_ADMIN',
        message: 'Không thể khóa tài khoản Quản trị viên hệ thống',
      })
    }

    if (target.status === 'LOCKED') {
      target.status = 'ACTIVE'
      target.lockReason = undefined
      target.lockedDate = undefined
      target.failedLoginCount = 0
    } else {
      target.status = 'LOCKED'
      target.lockReason = reason || 'Tạm khóa bởi Quản trị viên'
      target.lockedDate = new Date().toLocaleDateString('vi-VN')
      target.isOnline = false
    }

    mockDb.saveUsers(users)
    return enrichUserItem(target)
  },

  async updateUserProfile(
    userId: number,
    updates: Partial<Pick<UserItem, 'fullName' | 'email' | 'phoneNumber' | 'jobTitle' | 'roles'>>
  ): Promise<UserItem> {
    const users = mockDb.getUsers()
    const target = users.find((u) => u.id === userId)
    if (!target) {
      throw new ApiClientError(404, {
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: 'Không tìm thấy nhân viên',
      })
    }
    Object.assign(target, updates)
    mockDb.saveUsers(users)
    return enrichUserItem(target)
  },
}

