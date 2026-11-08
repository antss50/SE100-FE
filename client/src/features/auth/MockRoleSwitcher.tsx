import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../app/store'
import { toast } from '../../components/ui/toast-store'
import { ApiClientError, USE_MOCK } from '../../lib/api-client'
import { authService } from '../../services/auth.service'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-accounts'

/**
 * Chuyển nhanh vai trò bằng cách đăng nhập lại tài khoản seed tương ứng.
 * Chỉ hiện khi `VITE_USE_MOCK=true` (CLAUDE.md mục 5.3).
 */
export function MockRoleSwitcher() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const username = useAuthStore((s) => s.user?.username ?? '')
  const setSession = useAuthStore((s) => s.setSession)
  const [busy, setBusy] = useState(false)

  if (!USE_MOCK) return null

  const switchTo = async (next: string) => {
    if (!next || next === username) return
    setBusy(true)
    try {
      const res = await authService.login({ username: next, password: DEMO_PASSWORD })
      queryClient.clear()
      setSession(res.data)
      navigate('/')
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Không chuyển được vai trò')
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="hidden items-center gap-2 rounded-full border border-dashed border-accent/40 px-3 py-1 text-xs text-muted xl:flex">
      <span>Mock · đổi vai trò</span>
      <select
        aria-label="Chuyển nhanh vai trò (chỉ có ở chế độ mock)"
        value={DEMO_ACCOUNTS.some((a) => a.username === username) ? username : ''}
        disabled={busy}
        onChange={(e) => switchTo(e.target.value)}
        className="cursor-pointer bg-transparent font-semibold text-accent outline-none"
      >
        <option value="" disabled>
          Chọn tài khoản
        </option>
        {DEMO_ACCOUNTS.filter((a) => a.username !== 'newstaff').map((a) => (
          <option key={a.username} value={a.username}>
            {a.username} · {a.role}
          </option>
        ))}
      </select>
    </label>
  )
}
