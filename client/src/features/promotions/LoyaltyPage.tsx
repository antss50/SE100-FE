import {
  ArrowLeft,
  Award,
  Bell,
  Calendar,
  CheckCircle2,
  Crown,
  Gift,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClientError } from '../../lib/api-client'
import { promotionsService } from '../../services/promotions.service'
import type { CustomerTierCode, LoyaltyConfigData } from '../../types/api'
import { formatNumber } from '../../utils/format'

/** Trạng thái rỗng trong lúc chờ tải cấu hình từ API. */
const EMPTY_CONFIG: LoyaltyConfigData = { amountPerPoint: 0, redemptionValuePerPoint: 0, tiers: [] }

export function LoyaltyPage() {
  const [config, setConfig] = useState<LoyaltyConfigData>(EMPTY_CONFIG)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [focusedTier, setFocusedTier] = useState<CustomerTierCode | null>(null)

  const [amountPerPointInput, setAmountPerPointInput] = useState('10000')
  const [silverSpendInput, setSilverSpendInput] = useState('3000000')
  const [goldSpendInput, setGoldSpendInput] = useState('10000000')
  const [diamondSpendInput, setDiamondSpendInput] = useState('25000000')

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    promotionsService
      .getLoyaltyConfig()
      .then((res) => {
        if (!active) return
        setConfig(res.data)
      })
      .catch(() => {
        // ignore
      })
    return () => {
      active = false
    }
  }, [])

  const openEditConfig = (tierCode?: CustomerTierCode) => {
    setErrorMsg(null)
    setFocusedTier(tierCode || null)
    setAmountPerPointInput(String(config.amountPerPoint || 10000))
    const silver =
      config.tiers.find((t) => t.tier === 'SILVER')?.minSpend ?? 3000000
    const gold =
      config.tiers.find((t) => t.tier === 'GOLD')?.minSpend ?? 10000000
    const diamond =
      config.tiers.find((t) => t.tier === 'DIAMOND')?.minSpend ?? 25000000
    setSilverSpendInput(String(silver))
    setGoldSpendInput(String(gold))
    setDiamondSpendInput(String(diamond))
    setIsModalOpen(true)
  }

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsSaving(true)

    try {
      const nextPayload: LoyaltyConfigData = {
        amountPerPoint: Number(amountPerPointInput),
        redemptionValuePerPoint: config.redemptionValuePerPoint ?? 100,
        tiers: [
          {
            ...config.tiers[0],
            tier: 'BRONZE',
            minSpend: 0,
          },
          {
            ...config.tiers[1],
            tier: 'SILVER',
            minSpend: Number(silverSpendInput),
          },
          {
            ...config.tiers[2],
            tier: 'GOLD',
            minSpend: Number(goldSpendInput),
          },
          {
            ...config.tiers[3],
            tier: 'DIAMOND',
            minSpend: Number(diamondSpendInput),
          },
        ],
      }

      const res = await promotionsService.updateLoyaltyConfig(nextPayload)
      setConfig(res.data)
      setIsModalOpen(false)
      setToastMsg(
        res.message ||
          'Lưu cấu hình tích điểm & ngưỡng hạng thẻ thành công (PUT /api/v1/loyalty-config)'
      )
      setTimeout(() => setToastMsg(null), 4000)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message} (${err.errorCode})`)
      } else {
        setErrorMsg('Không thể lưu cấu hình hạng thẻ')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const bronzeTier = config.tiers.find((t) => t.tier === 'BRONZE')
  const silverTier = config.tiers.find((t) => t.tier === 'SILVER')
  const goldTier = config.tiers.find((t) => t.tier === 'GOLD')
  const diamondTier = config.tiers.find((t) => t.tier === 'DIAMOND')

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead9ce] pb-3.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold text-[#9a462d]">
            Hạng Thẻ Khách Hàng
          </span>
          <span className="text-[#d4bfb2]">•</span>
          <Link
            to="/promotions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6e564a] hover:text-[#9a462d]"
          >
            <ArrowLeft className="size-3.5" />
            <span>Quay lại Khuyến mãi 4 tầng</span>
          </Link>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#e7d6cb] px-3.5 py-1 text-xs font-mono font-semibold text-[#4a362c] shadow-2xs">
          <span className="size-2 rounded-full bg-amber-400" />
          <span>Thu ngân: Auto-Enforced Policy</span>
          <ShieldCheck className="size-3.5 text-[#7a6154]" />
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl bg-[#2b1d16] text-amber-50 px-4 py-3 text-xs font-medium shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-[11px] font-bold text-amber-200"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Hero Banner Card */}
      <div className="rounded-3xl bg-[#faeee5] border border-[#edd8ca] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#9a462d]">
              KHÁCH HÀNG THÂN THIẾT
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#e5dbd4] text-[#4b382e] text-[11px] font-bold">
              Bảo lưu hạng 12 tháng
            </span>
          </div>

          <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-[#1f1510] tracking-tight leading-tight">
            Hệ Thống 4 Hạng Thẻ & Tích Điểm Thành Viên
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-[#6b5346] leading-relaxed">
            Khách hàng được tự động thăng hạng theo lũy kế chi tiêu thực tế.
            Quyền lợi tích hợp trực tiếp trên màn hình bán hàng POS.
          </p>
        </div>

        {/* Point Conversion Rate Box */}
        <div
          onClick={() => openEditConfig()}
          title="Bấm để cập nhật tỷ lệ quy đổi điểm (PUT /api/v1/loyalty-config)"
          className="rounded-2xl bg-white border border-[#ead6c8] p-4 sm:p-5 shadow-xs flex flex-wrap sm:flex-nowrap items-center gap-5 cursor-pointer hover:border-[#c97252] transition"
        >
          <div className="flex items-center gap-3.5 pr-4 sm:border-r border-[#efe1d7]">
            <div className="size-11 rounded-full bg-[#f8dfc2] text-[#8c5220] grid place-items-center shrink-0">
              <Star className="size-5" />
            </div>
            <div>
              <p className="text-xs text-[#7c6356]">Quy tắc tích lũy:</p>
              <p className="mt-0.5 font-mono text-base font-extrabold text-[#221712]">
                {formatNumber(config.amountPerPoint)} đ = 1 Điểm
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-[#7c6356]">Quy đổi thanh toán:</p>
            <p className="mt-0.5 font-mono text-sm font-extrabold text-[#9a3b20]">
              1 Điểm = {formatNumber(config.redemptionValuePerPoint ?? 100)} đ
            </p>
            <p className="text-[10px] text-[#8d7467]">
              (Tối đa 50% giá trị đơn)
            </p>
          </div>
        </div>
      </div>

      {/* 4 Membership Tier Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch pt-2">
        {/* 1. BRONZE TIER */}
        <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#f3c68f] to-[#d98a2b] text-[#2b1806] text-[10px] font-extrabold uppercase tracking-wider">
                BRONZE TIER
              </span>
              <Award className="size-5 text-[#9a6324]" />
            </div>

            <h2 className="mt-4 text-xl font-extrabold text-[#221712]">
              Hạng ĐỒNG
            </h2>
            <p className="mt-1 font-mono text-xs text-[#5e473b]">
              Chi tiêu: 0 - {formatNumber(silverTier?.minSpend ?? 3000000)}đ
            </p>

            <div className="mt-4 rounded-xl bg-[#faefe7] px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#5e473b]">Chiết khấu hạng (tầng 2):</span>
              <span className="font-mono text-sm font-extrabold text-[#9a3b20]">
                {bronzeTier?.earnRatePercent ?? 0}%
              </span>
            </div>

            <ul className="mt-5 space-y-3 text-xs text-[#4b372e]">
              <li className="flex items-start gap-2.5">
                <Gift className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Voucher sinh nhật <strong>50.000 đ</strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <RefreshCw className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>Đổi trả theo tiêu chuẩn (3 ngày)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Bell className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>Nhận thông báo Flash sale qua Zalo OA</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => openEditConfig('BRONZE')}
            className="mt-8 w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#f5efe8] via-[#ecc38e] to-[#d9821b] text-[#221406] text-xs font-extrabold shadow-xs hover:brightness-95 transition cursor-pointer"
          >
            Chỉnh sửa mức Đồng
          </button>
        </div>

        {/* 2. SILVER TIER */}
        <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#e5e7eb] to-[#9ca3af] text-[#1f2937] text-[10px] font-extrabold uppercase tracking-wider">
                SILVER TIER
              </span>
              <Award className="size-5 text-[#6b7280]" />
            </div>

            <h2 className="mt-4 text-xl font-extrabold text-[#221712]">
              Hạng BẠC
            </h2>
            <p className="mt-1 font-mono text-xs text-[#5e473b]">
              Chi tiêu: &gt; {formatNumber(silverTier?.minSpend ?? 3000000)}đ
            </p>

            <div className="mt-4 rounded-xl bg-[#faefe7] px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#5e473b]">Chiết khấu hạng (tầng 2):</span>
              <span className="font-mono text-sm font-extrabold text-[#9a3b20]">
                {silverTier?.earnRatePercent ?? 5}%
              </span>
            </div>

            <ul className="mt-5 space-y-3 text-xs text-[#4b372e]">
              <li className="flex items-start gap-2.5">
                <Gift className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Giảm <strong>5%</strong> đơn hàng trong tháng sinh nhật
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <RefreshCw className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Hạn đổi trả mở rộng: <strong>07 ngày</strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Truck className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>Freeship đơn bán lẻ nội thành TP.HCM</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => openEditConfig('SILVER')}
            className="mt-8 w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#f3f4f6] via-[#d1d5db] to-[#8b929e] text-[#111827] text-xs font-extrabold shadow-xs hover:brightness-95 transition cursor-pointer"
          >
            Chỉnh sửa mức Bạc
          </button>
        </div>

        {/* 3. GOLD TIER (PHỔ BIẾN NHẤT) */}
        <div className="relative rounded-3xl bg-[#fffdf9] border-2 border-[#dfc39d] p-6 shadow-md flex flex-col justify-between">
          <span className="absolute -top-3 right-5 px-3 py-0.5 rounded-full bg-white border border-[#221712] text-[#221712] text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
            PHỔ BIẾN NHẤT
          </span>

          <div>
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#fef08a] to-[#eab308] text-[#3b2806] text-[10px] font-extrabold uppercase tracking-wider">
                GOLD TIER
              </span>
              <div className="size-6 rounded-full bg-[#6d522b] text-white grid place-items-center">
                <Star className="size-3.5 fill-current" />
              </div>
            </div>

            <h2 className="mt-4 text-xl font-extrabold text-[#221712]">
              Hạng VÀNG
            </h2>
            <p className="mt-1 font-mono text-xs text-[#5e473b]">
              Chi tiêu: &gt; {formatNumber(goldTier?.minSpend ?? 10000000)}đ
            </p>

            <div className="mt-4 rounded-xl bg-[#faefe7] px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#5e473b]">Chiết khấu hạng (tầng 2):</span>
              <span className="font-mono text-sm font-extrabold text-[#9a3b20]">
                {goldTier?.earnRatePercent ?? 8}%
              </span>
            </div>

            <ul className="mt-5 space-y-3 text-xs text-[#4b372e]">
              <li className="flex items-start gap-2.5">
                <Gift className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Giảm <strong>10%</strong> hóa đơn tháng sinh nhật
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Sparkles className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  <strong>Miễn phí</strong> soi da & phác đồ định kỳ
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <RefreshCw className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Hạn đổi trả đặc cách: <strong>15 ngày</strong>
                </span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => openEditConfig('GOLD')}
            className="mt-8 w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#fef9c3] via-[#facc15] to-[#ca8a04] text-[#1f1605] text-xs font-extrabold shadow-xs hover:brightness-95 transition cursor-pointer"
          >
            Chỉnh sửa mức Vàng
          </button>
        </div>

        {/* 4. DIAMOND VIP */}
        <div className="rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#bae6fd] to-[#2563eb] text-[#0f172a] text-[10px] font-extrabold uppercase tracking-wider">
                DIAMOND VIP
              </span>
              <Crown className="size-5 text-[#9a3b20]" />
            </div>

            <h2 className="mt-4 text-xl font-extrabold text-[#221712]">
              Hạng KIM CƯƠNG
            </h2>
            <p className="mt-1 font-mono text-xs text-[#5e473b]">
              Chi tiêu: &gt; {formatNumber(diamondTier?.minSpend ?? 25000000)}đ
            </p>

            <div className="mt-4 rounded-xl bg-[#faefe7] px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#5e473b]">Chiết khấu hạng (tầng 2):</span>
              <span className="font-mono text-sm font-extrabold text-[#9a3b20]">
                {diamondTier?.earnRatePercent ?? 12}%
              </span>
            </div>

            <ul className="mt-5 space-y-3 text-xs text-[#4b372e]">
              <li className="flex items-start gap-2.5">
                <Sparkles className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Chăm sóc da chuyên sâu <strong>1 lần/quý</strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Calendar className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Vé mời <strong>Private Launch</strong> mỹ phẩm mới
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>Dedicated Skincare Specialist tư vấn riêng</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-[#9a462d] shrink-0 mt-0.5" />
                <span>
                  Bảo hành đổi trả VIP: <strong>30 ngày</strong>
                </span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => openEditConfig('DIAMOND')}
            className="mt-8 w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#e0f2fe] via-[#60a5fa] to-[#1d4ed8] text-[#0f172a] text-xs font-extrabold shadow-xs hover:brightness-95 transition cursor-pointer"
          >
            Cấu hình Đặc quyền VIP
          </button>
        </div>
      </div>

      {/* Modal: PUT /api/v1/loyalty-config (UC-CUS-09) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#ead9ce] shadow-2xl">
            <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd]">
              <div>
                <h3 className="text-base font-extrabold text-[#221712]">
                  Cập nhật cấu hình tích điểm & Hạng thẻ (UC-CUS-09)
                </h3>
                <p className="text-[11px] font-mono text-[#7c6356]">
                  PUT /api/v1/loyalty-config{' '}
                  {focusedTier ? `· Đang chọn: ${focusedTier}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-[#5e473b] hover:bg-black/5 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
              {errorMsg && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-800">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#221712]">
                  Số tiền quy đổi thành 1 điểm (amountPerPoint - VNĐ) *
                </label>
                <input
                  type="number"
                  min={1}
                  step={1000}
                  value={amountPerPointInput}
                  onChange={(e) => setAmountPerPointInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-4 py-2.5 font-mono text-sm font-bold text-[#9a3b20] outline-none focus:border-[#d57252]"
                  required
                />
                <p className="mt-1 text-[11px] text-[#8a7062]">
                  earnedPoints = floor(eligibleSpend / amountPerPoint)
                </p>
              </div>

              <div className="pt-2 border-t border-[#f2e6de] space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#8c673a]">
                  Ngưỡng chi tiêu tích lũy 4 hạng thẻ (minSpend tăng dần)
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#5e473b]">
                      1. Hạng ĐỒNG (BRONZE)
                    </label>
                    <input
                      type="number"
                      value={0}
                      disabled
                      className="mt-1 w-full rounded-xl bg-[#f1ebe6] border border-[#e2d3c9] px-3.5 py-2 font-mono font-bold text-[#7c6356] cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#221712]">
                      2. Hạng BẠC (SILVER) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={500000}
                      value={silverSpendInput}
                      onChange={(e) => setSilverSpendInput(e.target.value)}
                      className="mt-1 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono font-bold text-[#221712]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#221712]">
                      3. Hạng VÀNG (GOLD) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1000000}
                      value={goldSpendInput}
                      onChange={(e) => setGoldSpendInput(e.target.value)}
                      className="mt-1 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono font-bold text-[#221712]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#221712]">
                      4. Hạng KIM CƯƠNG (DIAMOND) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1000000}
                      value={diamondSpendInput}
                      onChange={(e) => setDiamondSpendInput(e.target.value)}
                      className="mt-1 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2 font-mono font-bold text-[#221712]"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#faf2ec] p-3 text-[11px] text-[#6d5447] leading-relaxed">
                Lưu ý nghiệp vụ: Cấu hình mới chỉ áp dụng cho các đơn hàng
                COMPLETED sau thời điểm lưu, không tự động tính lại điểm hay hạ
                hạng của các đơn trước đó.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#e3d2c7] text-xs font-bold text-[#543e33]"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#d97757] hover:bg-[#c46344] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu cấu hình hạng thẻ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

