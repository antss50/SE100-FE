import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Briefcase,
  CheckCircle2,
  Edit3,
  FileText,
  History,
  Info,
  Lock,
  LogOut,
  Mail,
  Phone,
  RotateCcw,
  Shield,
  ShieldCheck,
  TrendingUp,
  Unlock,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useUiStore } from '../../app/store'
import { ApiClientError } from '../../lib/api-client'
import { usersService } from '../../services/users.service'
import type { UserItem } from '../../types/api'
import { formatNumber, getInitials, getRoleBadgeMeta } from '../../utils/format'

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const openChangePassword = useUiStore((s) => s.openChangePassword)

  const [staff, setStaff] = useState<UserItem | null>(null)
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOGS'>('OVERVIEW')
  const [eventFilter, setEventFilter] = useState<string>('ALL')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    usersService.getUserById(userId || 'LUM-084').then((data) => {
      setStaff(data)
      setEditFullName(data.fullName)
      setEditEmail(data.email)
      setEditPhone(data.phoneNumber)
    })
  }, [userId])

  if (!staff) {
    return (
      <div className="p-8 text-center text-xs text-[#8a7062]">
        Đang tải hồ sơ hoạt động nhân viên...
      </div>
    )
  }

  const primaryRole = staff.roles[0] || 'CASHIER'
  const roleMeta = getRoleBadgeMeta(primaryRole)
  const isLocked = staff.status === 'LOCKED'

  const showNotice = (msg: string) => {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(null), 3500)
  }

  const handleToggleLock = async () => {
    try {
      const updated = await usersService.toggleUserLock(staff)
      setStaff(updated)
      showNotice(
        updated.status === 'LOCKED'
          ? 'Đã khóa tạm thời tài khoản nhân viên'
          : 'Đã kích hoạt lại tài khoản nhân viên'
      )
    } catch (err) {
      if (err instanceof ApiClientError) {
        showNotice(err.message)
      }
    }
  }

  const handleSaveProfile = async () => {
    const updated = await usersService.updateUserProfile(staff.id, {
      fullName: editFullName,
      email: editEmail,
      phoneNumber: editPhone,
    })
    setStaff(updated)
    setIsEditOpen(false)
    showNotice('Đã cập nhật thông tin hồ sơ nhân viên')
  }

  const weeklyChart = staff.weeklyRevenue || [
    { day: 'T2', amount: 15200000 },
    { day: 'T3', amount: 21400000 },
    { day: 'T4', amount: 18900000 },
    { day: 'T5', amount: 17100000 },
    { day: 'T6', amount: 29800000, isPeak: true },
    { day: 'T7', amount: 32180000, isPeak: true },
    { day: 'CN', amount: 6940000 },
  ]
  const maxDayAmount = Math.max(...weeklyChart.map((d) => d.amount), 1)

  const logs = (staff.activityLogs || []).filter((item) => {
    if (eventFilter === 'ALL') return true
    return item.category === eventFilter
  })

  return (
    <div className="space-y-5">
      {/* Breadcrumb & Back Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#7e6659]">
          <Link to="/users" className="hover:text-[#221712]">
            Nhân sự & Hệ thống
          </Link>
          <span>›</span>
          <Link to="/users" className="hover:text-[#221712]">
            Hồ sơ nhân viên
          </Link>
          <span>›</span>
          <span className="font-bold text-[#221712]">
            {staff.fullName} ({staff.employeeCode})
          </span>
        </div>

        <Link
          to="/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5b4439] hover:text-[#9f432b]"
        >
          <ArrowLeft className="size-3.5" />
          <span>Quay lại danh sách nhân viên</span>
        </Link>
      </div>

      {/* Security Banner */}
      <div className="rounded-2xl bg-[#fcf6f2] border border-[#ebd9ce] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-4 text-[#9f432b]" />
          <span className="text-[#5e473b]">Trạng thái bảo mật hồ sơ:</span>
          {isLocked ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[11px]">
              <span className="size-1.5 rounded-full bg-red-600" />
              Đang tạm khóa ({staff.lockReason || 'Khóa bảo mật'})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
              <span className="size-1.5 rounded-full bg-emerald-600" />
              Đang hoạt động bình thường
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#836a5d]">
          <Info className="size-3.5" />
          <span>Xem hồ sơ nhân viên quầy</span>
          <span>•</span>
          <span className="italic">
            Chỉ Quản lý cửa hàng hoặc Admin có quyền sửa & khóa
          </span>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-2xl bg-[#2b1d16] text-amber-50 px-4 py-3 text-xs font-medium shadow-md">
          {statusMessage}
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-5">
          <div className="relative shrink-0">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-[#d9886a] to-[#873b22] text-white grid place-items-center text-2xl font-extrabold shadow-sm">
              {getInitials(staff.fullName)}
            </div>
            <span
              className={`size-4 rounded-full border-2 border-white absolute -bottom-1 -right-1 ${
                isLocked ? 'bg-red-600' : 'bg-emerald-600'
              }`}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#221712]">
                {staff.fullName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#fbeae2] text-[#9f432b] font-mono text-xs font-bold">
                {staff.employeeCode}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${roleMeta.bgClass} ${roleMeta.textClass}`}
              >
                {roleMeta.label}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#695246]">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isLocked
                    ? 'bg-red-50 text-red-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                ● {isLocked ? 'Tạm khóa' : 'Đang hoạt động'}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Mail className="size-3.5 text-[#9a7e70]" />
                {staff.email}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Phone className="size-3.5 text-[#9a7e70]" />
                {staff.phoneNumber}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-[#7d6558] flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-[#9a7e70]" />
              <span>{staff.jobTitle || 'Nhân sự vận hành điểm bán'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#9f432b] hover:bg-[#863520] text-white px-4 py-2.5 text-xs font-semibold transition cursor-pointer"
            >
              <Edit3 className="size-3.5" />
              <span>Chỉnh sửa hồ sơ</span>
            </button>
            <button
              type="button"
              onClick={openChangePassword}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#e2d0c5] hover:bg-[#faf3ee] text-[#4b372e] px-4 py-2.5 text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Đặt lại mật khẩu</span>
            </button>
            <button
              type="button"
              onClick={handleToggleLock}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 px-4 py-2.5 text-xs font-semibold transition cursor-pointer"
            >
              {isLocked ? (
                <>
                  <Unlock className="size-3.5" />
                  <span>Mở khóa tài khoản</span>
                </>
              ) : (
                <>
                  <Ban className="size-3.5" />
                  <span>Khóa tài khoản</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-[#9a8174]">
            Không thể khóa tài khoản Quản trị viên hệ thống.
          </p>
        </div>
      </div>

      {/* 2-Column Content Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Performance & Activity Feed */}
        <div className="lg:col-span-8 rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f2e6de] pb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('OVERVIEW')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-[#fbeae2] text-[#9f432b]'
                    : 'text-[#7b6255] hover:bg-[#faf3ee]'
                }`}
              >
                <TrendingUp className="size-3.5" />
                <span>Tổng quan</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('LOGS')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'LOGS'
                    ? 'bg-[#fbeae2] text-[#9f432b]'
                    : 'text-[#7b6255] hover:bg-[#faf3ee]'
                }`}
              >
                <History className="size-3.5" />
                <span>Nhật ký hoạt động</span>
              </button>
            </div>
            <span className="text-xs font-mono font-semibold text-[#6b5346]">
              Tháng 10/2026
            </span>
          </div>

          {activeTab === 'OVERVIEW' && (
            <>
              {/* 3 Performance Metrics */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#eee0d7] p-4 bg-[#fdfaf8]">
                  <div className="flex items-center justify-between text-xs text-[#7d6457]">
                    <span>Doanh thu thuần</span>
                    <FileText className="size-4 text-[#9f432b]" />
                  </div>
                  <p className="mt-2 font-mono text-xl font-extrabold text-[#221712]">
                    {formatNumber(staff.monthlyNetRevenue ?? 148520000)}{' '}
                    <span className="text-xs font-semibold">đ</span>
                  </p>
                  <p className="mt-2 pt-2 border-t border-[#f2e5dc] text-[11px] text-[#8b7265]">
                    Tiền hàng – Giảm giá – Trả hàng
                  </p>
                </div>

                <div className="rounded-2xl border border-[#eee0d7] p-4 bg-[#fdfaf8]">
                  <div className="flex items-center justify-between text-xs text-[#7d6457]">
                    <span>Đơn hoàn tất</span>
                    <FileText className="size-4 text-[#9f432b]" />
                  </div>
                  <p className="mt-2 font-mono text-xl font-extrabold text-[#221712]">
                    {staff.monthlyCompletedOrders ?? 218}{' '}
                    <span className="text-xs font-semibold">đơn</span>
                  </p>
                  <p className="mt-2 pt-2 border-t border-[#f2e5dc] text-[11px] font-medium text-emerald-700">
                    Xử lý thanh toán nhanh tại quầy
                  </p>
                </div>

                <div className="rounded-2xl border border-[#eee0d7] p-4 bg-[#fdfaf8]">
                  <div className="flex items-center justify-between text-xs text-[#7d6457]">
                    <span>Phiếu trả hàng</span>
                    <RotateCcw className="size-4 text-[#9f432b]" />
                  </div>
                  <p className="mt-2 font-mono text-xl font-extrabold text-[#221712]">
                    {staff.monthlyReturnOrders ?? 4}{' '}
                    <span className="text-xs font-semibold">phiếu</span>
                  </p>
                  <p className="mt-2 pt-2 border-t border-[#f2e5dc] text-[11px] text-[#8b7265]">
                    Tỷ lệ trả <strong>{staff.returnRatePercent ?? 1.8}%</strong>{' '}
                    (Trong hạn mức cho phép)
                  </p>
                </div>
              </div>

              {/* 7-Day Net Revenue Bar Chart */}
              <div className="rounded-2xl border border-[#eee0d7] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#221712]">
                      Doanh thu thuần 7 ngày gần nhất
                    </h3>
                    <p className="text-[11px] text-[#8c7365]">
                      Số liệu ghi nhận hóa đơn bán tại quầy
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#7c6356]">
                    Tuần 42
                  </span>
                </div>

                <div className="mt-6 h-40 flex items-end justify-between gap-3 px-2">
                  {weeklyChart.map((item) => {
                    const heightPct = Math.max(
                      12,
                      Math.round((item.amount / maxDayAmount) * 100)
                    )
                    return (
                      <div
                        key={item.day}
                        className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
                      >
                        <div
                          style={{ height: `${heightPct}%` }}
                          title={`${item.day}: ${formatNumber(item.amount)} đ`}
                          className={`w-full max-w-[44px] rounded-t-xl transition-all ${
                            item.isPeak
                              ? 'bg-[#8f381e] shadow-sm'
                              : 'bg-[#e6dad3] hover:bg-[#d5c2b7]'
                          }`}
                        />
                        <span
                          className={`text-[11px] font-mono ${
                            item.isPeak
                              ? 'font-bold text-[#8f381e]'
                              : 'text-[#8c7365]'
                          }`}
                        >
                          {item.day}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-[#f3e6de] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#866d60]">
                  <span>
                    * Đỉnh điểm doanh thu rơi vào Thứ 7 (32.180.000 đ)
                  </span>
                  <span className="font-mono">TB ngày: 21.217.000 đ</span>
                </div>
              </div>
            </>
          )}

          {/* Event Filter Pills & Activity Feed */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'ALL', label: 'Tất cả sự kiện' },
                { key: 'LOGIN', label: 'Đăng nhập' },
                { key: 'PASSWORD', label: 'Mật khẩu & Khóa' },
                { key: 'OVERRIDE_FEFO', label: 'Đổi lô thủ công (OVERRIDE_FEFO)' },
                { key: 'DISCARD_APPROVAL', label: 'Duyệt phiếu xuất/hủy' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setEventFilter(pill.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    eventFilter === pill.key
                      ? 'bg-[#7d3620] text-white'
                      : 'bg-[#f8f1ec] text-[#6d5448] hover:bg-[#f0e3da]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {logs.map((log) => {
                const isWarning = log.severity === 'warning'
                return (
                  <div
                    key={log.id}
                    className={`rounded-2xl border p-4 flex items-start justify-between gap-4 ${
                      isWarning
                        ? 'bg-[#fff9eb] border-[#f3d99b]'
                        : 'bg-white border-[#ede0d7]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`size-9 rounded-xl grid place-items-center shrink-0 mt-0.5 ${
                          isWarning
                            ? 'bg-amber-500 text-white'
                            : log.severity === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-[#f7ede6] text-[#785e51]'
                        }`}
                      >
                        {isWarning ? (
                          <AlertTriangle className="size-4" />
                        ) : log.severity === 'success' ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <Lock className="size-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#221712]">
                          {log.title}{' '}
                          {log.highlightCode && (
                            <span className="font-mono text-[#9f432b]">
                              {log.highlightCode}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-[#695246] leading-relaxed">
                          {log.description}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#8a7062] shrink-0">
                      {log.timestamp}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Account Security & Role Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f2e6de]">
              <Shield className="size-4 text-[#9f432b]" />
              <h2 className="text-sm font-bold text-[#221712]">
                Bảo mật tài khoản
              </h2>
            </div>

            <div className="rounded-2xl border border-[#efe2d9] p-3.5 flex items-center justify-between text-xs">
              <span className="text-[#785f52]">Tên đăng nhập</span>
              <span className="font-mono font-bold text-[#221712]">
                {staff.username}
              </span>
            </div>

            <div className="rounded-2xl border border-[#efe2d9] p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#785f52]">Lần đăng nhập gần nhất</span>
                <span className="font-mono font-bold text-[#221712]">
                  08:02:15
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#8d7467]">
                {staff.lastLoginAt} · {staff.lastLoginDevice}
              </p>
            </div>

            <div className="rounded-2xl border border-[#efe2d9] p-3.5 flex items-center justify-between text-xs">
              <span className="text-[#785f52]">Đổi mật khẩu lần đầu</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                {staff.mustChangePassword ? 'Chưa đổi' : 'Đã hoàn tất'}
              </span>
            </div>

            <div className="rounded-2xl border border-[#efe2d9] p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#785f52]">Sai mật khẩu liên tiếp</span>
                <span className="font-mono font-bold text-[#221712]">
                  {staff.failedLoginCount ?? 0} / 5 lần
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                An toàn (Dưới ngưỡng 5 lần)
              </p>
            </div>

            <div className="rounded-2xl border border-[#efe2d9] p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#785f52]">Trạng thái khóa tạm</span>
                <span
                  className={`font-bold ${
                    isLocked ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {isLocked ? 'Đang khóa' : 'Không có'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#8d7467] leading-relaxed">
                Nếu nhập sai 5 lần: Khóa tạm 30 phút kèm đồng hồ đếm ngược tự
                động.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                showNotice(
                  `Đã thu hồi toàn bộ Refresh Token của tài khoản ${staff.username}`
                )
              }
              className="w-full rounded-xl border border-red-200 hover:bg-red-50 text-red-700 py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Thu hồi phiên đăng nhập</span>
            </button>
          </div>

          <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f2e6de]">
              <ShieldCheck className="size-4 text-[#9f432b]" />
              <h2 className="text-sm font-bold text-[#221712]">
                Vai trò & Phân quyền
              </h2>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#785f52]">Tên vai trò</span>
              <span className="px-3 py-1 rounded-full bg-[#fbeae2] text-[#9f432b] font-bold text-[11px]">
                {roleMeta.viTitle.toUpperCase()} ({roleMeta.label})
              </span>
            </div>

            <p className="text-xs text-[#695246] leading-relaxed">
              Nhân sự vận hành điểm bán, thực hiện giao dịch và in hóa đơn tại
              quầy.
            </p>

            <div className="rounded-2xl bg-[#fdf8f5] border border-[#efe2d9] p-3.5 text-[11px] text-[#7a6154] leading-relaxed">
              <strong className="text-[#9f432b] block mb-1">
                ◎ Chính sách phân quyền hệ thống:
              </strong>
              Các quyền thao tác được cố định theo ma trận quyền chuẩn Lumina POS
              và áp dụng thống nhất cho toàn bộ quầy thu ngân.
            </div>

            <Link
              to="/rbac"
              className="w-full rounded-xl border border-[#e3d1c6] hover:bg-[#faf3ee] text-[#3a281f] py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <span>Xem ma trận phân quyền hệ thống</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#ead9ce] shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#221712]">
              Chỉnh sửa hồ sơ nhân viên ({staff.employeeCode})
            </h3>
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Họ và tên
              </label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e5d4c9] px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Email
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e5d4c9] px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Số điện thoại
              </label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e5d4c9] px-3.5 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#e3d2c7] text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="px-4 py-2 rounded-xl bg-[#9f432b] text-white text-xs font-semibold cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

