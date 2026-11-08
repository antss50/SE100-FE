import { apiRequest } from '../lib/api-client'
import type {
  ApiSuccessResponse,
  AuthUser,
  CreateUserRequest,
  CreateUserResponseData,
  GetUsersParams,
  PaginatedData,
  UserItem,
} from '../types/api'
import { toQueryString } from './query'

export type UpdateUserRequest = Partial<Pick<UserItem, 'fullName' | 'email' | 'phoneNumber' | 'jobTitle'>>

export const usersService = {
  /** AUTH-04: GET /users */
  getUsers(params: GetUsersParams = {}): Promise<ApiSuccessResponse<PaginatedData<UserItem>>> {
    return apiRequest<PaginatedData<UserItem>>(`/users${toQueryString(params)}`, { method: 'GET' })
  },

  /** AUTH-04: POST /users */
  createUser(payload: CreateUserRequest): Promise<ApiSuccessResponse<CreateUserResponseData>> {
    return apiRequest<CreateUserResponseData>('/users', { method: 'POST', body: JSON.stringify(payload) })
  },

  /** GET /users/me */
  getMe(): Promise<ApiSuccessResponse<AuthUser>> {
    return apiRequest<AuthUser>('/users/me', { method: 'GET' })
  },

  /** AUTH-04: GET /users/{idOrCode} — id, mã nhân viên hoặc username. */
  async getUserById(idOrCode: string | number): Promise<UserItem> {
    const res = await apiRequest<UserItem>(`/users/${encodeURIComponent(String(idOrCode))}`, { method: 'GET' })
    return res.data
  },

  /** AUTH-04: POST /users/{id}/lock hoặc /unlock tùy trạng thái hiện tại. */
  async toggleUserLock(user: Pick<UserItem, 'id' | 'status'>, reason?: string): Promise<UserItem> {
    const action = user.status === 'LOCKED' ? 'unlock' : 'lock'
    const res = await apiRequest<UserItem>(`/users/${user.id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(action === 'lock' ? { reason } : {}),
    })
    return res.data
  },

  /** AUTH-04: PATCH /users/{id} */
  async updateUserProfile(userId: number, updates: UpdateUserRequest): Promise<UserItem> {
    const res = await apiRequest<UserItem>(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(updates) })
    return res.data
  },
}
