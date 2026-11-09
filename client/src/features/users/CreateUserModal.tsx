import { UserPlus, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { ApiClientError } from '../../lib/api-client'
import { usersService } from '../../services/users.service'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

const ROLE_OPTIONS = [
  { id: 1, code: 'ADMIN', label: 'ADMIN — Chủ cửa hàng / Quản trị hệ thống' },
  { id: 2, code: 'STORE_MANAGER', label: 'STORE_MANAGER — Quản lý cửa hàng' },
  { id: 3, code: 'INVENTORY_STAFF', label: 'INVENTORY_STAFF — Nhân viên kho & FEFO' },
  { id: 4, code: 'CASHIER', label: 'CASHIER — Nhân viên thu ngân POS' },
]

export function CreateUserModal({
  isOpen,
  onClose,
  onCreated,
}: CreateUserModalProps) {
  const [employeeCode, setEmployeeCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('Password@123')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([4])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const toggleRoleId = (id: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id]
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsSubmitting(true)

    try {
      await usersService.createUser({
        employeeCode,
        username,
        password,
        fullName,
        email,
        phoneNumber,
        roleIds: selectedRoleIds,
      })
      onCreated()
      onClose()
      setUsername('')
      setFullName('')
      setEmail('')
      setPhoneNumber('')
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message} (${err.errorCode})`)
      } else {
        setErrorMsg('Không thể tạo tài khoản nhân viên')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[#ead8ce] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#fbeae2] text-[#9f432b] grid place-items-center">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2b1d16]">
                Tạo tài khoản nhân viên mới (UC-USER-02)
              </h3>
              <p className="text-xs text-[#7c6356]">
                Khởi tạo hồ sơ nhân sự và phân bổ vai trò RBAC ban đầu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8c7365] hover:bg-[#f6ede7]"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Mã nhân viên (employeeCode)
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="Để trống: hệ thống tự sinh (NV0007)"
                className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] px-3.5 py-2.5 text-xs font-mono font-semibold text-[#2b1d16] outline-none focus:border-[#b4533c]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Tên đăng nhập (username) *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: staff05"
                className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] px-3.5 py-2.5 text-xs font-mono text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Họ và tên nhân viên (fullName) *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="VD: Trần Văn B"
                className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] px-3.5 py-2.5 text-xs text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Mật khẩu khởi tạo (password) *
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] px-3.5 py-2.5 text-xs font-mono text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Email công việc (email) *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff05@lumina.vn"
                className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] px-3.5 py-2.5 text-xs text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Số điện thoại (phoneNumber) *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0912345678"
                className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] px-3.5 py-2.5 text-xs font-mono text-[#2b1d16] outline-none focus:border-[#b4533c]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#543e34]">
              Vai trò phân quyền (roleIds) *
            </label>
            <div className="mt-2 space-y-2">
              {ROLE_OPTIONS.map((role) => {
                const checked = selectedRoleIds.includes(role.id)
                return (
                  <label
                    key={role.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-xs cursor-pointer transition ${
                      checked
                        ? 'bg-[#fbeae2]/70 border-[#c96747] text-[#2b1d16] font-semibold'
                        : 'bg-[#fcf9f7] border-[#ead9ce] text-[#664f43]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRoleId(role.id)}
                      className="accent-[#9f432b]"
                    />
                    <span>{role.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#e3d2c7] text-xs font-semibold text-[#644c40] hover:bg-[#f8f0eb]"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#9f432b] hover:bg-[#863520] text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Đang khởi tạo...' : '+ Tạo tài khoản nhân viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

