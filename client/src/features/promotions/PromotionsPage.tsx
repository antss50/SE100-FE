import {
  ArrowRight,
  Ban,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Gift,
  History,
  Info,
  Percent,
  PlusCircle,
  Printer,
  RefreshCw,
  Sliders,
  Ticket,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiClientError } from '../../lib/api-client'
import { promotionsService } from '../../services/promotions.service'
import type {
  ApplyScope,
  DiscountType,
  PromotionItem,
  PromotionReportData,
  PromotionType,
} from '../../types/api'
import { formatCurrency } from '../../utils/format'

function getTierGradientClass(tier?: string): string {
  switch (tier) {
    case 'Kim Cương':
      return 'bg-gradient-to-r from-[#bae6fd] via-[#60a5fa] to-[#2563eb] text-[#0f172a]'
    case 'Vàng':
      return 'bg-gradient-to-r from-[#fef08a] via-[#facc15] to-[#ca8a04] text-[#2b1d04]'
    case 'Bạc':
      return 'bg-gradient-to-r from-[#e5e7eb] via-[#d1d5db] to-[#9ca3af] text-[#111827]'
    case 'Đồng':
    default:
      return 'bg-gradient-to-r from-[#f5d0a9] via-[#e5a95c] to-[#c97a1d] text-[#261404]'
  }
}

function formatDateVN(isoDate: string): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

