import { create } from 'zustand'
import type { AuthUser } from '../types/api'

const AUTH_STORAGE_KEY = 'se100_auth_session_v1'

interface StoredSession {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
}

const EMPTY_SESSION: StoredSession = { user: null, accessToken: null, refreshToken: null }

/** Không tự đăng nhập: chưa có phiên lưu thì trả phiên rỗng (CLAUDE.md mục 5.3). */
function loadStoredSession(): StoredSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return EMPTY_SESSION
    const parsed = JSON.parse(raw) as StoredSession
    return parsed?.user && parsed.accessToken ? parsed : EMPTY_SESSION
  } catch {
    return EMPTY_SESSION
  }
}

function saveStoredSession(session: StoredSession): void {
  try {
    if (session.user && session.accessToken) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    // Trình duyệt chặn localStorage: phiên chỉ còn trong bộ nhớ.
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
  setSession: (payload: { user: AuthUser; accessToken: string; refreshToken: string }) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  updateUser: (user: Partial<AuthUser>) => void
  clearSession: () => void
}

const initialSession = loadStoredSession()

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialSession.user,
  accessToken: initialSession.accessToken,
  refreshToken: initialSession.refreshToken,
  isAuthenticated: Boolean(initialSession.user && initialSession.accessToken),

  setSession: ({ user, accessToken, refreshToken }) => {
    saveStoredSession({ user, accessToken, refreshToken })
    set({ user, accessToken, refreshToken, isAuthenticated: true })
  },

  setTokens: (accessToken, refreshToken) => {
    saveStoredSession({ user: get().user, accessToken, refreshToken })
    set({ accessToken, refreshToken })
  },

  updateUser: (partial) => {
    const current = get()
    if (!current.user) return
    const updated = { ...current.user, ...partial }
    saveStoredSession({ user: updated, accessToken: current.accessToken, refreshToken: current.refreshToken })
    set({ user: updated })
  },

  clearSession: () => {
    saveStoredSession(EMPTY_SESSION)
    set({ ...EMPTY_SESSION, isAuthenticated: false })
  },
}))
