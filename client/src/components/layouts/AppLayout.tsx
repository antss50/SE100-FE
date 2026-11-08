import {
  Award,
  Bell,
  Boxes,
  Clock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Shield,
  ShieldCheck,
  Store,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore, useUiStore } from '../../app/store'
import { ChangePasswordModal } from '../../features/auth/ChangePasswordModal'
import { ShiftModal } from '../../features/auth/ShiftModal'
import { authService } from '../../services/auth.service'
import type { RoleCode } from '../../types/api'
import { getInitials, getRoleBadgeMeta } from '../../utils/format'

interface NavGroup {
  section: string
  items: {
    to: string
    label: string
    icon: LucideIcon
    end?: boolean
  }[]
}

const navGroups: NavGroup[] = [
  {
    section: '1. TỔNG QUAN',
    items: [
      {
        to: '/',
        label: 'Dashboard & Cảnh báo lô FEFO',
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    section: '2. KHO & HÀNG HÓA',
    items: [
      {
        to: '/inventory',
        label: 'Danh mục & Sản phẩm',
        icon: Boxes,
      },
    ],
  },
  {
    section: '3. BÁN HÀNG & POS',
    items: [
      {
        to: '/pos',
        label: 'Thu ngân POS siêu tốc',
        icon: Store,
      },
    ],
  },
  {
    section: '4. CHĂM SÓC & CS BÁN HÀNG',
    items: [
      {
        to: '/promotions',
        label: 'Khuyến mãi 4 tầng',
        icon: Tag,
      },
      {
        to: '/loyalty',
        label: 'Hạng thẻ & Tích điểm',
        icon: Award,
      },
      {
        to: '/customers',
        label: 'Khách hàng & Hội viên',
        icon: Users,
      },
    ],
  },
  {
    section: '5. NHÂN SỰ & HỆ THỐNG',
    items: [
      {
        to: '/users',
        label: 'Quản lý Tài khoản nhân viên',
        icon: Users,
      },
      {
        to: '/rbac',
        label: 'Phân quyền & Ma trận vai trò',
        icon: Shield,
      },
    ],
  },
]

export function AppLayout() {
  const navigate = useNavigate()
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const closeSidebar = useUiStore((state) => state.closeSidebar)
  const openChangePassword = useUiStore((state) => state.openChangePassword)
  const openShiftModal = useUiStore((state) => state.openShiftModal)

  const user = useAuthStore((state) => state.user)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const clearSession = useAuthStore((state) => state.clearSession)

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const primaryRole: RoleCode = user?.roles?.[0] || 'STORE_MANAGER'
  const roleMeta = getRoleBadgeMeta(primaryRole)

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authService.logout({ refreshToken })
      }
    } catch {
      // ignore logout error
    } finally {
      clearSession()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f3ee] text-[#221712] lg:flex">
      {isSidebarOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={closeSidebar}
          type="button"
        />
      )}

      {/* Lumina POS Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-[#ead9ce] bg-[#f7ede6] transition-transform lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#ead9ce] px-5">
          <NavLink
            to="/users"
            className="flex items-center gap-3"
            onClick={closeSidebar}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#9a462d] text-white shadow-xs">
              <Tag size={18} />
            </span>
            <div>
              <p className="text-sm font-extrabold tracking-wide text-[#9a462d] leading-none">
                LUMINA POS
              </p>
              <p className="mt-1 text-[10px] font-medium text-[#7e6558]">
                Chi nhánh Flagship Q.1, TP.HCM
              </p>
            </div>
          </NavLink>

          <button
            aria-label="Đóng menu"
            className="rounded-lg p-1.5 text-[#7a6154] hover:bg-[#efe0d5] lg:hidden"
            onClick={closeSidebar}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <nav
          aria-label="Điều hướng chính"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
        >
          {navGroups.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#9a7e70]">
                {group.section}
              </p>
              <div className="space-y-1">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                        isActive
                          ? 'bg-[#efdacd] text-[#9a462d] shadow-2xs'
                          : 'text-[#553f34] hover:bg-[#f1e3d9] hover:text-[#221712]'
                      }`
                    }
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Guard & System Status */}
        <div className="p-3.5 space-y-3 border-t border-[#ead9ce]">
          <div className="rounded-2xl bg-white/90 border border-[#e7d4c8] p-3 flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-[#faefe7] text-[#9a462d] grid place-items-center shrink-0">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#221712]">
                FEFO Active Guard
              </p>
              <p className="text-[10px] text-[#83695c]">
                Kiểm soát hạn dùng lô
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-[#8c7265]">
            <span>Lumina Cloud v4.2</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-600" />
              Sẵn sàng
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Top Lumina Header Bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#ead9ce] bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              aria-label="Mở menu"
              className="rounded-lg p-2 text-[#5c453a] hover:bg-[#faf2ec] lg:hidden"
              onClick={toggleSidebar}
              type="button"
            >
              <Menu size={20} />
            </button>

            {/* Active Role Pill with Quick Role Switcher */}
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-[#f5e3d8] border border-[#e6cbbd] px-3.5 py-1 text-xs">
              <span className="font-bold text-[#7c3d25]">ROLE:</span>
              <span className="font-mono font-extrabold text-[#9a462d]">{primaryRole}</span>
            </div>

            {/* Current Shift Pill */}
            <button
              type="button"
              onClick={openShiftModal}
              className="hidden md:inline-flex items-center gap-2 rounded-full bg-[#f8f0ea] hover:bg-[#f1e3d8] border border-[#ead8cc] px-3.5 py-1 text-xs transition cursor-pointer"
            >
              <span className="size-2 rounded-full bg-emerald-600" />
              <span className="text-[#5e473b]">Ca sáng:</span>
              <span className="font-mono font-bold text-[#221712]">
                08:00 - 15:30
              </span>
              <span className="text-[#9a462d] font-semibold">(Đang mở)</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#e3d1c5] hover:bg-[#faf3ee] px-3.5 py-1.5 text-xs font-bold text-[#3f2c23] cursor-pointer"
            >
              <QrCode className="size-3.5 text-[#9a462d]" />
              <span>Quét FEFO</span>
            </button>

            <button
              type="button"
              onClick={openShiftModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#873b22] hover:bg-[#712f19] text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Clock className="size-3.5" />
              <span>Mở / Chốt ca</span>
            </button>

            <button
              type="button"
              className="relative rounded-xl p-2 text-[#5e473b] hover:bg-[#faf2ec]"
              aria-label="Thông báo"
            >
              <Bell className="size-4" />
              <span className="absolute top-1 right-1 size-4 rounded-full bg-[#c94a29] text-white text-[9px] font-bold grid place-items-center">
                5
              </span>
            </button>

            {/* User Profile Dropdown Trigger */}
            <div className="relative pl-2 border-l border-[#ede0d7]">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 text-left cursor-pointer"
              >
                <div className="size-9 rounded-full bg-[#f3e1d6] border border-[#e2c6b6] text-[#873b22] grid place-items-center text-xs font-extrabold">
                  {getInitials(user?.fullName || 'Trần Lê Ngọc Mai')}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-[#221712] leading-tight">
                    {user?.fullName || 'Trần Lê Ngọc Mai'}
                  </p>
                  <p className="text-[11px] text-[#83695c]">
                    {roleMeta.viTitle}
                  </p>
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-[#ead9ce] shadow-xl p-2 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-[#f2e6de]">
                    <p className="font-bold text-[#221712]">{user?.fullName}</p>
                    <p className="font-mono text-[11px] text-[#8a7062]">
                      @{user?.username} · {user?.employeeCode}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      navigate(`/users/${user?.employeeCode || 'LUM-012'}`)
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#faf3ee] text-[#3b2920] font-medium flex items-center gap-2 cursor-pointer mt-1"
                  >
                    <Users className="size-3.5 text-[#9a462d]" />
                    <span>Hồ sơ cá nhân (/users/me)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      openChangePassword()
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#faf3ee] text-[#3b2920] font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="size-3.5 text-[#9a462d]" />
                    <span>Đổi mật khẩu bảo mật</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      handleLogout()
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-700 font-semibold flex items-center gap-2 cursor-pointer mt-1 border-t border-[#f2e6de] pt-2"
                  >
                    <LogOut className="size-3.5" />
                    <span>Đăng xuất phiên POS</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-7">
          <Outlet />
        </main>
      </div>

      {/* Global Auth Modals */}
      <ChangePasswordModal />
      <ShiftModal />
    </div>
  )
}
