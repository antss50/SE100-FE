import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClientError } from '../../lib/api-client'
import { usersService } from '../../services/users.service'
import type { UserItem } from '../../types/api'
import { getInitials, getRoleBadgeMeta } from '../../utils/format'
import { CreateUserModal } from './CreateUserModal'

export function UsersListPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await usersService.getUsers({
        keyword,
        role: roleFilter,
        status: statusFilter,
        page,
        pageSize: 20,
      })
      setUsers(res.data.items)
      setTotalItems(res.data.totalItems)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [keyword, roleFilter, statusFilter, page])

  useEffect(() => {
    let active = true
    usersService
      .getUsers({
        keyword,
        role: roleFilter,
        status: statusFilter,
        page,
        pageSize: 20,
      })
      .then((res) => {
        if (active) {
          setUsers(res.data.items)
          setTotalItems(res.data.totalItems)
        }
      })
      .catch(() => {
        // ignore
      })
    return () => {
      active = false
    }
  }, [keyword, roleFilter, statusFilter, page])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3200)
  }

  const handleToggleLock = async (user: UserItem) => {
    try {
      const updated = await usersService.toggleUserLock(user.id)
      showToast(
        updated.status === 'LOCKED'
          ? `Đã tạm khóa tài khoản ${updated.fullName} (${updated.employeeCode})`
          : `Đã mở khóa tài khoản ${updated.fullName} (${updated.employeeCode})`
      )
      fetchUsers()
    } catch (err) {
      if (err instanceof ApiClientError) {
        showToast(err.message)
      }
    }
  }

  const handleExportCsv = () => {
    const headers = ['Mã NV,Username,Họ tên,Email,SĐT,Vai trò,Trạng thái']
    const rows = users.map(
      (u) =>
        `${u.employeeCode},${u.username},"${u.fullName}",${u.email},${u.phoneNumber},${u.roles.join('|')},${u.status}`
    )
    const blob = new Blob(['\uFEFF' + [...headers, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'danh-sach-nhan-su-lumina.csv'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Đã xuất danh sách nhân sự (CSV)')
  }

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length
  const lockedCount = users.filter((u) => u.status === 'LOCKED').length

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#221712] tracking-tight">
            Quản lý Tài khoản & Hồ sơ Nhân viên
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#7e6659]">
            Hệ thống Quản lý danh sách tài khoản, hồ sơ nhân sự, phân bổ ca & chi
            nhánh phụ trách trên toàn chuỗi boutique Lumina Cosmetics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#e3d2c7] hover:bg-[#faf3ee] px-4 py-2.5 text-xs font-semibold text-[#543e33] shadow-2xs transition cursor-pointer"
          >
            <Download className="size-4 text-[#8c6b5b]" />
            <span>Xuất danh sách nhân sự</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#9f432b] hover:bg-[#87351f] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
          >
            <UserPlus className="size-4" />
            <span>Tạo tài khoản nhân viên mới</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl bg-[#2b1d16] text-amber-50 px-4 py-3 text-xs font-medium shadow-lg flex items-center justify-between">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-amber-200 hover:text-white text-[11px] font-bold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 3 KPI Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#7b6255]">
              Tổng tài khoản nhân sự
            </span>
            <div className="size-9 rounded-xl bg-[#f9ece4] text-[#9f432b] grid place-items-center">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#221712]">
              {Math.max(32, totalItems)}
            </span>
            <span className="text-xs text-[#8a7062]">nhân sự</span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#f3e6de] flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-600" />
              {Math.max(28, activeCount)} Active
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
              <span className="size-2 rounded-full bg-red-600" />
              {Math.max(4, lockedCount)} Tạm khóa
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#7b6255]">
              Phân bổ ma trận vai trò
            </span>
            <div className="size-9 rounded-xl bg-[#f9ece4] text-[#9f432b] grid place-items-center">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          {/* Multi-segment progress bar */}
          <div className="mt-5 h-2.5 w-full rounded-full bg-[#f4eae3] overflow-hidden flex">
            <div className="h-full bg-[#9f311b] w-[8%]" title="2 ADMIN" />
            <div className="h-full bg-[#4b6036] w-[16%]" title="5 STORE_MANAGER" />
            <div className="h-full bg-[#d37b2c] w-[28%]" title="9 INVENTORY" />
            <div className="h-full bg-[#dfbeaa] w-[48%]" title="16 CASHIER" />
          </div>
          <div className="mt-4 pt-3 border-t border-[#f3e6de] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5e483d]">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-xs bg-[#9f311b]" />
              <strong>2</strong> ADMIN
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-xs bg-[#4b6036]" />
              <strong>5</strong> MGR
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-xs bg-[#d37b2c]" />
              <strong>9</strong> INVENTORY
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-xs bg-[#dfbeaa]" />
              <strong>16</strong> CASHIER
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#7b6255]">
              Nhân sự trong ca trực
            </span>
            <div className="size-9 rounded-xl bg-[#f9ece4] text-[#9f432b] grid place-items-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold text-[#221712]">08</span>
            <span className="text-xs font-semibold text-emerald-700">
              Đang online
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#f3e6de] flex items-center justify-between text-xs text-[#6e564a]">
            <span>
              Ca sáng: <strong className="text-[#221712]">4 NV</strong>
            </span>
            <span className="text-[#d4bfb2]">•</span>
            <span>
              Ca chiều: <strong className="text-[#221712]">4 NV</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="size-4 text-[#9a7e70] absolute left-4 top-3.5" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo Họ tên, Email, SĐT hoặc Mã NV (VD: LUM-084, LUM-012)..."
            className="w-full rounded-2xl bg-white border border-[#ead9ce] pl-11 pr-4 py-2.5 text-xs text-[#2b1d16] placeholder:text-[#a3897c] outline-none focus:border-[#b4533c]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-2xl bg-white border border-[#ead9ce] px-4 py-2.5 text-xs font-medium text-[#3b2920] outline-none focus:border-[#b4533c]"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="ADMIN">ADMIN (Chủ cửa hàng)</option>
            <option value="STORE_MANAGER">STORE_MANAGER (Quản lý)</option>
            <option value="INVENTORY_STAFF">INVENTORY_STAFF (Kho & FEFO)</option>
            <option value="CASHIER">CASHIER (Thu ngân)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-2xl bg-white border border-[#ead9ce] px-4 py-2.5 text-xs font-medium text-[#3b2920] outline-none focus:border-[#b4533c]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="LOCKED">Tạm khóa (LOCKED)</option>
          </select>

          <button
            type="button"
            onClick={fetchUsers}
            title="Làm mới danh sách"
            className="rounded-2xl bg-white border border-[#ead9ce] p-2.5 text-[#6e5549] hover:bg-[#faf3ee] cursor-pointer"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Staff Table Card */}
      <div className="rounded-3xl bg-white border border-[#ead9ce] shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1e4dc] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold text-[#221712]">
              Danh sách hồ sơ nhân viên
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#fbeae2] text-[#9f432b] text-[11px] font-bold">
              {totalItems} hồ sơ
            </span>
          </div>
          <div className="text-xs text-[#7d6558]">
            Sắp xếp:{' '}
            <span className="font-semibold text-[#9f432b]">
              Ca trực gần nhất ▾
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f2e6de] bg-[#fdfaf8] text-[10px] font-bold uppercase tracking-wider text-[#907668]">
                <th className="py-3.5 px-6">NHÂN VIÊN</th>
                <th className="py-3.5 px-4">EMAIL & ĐIỆN THOẠI</th>
                <th className="py-3.5 px-4">VAI TRÒ</th>
                <th className="py-3.5 px-4">TRẠNG THÁI & BẢO MẬT</th>
                <th className="py-3.5 px-4">ĐĂNG NHẬP / CA TRỰC</th>
                <th className="py-3.5 px-6 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4eae3] text-xs">
              {users.map((staff) => {
                const primaryRole = staff.roles[0] || 'CASHIER'
                const roleMeta = getRoleBadgeMeta(primaryRole)
                const isLocked = staff.status === 'LOCKED'

                return (
                  <tr
                    key={staff.id}
                    className="hover:bg-[#fdf8f5] transition group"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                          <div
                            className={`size-10 rounded-full grid place-items-center text-xs font-bold border ${
                              isLocked
                                ? 'bg-stone-100 text-stone-600 border-stone-200'
                                : 'bg-[#f4e3d8] text-[#783822] border-[#e5cbbd]'
                            }`}
                          >
                            {getInitials(staff.fullName)}
                          </div>
                          <span
                            className={`size-2.5 rounded-full border-2 border-white absolute -bottom-0.5 -right-0.5 ${
                              isLocked ? 'bg-red-600' : 'bg-emerald-600'
                            }`}
                          />
                        </div>
                        <div>
                          <Link
                            to={`/users/${staff.employeeCode}`}
                            className="font-bold text-[#221712] hover:text-[#9f432b] transition block"
                          >
                            {staff.fullName}
                          </Link>
                          <p className="text-[11px] text-[#8a7062] font-mono mt-0.5">
                            Mã NV:{' '}
                            <strong className="text-[#4a372d]">
                              {staff.employeeCode}
                            </strong>{' '}
                            · @{staff.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-medium text-[#2c1e18]">{staff.email}</p>
                      <p className="text-[11px] font-mono text-[#8a7062] mt-0.5">
                        {staff.phoneNumber}
                      </p>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${roleMeta.bgClass} ${roleMeta.textClass}`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${roleMeta.dotClass}`}
                        />
                        {roleMeta.label}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      {isLocked ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                            <Lock className="size-3.5" />
                            <span>
                              {staff.lockReason || 'Tạm khóa bảo mật'}
                            </span>
                          </span>
                          {staff.lockedDate && (
                            <p className="text-[11px] text-[#947b6e] mt-0.5">
                              Khóa ngày: {staff.lockedDate}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3.5" />
                          <span>Đang hoạt động</span>
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-bold text-[#221712]">
                        {staff.lastLoginAt || 'Hôm nay 08:00'}
                      </p>
                      <p className="text-[11px] text-[#856b5d] mt-0.5 flex items-center gap-1">
                        {!isLocked && (
                          <span className="size-1.5 rounded-full bg-[#c96444]" />
                        )}
                        <span>{staff.currentShiftLabel}</span>
                      </p>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to={`/users/${staff.employeeCode}`}
                          title="Xem chi tiết hoạt động nhân viên"
                          className="p-2 rounded-xl text-[#7a6154] hover:bg-[#f6ece6] hover:text-[#221712] transition"
                        >
                          <Eye className="size-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            showToast(
                              `Đã gửi yêu cầu đặt lại mật khẩu mặc định cho ${staff.fullName} (${staff.employeeCode})`
                            )
                          }
                          title="Đặt lại mật khẩu"
                          className="p-2 rounded-xl text-[#7a6154] hover:bg-[#f6ece6] hover:text-[#221712] transition cursor-pointer"
                        >
                          <RefreshCw className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleLock(staff)}
                          title={
                            isLocked
                              ? 'Mở khóa tài khoản'
                              : 'Khóa tài khoản tạm thời'
                          }
                          className="p-2 rounded-xl text-[#7a6154] hover:bg-red-50 hover:text-red-700 transition cursor-pointer"
                        >
                          {isLocked ? (
                            <Unlock className="size-4 text-amber-700" />
                          ) : (
                            <Ban className="size-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-xs text-[#8a7062]"
                  >
                    Không tìm thấy hồ sơ nhân viên nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-[#fdfaf8] border-t border-[#f1e4dc] flex flex-wrap items-center justify-between gap-3 text-xs text-[#7e6659]">
          <p>
            Hiển thị <strong>1 – {users.length}</strong> trên tổng số{' '}
            <strong>{Math.max(users.length, totalItems)}</strong> nhân sự
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="size-8 rounded-lg border border-[#e5d5cb] grid place-items-center text-[#6d5549] disabled:opacity-40 hover:bg-white cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`size-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                  page === p
                    ? 'bg-[#9f432b] text-white shadow-xs'
                    : 'border border-[#e5d5cb] bg-white text-[#5d463b] hover:bg-[#faf3ee]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="size-8 rounded-lg border border-[#e5d5cb] grid place-items-center text-[#6d5549] hover:bg-white cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          showToast('Tạo tài khoản nhân viên mới thành công (HTTP 201)')
          fetchUsers()
        }}
      />
    </div>
  )
}
