import {
  Award,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUiStore } from '../../app/store'
import { mockDb } from '../../lib/mock-db'
import { authService } from '../../services/auth.service'
import { customersService } from '../../services/customers.service'
import { productsService } from '../../services/products.service'
import { promotionsService } from '../../services/promotions.service'
import type {
  CustomerItem,
  LoyaltyConfigData,
  ProductItem,
  PromotionItem,
  ShiftInfo,
} from '../../types/api'
import { formatCurrency, formatNumber } from '../../utils/format'

interface CartItem {
  product: ProductItem
  quantity: number
}

export function PosPage() {
  const openShiftModal = useUiStore((s) => s.openShiftModal)

  const [products, setProducts] = useState<ProductItem[]>([])
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [promotions, setPromotions] = useState<PromotionItem[]>([])
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfigData | null>(
    null
  )
  const [currentShift, setCurrentShift] = useState<ShiftInfo | null>(null)

  const [searchProduct, setSearchProduct] = useState('')
  const [selectedCustomerCode, setSelectedCustomerCode] =
    useState<string>('KH-2024-001')
  const [selectedVoucher, setSelectedVoucher] = useState<string>('WELCOME10')
  const [cart, setCart] = useState<CartItem[]>([])
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      productsService.getProducts({ status: 'ACTIVE', pageSize: 50 }),
      customersService.getCustomers({ pageSize: 50 }),
      promotionsService.getPromotions({ status: 'ACTIVE' }),
      promotionsService.getLoyaltyConfig(),
      authService.getCurrentShift(),
    ]).then(([prodRes, cusRes, promoRes, loyaltyRes, shiftRes]) => {
      if (!active) return
      setProducts(prodRes.data.items)
      setCustomers(cusRes.data.items)
      setPromotions(promoRes.data.items)
      setLoyaltyConfig(loyaltyRes.data)
      setCurrentShift(shiftRes.data.shift)
      if (prodRes.data.items.length > 0) {
        setCart([{ product: prodRes.data.items[0], quantity: 1 }])
      }
    })
    return () => {
      active = false
    }
  }, [])

  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.sku === product.sku)
      if (existing) {
        return prev.map((i) =>
          i.product.sku === product.sku
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQty = (sku: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.sku === sku ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  const selectedCustomer = customers.find(
    (c) => c.customerCode === selectedCustomerCode
  )
  const selectedPromo = promotions.find(
    (p) => p.voucherCode === selectedVoucher
  )

  const subtotalAmount = cart.reduce(
    (sum, item) => sum + item.product.retailPrice * item.quantity,
    0
  )

  const tierDiscountRate = parseFloat(
    selectedCustomer?.tier?.discountRate || '0'
  )
  const tierDiscountAmount = Math.round(subtotalAmount * tierDiscountRate)

  let orderDiscountAmount = 0
  if (selectedPromo && subtotalAmount >= (selectedPromo.minOrderValue ?? 0)) {
    if (
      selectedPromo.promotionType === 'PERCENT_ORDER' ||
      selectedPromo.discountType === 'PERCENT'
    ) {
      const rawDisc = Math.round(
        subtotalAmount * ((selectedPromo.discountValue ?? 0) / 100)
      )
      orderDiscountAmount = selectedPromo.maxDiscountAmount
        ? Math.min(rawDisc, selectedPromo.maxDiscountAmount)
        : rawDisc
    } else if (
      selectedPromo.promotionType === 'FIXED_ORDER' ||
      selectedPromo.discountType === 'FIXED_AMOUNT'
    ) {
      orderDiscountAmount = selectedPromo.discountValue ?? 0
    }
  }

  // UC-CUS-08: eligibleSpend = max(0, subtotalAmount - lineDiscountAmount - tierDiscountAmount - orderDiscountAmount)
  const eligibleSpend = Math.max(
    0,
    subtotalAmount - tierDiscountAmount - orderDiscountAmount
  )
  const amountPerPoint = loyaltyConfig?.amountPerPoint || 10000
  const earnedPoints = selectedCustomer
    ? Math.floor(eligibleSpend / amountPerPoint)
    : 0

  const taxAmount = Math.round(eligibleSpend * 0.08)
  const totalPayable = eligibleSpend + taxAmount

  const handleCompleteOrder = () => {
    if (cart.length === 0) return

    const orderCode = `#HD-${Math.floor(90000 + Math.random() * 9999)}`

    // UC-CUS-08: Cập nhật điểm, lịch sử điểm (EARN) và tự động nâng hạng thẻ nếu đủ minSpend
    if (selectedCustomer && loyaltyConfig) {
      const allCustomers = mockDb.getCustomers()
      const targetCus = allCustomers.find(
        (c) => c.customerCode === selectedCustomer.customerCode
      )
      if (targetCus) {
        const nextTotalSpent =
          parseFloat(targetCus.totalSpent || '0') + eligibleSpend
        const nextPoints = targetCus.rewardPoints + earnedPoints
        targetCus.totalSpent = nextTotalSpent.toFixed(2)
        targetCus.rewardPoints = nextPoints
        targetCus.completedOrdersCount =
          (targetCus.completedOrdersCount || 0) + 1
        targetCus.lastOrderText = 'Vừa xong'
        targetCus.lastOrderCode = orderCode

        // Tự động nâng lên hạng thẻ cao nhất thỏa mãn minSpend <= totalSpent
        const sortedTiers = [...loyaltyConfig.tiers].sort(
          (a, b) => b.minSpend - a.minSpend
        )
        const matchedTier = sortedTiers.find(
          (t) => nextTotalSpent >= t.minSpend
        )
        if (matchedTier) {
          const tierNames: Record<string, string> = {
            BRONZE: 'Hạng Đồng',
            SILVER: 'Hạng Bạc',
            GOLD: 'Hạng Vàng',
            DIAMOND: 'Hạng Kim Cương',
          }
          targetCus.tier = {
            ...targetCus.tier,
            tierCode: matchedTier.tier,
            tierName: tierNames[matchedTier.tier] || matchedTier.tier,
          }
        }

        if (earnedPoints > 0) {
          targetCus.pointHistories = [
            {
              id: Date.now(),
              orderId: orderCode.replace('#', ''),
              actionType: 'EARN',
              pointsChanged: earnedPoints,
              balanceAfter: nextPoints,
              createdAt: new Date().toLocaleString('vi-VN'),
              description: `Tích điểm tự động đơn ${orderCode} (UC-CUS-08)`,
            },
            ...(targetCus.pointHistories || []),
          ]
        }

        mockDb.saveCustomers(allCustomers)
        setCustomers(allCustomers)
      }
    }

    setCheckoutSuccess(
      `Hoàn tất đơn hàng ${orderCode} (${formatCurrency(totalPayable)})${
        selectedCustomer
          ? ` · Cộng +${formatNumber(earnedPoints)} điểm cho ${selectedCustomer.fullName}`
          : ''
      }`
    )
    setCart([])
    setTimeout(() => setCheckoutSuccess(null), 5000)
  }

  const filteredProducts = products.filter((p) => {
    if (!searchProduct.trim()) return true
    const kw = searchProduct.trim().toLowerCase()
    return (
      p.productName.toLowerCase().includes(kw) ||
      p.sku.toLowerCase().includes(kw) ||
      (p.barcode && p.barcode.includes(kw))
    )
  })

  return (
    <div className="space-y-6">
      {/* Top POS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#221712]">
            Màn hình Thu ngân POS Siêu tốc (FEFO & Loyalty Auto-Sync)
          </h1>
          <p className="text-xs text-[#7c6356] mt-1">
            Tự động gắn lô FEFO, áp dụng chiết khấu hạng thẻ, Voucher và tích
            điểm thưởng theo quy tắc UC-CUS-08.
          </p>
        </div>

        <button
          type="button"
          onClick={openShiftModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#f7ece4] border border-[#e5d2c6] px-4 py-2.5 text-xs font-bold text-[#3f2c23] cursor-pointer"
        >
          <Clock className="size-4 text-[#9a462d]" />
          <span>
            {currentShift
              ? `Ca #SHIFT-0${currentShift.shiftId} (Tiền đầu ca: ${formatCurrency(currentShift.openingCash)})`
              : 'Mở ca làm việc (UC-POS-05a)'}
          </span>
        </button>
      </div>

      {checkoutSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{checkoutSuccess}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Product Catalog Grid */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="size-4 text-[#9a7e70] absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              placeholder="Quét mã vạch EAN-13 hoặc nhập tên/SKU mỹ phẩm..."
              className="w-full rounded-2xl bg-white border border-[#ead9ce] pl-11 pr-4 py-3 text-xs text-[#221712] outline-none focus:border-[#d57252]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            {filteredProducts.map((prod) => (
              <div
                key={prod.sku}
                onClick={() => addToCart(prod)}
                className="rounded-3xl bg-white border border-[#ead9ce] hover:border-[#d57252] p-4 shadow-2xs transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#f6ebe4] text-[#9a462d] font-mono text-[10px] font-bold">
                      {prod.sku}
                    </span>
                    <span className="text-[11px] font-semibold text-[#7c6356]">
                      {prod.brandName}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xs sm:text-sm font-extrabold text-[#221712]">
                    {prod.productName}
                  </h3>
                  <p className="mt-1 text-[11px] text-[#7c6356]">
                    {prod.unit} {prod.volume} · Tồn: {prod.currentStock ?? 20}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#f3e7df] flex items-center justify-between">
                  <span className="font-mono text-sm font-extrabold text-[#9a3b20]">
                    {formatCurrency(prod.retailPrice)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#da7756]">
                    <Plus className="size-3.5" /> Thêm vào đơn
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: Cart, Customer Loyalty & Payment Summary */}
        <div className="lg:col-span-5 rounded-3xl bg-white border border-[#ead9ce] p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#f2e6de]">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-4 text-[#9a462d]" />
              <h2 className="text-sm font-extrabold text-[#221712]">
                Giỏ hàng & Tính điểm tự động (UC-CUS-08)
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#fbeae2] text-[#9a462d] font-mono text-[11px] font-bold">
              {cart.reduce((s, i) => s + i.quantity, 0)} SP
            </span>
          </div>

          {/* Customer Selector */}
          <div>
            <label className="text-xs font-bold text-[#4b362c] flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-[#9a462d]" />
              <span>Khách hàng thành viên</span>
            </label>
            <select
              value={selectedCustomerCode}
              onChange={(e) => setSelectedCustomerCode(e.target.value)}
              className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2.5 text-xs font-semibold text-[#221712]"
            >
              <option value="">Khách vãng lai (Không tích điểm)</option>
              {customers.map((c) => (
                <option key={c.customerCode} value={c.customerCode}>
                  {c.fullName} ({c.phoneNumber}) — {c.tier?.tierName}
                </option>
              ))}
            </select>
          </div>

          {/* Voucher Selector */}
          <div>
            <label className="text-xs font-bold text-[#4b362c] flex items-center gap-1.5">
              <Tag className="size-3.5 text-[#9a462d]" />
              <span>Áp dụng Voucher khuyến mãi (G11)</span>
            </label>
            <select
              value={selectedVoucher}
              onChange={(e) => setSelectedVoucher(e.target.value)}
              className="mt-1.5 w-full rounded-xl bg-[#fcf7f4] border border-[#e5d2c6] px-3.5 py-2.5 text-xs font-semibold text-[#221712]"
            >
              <option value="">Không dùng mã Voucher</option>
              {promotions.map((p) => (
                <option key={p.voucherCode} value={p.voucherCode}>
                  {p.voucherCode} — {p.promotionName} ({p.valueSummaryTitle})
                </option>
              ))}
            </select>
          </div>

          {/* Cart Items */}
          <div className="divide-y divide-[#f3e7df] max-h-56 overflow-y-auto">
            {cart.map(({ product, quantity }) => (
              <div
                key={product.sku}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#221712] truncate">
                    {product.productName}
                  </p>
                  <p className="font-mono text-[11px] text-[#8a7062]">
                    {formatCurrency(product.retailPrice)} x {quantity}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateQty(product.sku, -1)}
                    className="size-7 rounded-lg bg-[#f6ede6] grid place-items-center cursor-pointer"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center font-mono font-bold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(product.sku, 1)}
                    className="size-7 rounded-lg bg-[#f6ede6] grid place-items-center cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQty(product.sku, -quantity)}
                    className="size-7 rounded-lg text-red-600 hover:bg-red-50 grid place-items-center cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <p className="py-8 text-center text-xs text-[#8a7062]">
                Chưa có sản phẩm trong giỏ. Bấm vào sản phẩm bên trái để thêm.
              </p>
            )}
          </div>

          {/* Calculation Breakdown (UC-CUS-08 formula) */}
          <div className="rounded-2xl bg-[#faf3ee] border border-[#ebd9ce] p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6e564a]">Tổng tiền hàng (subtotal):</span>
              <span className="font-mono font-bold">
                {formatCurrency(subtotalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-[#9a462d]">
              <span>Chiết khấu hạng thẻ ({selectedCustomer?.tier?.tierName || '0%'}):</span>
              <span className="font-mono font-bold">
                -{formatCurrency(tierDiscountAmount)}
              </span>
            </div>
            <div className="flex justify-between text-[#9a462d]">
              <span>Giảm giá Voucher ({selectedVoucher || 'Không'}):</span>
              <span className="font-mono font-bold">
                -{formatCurrency(orderDiscountAmount)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#e8d5c8]">
              <span className="text-[#6e564a]">
                Chi tiêu tính điểm (eligibleSpend):
              </span>
              <span className="font-mono font-bold text-[#221712]">
                {formatCurrency(eligibleSpend)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e564a]">Thuế GTGT (taxAmount 8%):</span>
              <span className="font-mono">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#e8d5c8] text-sm font-extrabold text-[#221712]">
              <span>Tổng thanh toán:</span>
              <span className="font-mono text-[#9a3b20]">
                {formatCurrency(totalPayable)}
              </span>
            </div>
          </div>

          {/* Points Earned Preview Banner */}
          <div className="rounded-2xl bg-[#faefe7] border border-[#ebd5c6] px-4 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#5e3927]">
              <Award className="size-4 text-[#9a462d]" />
              <span>Điểm thưởng cộng sau hoàn tất (earnedPoints):</span>
            </div>
            <span className="font-mono font-extrabold text-emerald-700">
              +{formatNumber(earnedPoints)} pts
            </span>
          </div>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleCompleteOrder}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#da7756] hover:bg-[#c46343] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Sparkles className="size-4" />
            <span>Hoàn tất Đơn hàng & Tích điểm (COMPLETED)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
