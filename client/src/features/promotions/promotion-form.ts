import { z } from 'zod'
import type {
  PromotionInput,
  PromotionItemRow,
  PromotionStepRow,
  PromotionType,
  PromotionView,
} from '../../types/promotions'
import { isoToLocalInput, localInputToIso } from '../../utils/datetime'

/** Các ô nhập là chuỗi; chuyển sang số khi gửi. */
export const promotionFormSchema = z
  .object({
    promotionName: z.string().trim().min(1, 'Vui lòng nhập tên chương trình'),
    description: z.string(),
    promotionType: z.enum([
      'PRODUCT_DISCOUNT',
      'FLASH_PRICE',
      'BUY_X_GET_Y',
      'COMBO',
      'ORDER_TIERED',
      'VOUCHER',
      'ORDER_GIFT',
    ]),
    voucherCode: z.string(),
    applyScope: z.enum(['ALL', 'PRODUCT', 'BRAND', 'CATEGORY']),
    discountType: z.enum(['PERCENT', 'FIXED_AMOUNT']),
    discountValue: z.string(),
    maxDiscountAmount: z.string(),
    fixedPrice: z.string(),
    comboPrice: z.string(),
    buyQuantity: z.string(),
    isRepeatable: z.boolean(),
    minOrderValue: z.string(),
    minTierId: z.string(),
    startAt: z.string().min(1, 'Chọn thời gian bắt đầu'),
    endAt: z.string().min(1, 'Chọn thời gian kết thúc'),
    dailyStartTime: z.string(),
    dailyEndTime: z.string(),
    maxQuantity: z.string(),
    usageLimit: z.string(),
    limitPerCustomer: z.string(),
  })
  .refine((v) => !v.startAt || !v.endAt || v.endAt >= v.startAt, {
    path: ['endAt'],
    message: 'Thời gian kết thúc không được trước thời gian bắt đầu',
  })

export type PromotionFormValues = z.infer<typeof promotionFormSchema>

export interface PromotionFormExtras {
  items: PromotionItemRow[]
  steps: PromotionStepRow[]
  brandIds: number[]
  categoryIds: number[]
  weekdays: number[]
}

const text = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const num = (s: string): number | null => (s.trim() === '' ? null : Number(s))

export function emptyFormValues(type: PromotionType = 'PRODUCT_DISCOUNT'): PromotionFormValues {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 30)
  return {
    promotionName: '',
    description: '',
    promotionType: type,
    voucherCode: '',
    applyScope: 'ALL',
    discountType: 'PERCENT',
    discountValue: '',
    maxDiscountAmount: '',
    fixedPrice: '',
    comboPrice: '',
    buyQuantity: '',
    isRepeatable: false,
    minOrderValue: '',
    minTierId: '',
    startAt: isoToLocalInput(start.toISOString()),
    endAt: isoToLocalInput(end.toISOString()),
    dailyStartTime: '',
    dailyEndTime: '',
    maxQuantity: '',
    usageLimit: '',
    limitPerCustomer: '',
  }
}

export function formFromPromotion(p: PromotionView): { values: PromotionFormValues; extras: PromotionFormExtras } {
  return {
    values: {
      promotionName: p.promotionName,
      description: p.description ?? '',
      promotionType: p.promotionType,
      voucherCode: p.voucherCode ?? '',
      applyScope: p.applyScope ?? 'ALL',
      discountType: p.discountType ?? 'PERCENT',
      discountValue: text(p.discountValue),
      maxDiscountAmount: text(p.maxDiscountAmount),
      fixedPrice: text(p.fixedPrice),
      comboPrice: text(p.comboPrice),
      buyQuantity: text(p.buyQuantity),
      isRepeatable: p.isRepeatable,
      minOrderValue: p.minOrderValue ? String(p.minOrderValue) : '',
      minTierId: text(p.minTierId),
      startAt: isoToLocalInput(p.startAt),
      endAt: isoToLocalInput(p.endAt),
      dailyStartTime: p.dailyStartTime ?? '',
      dailyEndTime: p.dailyEndTime ?? '',
      maxQuantity: text(p.maxQuantity),
      usageLimit: text(p.usageLimit),
      limitPerCustomer: text(p.limitPerCustomer),
    },
    extras: {
      items: p.items,
      steps: p.steps,
      brandIds: p.brandIds,
      categoryIds: p.categoryIds,
      weekdays: p.weekdays ? p.weekdays.split(',').map(Number) : [],
    },
  }
}

export function toPromotionInput(v: PromotionFormValues, x: PromotionFormExtras): PromotionInput {
  return {
    promotionName: v.promotionName.trim(),
    description: v.description.trim() || null,
    promotionType: v.promotionType,
    voucherCode: v.voucherCode.trim() || null,
    customerId: null,
    applyScope: v.promotionType === 'PRODUCT_DISCOUNT' ? v.applyScope : null,
    discountType: v.discountType,
    discountValue: num(v.discountValue),
    maxDiscountAmount: num(v.maxDiscountAmount),
    fixedPrice: num(v.fixedPrice),
    comboPrice: num(v.comboPrice),
    buyQuantity: num(v.buyQuantity),
    isRepeatable: v.isRepeatable,
    minOrderValue: num(v.minOrderValue) ?? 0,
    minTierId: num(v.minTierId),
    startAt: localInputToIso(v.startAt),
    endAt: localInputToIso(v.endAt),
    dailyStartTime: v.dailyStartTime || null,
    dailyEndTime: v.dailyEndTime || null,
    weekdays: x.weekdays.length > 0 && x.weekdays.length < 7 ? [...x.weekdays].sort().join(',') : null,
    maxQuantity: num(v.maxQuantity),
    usageLimit: num(v.usageLimit),
    limitPerCustomer: num(v.limitPerCustomer),
    items: x.items,
    brandIds: x.brandIds,
    categoryIds: x.categoryIds,
    steps: x.steps,
  }
}
