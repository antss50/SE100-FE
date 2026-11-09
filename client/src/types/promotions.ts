/** Kiểu dữ liệu khuyến mãi theo DATABASE.md mục 24-24d và KHUYEN_MAI.md (7 loại, 4 tầng). */

export type PromotionType =
  | 'PRODUCT_DISCOUNT'
  | 'FLASH_PRICE'
  | 'BUY_X_GET_Y'
  | 'COMBO'
  | 'ORDER_TIERED'
  | 'VOUCHER'
  | 'ORDER_GIFT'

export type PromotionStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED'
/** "Sắp diễn ra / Đang chạy / Đã kết thúc" tính theo ngày (không lưu trong CSDL). */
export type PromotionPhase = 'UPCOMING' | 'RUNNING' | 'ENDED'
export type ApplyScope = 'ALL' | 'PRODUCT' | 'BRAND' | 'CATEGORY'
export type DiscountType = 'PERCENT' | 'FIXED_AMOUNT'
export type PromotionItemRole = 'TARGET' | 'BUY' | 'GIFT' | 'COMBO_ITEM'

export interface PromotionItemRow {
  productId: number
  role: PromotionItemRole
  quantity: number
}

export interface PromotionStepRow {
  /** Chỉ có khi đọc từ máy chủ. */
  id?: number
  minOrderValue: number
  discountType: DiscountType
  discountValue: number
  maxDiscountAmount: number | null
}

/** Bảng PROMOTIONS kèm bốn bảng con đã nạp sẵn. */
export interface PromotionRecord {
  id: number
  promotionName: string
  description: string | null
  promotionType: PromotionType
  status: PromotionStatus
  voucherCode: string | null
  customerId: number | null
  applyScope: ApplyScope | null
  discountType: DiscountType | null
  discountValue: number | null
  maxDiscountAmount: number | null
  fixedPrice: number | null
  comboPrice: number | null
  buyQuantity: number | null
  isRepeatable: boolean
  minOrderValue: number
  minTierId: number | null
  startAt: string
  endAt: string
  dailyStartTime: string | null
  dailyEndTime: string | null
  /** `1,3,5` (1 = thứ Hai ... 7 = Chủ nhật); null = mọi ngày. */
  weekdays: string | null
  maxQuantity: number | null
  usageLimit: number | null
  limitPerCustomer: number | null
  createdBy: number
  createdAt: string
  updatedAt: string | null
  items: PromotionItemRow[]
  brandIds: number[]
  categoryIds: number[]
  steps: PromotionStepRow[]
}

/** Dòng danh sách / chi tiết trả về cho giao diện. */
export interface PromotionView extends PromotionRecord {
  phase: PromotionPhase
  /** Số đơn COMPLETED đã dùng (đếm từ ORDERS, không lưu). */
  usedCount: number
  /** Đã có đơn dùng thì khóa sửa mức giảm, điều kiện, bảng con (luật 10). */
  locked: boolean
  minTierName: string | null
  customerName: string | null
}

export type PromotionInput = Omit<
  PromotionRecord,
  'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'status'
>

export interface GetPromotionsParams {
  keyword?: string
  type?: PromotionType | 'ALL'
  status?: PromotionStatus | 'ALL'
  phase?: PromotionPhase | 'ALL'
  page?: number
  pageSize?: number
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  PRODUCT_DISCOUNT: 'Giảm giá sản phẩm',
  FLASH_PRICE: 'Đồng giá giờ vàng',
  BUY_X_GET_Y: 'Mua X tặng Y',
  COMBO: 'Combo giá cố định',
  ORDER_TIERED: 'Bậc thang theo hóa đơn',
  VOUCHER: 'Voucher mã',
  ORDER_GIFT: 'Quà theo hóa đơn',
}

export const PROMOTION_TIER_OF: Record<PromotionType, 'Tầng 1 · Dòng hàng' | 'Tầng 3 · Đơn hàng'> = {
  PRODUCT_DISCOUNT: 'Tầng 1 · Dòng hàng',
  FLASH_PRICE: 'Tầng 1 · Dòng hàng',
  BUY_X_GET_Y: 'Tầng 1 · Dòng hàng',
  COMBO: 'Tầng 1 · Dòng hàng',
  ORDER_TIERED: 'Tầng 3 · Đơn hàng',
  VOUCHER: 'Tầng 3 · Đơn hàng',
  ORDER_GIFT: 'Tầng 3 · Đơn hàng',
}

/** Một dòng tóm tắt mức ưu đãi để hiện trên thẻ/bảng. */
export function summarizePromotion(p: PromotionRecord): string {
  const money = (v: number | null) => (v ?? 0).toLocaleString('vi-VN')
  const discount = (type: DiscountType | null, value: number | null) =>
    type === 'PERCENT' ? `${value ?? 0}%` : `${money(value)} đ`
  switch (p.promotionType) {
    case 'PRODUCT_DISCOUNT':
      return `Giảm ${discount(p.discountType, p.discountValue)}`
    case 'FLASH_PRICE':
      return `Đồng giá ${money(p.fixedPrice)} đ`
    case 'BUY_X_GET_Y':
      return `Mua ${p.buyQuantity ?? 0} tặng ${p.items.filter((i) => i.role === 'GIFT').reduce((s, i) => s + i.quantity, 0)}`
    case 'COMBO':
      return `Combo ${money(p.comboPrice)} đ`
    case 'ORDER_TIERED':
      return `${p.steps.length} bậc giảm theo hóa đơn`
    case 'VOUCHER':
      return `Giảm ${discount(p.discountType, p.discountValue)} · đơn từ ${money(p.minOrderValue)} đ`
    case 'ORDER_GIFT':
      return `Tặng quà cho đơn từ ${money(p.minOrderValue)} đ`
  }
}
