import {
  ArrowRight,
  Award,
  Ban,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileText,
  Gift,
  Heart,
  Mail,
  Phone,
  Search,
  ShoppingCart,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { customersService } from '../../services/customers.service'
import {
  parseCustomerNote,
  serializeCustomerNote,
} from '../../utils/customer-note'
import type { CustomerItem, SkinType } from '../../types/api'
import {
  formatCurrency,
  formatNumber,
  getInitials,
  getSkinTypeLabel,
} from '../../utils/format'

export function CustomerDetailPage() {
  const { customerCode } = useParams<{ customerCode: string }>()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<CustomerItem | null>(null)
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'POINTS' | 'PROFILE'>(
    'ORDERS'
  )
  const [orderSearch, setOrderSearch] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSkinType, setEditSkinType] = useState<SkinType>('COMBINATION')
  const [editCareNote, setEditCareNote] = useState('')

  useEffect(() => {
    customersService
      .getCustomerByCode(customerCode || 'KH-2024-001')
      .then((res) => setCustomer(res.data))
      .catch(() => {
        // fallback to first customer
        customersService
          .getCustomerByCode('KH-2024-001')
          .then((res) => setCustomer(res.data))
      })
  }, [customerCode])

  if (!customer) {
    return (
      <div className="p-8 text-center text-xs text-[#8a7062]">
        Đang tải hồ sơ khách hàng...
      </div>
    )
  }

  const parsedNote = parseCustomerNote(customer.note)
  const isInactive = customer.status === 'INACTIVE'
  const totalSpentNum = parseFloat(customer.totalSpent || '0')
  const ordersCount =
    customer.completedOrdersCount || customer.orderHistories?.length || 1
  const avgOrderVal = Math.round(totalSpentNum / Math.max(1, ordersCount))

  const openEditModal = () => {
    setEditFullName(customer.fullName)
    setEditPhone(customer.phoneNumber)
    setEditEmail(customer.email || '')
    setEditAddress(customer.address || '')
    setEditSkinType(customer.skinType || 'COMBINATION')
    setEditCareNote(parsedNote.careNote || '')
    setIsEditModalOpen(true)
  }

  const handleSaveCustomerEdit = async () => {
    const nextNote = serializeCustomerNote({
      ...parsedNote,
      careNote: editCareNote,
    })
    const updated = await customersService.updateCustomer(
      customer.customerCode,
      {
        fullName: editFullName,
        phoneNumber: editPhone,
        email: editEmail,
        address: editAddress,
        skinType: editSkinType,
        note: nextNote,
      }
    )
    setCustomer(updated)
    setIsEditModalOpen(false)
    setToastMsg(`Đã cập nhật hồ sơ khách hàng ${updated.customerCode}`)
    setTimeout(() => setToastMsg(null), 3200)
  }

  const handleToggleStatus = async () => {
    const updated = await customersService.toggleCustomerStatus(customer)
    setCustomer(updated)
    setToastMsg(
      updated.status === 'INACTIVE'
        ? `Đã tạm ngừng hoạt động hồ sơ ${updated.customerCode}`
        : `Đã kích hoạt lại hồ sơ ${updated.customerCode}`
    )
    setTimeout(() => setToastMsg(null), 3200)
  }

  const orders = (customer.orderHistories || []).filter((o) => {
    if (!orderSearch.trim()) return true
    const kw = orderSearch.trim().toLowerCase()
    return (
      o.orderCode.toLowerCase().includes(kw) ||
      o.mainProductName.toLowerCase().includes(kw)
    )
  })

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#7e6659]">
            <Link to="/customers" className="hover:text-[#221712]">
              Quản lý khách hàng
            </Link>
            <span>/</span>
            <span className="px-2 py-0.5 rounded bg-[#f5e6dc] text-[#9a462d] font-mono font-bold">
              {customer.customerCode}
            </span>
          </div>

          <h1 className="mt-2 text-2xl sm:text-[26px] font-extrabold text-[#221712]">
            Hồ sơ khách hàng: {customer.fullName}
          </h1>

          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isInactive
                  ? 'bg-red-100 text-red-800'
                  : 'bg-[#f4e8df] text-[#6d4b38]'
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  isInactive ? 'bg-red-600' : 'bg-[#8c5233]'
                }`}
              />
              {isInactive ? 'Ngừng hoạt động' : 'Đang hoạt động'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openEditModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#e3d2c7] hover:bg-[#faf3ee] px-4 py-2.5 text-xs font-bold text-[#3f2c23] cursor-pointer"
          >
            <Edit3 className="size-3.5" />
            <span>Chỉnh sửa hồ sơ</span>
          </button>

          <button
            type="button"
            onClick={handleToggleStatus}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 px-4 py-2.5 text-xs font-bold text-red-700 cursor-pointer"
          >
            <Ban className="size-3.5" />
            <span>{isInactive ? 'Kích hoạt lại' : 'Ngừng hoạt động'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#8f422a] hover:bg-[#77341f] text-white px-5 py-2.5 text-xs font-bold shadow-sm cursor-pointer"
          >
            <ShoppingCart className="size-4" />
            <span>Tạo đơn hàng POS</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl bg-[#2b1d16] text-amber-50 px-4 py-3 text-xs font-medium shadow-md">
          {toastMsg}
        </div>
      )}

      {/* VIP Membership Card + 3 Stat Cards Grid */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Luxury VIP Club Card (5 Cols) */}
        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-[#6d321c] via-[#7c3920] to-[#4e2111] text-amber-50 p-6 shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-white/15 border border-white/25 grid place-items-center">
                <Award className="size-5 text-amber-200" />
              </div>
              <div>
                <p className="text-xs font-extrabold tracking-wider uppercase text-amber-100">
                  LUMINA VIP CLUB ✦
                </p>
                <p className="font-mono text-[10px] tracking-[0.15em] text-amber-200/80 uppercase">
                  BOUTIQUE ATELIER PRIVILEGE
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#f5deb3] text-[#4e2111] text-[11px] font-extrabold uppercase">
              {customer.tier?.tierName?.replace('Hạng ', '') || 'HỘI VIÊN'}
            </span>
          </div>

          <div className="my-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-amber-200/75">
              CHỦ SỞ HỮU THẺ
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-wide uppercase text-white">
              {customer.fullName}
            </h2>
            <p className="mt-1 font-mono text-xs text-amber-200/90">
              {customer.customerCode} • Gia nhập:{' '}
              {customer.joinedAt || '18/02/2023'}
            </p>
          </div>

          <div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase text-amber-200/80">
                  ĐIỂM KHẢ DỤNG
                </p>
                <p className="font-mono text-2xl font-extrabold text-amber-100">
                  {formatNumber(customer.rewardPoints)}{' '}
                  <span className="text-xs font-normal text-amber-200/90">
                    pts (~{formatCurrency(customer.rewardPoints * 100)})
                  </span>
                </p>
              </div>

              <div className="text-right">
                <p className="font-mono text-[10px] uppercase text-amber-200/80">
                  ĐẶC QUYỀN HẠNG
                </p>
                <span className="mt-1 inline-block px-2.5 py-1 rounded-lg bg-white/15 text-[11px] font-bold text-amber-50">
                  Giảm{' '}
                  {Math.round(
                    parseFloat(customer.tier?.discountRate || '0.12') * 100
                  )}
                  % + Quà VIP
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/15">
              <div className="flex items-center justify-between text-[11px] text-amber-100/90">
                <span>Tiến độ cấp bậc</span>
                <span className="font-bold">Cấp tối đa (100%)</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/30 overflow-hidden">
                <div className="h-full bg-amber-300 w-full rounded-full" />
              </div>
              <p className="mt-1.5 text-[10px] italic text-amber-200/80 text-center">
                Đã đạt cấp bậc cao nhất của hệ thống Lumina
              </p>
            </div>
          </div>
        </div>

        {/* 3 Right Metric Cards (7 Cols) */}
        <div className="lg:col-span-7 grid sm:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-xl bg-[#faf1ea] text-[#9a462d] grid place-items-center">
                <FileText className="size-4" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#fbeae2] text-[#9a462d] font-mono text-[10px] font-bold">
                +18% năm 2024
              </span>
            </div>

            <div className="my-4">
              <p className="font-mono text-xs text-[#7c6255]">
                Tổng chi tiêu tích lũy
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-[#8f422a]">
                {formatNumber(totalSpentNum)}
              </p>
            </div>

            <p className="text-[11px] text-[#7c6255] pt-3 border-t border-[#f3e6de]">
              ↗ Trung bình: <strong>{formatCurrency(avgOrderVal)}</strong> / đơn
            </p>
          </div>

          <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-xl bg-[#faf1ea] text-[#9a462d] grid place-items-center">
                <FileText className="size-4" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#fbeae2] text-[#9a462d] font-mono text-[10px] font-bold">
                Top 5% Boutique
              </span>
            </div>

            <div className="my-4">
              <p className="font-mono text-xs text-[#7c6255]">
                Đơn hàng thành công
              </p>
              <p className="mt-1 font-mono text-3xl font-extrabold text-[#221712]">
                {ordersCount}{' '}
                <span className="text-xs font-normal text-[#7c6255]">đơn</span>
              </p>
            </div>

            <p className="text-[11px] text-[#7c6255] pt-3 border-t border-[#f3e6de]">
              ⇄ Tỷ lệ quay lại mua sắm: <strong>94%</strong>
            </p>
          </div>

          <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-xl bg-[#faf1ea] text-[#9a462d] grid place-items-center">
                <Clock className="size-4" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f5ebe4] text-[#7c6255] font-mono text-[10px] font-bold">
                Tại quầy
              </span>
            </div>

            <div className="my-4">
              <p className="font-mono text-xs text-[#7c6255]">
                Đơn hàng gần nhất
              </p>
              <p className="mt-1 text-lg font-extrabold text-[#221712]">
                {customer.lastOrderText || 'Hôm qua, 14:20'}
              </p>
            </div>

            <p className="text-[11px] text-[#7c6255] pt-3 border-t border-[#f3e6de]">
              <strong className="font-mono text-[#9a462d]">
                {customer.lastOrderCode || '#HD-90823'}
              </strong>{' '}
              {customer.lastOrderBranch || 'Chi nhánh Q.1'}
            </p>
          </div>
        </div>
      </div>

      {/* Customer Identity & Skin Summary Strip */}
      <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-[#f5e5db] text-[#8f422a] grid place-items-center font-extrabold text-sm shrink-0">
            {getInitials(customer.fullName)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-[#221712]">
                {customer.fullName}
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-[#f6ebe4] text-[#7a5d4e] font-mono text-[11px] font-semibold">
                {customer.gender === 'MALE' ? 'Nam' : 'Nữ'} • 31 tuổi
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#6e564a] font-mono">
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5 text-[#9a7e70]" />
                {customer.phoneNumber}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5 text-[#9a7e70]" />
                {customer.email || 'Chưa cập nhật email'}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5 text-[#9a7e70]" />
                {customer.dateOfBirth || '24/11/1993'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#faefe7] border border-[#ebd5c6] text-[#5e3927]">
            <Sparkles className="size-3.5 text-[#9a462d]" />
            <span>
              Loại da: <strong>{getSkinTypeLabel(customer.skinType)}</strong>
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#faefe7] border border-[#ebd5c6] text-[#5e3927]">
            <span>☼ Tình trạng:</span>
            <strong>
              {parsedNote.skinConcerns.length > 0
                ? parsedNote.skinConcerns.join(', ')
                : 'Chống lão hóa, nhạy cảm nhẹ'}
            </strong>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#faefe7] border border-[#ebd5c6] text-[#5e3927]">
            <Heart className="size-3.5 text-[#9a462d]" />
            <span>
              Brand chuộng:{' '}
              <strong>
                {parsedNote.favoriteBrands ||
                  customer.favoriteBrands ||
                  'Estée Lauder, YSL'}
              </strong>
            </span>
          </span>
        </div>
      </div>

      {/* Tabs & Content Area */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ORDERS')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'ORDERS'
                ? 'bg-[#f6e6dc] text-[#9a462d] border border-[#e5c9b8]'
                : 'bg-white border border-transparent text-[#6e564a] hover:bg-[#faf3ee]'
            }`}
          >
            <FileText className="size-4" />
            <span>Lịch sử mua hàng</span>
            <span className="px-2 py-0.5 rounded-full bg-[#e8cfc0] text-[#7c3720] font-mono text-[11px]">
              {ordersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('POINTS')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'POINTS'
                ? 'bg-[#f6e6dc] text-[#9a462d] border border-[#e5c9b8]'
                : 'bg-white border border-transparent text-[#6e564a] hover:bg-[#faf3ee]'
            }`}
          >
            <Gift className="size-4" />
            <span>Lịch sử điểm thưởng (+/-)</span>
            <span className="px-2 py-0.5 rounded-full bg-[#f0e4dc] text-[#6d5244] font-mono text-[11px]">
              {customer.pointHistories?.length || 0} giao dịch
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'PROFILE'
                ? 'bg-[#f6e6dc] text-[#9a462d] border border-[#e5c9b8]'
                : 'bg-white border border-transparent text-[#6e564a] hover:bg-[#faf3ee]'
            }`}
          >
            <UserCheck className="size-4" />
            <span>Thông tin cá nhân & Đặc điểm da</span>
          </button>
        </div>

        {/* TAB 1: ORDER HISTORY */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 max-w-md">
              <div className="relative flex-1">
                <Search className="size-4 text-[#9a7e70] absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Tìm theo mã hóa đơn, SKU"
                  className="w-full rounded-xl bg-white border border-[#e7d6cb] pl-10 pr-4 py-2 text-xs font-mono text-[#221712] outline-none focus:border-[#9a462d]"
                />
              </div>
              <button
                type="button"
                className="p-2 rounded-xl bg-[#f5e7de] text-[#7c432b] hover:bg-[#ead4c6] cursor-pointer"
                title="Tải lịch sử đơn hàng"
              >
                <Download className="size-4" />
              </button>
            </div>

            <div className="rounded-3xl bg-white border border-[#ead9ce] shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#faf3ee] border-b border-[#eedfd6] text-[10px] font-extrabold uppercase tracking-wider text-[#876d60]">
                      <th className="py-3.5 px-6">MÃ ĐƠN HÀNG</th>
                      <th className="py-3.5 px-4">NGÀY GIỜ MUA</th>
                      <th className="py-3.5 px-4">SẢN PHẨM CHÍNH</th>
                      <th className="py-3.5 px-4 text-right">
                        TỔNG THANH TOÁN
                      </th>
                      <th className="py-3.5 px-4 text-center">TÍCH ĐIỂM</th>
                      <th className="py-3.5 px-4 text-center">TRẠNG THÁI</th>
                      <th className="py-3.5 px-6 text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3e7df] text-xs">
                    {orders.map((ord) => (
                      <tr key={ord.orderCode} className="hover:bg-[#fdfaf8]">
                        <td className="py-4 px-6 font-mono font-bold text-[#9a462d]">
                          {ord.orderCode}
                        </td>
                        <td className="py-4 px-4 font-mono text-[11px] text-[#5e473b]">
                          {ord.purchasedAt}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className="size-9 rounded-xl bg-[#faefe7] border border-[#ebd7ca] text-[#8f422a] font-mono text-[10px] font-extrabold grid place-items-center shrink-0">
                              {ord.brandShort}
                            </span>
                            <div>
                              <p className="font-bold text-[#221712]">
                                {ord.mainProductName}
                              </p>
                              <p className="text-[11px] text-[#8a7062] mt-0.5">
                                {ord.subNote}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-extrabold text-[#221712]">
                          {formatCurrency(ord.totalPaid)}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-emerald-700">
                          +{ord.pointsEarned} pts
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                            ● Hoàn thành
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setToastMsg(
                                `Đang xem chi tiết hóa đơn ${ord.orderCode}`
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#faf1eb] hover:bg-[#f2dfd3] text-[#8f422a] text-[11px] font-bold cursor-pointer"
                          >
                            <span>Chi tiết</span>
                            <ArrowRight className="size-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 bg-[#fdfaf8] border-t border-[#f1e4dc] flex items-center justify-between text-xs text-[#7e6659]">
                <span>
                  Hiển thị {orders.length} trên {ordersCount} hóa đơn đã thanh
                  toán
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="size-8 rounded-lg border border-[#e5d5cb] grid place-items-center"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="size-8 rounded-lg bg-[#8f422a] text-white font-bold"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    className="size-8 rounded-lg border border-[#e5d5cb] bg-white font-bold"
                  >
                    2
                  </button>
                  <button
                    type="button"
                    className="size-8 rounded-lg border border-[#e5d5cb] grid place-items-center"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: POINT HISTORIES (UC-CUS-03 pointHistories) */}
        {activeTab === 'POINTS' && (
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#221712]">
              10 giao dịch tích/trừ điểm thưởng gần nhất (POINT_HISTORIES)
            </h3>

            {customer.pointHistories && customer.pointHistories.length > 0 ? (
              <div className="divide-y divide-[#f3e7df]">
                {customer.pointHistories.map((ph, idx) => (
                  <div
                    key={ph.id ?? idx}
                    className="py-3.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            ph.pointsChanged >= 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {ph.actionType}
                        </span>
                        <span className="font-bold text-[#221712]">
                          {ph.description || `Giao dịch đơn #${ph.orderId}`}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[#8a7062]">
                        Thời gian: {ph.createdAt}
                      </p>
                    </div>

                    <div className="text-right font-mono">
                      <p
                        className={`text-sm font-extrabold ${
                          ph.pointsChanged >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {ph.pointsChanged >= 0
                          ? `+${ph.pointsChanged}`
                          : ph.pointsChanged}{' '}
                        pts
                      </p>
                      <p className="text-[11px] text-[#7c6255]">
                        Số dư sau GD: <strong>{ph.balanceAfter} pts</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8a7062] py-6 text-center">
                Khách hàng chưa phát sinh lịch sử biến động điểm thưởng.
              </p>
            )}
          </div>
        )}

        {/* TAB 3: PERSONAL & SKIN PROFILE (Parsed from note) */}
        {activeTab === 'PROFILE' && (
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs grid md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#221712] pb-2 border-b border-[#f2e6de]">
                Thông tin định danh & Liên hệ
              </h3>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Mã khách hàng:</span>
                <span className="font-mono font-bold text-[#9a462d]">
                  {customer.customerCode}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Họ và tên:</span>
                <span className="font-bold text-[#221712]">
                  {customer.fullName}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Số điện thoại:</span>
                <span className="font-mono font-bold text-[#221712]">
                  {customer.phoneNumber}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Email:</span>
                <span>{customer.email || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Địa chỉ giao hàng:</span>
                <span className="text-right max-w-xs font-medium text-[#221712]">
                  {customer.address || 'TP. Hồ Chí Minh'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#221712] pb-2 border-b border-[#f2e6de]">
                Hồ sơ Làn da & Ghi chú tư vấn (Trường `note` đã phân tách)
              </h3>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Phân loại da (skinType):</span>
                <span className="font-bold text-[#8f422a]">
                  {getSkinTypeLabel(customer.skinType)} ({customer.skinType})
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Tình trạng da:</span>
                <span className="font-semibold text-[#221712]">
                  {parsedNote.skinConcerns.join(', ') || 'Chưa ghi nhận'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#7c6255]">Cảnh báo dị ứng:</span>
                <span className="font-semibold text-red-700">
                  {parsedNote.allergyNote || 'Không có tiền sử dị ứng'}
                </span>
              </div>
              <div className="pt-2">
                <span className="text-[#7c6255] block mb-1">
                  Ghi chú thói quen chăm sóc da:
                </span>
                <div className="rounded-xl bg-[#faf3ee] border border-[#ead9ce] p-3 text-[#4a362c] leading-relaxed">
                  {parsedNote.careNote || customer.note || 'Chưa có ghi chú'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#ead9ce] shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#221712]">
              Chỉnh sửa hồ sơ khách hàng ({customer.customerCode})
            </h3>
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Họ và tên khách hàng
              </label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e5d4c9] px-3.5 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#543e34]">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c9] px-3.5 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#543e34]">
                  Loại da (skinType)
                </label>
                <select
                  value={editSkinType}
                  onChange={(e) => setEditSkinType(e.target.value as SkinType)}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c9] px-3 py-2 text-xs"
                >
                  <option value="COMBINATION">Da hỗn hợp</option>
                  <option value="OILY">Da dầu</option>
                  <option value="DRY">Da khô</option>
                  <option value="SENSITIVE">Da nhạy cảm</option>
                  <option value="NORMAL">Da thường</option>
                </select>
              </div>
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
                Địa chỉ
              </label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e5d4c9] px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Ghi chú chăm sóc da
              </label>
              <textarea
                rows={3}
                value={editCareNote}
                onChange={(e) => setEditCareNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#e5d4c9] p-3 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#e3d2c7] text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCustomerEdit}
                className="px-4 py-2 rounded-xl bg-[#8f422a] text-white text-xs font-semibold cursor-pointer"
              >
                Lưu hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

