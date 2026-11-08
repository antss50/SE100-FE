import { create } from 'zustand'
import type { AuthUser, RoleCode } from '../types/api'

const AUTH_STORAGE_KEY = 'lumina_auth_session_v1'

interface StoredSession {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
}

const DEFAULT_DEMO_USER: AuthUser = {
  id: 1,
  employeeCode: 'LUM-012',
  username: 'manager01',
  fullName: 'Trần Lê Ngọc Mai',
  email: 'mai.tran@lumina.vn',
  phoneNumber: '0908123456',
  mustChangePassword: false,
  roles: ['STORE_MANAGER', 'ADMIN'],
  permissions: [
    'auth.user.manage',
    'auth.rbac.configure',
    'POS_CREATE_ORDER',
    'POS_PROCESS_RETURN',
    'CUS_MANAGE',
  ],
}

function loadStoredSession(): StoredSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return {
        user: DEFAULT_DEMO_USER,
        accessToken: 'demo-access-token-lumina',
        refreshToken: 'demo-refresh-token-lumina',
      }
    }
    return JSON.parse(raw) as StoredSession
  } catch {
    return {
      user: DEFAULT_DEMO_USER,
      accessToken: 'demo-access-token-lumina',
      refreshToken: 'demo-refresh-token-lumina',
    }
  }
}

function saveStoredSession(session: StoredSession): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore storage errors
  }
}

type UiState = {
  isSidebarOpen: boolean
  isChangePasswordOpen: boolean
  isShiftModalOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  openChangePassword: () => void
  closeChangePassword: () => void
  openShiftModal: () => void
  closeShiftModal: () => void
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  isChangePasswordOpen: false,
  isShiftModalOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  openChangePassword: () => set({ isChangePasswordOpen: true }),
  closeChangePassword: () => set({ isChangePasswordOpen: false }),
  openShiftModal: () => set({ isShiftModalOpen: true }),
  closeShiftModal: () => set({ isShiftModalOpen: false }),
}))

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setSession: (payload: {
    user: AuthUser
    accessToken: string
    refreshToken: string
  }) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  updateUser: (user: Partial<AuthUser>) => void
  clearSession: () => void
  switchDemoRole: (role: RoleCode) => void
}

const initialSession = loadStoredSession()

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialSession.user,
  accessToken: initialSession.accessToken,
  refreshToken: initialSession.refreshToken,
  isAuthenticated: Boolean(initialSession.user && initialSession.accessToken),

  setSession: ({ user, accessToken, refreshToken }) => {
    saveStoredSession({ user, accessToken, refreshToken })
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    })
  },

  setTokens: (accessToken, refreshToken) => {
    const current = get()
    saveStoredSession({
      user: current.user,
      accessToken,
      refreshToken,
    })
    set({ accessToken, refreshToken })
  },

  updateUser: (partial) => {
    const current = get()
    if (!current.user) return
    const updated = { ...current.user, ...partial }
    saveStoredSession({
      user: updated,
      accessToken: current.accessToken,
      refreshToken: current.refreshToken,
    })
    set({ user: updated })
  },

  clearSession: () => {
    saveStoredSession({ user: null, accessToken: null, refreshToken: null })
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  },

  switchDemoRole: (role) => {
    const roleProfileMap: Record<string, AuthUser> = {
      ADMIN: {
        id: 4,
        employeeCode: 'LUM-002',
        username: 'admin',
        fullName: 'Đặng Quốc Khang',
        email: 'khang.dang@lumina.vn',
        phoneNumber: '0903999888',
        mustChangePassword: false,
        roles: ['ADMIN'],
        permissions: ['*'],
      },
      STORE_MANAGER: {
        id: 1,
        employeeCode: 'LUM-012',
        username: 'manager01',
        fullName: 'Trần Lê Ngọc Mai',
        email: 'mai.tran@lumina.vn',
        phoneNumber: '0908123456',
        mustChangePassword: false,
        roles: ['STORE_MANAGER'],
        permissions: ['auth.user.manage', 'CUS_MANAGE', 'POS_CREATE_ORDER'],
      },
      CASHIER: {
        id: 2,
        employeeCode: 'LUM-084',
        username: 'namy.cashier',
        fullName: 'Nguyễn Thu Hà',
        email: 'namy@lumina.vn',
        phoneNumber: '0912345678',
        mustChangePassword: false,
        roles: ['CASHIER'],
        permissions: ['POS_CREATE_ORDER', 'POS_PROCESS_RETURN'],
      },
      INVENTORY_STAFF: {
        id: 3,
        employeeCode: 'LUM-045',
        username: 'inventory01',
        fullName: 'Lê Vũ Hoàng An',
        email: 'an.levu@lumina.vn',
        phoneNumber: '0938776211',
        mustChangePassword: false,
        roles: ['INVENTORY_STAFF'],
        permissions: ['fefo.lot.inbound_create', 'inventory.audit.count'],
      },
    }
    const nextUser = roleProfileMap[role] ?? DEFAULT_DEMO_USER
    const current = get()
    const token = current.accessToken ?? 'demo-access-token-lumina'
    const refresh = current.refreshToken ?? 'demo-refresh-token-lumina'
    saveStoredSession({ user: nextUser, accessToken: token, refreshToken: refresh })
    set({
      user: nextUser,
      accessToken: token,
      refreshToken: refresh,
      isAuthenticated: true,
    })
  },
}))
