import { CheckCircle2, KeyRound, Lock, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useUiStore } from '../../app/store'
import { ApiClientError } from '../../lib/api-client'
import { authService } from '../../services/auth.service'

export function ChangePasswordModal() {
  const requested = useUiStore((s) => s.isChangePasswordOpen)
  const closeChangePassword = useUiStore((s) => s.closeChangePassword)
  const user = useAuthStore((s) => s.user)
  // Luật 47: tài khoản bắt buộc đổi mật khẩu lần đầu thì hộp này luôn mở và không đóng được.
  const forced = Boolean(user?.mustChangePassword)
  const isOpen = requested || forced
  const clearSession = useAuthStore((s) => s.clearSession)
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setErrorMsg(null)
    setSuccessMsg(null)
    closeChangePassword()
    if (forced) {
      clearSession()
      navigate('/login')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (newPassword !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await authService.changePassword({
        oldPassword,
        newPassword,
      })
      setSuccessMsg(
        res.message || 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại'
      )
      setTimeout(() => {
        handleClose()
        clearSession()
        navigate('/login')
      }, 1500)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('Không thể đổi mật khẩu. Vui lòng thử lại.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[#ead8ce] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#fbeae2] text-[#b4533c] grid place-items-center">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h3 id="change-password-title" className="text-base font-bold text-[#2b1d16]">
                Đổi mật khẩu bảo mật
              </h3>
              <p className="text-xs text-[#7c6356]">
                Tài khoản: <span className="font-mono font-semibold">{user?.username}</span>
              </p>
            </div>
          </div>
          {!forced && (
            <button
              type="button"
              aria-label="Đóng"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-[#8c7365] hover:bg-[#f6ede7]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {user?.mustChangePassword && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
            Tài khoản của bạn được yêu cầu đổi mật khẩu lần đầu trước khi tiếp tục
            giao dịch.
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="cp-old" className="block text-xs font-semibold text-[#543e34]">
              Mật khẩu hiện tại *
            </label>
            <div className="mt-1.5 relative">
              <Lock className="size-4 text-[#9a7d6f] absolute left-3.5 top-3" />
              <input
                type="password"
                id="cp-old"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại (VD: Password@123)"
                className="w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] pl-10 pr-3.5 py-2.5 text-xs text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="cp-new" className="block text-xs font-semibold text-[#543e34]">
              Mật khẩu mới *
            </label>
            <div className="mt-1.5 relative">
              <Lock className="size-4 text-[#9a7d6f] absolute left-3.5 top-3" />
              <input
                type="password"
                id="cp-new"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự, chữ hoa, chữ thường & số"
                className="w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] pl-10 pr-3.5 py-2.5 text-xs text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-[#8d7468]">
              Quy chuẩn Bcrypt: Tối thiểu 8 ký tự, gồm chữ hoa (A-Z), chữ thường
              (a-z) và chữ số (0-9).
            </p>
          </div>

          <div>
            <label htmlFor="cp-confirm" className="block text-xs font-semibold text-[#543e34]">
              Xác nhận mật khẩu mới *
            </label>
            <div className="mt-1.5 relative">
              <Lock className="size-4 text-[#9a7d6f] absolute left-3.5 top-3" />
              <input
                type="password"
                id="cp-confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] pl-10 pr-3.5 py-2.5 text-xs text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-[#e3d2c7] text-xs font-semibold text-[#644c40] hover:bg-[#f8f0eb]"
            >
              {forced ? 'Đăng xuất' : 'Hủy bỏ'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#9f432b] hover:bg-[#893620] text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

