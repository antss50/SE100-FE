import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LockKeyhole, LogOut, Menu, ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useUiStore } from '../../app/store'
import { hasPermission } from '../../domain/permissions'
import { MockRoleSwitcher } from '../../features/auth/MockRoleSwitcher'
import { queryKeys } from '../../lib/query-keys'
import { authService } from '../../services/auth.service'
import { shiftsService } from '../../services/shifts.service'
import { getInitials, getRoleBadgeMeta } from '../../utils/format'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })

export function Header() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const openChangePassword = useUiStore((s) => s.openChangePassword)
  const openShiftModal = useUiStore((s) => s.openShiftModal)
  const user = useAuthStore((s) => s.user)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const clearSession = useAuthStore((s) => s.clearSession)
  const permissions = user?.permissions ?? []
  const canUseShift = hasPermission(permissions, 'POS_SHIFT_OPEN')
  const canScanStock = hasPermission(permissions, ['STOCK_VIEW', 'STOCK_VIEW_AVAILABLE'])

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: shiftData } = useQuery({
    queryKey: queryKeys.shifts.current,
    queryFn: () => shiftsService.getCurrentShift(),
    enabled: canUseShift,
  })
  const shift = shiftData?.data.shift

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    setMenuOpen(false)
    try {
      if (refreshToken) await authService.logout({ refreshToken })
    } catch {
      // Đăng xuất phía máy vẫn thực hiện dù gọi API lỗi.
    } finally {
      clearSession()
      queryClient.clear()
      navigate('/login', { replace: true })
    }
  }

  const primaryRole = user?.roles[0] ?? ''

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="Mở menu"
          className="rounded-lg p-2 text-ink-soft hover:bg-accent-soft lg:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="size-5" />
        </button>
        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs sm:inline-flex">
          <span className="text-muted">Role:</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">{primaryRole}</span>
        </span>
        {canUseShift && (
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs md:inline-flex">
            <span className={`size-2 rounded-full ${shift ? 'bg-success' : 'bg-neutral'}`} aria-hidden="true" />
            {shift ? (
              <>
                Ca mở lúc <strong className="text-ink">{formatTime(shift.openedAt)}</strong>
                <span className="text-accent">(Đang mở)</span>
              </>
            ) : (
              <span className="text-muted">Chưa mở ca</span>
            )}
          </span>
        )}
        <MockRoleSwitcher />
      </div>

      <div className="flex items-center gap-2">
        {canScanStock && (
          <button
            type="button"
            onClick={() => navigate('/stock?scan=1')}
            className="hidden items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-card sm:inline-flex"
          >
            <ScanLine className="size-4 text-accent" aria-hidden="true" />
            Quét FEFO
          </button>
        )}
        {canUseShift && (
          <button
            type="button"
            onClick={openShiftModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-bright px-3 py-2 text-xs font-semibold text-white hover:brightness-95"
          >
            <LockKeyhole className="size-4" aria-hidden="true" />
            Mở / Chốt ca
          </button>
        )}

        <div ref={menuRef} className="relative border-l border-line pl-3">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 text-left"
          >
            <span className="grid size-9 place-items-center rounded-full border border-line bg-accent-soft text-xs font-bold text-accent">
              {getInitials(user?.fullName ?? '')}
            </span>
            <span className="hidden sm:block">
              <span className="block text-xs font-semibold text-ink">{user?.fullName}</span>
              <span className="block text-[11px] text-muted">{getRoleBadgeMeta(primaryRole).viTitle}</span>
            </span>
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-white p-1.5 text-sm shadow-xl">
              <p className="border-b border-line px-3 py-2 text-xs text-muted">
                @{user?.username} · {user?.employeeCode}
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  openChangePassword()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ink-soft hover:bg-card"
              >
                <KeyRound className="size-4 text-accent" aria-hidden="true" />
                Đổi mật khẩu
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-danger hover:bg-danger-soft"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
