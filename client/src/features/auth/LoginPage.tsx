import {
  ArrowRight,
  Eye,
  EyeOff,
  Flower2,
  Hourglass,
  Lock,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore, useUiStore } from '../../app/store'
import { ApiClientError, USE_MOCK } from '../../lib/api-client'
import { homePathFor } from '../../routes/nav-config'
import { authService } from '../../services/auth.service'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-accounts'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSession = useAuthStore((s) => s.setSession)
  const openChangePassword = useUiStore((s) => s.openChangePassword)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [showForgotModal, setShowForgotModal] = useState(false)

  /** Quay lại trang bảo vệ đã định vào (nếu có), không thì về trang chủ theo quyền. */
  const redirectTarget = (permissions: readonly string[]): string => {
    const from = (location.state as { from?: string } | null)?.from
    return from && from !== '/login' ? from : (homePathFor(permissions) ?? '/')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setErrorCode(null)
    setIsLoading(true)

    try {
      const response = await authService.login({ username, password })
      setSession(response.data)

      if (response.data.user.mustChangePassword) {
        openChangePassword()
      }

      navigate(redirectTarget(response.data.user.permissions), { replace: true })
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message)
        setErrorCode(err.errorCode)
      } else {
        setErrorMsg('Không thể xác thực tài khoản. Vui lòng thử lại.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fillDemoAccount = (demoUsername: string) => {
    setUsername(demoUsername)
    setPassword(DEMO_PASSWORD)
    setErrorMsg(null)
    setErrorCode(null)
  }

  if (isAuthenticated) {
    const permissions = useAuthStore.getState().user?.permissions ?? []
    return <Navigate to={redirectTarget(permissions)} replace />
  }

  return (
    <div className="min-h-screen bg-[#f5ede7] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[1120px] min-h-[700px] bg-white rounded-3xl shadow-[0_24px_60px_-15px_rgba(92,51,34,0.14)] overflow-hidden grid lg:grid-cols-12 border border-[#efe2d9]">
        {/* Left Brand Showcase Panel */}
        <div className="lg:col-span-5 bg-[#f7e7de] p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3.5">
              <div className="size-11 rounded-2xl bg-[#d57252] text-white grid place-items-center shadow-sm">
                <Flower2 className="size-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide text-[#2c1e18]">
                  LUMINA
                </h1>
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[#b4533c] uppercase">
                  BEAUTY POS & ERP
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-[#5e473d]">
              Hệ sinh thái quản trị chuỗi bán lẻ mỹ phẩm cao cấp & tối ưu hóa vận
              hành điểm bán.
            </p>

            {/* Boutique Visual Banner */}
            <div className="mt-6 relative rounded-2xl overflow-hidden h-56 shadow-md border border-[#ebcfc0] bg-gradient-to-br from-[#8c5239] via-[#b57355] to-[#563020]">
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 25% 25%, rgba(255,245,235,0.7) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(255,205,178,0.5) 0%, transparent 50%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              {/* Cosmetics display shelf illustration */}
              <div className="absolute inset-0 p-6 flex flex-col justify-between">
                <div className="flex justify-end gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/20 text-amber-50 backdrop-blur-sm">
                    Atelier Flagship
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#ef7d57] animate-pulse" />
                    <p className="font-mono text-xs tracking-[0.15em] text-amber-50/95 font-semibold uppercase">
                      FLAGSHIP STORE
                    </p>
                  </div>
                  <p className="font-mono text-xs tracking-[0.15em] text-amber-100/90 uppercase pl-4 mt-0.5">
                    NETWORK ONLINE
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Feature Highlight Cards */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3.5 rounded-2xl bg-white/90 px-4 py-3.5 shadow-xs border border-[#f0dfd4]">
              <div className="size-9 rounded-xl bg-[#f9ece4] text-[#b4533c] grid place-items-center shrink-0">
                <Hourglass className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#2c1e18]">
                  Kiểm soát FEFO thông minh
                </p>
                <p className="text-[11px] text-[#785e52]">
                  Tự động cảnh báo hạn dùng theo lô date
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl bg-white/90 px-4 py-3.5 shadow-xs border border-[#f0dfd4]">
              <div className="size-9 rounded-xl bg-[#f9ece4] text-[#8d5b3c] grid place-items-center shrink-0">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#2c1e18]">
                  Bảo mật phân quyền 4 cấp
                </p>
                <p className="text-[11px] text-[#785e52]">
                  Quản trị viên, Quản lý, Kho & Thu ngân
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl bg-white/90 px-4 py-3.5 shadow-xs border border-[#f0dfd4]">
              <div className="size-9 rounded-xl bg-[#f9ece4] text-[#d57252] grid place-items-center shrink-0">
                <Zap className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#2c1e18]">
                  POS bán hàng siêu tốc
                </p>
                <p className="text-[11px] text-[#785e52]">
                  Xử lý hóa đơn 0.8s, đồng bộ tức thì
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-14 lg:p-16 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            <h2 className="text-3xl font-bold text-[#1f1612] tracking-tight">
              Đăng Nhập POS
            </h2>
            <p className="mt-2 text-sm text-[#786156]">
              Vui lòng xác thực tài khoản để bắt đầu ca
            </p>

            {errorMsg && (
              <div
                role="alert"
                className={`mt-5 rounded-2xl border p-4 text-xs leading-relaxed ${
                  errorCode === 'AUTH_ACCOUNT_LOCKED'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50/90 border-amber-200 text-amber-900'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>
                    {errorCode === 'AUTH_ACCOUNT_LOCKED'
                      ? 'Tài khoản bị khóa bảo mật (HTTP 403)'
                      : 'Xác thực không thành công'}
                  </span>
                  {errorCode && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/5">
                      {errorCode}
                    </span>
                  )}
                </div>
                <p className="mt-1">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#6e564b]"
                >
                  USERNAME
                </label>
                <div className="mt-2 relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#947668]">
                    <User className="size-4" />
                  </span>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập mã NV hoặc username (VD: LUM084, admin)"
                    className="w-full rounded-xl bg-[#fdf2eb] border border-[#f3dfd3] focus:border-[#d57252] focus:bg-white pl-11 pr-4 py-3.5 text-sm font-mono font-medium text-[#2b1d16] outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#6e564b]"
                  >
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-semibold text-[#b4533c] hover:text-[#8f3c27] transition"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="mt-2 relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#947668]">
                    <Lock className="size-4" />
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl bg-[#fdf2eb] border border-[#f3dfd3] focus:border-[#d57252] focus:bg-white pl-11 pr-11 py-3.5 text-sm text-[#2b1d16] outline-none transition"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#7c6154] hover:text-[#2b1d16]"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full rounded-xl bg-[#d57252] hover:bg-[#c25f40] active:bg-[#b05235] disabled:opacity-60 text-white font-semibold py-4 px-6 text-sm shadow-[0_10px_25px_-5px_rgba(213,114,82,0.5)] flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>
                  {isLoading
                    ? 'Đang xác thực phiên làm việc...'
                    : 'Xác Thực & Mở Phiên Bán Hàng'}
                </span>
                <ArrowRight className="size-4" />
              </button>
            </form>

            {/* Tài khoản mẫu: chỉ hiện ở chế độ mock */}
            {USE_MOCK && (
            <div className="mt-8 pt-6 border-t border-[#f2e6de]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8e7467]">
                Tài khoản thử nghiệm nhanh (Mật khẩu: Password@123)
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => fillDemoAccount(acc.username)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      username === acc.username
                        ? 'bg-[#fbeae2] border-[#d57252] text-[#9e3f22]'
                        : 'bg-[#faf6f3] border-[#eaddd4] text-[#654d42] hover:bg-[#f4eae3]'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#ead9ce] shadow-xl">
            <h3 className="text-base font-bold text-[#2b1d16]">
              Chính sách cấp lại mật khẩu POS
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#6b5347]">
              Theo quy định bảo mật chuỗi <strong>Lumina POS & ERP</strong>, nhân
              viên không tự khôi phục mật khẩu qua email cá nhân. Vui lòng liên hệ{' '}
              <strong>Quản lý cửa hàng (STORE_MANAGER)</strong> hoặc{' '}
              <strong>Quản trị viên (ADMIN)</strong> để được đặt lại mật khẩu hoặc
              mở khóa tài khoản khi nhập sai quá 5 lần.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 rounded-xl bg-[#b4533c] text-white text-xs font-semibold hover:bg-[#9a422d]"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

