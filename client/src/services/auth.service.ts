import { apiRequest } from '../lib/api-client'
import type {
  ApiSuccessResponse,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponseData,
  LogoutRequest,
  RefreshTokenRequest,
  RefreshTokenResponseData,
} from '../types/api'

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export const authService = {
  /** AUTH-01: POST /auth/login */
  login(payload: LoginRequest): Promise<ApiSuccessResponse<LoginResponseData>> {
    return apiRequest<LoginResponseData>('/auth/login', json('POST', payload))
  },

  /** POST /auth/refresh-token */
  refreshToken(payload: RefreshTokenRequest): Promise<ApiSuccessResponse<RefreshTokenResponseData>> {
    return apiRequest<RefreshTokenResponseData>('/auth/refresh-token', json('POST', payload))
  },

  /** AUTH-03: POST /auth/change-password */
  changePassword(payload: ChangePasswordRequest): Promise<ApiSuccessResponse<null>> {
    return apiRequest<null>('/auth/change-password', json('POST', payload))
  },

  /** AUTH-02: POST /auth/logout */
  logout(payload: LogoutRequest): Promise<ApiSuccessResponse<null>> {
    return apiRequest<null>('/auth/logout', json('POST', payload))
  },
}
