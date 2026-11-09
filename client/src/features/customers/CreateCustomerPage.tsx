import {
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { ApiClientError } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { customersService } from '../../services/customers.service'
import type { GenderType, SkinType } from '../../types/api'
import { serializeCustomerNote } from '../../utils/customer-note'

const SKIN_TYPE_OPTIONS: { code: SkinType; label: string }[] = [
  { code: 'OILY', label: 'Da dầu' },
  { code: 'COMBINATION', label: 'Da hỗn hợp thiên dầu' },
  { code: 'DRY', label: 'Da khô' },
  { code: 'SENSITIVE', label: 'Da nhạy cảm' },
  { code: 'NORMAL', label: 'Da thường' },
]

const SKIN_CONCERN_OPTIONS = [
  'Mụn ẩn',
  'Thâm nám',
  'Lão hóa',
  'Lỗ chân lông to',
]

export function CreateCustomerPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('Nguyễn Thị Lan')
  const [phoneNumber, setPhoneNumber] = useState('0912 345 678')
  const [email, setEmail] = useState('lan.nguyen@example.com')
  const [dateOfBirth, setDateOfBirth] = useState('1996-08-15')
  const [gender, setGender] = useState<GenderType>('FEMALE')
  const [address, setAddress] = useState(
    '124/8 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
  )
  const [skinType, setSkinType] = useState<SkinType>('COMBINATION')
  const [skinConcerns, setSkinConcerns] = useState<string[]>([
    'Mụn ẩn',
    'Thâm nám',
    'Lỗ chân lông to',
  ])
  const [allergyNote, setAllergyNote] = useState(
    'Dị ứng cồn khô, hương liệu nhân tạo đậm'
  )
  const [careNote, setCareNote] = useState(
    'Ưa chuộng serum chống oxy hóa và kem chống nắng nâng tông nhẹ. Thích các sản phẩm kết cấu mỏng nhẹ thẩm thấu nhanh.'
  )
  const canLock = useCan('CUSTOMER_LOCK')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cleanPhone = phoneNumber.replace(/\s+/g, '')
  const { data: duplicateCustomer } = useQuery({
    queryKey: queryKeys.customers.byPhone(cleanPhone),
    queryFn: () => customersService.findByPhone(cleanPhone),
    enabled: /^[0-9]{10,11}$/.test(cleanPhone),
  })
  const isPhoneValid = /^[0-9]{10,11}$/.test(cleanPhone) && !duplicateCustomer

  const toggleSkinConcern = (concern: string) => {
    setSkinConcerns((prev) =>
      prev.includes(concern)
        ? prev.filter((item) => item !== concern)
        : [...prev, concern]
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsSubmitting(true)

    try {
      const combinedNote = serializeCustomerNote({
        skinConcerns,
        allergyNote,
        favoriteBrands: '',
        careNote,
      })

      const res = await customersService.createCustomer({
        fullName,
        phoneNumber,
        email,
        dateOfBirth,
        gender,
        address,
        skinType,
        note: combinedNote,
        status,
      })

      navigate(`/customers/${res.data.customerCode}`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message}`)
      } else {
        setErrorMsg('Không thể thêm mới khách hàng. Vui lòng kiểm tra lại.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Breadcrumb & Top Action Bar */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[#8a7062]">
          <Link to="/customers" className="hover:text-[#221712]">
            Quản lý khách hàng
          </Link>
          <span>/</span>
          <span className="font-bold text-[#9a462d]">Thêm mới khách hàng</span>
        </div>

        <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#221712]">
              Thêm mới hồ sơ khách hàng hội viên
            </h1>
            <p className="mt-1 text-xs text-[#7c6255]">
              Hệ thống tự động khởi tạo mã khách hàng duy nhất. Số điện thoại
              được sử dụng để tra cứu tích điểm nhanh tại quầy POS.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/customers"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#e3d2c7] hover:bg-[#faf3ee] px-4 py-2.5 text-xs font-semibold text-[#543e33]"
            >
              <X className="size-3.5" />
              <span>Hủy bỏ</span>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f422a] hover:bg-[#77341f] text-white px-5 py-2.5 text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <Check className="size-3.5" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu khách hàng'}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 font-semibold flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 2-Column Form Layout */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 Cols): THÔNG TIN CƠ BẢN & ĐỊNH DANH */}
        <div className="lg:col-span-7 rounded-3xl bg-white border border-[#ead9ce] p-6 sm:p-7 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#f2e6de]">
            <div className="flex items-center gap-2.5">
              <User className="size-4 text-[#9a462d]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#221712]">
                THÔNG TIN CƠ BẢN & ĐỊNH DANH
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#fbeae2] text-[#9a462d] font-mono text-[10px] font-bold">
              Bắt buộc điền (*)
            </span>
          </div>

          {/* Auto-generated Customer Code */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#4b362c]">
                Mã định danh khách hàng
              </span>
              <span className="font-mono text-[11px] text-[#9a8173]">
                (Hệ thống tự động cấp)
              </span>
            </div>
            <div className="mt-1.5 rounded-xl bg-[#f7ede6] border border-[#e7d4c8] px-4 py-3 flex items-center justify-between">
              <span className="font-mono text-sm font-extrabold text-[#9a462d]">
                KH#### (cấp khi lưu)
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#7c6255]">
                <Lock className="size-3" />
                Khóa sinh mã tự động
              </span>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-[#4b362c]">
              Họ và tên khách hàng <span className="text-red-600">*</span>
            </label>
            <div className="mt-1.5 relative">
              <User className="size-4 text-[#9a7e70] absolute left-3.5 top-3" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên khách hàng"
                className="w-full rounded-xl bg-white border border-[#e5d3c8] focus:border-[#9a462d] pl-10 pr-4 py-2.5 text-xs font-medium text-[#221712] outline-none"
                required
              />
            </div>
          </div>

          {/* Primary Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-[#4b362c]">
              Số điện thoại chính (Tra cứu tại quầy POS){' '}
              <span className="text-red-600">*</span>
            </label>
            <div className="mt-1.5 relative">
              <Phone className="size-4 text-[#9a7e70] absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0912 345 678"
                className="w-full rounded-xl bg-white border border-[#e5d3c8] focus:border-[#9a462d] pl-10 pr-10 py-2.5 font-mono text-xs font-bold text-[#221712] outline-none"
                required
              />
              {isPhoneValid && (
                <CheckCircle2 className="size-4 text-[#7c5a46] absolute right-3.5 top-3" />
              )}
            </div>

            {isPhoneValid && (
              <div className="mt-2 rounded-xl bg-[#f9efe8] border border-[#ebd8cc] px-3.5 py-2 text-[11px] text-[#6d4f40] flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-[#9a462d] shrink-0" />
                <span>
                  Số điện thoại hợp lệ và chưa từng đăng ký tại hệ thống Lumina
                  POS.
                </span>
              </div>
            )}

            {/* Duplicate Phone Reference / Live Check Box (matching UI design) */}
            <div className="mt-3 rounded-2xl bg-[#fff7f5] border border-red-200/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-red-700">
                <span>
                  ⓘ Số điện thoại mẫu (Trường hợp trùng lặp để đối soát):
                </span>
                <span className="font-mono uppercase tracking-wider text-[10px]">
                  CẢNH BÁO TRÙNG
                </span>
              </div>
              <div className="rounded-xl bg-white border border-red-200 px-3.5 py-2 flex items-center justify-between font-mono text-xs font-bold text-red-700">
                <span>
                  📞 {duplicateCustomer ? cleanPhone : '0988 776 554'}
                </span>
                <button
                  type="button"
                  onClick={() => setPhoneNumber('0988776554')}
                  title="Thử kiểm tra số điện thoại trùng"
                  className="text-[10px] font-sans font-semibold underline text-red-600 cursor-pointer"
                >
                  Thử SĐT trùng
                </button>
              </div>
              <p className="text-[11px] text-red-700 leading-relaxed">
                Số điện thoại này đã thuộc về khách hàng{' '}
                <Link
                  to={`/customers/${duplicateCustomer?.customerCode || 'KH0006'}`}
                  className="font-bold underline"
                >
                  {duplicateCustomer?.fullName || 'Lê Minh Tâm'}
                </Link>{' '}
                (Mã thẻ: {duplicateCustomer?.customerCode || 'KH0006'}).
                Vui lòng kiểm tra lại.
              </p>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[#4b362c]">
              Địa chỉ Email (Nhận ưu đãi điện tử & Hóa đơn VAT)
            </label>
            <div className="mt-1.5 relative">
              <Mail className="size-4 text-[#9a7e70] absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lan.nguyen@example.com"
                className="w-full rounded-xl bg-white border border-[#e5d3c8] focus:border-[#9a462d] pl-10 pr-4 py-2.5 text-xs text-[#221712] outline-none"
              />
            </div>
          </div>

          {/* Date of Birth & Gender */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#4b362c]">Ngày sinh</label>
                <span className="font-mono text-[10px] text-[#9a462d] font-semibold">
                  Tặng Voucher B-Day
                </span>
              </div>
              <div className="mt-1.5 relative">
                <Calendar className="size-4 text-[#9a7e70] absolute left-3.5 top-3" />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-xl bg-white border border-[#e5d3c8] focus:border-[#9a462d] pl-10 pr-3.5 py-2.5 font-mono text-xs text-[#221712] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4b362c]">
                Giới tính
              </label>
              <div className="mt-1.5 rounded-xl bg-[#faf2ec] border border-[#ebd8cc] px-3.5 py-2.5 flex items-center justify-between text-xs">
                {[
                  { code: 'FEMALE', label: 'Nữ' },
                  { code: 'MALE', label: 'Nam' },
                  { code: 'OTHER', label: 'Khác' },
                ].map((g) => (
                  <label
                    key={g.code}
                    className="inline-flex items-center gap-1.5 font-medium text-[#3b2920] cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="gender"
                      checked={gender === g.code}
                      onChange={() => setGender(g.code as GenderType)}
                      className="accent-[#9a462d]"
                    />
                    <span>{g.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-[#4b362c]">
              Địa chỉ thường trú & Giao hàng
            </label>
            <div className="mt-1.5 relative">
              <MapPin className="size-4 text-[#9a7e70] absolute left-3.5 top-3" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Nhập số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                className="w-full rounded-xl bg-white border border-[#e5d3c8] focus:border-[#9a462d] pl-10 pr-4 py-2.5 text-xs text-[#221712] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column (5 Cols): Skin Characteristics + Membership Setup */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: ĐẶC ĐIỂM DA & GHI CHÚ MỸ PHẨM */}
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#f2e6de]">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[#9a462d]" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#221712]">
                  ĐẶC ĐIỂM DA & GHI CHÚ MỸ PHẨM
                </h2>
              </div>
              <span className="font-mono text-[10px] text-[#9a462d] font-semibold">
                Dành cho tư vấn
              </span>
            </div>

            {/* Skin Type (skinType) */}
            <div>
              <label className="block text-xs font-semibold text-[#4b362c]">
                Loại da (Phân loại chính)
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SKIN_TYPE_OPTIONS.map((opt) => {
                  const active = skinType === opt.code
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setSkinType(opt.code)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                        active
                          ? 'bg-[#8f422a] text-white shadow-2xs'
                          : 'bg-[#f6ede7] text-[#5e473c] hover:bg-[#ede0d6]'
                      }`}
                    >
                      {active ? `✓ ${opt.label}` : opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Skin Concerns (Multi-select serialized into note) */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#4b362c]">
                  Tình trạng da / Mối quan tâm
                </label>
                <span className="font-mono text-[10px] text-[#9a8173]">
                  Chọn nhiều
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SKIN_CONCERN_OPTIONS.map((concern) => {
                  const checked = skinConcerns.includes(concern)
                  return (
                    <label
                      key={concern}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition ${
                        checked
                          ? 'bg-[#fdf3ee] border-[#d3957c] text-[#6d3522] font-semibold'
                          : 'bg-[#faf6f3] border-[#e7d7cd] text-[#6e564a]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSkinConcern(concern)}
                        className="size-6 accent-[#8f422a]"
                      />
                      <span>{concern}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Cosmetic Allergy Note */}
            <div>
              <label className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                <span>Dị ứng thành phần mỹ phẩm (Lưu ý an toàn)</span>
              </label>
              <input
                type="text"
                value={allergyNote}
                onChange={(e) => setAllergyNote(e.target.value)}
                placeholder="VD: Dị ứng cồn khô, hương liệu nhân tạo..."
                className="mt-1.5 w-full rounded-xl bg-[#fcf8f6] border border-[#ead9ce] px-3.5 py-2.5 text-xs text-[#3b2920] outline-none focus:border-[#9a462d]"
              />
            </div>

            {/* Staff Care Note */}
            <div>
              <label className="block text-xs font-semibold text-[#4b362c]">
                Ghi chú nhân viên & Thói quen chăm sóc da
              </label>
              <textarea
                rows={3}
                value={careNote}
                onChange={(e) => setCareNote(e.target.value)}
                placeholder="Ghi chú thói quen sử dụng mỹ phẩm..."
                className="mt-1.5 w-full rounded-xl bg-[#fcf8f6] border border-[#ead9ce] p-3.5 text-xs text-[#3b2920] leading-relaxed outline-none focus:border-[#9a462d]"
              />
            </div>
          </div>

          {/* Card 2: THIẾT LẬP HỘI VIÊN & TRẠNG THÁI */}
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#f2e6de]">
              <Award className="size-4 text-[#9a462d]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#221712]">
                THIẾT LẬP HỘI VIÊN & TRẠNG THÁI
              </h2>
            </div>

            <div className="rounded-2xl bg-[#faefe7] border border-[#ebd6c8] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#e9c8aa] text-[#6e4124] grid place-items-center font-bold">
                  🏅
                </div>
                <div>
                  <p className="text-xs font-bold text-[#221712]">
                    Hạng hội viên ban đầu
                  </p>
                  <p className="font-mono text-[11px] text-[#855a40]">
                    Hạng Đồng (0 điểm tích lũy)
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-white text-[#855a40] font-mono text-[10px] font-extrabold">
                TIER 1
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4b362c]">
                Trạng thái hồ sơ
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label
                  className={`rounded-2xl border p-3.5 flex items-start gap-2.5 cursor-pointer transition ${
                    status === 'ACTIVE'
                      ? 'bg-[#faefe7] border-[#c98468]'
                      : 'bg-[#fcf9f7] border-[#ead9ce]'
                  }`}
                >
                  <input
                    type="radio"
                    name="customerStatus"
                    checked={status === 'ACTIVE'}
                    onChange={() => setStatus('ACTIVE')}
                    className="mt-0.5 accent-[#8f422a]"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#221712]">
                      Đang hoạt động
                    </p>
                    <p className="font-mono text-[10px] text-[#7c6255]">
                      Được phép tích điểm & mua
                    </p>
                  </div>
                </label>

                <label
                  className={`rounded-2xl border p-3.5 flex items-start gap-2.5 cursor-pointer transition ${
                    status === 'INACTIVE'
                      ? 'bg-[#faefe7] border-[#c98468]'
                      : 'bg-[#fcf9f7] border-[#ead9ce]'
                  }`}
                >
                  <input
                    type="radio"
                    name="customerStatus"
                    checked={status === 'INACTIVE'}
                    disabled={!canLock}
                    onChange={() => setStatus('INACTIVE')}
                    className="mt-0.5 accent-[#8f422a]"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#221712]">
                      Ngừng hoạt động
                    </p>
                    <p className="font-mono text-[10px] text-[#7c6255]">
                      Tạm khóa tài khoản
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-2xl bg-[#f9efe8] border border-[#ebd8cc] p-3.5 flex items-start gap-2.5 text-[11px] text-[#6d5244] leading-relaxed">
              <ShieldCheck className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
              <p>
                <strong>Quy chuẩn dữ liệu:</strong> Không xóa cứng khách hàng
                khi ngừng hoạt động để bảo toàn lịch sử hóa đơn kế toán, đối
                soát tồn kho và báo cáo thuế theo quy định.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          to="/customers"
          className="px-5 py-2.5 rounded-xl bg-white border border-[#e3d2c7] hover:bg-[#faf3ee] text-xs font-semibold text-[#543e33]"
        >
          Hủy bỏ thay đổi
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#8f422a] hover:bg-[#77341f] text-white text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-60"
        >
          <Save className="size-4" />
          <span>
            {isSubmitting ? 'Đang lưu thông tin...' : 'Lưu thông tin khách hàng'}
          </span>
        </button>
      </div>
    </form>
  )
}