export function PromotionsPage() {
  const navigate = useNavigate()

  const [promotions, setPromotions] = useState<PromotionItem[]>([])
  const [tierSwitches, setTierSwitches] = useState({
    layer1: true,
    layer2: true,
    layer3: true,
    layer4: true,
  })
  const [reloadTick, setReloadTick] = useState(0)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Create / Edit Modal state (UC-PROM-02 & UC-PROM-03)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromotionItem | null>(null)
  const [promotionName, setPromotionName] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [promotionType, setPromotionType] =
    useState<PromotionType>('PERCENT_ORDER')
  const [applyScope, setApplyScope] = useState<ApplyScope>('ALL')
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENT')
  const [discountValue, setDiscountValue] = useState('10')
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('100000')
  const [minOrderValue, setMinOrderValue] = useState('300000')
  const [startDate, setStartDate] = useState('2026-10-01')
  const [endDate, setEndDate] = useState('2026-12-31')
  const [usageLimit, setUsageLimit] = useState('500')
  const [limitPerCustomer, setLimitPerCustomer] = useState('1')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Report Modal state (UC-PROM-07)
  const [reportModalCode, setReportModalCode] = useState<string | null>(null)
  const [reportData, setReportData] = useState<PromotionReportData | null>(null)

  useEffect(() => {
    let active = true
    promotionsService
      .getPromotions({ page: 1, pageSize: 20 })
      .then((res) => {
        if (active) {
          setPromotions(res.data.items)
        }
      })
      .catch(() => {
        // ignore
      })
    return () => {
      active = false
    }
  }, [reloadTick])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3600)
  }

  const handleTogglePause = async (promo: PromotionItem) => {
    setErrorBanner(null)
    try {
      const res = await promotionsService.togglePausePromotion(
        promo.voucherCode
      )
      setReloadTick((t) => t + 1)
      showToast(`${res.message} (${res.data.voucherCode} → ${res.data.status})`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorBanner(`${err.message} (${err.errorCode})`)
      }
    }
  }

  const openCreateModal = () => {
    setEditingPromo(null)
    setFormError(null)
    setPromotionName('')
    setVoucherCode(`SALE${Math.floor(100 + Math.random() * 900)}`)
    setPromotionType('PERCENT_ORDER')
    setApplyScope('ALL')
    setDiscountType('PERCENT')
    setDiscountValue('15')
    setMaxDiscountAmount('100000')
    setMinOrderValue('300000')
    setStartDate('2026-11-01')
    setEndDate('2026-12-31')
    setUsageLimit('500')
    setLimitPerCustomer('1')
    setIsFormOpen(true)
  }

  const openEditModal = (promo: PromotionItem) => {
    setEditingPromo(promo)
    setFormError(null)
    setPromotionName(promo.promotionName)
    setVoucherCode(promo.voucherCode)
    setPromotionType(promo.promotionType)
    setApplyScope(promo.applyScope)
    setDiscountType(promo.discountType || 'PERCENT')
    setDiscountValue(String(promo.discountValue ?? 10))
    setMaxDiscountAmount(String(promo.maxDiscountAmount ?? 100000))
    setMinOrderValue(String(promo.minOrderValue ?? 0))
    setStartDate(promo.startDate)
    setEndDate(promo.endDate)
    setUsageLimit(String(promo.usageLimit))
    setLimitPerCustomer(String(promo.limitPerCustomer ?? 1))
    setIsFormOpen(true)
  }

  const handleOpenReport = async (code: string) => {
    setReportModalCode(code)
    try {
      const res = await promotionsService.getPromotionReport(code)
      setReportData(res.data)
    } catch {
      // ignore
    }
  }

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)

    try {
      if (editingPromo) {
        const res = await promotionsService.updatePromotion(
          editingPromo.voucherCode,
          {
            promotionName,
            discountType,
            discountValue: Number(discountValue),
            minOrderValue: Number(minOrderValue),
            startDate,
            endDate,
            usageLimit: Number(usageLimit),
            limitPerCustomer: Number(limitPerCustomer),
          }
        )
        setIsFormOpen(false)
        setReloadTick((t) => t + 1)
        showToast(res.message || 'Cập nhật chương trình khuyến mãi thành công')
      } else {
        const res = await promotionsService.createPromotion({
          promotionName,
          promotionType,
          voucherCode,
          applyScope,
          startDate,
          endDate,
          usageLimit: Number(usageLimit),
          limitPerCustomer: Number(limitPerCustomer),
          minOrderValue: Number(minOrderValue),
          discountType:
            promotionType === 'FIXED_ORDER' ? 'FIXED_AMOUNT' : discountType,
          discountValue:
            promotionType === 'BUY_X_GET_Y' || promotionType === 'COMBO'
              ? undefined
              : Number(discountValue),
          maxDiscountAmount: Number(maxDiscountAmount) || undefined,
        })
        setIsFormOpen(false)
        setReloadTick((t) => t + 1)
        showToast(
          `${res.message} (${res.data.voucherCode} — HTTP 201 Created)`
        )
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(`${err.message} (${err.errorCode})`)
      } else {
        setFormError('Không thể lưu chương trình khuyến mãi')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-7">
      {/* Top Breadcrumb */}
      <div className="border-b border-[#ead9ce] pb-3">
        <span className="text-xs font-extrabold text-[#9a462d]">
          Khuyến Mãi & Hạng Thẻ
        </span>
      </div>

      {/* Main Title & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1f1510] tracking-tight leading-tight">
            Chính sách Bán hàng,
            <br />
            Khuyến mãi 4 tầng & Khách hàng Thành viên
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#7c6356] leading-relaxed">
            Quản lý cài đặt quy tắc kinh doanh trung tâm. Hệ thống tự động kích
            hoạt chiết khấu phân tầng khi quét mã vạch và kiểm tra số lô FEFO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              handleOpenReport(promotions[0]?.voucherCode || 'WELCOME10')
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-[#f7ece4] hover:bg-[#efe0d5] border border-[#e6d3c7] px-4 py-2.5 text-xs font-bold text-[#3f2c23] transition cursor-pointer"
          >
            <History className="size-4 text-[#8c5a3c]" />
            <span>Lịch sử áp dụng</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/loyalty')}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#f7ece4] hover:bg-[#efe0d5] border border-[#e6d3c7] px-4 py-2.5 text-xs font-bold text-[#3f2c23] transition cursor-pointer"
          >
            <Percent className="size-4 text-[#9a462d]" />
            <span>Tỷ lệ tích điểm</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#da7756] hover:bg-[#c46343] text-white px-5 py-2.5 text-xs font-bold shadow-[0_8px_20px_-6px_rgba(218,119,86,0.6)] transition cursor-pointer"
          >
            <PlusCircle className="size-4" />
            <span>Tạo khuyến mãi mới</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl bg-[#2b1d16] text-amber-50 px-4 py-3 text-xs font-medium shadow-md flex items-center justify-between">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-[11px] font-bold text-amber-200"
          >
            Đóng
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-800 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-[11px] underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* SECTION 1: Khung Khuyến Mãi 4 Tầng */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#221712]">
            Khung Khuyến Mãi 4 Tầng
          </h2>
          <p className="font-mono text-xs text-[#695246]">
            <span className="text-[#9a462d] font-bold">⊞</span> Thứ tự ưu tiên
            xử lý: Tầng 1 ‖ Tầng 2 ‖ Tầng 3 ‖ Tầng 4
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {/* TẦNG 01 */}
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a7e70]">
                  TẦNG 01
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTierSwitches((s) => ({ ...s, layer1: !s.layer1 }))
                  }
                  className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                    tierSwitches.layer1
                      ? 'bg-[#da7756] justify-end'
                      : 'bg-[#e2d5cc] justify-start'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white shadow-2xs" />
                </button>
              </div>

              <h3 className="mt-2 text-sm font-extrabold text-[#221712]">
                Sản Phẩm & Flash Sale & Combo
              </h3>
              <p className="mt-2 text-xs text-[#695246] leading-relaxed">
                Giảm trực tiếp % hoặc tiền mặt trên từng SKU độc lập; áp dụng
                khung giờ vàng chớp nhoáng tự động tắt khi hết suất.
              </p>

              <div className="mt-4 rounded-2xl bg-[#fbf3ed] border border-[#efe0d5] p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#695246]">Đang kích hoạt:</span>
                  <strong className="text-[#9a3b20]">12 Sản phẩm</strong>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-[#efdfd4] text-[#4b362c] text-[10px] font-bold">
                    Kem CN Ultra: -15%
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#efdfd4] text-[#4b362c] text-[10px] font-bold">
                    Son Velvet Matte: -20%
                  </span>
                </div>
              </div>

              <p className="mt-3 font-mono text-[11px] text-[#695246] flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#8c6b5b] shrink-0" />
                <span>Khung giờ: 11:00 - 13:00 • 19:00 - 21:00</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#f3eae3] hover:bg-[#e9dad0] text-[#221712] text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sliders className="size-3.5" />
              <span>Chỉnh sửa SKU (12)</span>
            </button>
          </div>

          {/* TẦNG 02 */}
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a7e70]">
                  TẦNG 02
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTierSwitches((s) => ({ ...s, layer2: !s.layer2 }))
                  }
                  className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                    tierSwitches.layer2
                      ? 'bg-[#da7756] justify-end'
                      : 'bg-[#e2d5cc] justify-start'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white shadow-2xs" />
                </button>
              </div>

              <h3 className="mt-2 text-sm font-extrabold text-[#221712]">
                Hạng thẻ
              </h3>
              <p className="mt-2 text-xs text-[#695246] leading-relaxed">
                Cơ chế bó sản phẩm (Bundle) và khuyến mãi kèm quà tặng: tự động
                giải trừ tồn kho cả SKU bán lẫn SKU quà tặng theo FEFO.
              </p>

              <div className="mt-4 rounded-2xl bg-[#fbf3ed] border border-[#efe0d5] p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#695246]">Gói kích hoạt:</span>
                  <strong className="text-[#8c5220]">04 Gói combo</strong>
                </div>
                <p className="text-[11px] text-[#4b362c]">
                  <span className="text-[#9a3b20]">●</span> Mua 1 Serum ‖ Tặng 1
                  Mask
                </p>
                <p className="text-[11px] text-[#4b362c]">
                  <span className="text-[#9a3b20]">●</span> Mua 2 Toner ‖ Giảm
                  50%
                </p>
              </div>

              <p className="mt-3 font-mono text-[11px] text-[#695246] flex items-center gap-1.5">
                <RefreshCw className="size-3.5 text-[#8c6b5b] shrink-0" />
                <span>Trừ tồn kho kép: Hàng bán + Quà mẫu</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/loyalty')}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#f3eae3] hover:bg-[#e9dad0] text-[#221712] text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sliders className="size-3.5" />
              <span>Cấu hình Combo & Quà</span>
            </button>
          </div>

          {/* TẦNG 03 */}
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a7e70]">
                  TẦNG 03
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTierSwitches((s) => ({ ...s, layer3: !s.layer3 }))
                  }
                  className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                    tierSwitches.layer3
                      ? 'bg-[#da7756] justify-end'
                      : 'bg-[#e2d5cc] justify-start'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white shadow-2xs" />
                </button>
              </div>

              <h3 className="mt-2 text-sm font-extrabold text-[#221712]">
                Bậc Thang & Voucher
              </h3>
              <p className="mt-2 text-xs text-[#695246] leading-relaxed">
                Khuyến mãi theo tổng giá trị giỏ hàng sau khi đã áp dụng Tầng 1,
                2 và kết hợp mã Voucher hợp lệ.
              </p>

              <div className="mt-4 rounded-2xl bg-[#fbf3ed] border border-[#efe0d5] p-3.5 space-y-1.5 text-xs">
                <p className="font-bold text-[#221712] text-[11px]">
                  Bậc thang giỏ hàng:
                </p>
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Đơn ≥ 1.000.000đ:</span>
                  <strong className="text-[#9a3b20]">-50.000đ</strong>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Đơn ≥ 2.000.000đ:</span>
                  <strong className="text-[#9a3b20]">-120.000đ</strong>
                </div>
                <p className="text-right text-[10px] text-[#7c6356]">
                  Còn 312 lượt
                </p>
              </div>

              <p className="mt-3 font-mono text-[11px] text-[#695246] flex items-center gap-1.5">
                <Ticket className="size-3.5 text-[#8c6b5b] shrink-0" />
                <span>Giới hạn 1 voucher/hóa đơn bán lẻ</span>
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#f3eae3] hover:bg-[#e9dad0] text-[#221712] text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Ticket className="size-3.5" />
              <span>Quản lý Kho Voucher</span>
            </button>
          </div>

          {/* TẦNG 04 */}
          <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9a7e70]">
                  TẦNG 04
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTierSwitches((s) => ({ ...s, layer4: !s.layer4 }))
                  }
                  className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                    tierSwitches.layer4
                      ? 'bg-[#da7756] justify-end'
                      : 'bg-[#e2d5cc] justify-start'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white shadow-2xs" />
                </button>
              </div>

              <h3 className="mt-2 text-sm font-extrabold text-[#221712]">
                Điểm thưởng
              </h3>
              <p className="mt-2 text-xs text-[#695246] leading-relaxed">
                Đặc quyền phi tiền tệ: Tặng bộ minisize độc quyền, quà lưu niệm
                thương hiệu và dịch vụ tư vấn da chuyên biệt tại cửa hàng.
              </p>

              <div className="mt-4 rounded-2xl bg-[#fbf3ed] border border-[#efe0d5] p-3.5 space-y-1.5 text-xs">
                <p className="font-bold text-[#221712] text-[11px]">
                  Mốc thưởng kèm theo:
                </p>
                <p className="text-[11px] text-[#4b362c]">
                  <span className="text-[#9a3b20]">●</span>{' '}
                  <strong>&gt; 1.5M:</strong> Set Sample 5 món cao cấp
                </p>
                <p className="text-[11px] text-[#4b362c]">
                  <span className="text-[#9a3b20]">●</span>{' '}
                  <strong>&gt; 3.0M:</strong> Túi Velvet + Phiếu soi da 3D
                </p>
              </div>

              <p className="mt-3 font-mono text-[11px] text-[#695246] flex items-center gap-1.5">
                <Gift className="size-3.5 text-[#8c6b5b] shrink-0" />
                <span>Tự in barcode quà trên bill</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/loyalty')}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#f3eae3] hover:bg-[#e9dad0] text-[#221712] text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Gift className="size-3.5" />
              <span>Cài đặt Quà Tặng</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Bảng Khuyến Mãi Khách Hàng */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-[#221712]">
          Bảng Khuyến Mãi Khách Hàng
        </h2>

        <div className="rounded-3xl bg-white border border-[#ead9ce] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#faf0e7] border-b border-[#eeddd2] text-[10px] font-extrabold uppercase tracking-wider text-[#7e6457]">
                  <th className="py-4 px-6">TÊN KHUYẾN MÃI</th>
                  <th className="py-4 px-4 text-center">HẠNG TỐI THIỂU</th>
                  <th className="py-4 px-4 text-center">THỜI HẠN ÁP DỤNG</th>
                  <th className="py-4 px-4 text-center">GIÁ TRỊ</th>
                  <th className="py-4 px-4 text-center">SỐ LƯỢNG</th>
                  <th className="py-4 px-6 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3e7df] text-xs">
                {promotions.map((promo) => {
                  const isActive = promo.status === 'ACTIVE'
                  return (
                    <tr
                      key={promo.voucherCode}
                      className="hover:bg-[#fdf9f6] transition"
                    >
                      <td className="py-5 px-6">
                        <p className="font-extrabold text-xs sm:text-sm text-[#221712]">
                          {promo.promotionName}
                        </p>
                        <span className="mt-1 inline-block font-mono text-[11px] text-[#9a462d] font-bold">
                          Mã: {promo.voucherCode} · {promo.promotionType}
                        </span>
                      </td>

                      <td className="py-5 px-4 text-center">
                        <span
                          className={`inline-block min-w-[96px] px-4 py-1.5 rounded-xl text-[11px] font-extrabold shadow-2xs ${getTierGradientClass(
                            promo.minTierLabel
                          )}`}
                        >
                          {promo.minTierLabel || 'Đồng'}
                        </span>
                      </td>

                      <td className="py-5 px-4 text-center font-mono text-xs font-semibold text-[#221712]">
                        {formatDateVN(promo.startDate)} -{' '}
                        {formatDateVN(promo.endDate)}
                      </td>

                      <td className="py-5 px-4 text-center max-w-xs mx-auto">
                        <p className="font-mono font-extrabold text-red-600">
                          {promo.valueSummaryTitle}
                        </p>
                        {promo.valueSummarySub && (
                          <p className="mt-1 font-mono text-[11px] italic text-[#4b362c] leading-relaxed">
                            {promo.valueSummarySub}
                          </p>
                        )}
                      </td>

                      <td className="py-5 px-4 text-center">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-[#e36448] text-white font-mono text-xs font-extrabold">
                          {promo.usedCount}/
                          <span className="text-black">
                            {promo.usageLimit}
                          </span>
                        </span>
                      </td>

                      <td className="py-5 px-6 text-right">
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenReport(promo.voucherCode)
                            }
                            title="Xem báo cáo hiệu quả khuyến mãi (UC-PROM-07)"
                            className="p-1.5 rounded-lg text-[#7c6356] hover:bg-[#f6ece4] hover:text-[#221712] cursor-pointer"
                          >
                            <BarChart3 className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(promo)}
                            title="Chỉnh sửa khuyến mãi (UC-PROM-03)"
                            className="p-1.5 rounded-lg text-[#4b362c] hover:bg-[#f6ece4] cursor-pointer"
                          >
                            <Edit2 className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePause(promo)}
                            title={
                              isActive
                                ? 'Đang kích hoạt — Bấm để Tạm dừng (PATCH /pause)'
                                : 'Đang tạm dừng — Bấm để Kích hoạt lại'
                            }
                            className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                              isActive
                                ? 'bg-[#da7756] justify-end'
                                : 'bg-[#d6c7bc] justify-start'
                            }`}
                          >
                            <span className="size-4 rounded-full bg-white shadow-2xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-[#faf1ea] border-t border-[#eeddd2] flex flex-wrap items-center justify-between gap-4 text-xs text-[#6d5549]">
            <div className="flex items-center gap-3">
              <span>Hiển thị 1 - {promotions.length} trên tổng số 125 khuyến mãi</span>
              <span>•</span>
              <span>Dòng mỗi trang:</span>
              <span className="px-3 py-1 rounded-lg bg-white border border-[#e5d2c6] font-bold text-[#221712]">
                20
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="size-8 rounded-lg border border-[#e5d2c6] bg-white/70 grid place-items-center"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                className="size-8 rounded-lg bg-[#da7756] text-white font-bold"
              >
                1
              </button>
              <button
                type="button"
                className="size-8 rounded-lg bg-white border border-[#e5d2c6] font-bold"
              >
                2
              </button>
              <button
                type="button"
                className="size-8 rounded-lg bg-white border border-[#e5d2c6] font-bold"
              >
                3
              </button>
              <span className="px-1">...</span>
              <button
                type="button"
                className="size-8 rounded-lg bg-white border border-[#e5d2c6] font-bold"
              >
                62
              </button>
              <button
                type="button"
                className="size-8 rounded-lg border border-[#e5d2c6] bg-white/70 grid place-items-center"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Bảng Chính Sách Đổi Trả, Hoàn Tiền & Hạch Toán Lô FEFO */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-[#221712]">
            Bảng Chính Sách Đổi Trả, Hoàn Tiền & Hạch Toán Lô FEFO
          </h2>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#f5eae2] hover:bg-[#ead8cc] px-4 py-2 text-xs font-bold text-[#3f2c23] cursor-pointer"
          >
            <Printer className="size-3.5" />
            <span>In sổ tay thu ngân</span>
          </button>
        </div>

        <div className="rounded-3xl bg-white border border-[#ead9ce] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#faf0e7] border-b border-[#eeddd2] text-[10px] font-extrabold uppercase tracking-wider text-[#7e6457]">
                  <th className="py-4 px-6">TRƯỜNG HỢP ĐỔI TRẢ</th>
                  <th className="py-4 px-4">ĐIỀU KIỆN HÀNG HÓA & SEAL</th>
                  <th className="py-4 px-4">THỜI HẠN ÁP DỤNG</th>
                  <th className="py-4 px-4">RÀNG BUỘC LÔ / FEFO</th>
                  <th className="py-4 px-4">THẨM QUYỀN PHÊ DUYỆT</th>
                  <th className="py-4 px-6 text-right">PHƯƠNG THỨC HOÀN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3e7df] text-xs">
                <tr>
                  <td className="py-4 px-6">
                    <div className="flex items-start gap-3">
                      <span className="size-8 rounded-xl bg-red-50 text-red-600 grid place-items-center font-extrabold shrink-0">
                        ✳
                      </span>
                      <div>
                        <p className="font-bold text-[#221712]">Hàng lỗi NSX</p>
                        <p className="text-[11px] font-mono text-[#7c6356] mt-0.5">
                          Lỗi bao bì, vòi xịt, kích ứng có xác nhận
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-block px-3 py-1 rounded-xl bg-[#f4ece6] text-[#4b362c] text-[11px] font-semibold">
                      Đã khui seal (≤ 20% dung tích)
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-[#221712]">
                    Trong vòng 07 ngày
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-mono font-bold text-[#9a3b20]">
                      ↺ Bắt buộc số Lô cũ
                    </p>
                    <p className="text-[11px] text-[#7c6356]">
                      Hạch toán trả lại đúng nhà cung cấp
                    </p>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 rounded-full bg-[#b4533c] text-white font-mono text-[10px] font-extrabold">
                      STORE_MANAGER
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-bold text-[#9a3b20]">
                    Đổi 1-1 / Hoàn tiền 100%
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6">
                    <div className="flex items-start gap-3">
                      <span className="size-8 rounded-xl bg-[#f6ede6] text-[#6d5447] grid place-items-center font-bold shrink-0">
                        ⇄
                      </span>
                      <div>
                        <p className="font-bold text-[#221712]">
                          Khách đổi ý (Nhu cầu cá nhân)
                        </p>
                        <p className="text-[11px] font-mono text-[#7c6356] mt-0.5">
                          Đổi màu son, đổi dòng sản phẩm dưỡng
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-block px-3 py-1 rounded-xl bg-[#faebd7] text-[#6d461c] text-[11px] font-bold">
                      Nguyên tem mác & Seal nilon 100%
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-[#221712]">
                    Theo Hạng thẻ (3 - 30 ngày)
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-mono font-bold text-[#221712]">
                      Kiểm tra HSD &gt; 12 tháng
                    </p>
                    <p className="text-[11px] text-[#7c6356]">
                      Nhập lại kệ bán thường
                    </p>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 rounded-full bg-[#f2e6de] text-[#3a281f] font-mono text-[10px] font-extrabold">
                      LEAD_CASHIER
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-[#221712]">
                    Đổi hàng bằng giá trị đơn cũ
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6">
                    <div className="flex items-start gap-3">
                      <span className="size-8 rounded-xl bg-[#f4eeea] text-[#8d7467] grid place-items-center shrink-0">
                        <Ban className="size-4" />
                      </span>
                      <div>
                        <p className="font-bold text-[#221712]">
                          Hàng Sale Cận Date (&lt; 3 tháng)
                        </p>
                        <p className="text-[11px] font-mono text-[#7c6356] mt-0.5">
                          Hàng xả kho dán nhãn vàng FEFO
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-block px-3 py-1 rounded-xl bg-red-100/80 text-red-800 text-[11px] font-bold">
                      Miễn đổi trả dưới mọi hình thức
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-[#7c6356]">
                    Không áp dụng
                  </td>
                  <td className="py-4 px-4 font-mono text-[#5e473b]">
                    SKU đánh dấu mã Clear-Stock
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-mono text-[10px] font-extrabold">
                      HỆ THỐNG KHÓA
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-[#7c6356]">
                    Không hoàn tiền
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-[#faf1ea] border-t border-[#eeddd2] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#5e473b]">
              <Info className="size-4 text-[#9a462d] shrink-0" />
              <span>
                Mọi giao dịch hoàn tiền mặt hoặc chuyển khoản trên{' '}
                <strong>500.000đ</strong> yêu cầu quét mã OTP của Quản lý cửa
                hàng (Store Manager).
              </span>
            </div>
            <Link
              to="/rbac"
              className="inline-flex items-center gap-1.5 font-extrabold text-[#9a3b20] hover:underline"
            >
              <span>Cập nhật ma trận phân quyền hoàn trả</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Modal: Create / Edit Promotion (UC-PROM-02 & UC-PROM-03) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-hidden border border-[#ead9ce] shadow-2xl flex flex-col">
            <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd]">
              <div>
                <h3 className="text-base font-extrabold text-[#221712]">
                  {editingPromo
                    ? `Cập nhật Chương trình Khuyến mãi (${editingPromo.voucherCode})`
                    : 'Tạo Chương trình Khuyến mãi / Voucher mới (UC-PROM-02)'}
                </h3>
                {editingPromo && editingPromo.usedCount > 0 && (
                  <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
                    ⚠ Đã có {editingPromo.usedCount} đơn COMPLETED: Hệ thống chỉ
                    cho phép gia hạn endDate và tăng usageLimit (UC-PROM-03).
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-1.5 text-[#5e473b] hover:bg-black/5 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitForm}
              className="p-6 overflow-y-auto space-y-4 text-xs"
            >
              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 font-semibold text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#221712]">
                    Mã Voucher (voucherCode) *
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingPromo)}
                    value={voucherCode}
                    onChange={(e) =>
                      setVoucherCode(e.target.value.toUpperCase())
                    }
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2.5 font-mono font-bold text-[#221712] disabled:opacity-60"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#221712]">
                    Tên chương trình (promotionName) *
                  </label>
                  <input
                    type="text"
                    value={promotionName}
                    onChange={(e) => setPromotionName(e.target.value)}
                    placeholder="VD: Mua kem dưỡng tặng serum"
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2.5 text-[#221712]"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#221712]">
                    Loại khuyến mãi (promotionType) *
                  </label>
                  <select
                    disabled={Boolean(editingPromo)}
                    value={promotionType}
                    onChange={(e) =>
                      setPromotionType(e.target.value as PromotionType)
                    }
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2.5 font-semibold text-[#221712]"
                  >
                    <option value="PERCENT_ORDER">
                      PERCENT_ORDER (Giảm % hóa đơn)
                    </option>
                    <option value="FIXED_ORDER">
                      FIXED_ORDER (Giảm tiền cố định)
                    </option>
                    <option value="STEP_DISCOUNT">
                      STEP_DISCOUNT (Giảm bậc thang)
                    </option>
                    <option value="BUY_X_GET_Y">
                      BUY_X_GET_Y (Mua X tặng Y)
                    </option>
                    <option value="COMBO">COMBO (Gói trọn bộ)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#221712]">
                    Phạm vi áp dụng (applyScope) *
                  </label>
                  <select
                    disabled={Boolean(editingPromo)}
                    value={applyScope}
                    onChange={(e) =>
                      setApplyScope(e.target.value as ApplyScope)
                    }
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2.5 font-semibold text-[#221712]"
                  >
                    <option value="ALL">ALL (Toàn bộ sản phẩm)</option>
                    <option value="PRODUCT">PRODUCT (Theo sản phẩm)</option>
                    <option value="BRAND">BRAND (Theo thương hiệu)</option>
                    <option value="CATEGORY">CATEGORY (Theo danh mục)</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#221712]">
                    Mức giảm (discountValue)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono font-bold text-[#9a3b20]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#221712]">
                    Giảm tối đa (maxDiscount)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#221712]">
                    Đơn tối thiểu (minOrderValue)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#221712]">
                    Ngày bắt đầu (startDate) *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#221712]">
                    Ngày kết thúc (endDate) *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#221712]">
                    Tổng giới hạn lượt dùng (usageLimit) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#221712]">
                    Giới hạn / Khách hàng (limitPerCustomer) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={limitPerCustomer}
                    onChange={(e) => setLimitPerCustomer(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#f1e4dc]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#e3d2c7] font-bold text-[#543e33]"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#da7756] hover:bg-[#c46343] text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting
                    ? 'Đang lưu...'
                    : editingPromo
                      ? 'Lưu cập nhật (UC-PROM-03)'
                      : 'Tạo khuyến mãi (UC-PROM-02)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Promotion Effectiveness Report (UC-PROM-07) */}
      {reportModalCode && reportData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] overflow-hidden border border-[#ead9ce] shadow-2xl flex flex-col">
            <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd]">
              <div>
                <h3 className="text-base font-extrabold text-[#221712]">
                  Báo cáo hiệu quả Khuyến mãi: {reportModalCode} (UC-PROM-07)
                </h3>
                <p className="text-[11px] font-mono text-[#7c6356]">
                  GET /api/v1/promotions/{reportModalCode}/report
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportModalCode(null)}
                className="rounded-lg p-1.5 text-[#5e473b] hover:bg-black/5 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-[#fcf7f4] border border-[#ead9ce] p-3.5">
                  <span className="text-[#7c6356]">Lượt sử dụng</span>
                  <p className="mt-1 font-mono text-lg font-extrabold text-[#221712]">
                    {reportData.totalUsage} đơn
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fcf7f4] border border-[#ead9ce] p-3.5">
                  <span className="text-[#7c6356]">Tổng tiền giảm</span>
                  <p className="mt-1 font-mono text-lg font-extrabold text-[#9a3b20]">
                    {formatCurrency(reportData.totalDiscountAmount)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fcf7f4] border border-[#ead9ce] p-3.5">
                  <span className="text-[#7c6356]">Doanh thu tạo ra</span>
                  <p className="mt-1 font-mono text-lg font-extrabold text-emerald-700">
                    {formatCurrency(reportData.totalRevenueGenerated)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fcf7f4] border border-[#ead9ce] p-3.5">
                  <span className="text-[#7c6356]">Tỷ lệ dùng (usageRate)</span>
                  <p className="mt-1 font-mono text-lg font-extrabold text-[#221712]">
                    {(reportData.usageRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-[#221712] mb-2">
                  Đơn hàng COMPLETED đã áp dụng mã {reportModalCode}
                </h4>
                <div className="rounded-2xl border border-[#ead9ce] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#faf0e7] text-[10px] font-extrabold uppercase text-[#7e6457]">
                        <th className="py-2.5 px-4">MÃ ĐƠN</th>
                        <th className="py-2.5 px-4">KHÁCH HÀNG</th>
                        <th className="py-2.5 px-4 text-right">GIÁ TRỊ ĐƠN</th>
                        <th className="py-2.5 px-4 text-right">CHIẾT KHẤU</th>
                        <th className="py-2.5 px-4 text-right">THỰC TRẢ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3e7df]">
                      {reportData.orders.map((o) => (
                        <tr key={o.orderCode}>
                          <td className="py-2.5 px-4 font-mono font-bold text-[#9a462d]">
                            {o.orderCode}
                          </td>
                          <td className="py-2.5 px-4 font-semibold">
                            {o.customerName}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            {formatCurrency(o.orderValue)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-red-700">
                            -{formatCurrency(o.discountAmount)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            {formatCurrency(o.paidAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

