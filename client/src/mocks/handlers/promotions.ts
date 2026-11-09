import { z } from 'zod'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody, sameText } from '../http'
import type { MockTransaction } from '../db'
import { buildUsageIndex, phaseOf, toView } from '../promotion-engine'
import type { MockRoute } from '../router'
import { toIsoLocal } from '../time'
import type { PromotionRecord } from '../../types/promotions'
import { loyaltyRoutes } from './loyalty'

const PROMOTION_TYPES = [
  'PRODUCT_DISCOUNT',
  'FLASH_PRICE',
  'BUY_X_GET_Y',
  'COMBO',
  'ORDER_TIERED',
  'VOUCHER',
  'ORDER_GIFT',
] as const

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Thời gian không hợp lệ')
const money = z.number().min(0, 'Số tiền không được âm')
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:MM')
const discountType = z.enum(['PERCENT', 'FIXED_AMOUNT'])

const inputSchema = z.object({
  promotionName: z.string().trim().min(1, 'Vui lòng nhập tên chương trình'),
  description: z.string().trim().nullish(),
  promotionType: z.enum(PROMOTION_TYPES),
  status: z.enum(['DRAFT', 'ACTIVE']).optional(),
  voucherCode: z.string().trim().nullish(),
  customerId: z.number().int().nullish(),
  applyScope: z.enum(['ALL', 'PRODUCT', 'BRAND', 'CATEGORY']).nullish(),
  discountType: discountType.nullish(),
  discountValue: z.number().positive('Mức giảm phải lớn hơn 0').nullish(),
  maxDiscountAmount: money.nullish(),
  fixedPrice: money.nullish(),
  comboPrice: money.nullish(),
  buyQuantity: z.number().int().positive('Số món cần mua phải lớn hơn 0').nullish(),
  isRepeatable: z.boolean().optional(),
  minOrderValue: money.optional(),
  minTierId: z.number().int().nullish(),
  startAt: isoDateTime,
  endAt: isoDateTime,
  dailyStartTime: hhmm.nullish(),
  dailyEndTime: hhmm.nullish(),
  weekdays: z.string().regex(/^[1-7](,[1-7])*$/, 'Các thứ không hợp lệ').nullish(),
  maxQuantity: z.number().int().positive().nullish(),
  usageLimit: z.number().int().positive('Tổng lượt dùng phải lớn hơn 0').nullish(),
  limitPerCustomer: z.number().int().positive('Lượt dùng mỗi khách phải lớn hơn 0').nullish(),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        role: z.enum(['TARGET', 'BUY', 'GIFT', 'COMBO_ITEM']),
        quantity: z.number().int().positive(),
      })
    )
    .default([]),
  brandIds: z.array(z.number().int()).default([]),
  categoryIds: z.array(z.number().int()).default([]),
  steps: z
    .array(
      z.object({
        minOrderValue: money,
        discountType,
        discountValue: z.number().positive('Mức giảm của bậc phải lớn hơn 0'),
        maxDiscountAmount: money.nullish(),
      })
    )
    .default([]),
})

type Input = z.infer<typeof inputSchema>

const invalid = (message: string) => new MockHttpError(422, 'PROM_INVALID', message)

/** Kiểm cột bắt buộc theo loại (DATABASE.md mục 24) và các ràng buộc chung. */
function validate(db: MockTransaction, input: Input, selfId: number | null): void {
  if (new Date(input.endAt) < new Date(input.startAt)) {
    throw new MockHttpError(422, 'PROM_DATE_RANGE_INVALID', 'Thời gian kết thúc không được trước thời gian bắt đầu')
  }
  if (input.limitPerCustomer && input.usageLimit && input.limitPerCustomer > input.usageLimit) {
    throw new MockHttpError(
      422,
      'PROM_LIMIT_PER_CUSTOMER_INVALID',
      'Số lượt mỗi khách không được vượt quá tổng số lượt dùng'
    )
  }
  if (input.discountType === 'PERCENT' && (input.discountValue ?? 0) > 100) {
    throw invalid('Mức giảm phần trăm không được vượt quá 100%')
  }
  const roles = (role: string) => input.items.filter((i) => i.role === role)
  switch (input.promotionType) {
    case 'PRODUCT_DISCOUNT':
      if (!input.applyScope || !input.discountType || !input.discountValue) {
        throw invalid('Giảm giá sản phẩm cần phạm vi áp dụng, kiểu giảm và mức giảm')
      }
      if (input.applyScope === 'PRODUCT' && roles('TARGET').length === 0) throw invalid('Chọn ít nhất một sản phẩm áp dụng')
      if (input.applyScope === 'BRAND' && input.brandIds.length === 0) throw invalid('Chọn ít nhất một thương hiệu')
      if (input.applyScope === 'CATEGORY' && input.categoryIds.length === 0) throw invalid('Chọn ít nhất một danh mục')
      break
    case 'FLASH_PRICE':
      if (!input.fixedPrice) throw invalid('Đồng giá giờ vàng cần giá đồng giá')
      if (roles('TARGET').length === 0) throw invalid('Chọn ít nhất một sản phẩm áp dụng')
      break
    case 'BUY_X_GET_Y':
      if (!input.buyQuantity) throw invalid('Mua X tặng Y cần số món phải mua')
      if (roles('BUY').length === 0) throw invalid('Chọn ít nhất một sản phẩm nhóm "mua"')
      if (roles('GIFT').length === 0) throw invalid('Chọn ít nhất một sản phẩm quà tặng')
      break
    case 'COMBO':
      if (!input.comboPrice) throw invalid('Combo cần giá cả bộ')
      if (roles('COMBO_ITEM').length < 2) throw invalid('Combo cần ít nhất hai sản phẩm')
      break
    case 'ORDER_TIERED': {
      if (input.steps.length === 0) throw invalid('Bậc thang cần ít nhất một bậc')
      const mins = input.steps.map((s) => s.minOrderValue)
      if (new Set(mins).size !== mins.length) throw invalid('Hai bậc không được cùng ngưỡng đơn hàng')
      break
    }
    case 'ORDER_GIFT':
      if (!input.minOrderValue) throw invalid('Quà theo hóa đơn cần ngưỡng đơn hàng')
      if (roles('GIFT').length === 0) throw invalid('Chọn ít nhất một sản phẩm quà tặng')
      break
    case 'VOUCHER':
      if (!input.voucherCode) throw invalid('Voucher cần mã nhập tại quầy')
      if (!input.discountType || !input.discountValue) throw invalid('Voucher cần kiểu giảm và mức giảm')
      if (
        db
          .read('promotions')
          .some((p) => p.id !== selfId && sameText(p.voucherCode, input.voucherCode))
      ) {
        throw new MockHttpError(409, 'PROM_VOUCHER_DUPLICATED', 'Mã voucher này đã tồn tại, vui lòng chọn mã khác')
      }
      if (input.customerId != null) {
        const target = db.read('customers').find((c) => c.id === input.customerId)
        if (!target) throw new MockHttpError(404, 'CUS_NOT_FOUND', 'Không tìm thấy khách hàng của voucher riêng')
        if (target.status !== 'ACTIVE') throw invalid('Khách hàng đã bị khóa ưu đãi, không gán voucher riêng được')
      }
      break
  }
  const productIds = db.read('products').map((p) => p.id)
  for (const item of input.items) {
    if (!productIds.includes(item.productId)) throw invalid(`Sản phẩm #${item.productId} không tồn tại`)
  }
}

/** Chỉ giữ cột thuộc loại của khuyến mãi, các cột khác để NULL cho CSDL sạch. */
function normalize(input: Input): Omit<PromotionRecord, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'status'> {
  const t = input.promotionType
  const only = <T,>(types: readonly (typeof PROMOTION_TYPES)[number][], value: T | null | undefined): T | null =>
    types.includes(t) ? (value ?? null) : null
  const itemRoles: Record<(typeof PROMOTION_TYPES)[number], string[]> = {
    PRODUCT_DISCOUNT: ['TARGET'],
    FLASH_PRICE: ['TARGET'],
    BUY_X_GET_Y: ['BUY', 'GIFT'],
    COMBO: ['COMBO_ITEM'],
    ORDER_TIERED: [],
    ORDER_GIFT: ['GIFT'],
    VOUCHER: [],
  }
  return {
    promotionName: input.promotionName,
    description: input.description || null,
    promotionType: t,
    voucherCode: t === 'VOUCHER' ? (input.voucherCode?.toUpperCase() ?? null) : null,
    customerId: only(['VOUCHER'], input.customerId),
    applyScope: only(['PRODUCT_DISCOUNT'], input.applyScope),
    discountType: only(['PRODUCT_DISCOUNT', 'VOUCHER'], input.discountType),
    discountValue: only(['PRODUCT_DISCOUNT', 'VOUCHER'], input.discountValue),
    maxDiscountAmount: only(['PRODUCT_DISCOUNT', 'VOUCHER'], input.maxDiscountAmount),
    fixedPrice: only(['FLASH_PRICE'], input.fixedPrice),
    comboPrice: only(['COMBO'], input.comboPrice),
    buyQuantity: only(['BUY_X_GET_Y'], input.buyQuantity),
    isRepeatable: t === 'BUY_X_GET_Y' ? Boolean(input.isRepeatable) : false,
    minOrderValue: t === 'VOUCHER' || t === 'ORDER_GIFT' ? (input.minOrderValue ?? 0) : 0,
    minTierId: input.minTierId ?? null,
    startAt: input.startAt,
    endAt: input.endAt,
    dailyStartTime: only(['FLASH_PRICE'], input.dailyStartTime),
    dailyEndTime: only(['FLASH_PRICE'], input.dailyEndTime),
    weekdays: only(['FLASH_PRICE'], input.weekdays),
    maxQuantity: only(['FLASH_PRICE'], input.maxQuantity),
    usageLimit: input.usageLimit ?? null,
    limitPerCustomer: input.limitPerCustomer ?? null,
    items:
      t === 'PRODUCT_DISCOUNT' && input.applyScope !== 'PRODUCT'
        ? []
        : input.items.filter((i) => itemRoles[t].includes(i.role)),
    brandIds: t === 'PRODUCT_DISCOUNT' && input.applyScope === 'BRAND' ? input.brandIds : [],
    categoryIds: t === 'PRODUCT_DISCOUNT' && input.applyScope === 'CATEGORY' ? input.categoryIds : [],
    steps: t === 'ORDER_TIERED' ? input.steps.map((s) => ({ ...s, maxDiscountAmount: s.maxDiscountAmount ?? null })) : [],
  }
}

function findPromotion(db: MockTransaction, id: string): PromotionRecord {
  const found = db.read('promotions').find((p) => String(p.id) === id)
  if (!found) throw notFound('PROM_NOT_FOUND', 'Không tìm thấy chương trình khuyến mãi')
  return found
}

/** Phần "khóa sửa" của một khuyến mãi (luật 10): mọi thứ trừ tên, mô tả, ngày kết thúc. */
const lockedPart = (p: ReturnType<typeof normalize>): string => {
  const { promotionName, description, endAt, items, brandIds, categoryIds, steps, ...rest } = p
  void promotionName
  void description
  void endAt
  const sortedItems = [...items].sort((a, b) => a.role.localeCompare(b.role) || a.productId - b.productId)
  const sortedSteps = steps
    .map((s) => [s.minOrderValue, s.discountType, s.discountValue, s.maxDiscountAmount ?? null])
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  const scalars = Object.keys(rest)
    .sort()
    .map((k) => [k, (rest as Record<string, unknown>)[k]])
  return JSON.stringify([scalars, sortedItems, [...brandIds].sort(), [...categoryIds].sort(), sortedSteps])
}

export const promotionRoutes: MockRoute[] = [
  ...loyaltyRoutes,
  {
    method: 'GET',
    path: '/promotions',
    permission: 'PROMOTION_VIEW',
    handler: ({ db, query, now }) => {
      const kw = keywordOf(query)
      const type = query.get('type')
      const status = query.get('status')
      const phase = query.get('phase')
      const usage = buildUsageIndex(db)
      const items = db
        .read('promotions')
        .filter(
          (p) =>
            (!kw || (p.voucherCode ?? '').toLowerCase().includes(kw) || p.promotionName.toLowerCase().includes(kw)) &&
            (!type || type === 'ALL' || p.promotionType === type) &&
            (!status || status === 'ALL' || p.status === status) &&
            (!phase || phase === 'ALL' || phaseOf(p, now) === phase)
        )
        .sort((a, b) => b.id - a.id)
        .map((p) => toView(db, p, now, usage))
      return ok(paginate(items, query, 12), 'Lấy danh sách khuyến mãi thành công')
    },
  },
  {
    method: 'GET',
    path: '/promotions/:id',
    permission: 'PROMOTION_VIEW',
    handler: ({ db, params, now }) =>
      ok(toView(db, findPromotion(db, params.id), now, buildUsageIndex(db)), 'Lấy chương trình khuyến mãi thành công'),
  },
  {
    method: 'POST',
    path: '/promotions',
    permission: 'PROMOTION_MANAGE',
    handler: ({ db, body, user, now }) => {
      const input = parseBody(inputSchema, body)
      validate(db, input, null)
      const promotions = db.read('promotions')
      const created: PromotionRecord = {
        ...normalize(input),
        id: db.nextSeq('promotion', promotions.reduce((m, p) => Math.max(m, p.id), 0) + 1),
        status: input.status ?? 'DRAFT',
        createdBy: user?.id ?? 0,
        createdAt: toIsoLocal(now),
        updatedAt: null,
      }
      db.write('promotions', [...promotions, created])
      return ok(toView(db, created, now, buildUsageIndex(db)), 'Tạo chương trình khuyến mãi thành công', 201)
    },
  },
  {
    method: 'PUT',
    path: '/promotions/:id',
    permission: 'PROMOTION_MANAGE',
    handler: ({ db, params, body, now }) => {
      const input = parseBody(inputSchema, body)
      const target = findPromotion(db, params.id)
      validate(db, input, target.id)
      const next = normalize(input)
      const usage = buildUsageIndex(db)
      if ((usage.used.get(target.id) ?? 0) > 0) {
        const { id, createdBy, createdAt, updatedAt, status, ...currentFields } = target
        void id
        void createdBy
        void createdAt
        void updatedAt
        void status
        if (lockedPart(next) !== lockedPart(currentFields)) {
          throw new MockHttpError(
            409,
            'PROM_FIELD_LOCKED',
            'Chương trình đã có đơn dùng: chỉ được đổi tên, mô tả, ngày kết thúc hoặc tạm dừng'
          )
        }
      }
      Object.assign(target, next, { updatedAt: toIsoLocal(now) })
      if (input.status && target.status === 'DRAFT') target.status = input.status
      db.touch('promotions')
      return ok(toView(db, target, now, usage), 'Cập nhật chương trình khuyến mãi thành công')
    },
  },
  {
    method: 'PATCH',
    path: '/promotions/:id/status',
    permission: 'PROMOTION_MANAGE',
    handler: ({ db, params, body, now }) => {
      const { status } = parseBody(z.object({ status: z.enum(['ACTIVE', 'PAUSED']) }), body)
      const target = findPromotion(db, params.id)
      if (target.status === status) {
        throw new MockHttpError(409, 'PROM_STATUS_INVALID', 'Chương trình đã ở trạng thái này')
      }
      if (status === 'PAUSED' && target.status !== 'ACTIVE') {
        throw new MockHttpError(409, 'PROM_STATUS_INVALID', 'Chỉ chương trình đang kích hoạt mới tạm dừng được')
      }
      target.status = status
      target.updatedAt = toIsoLocal(now)
      db.touch('promotions')
      return ok(
        toView(db, target, now, buildUsageIndex(db)),
        status === 'PAUSED' ? 'Đã tạm dừng chương trình' : 'Đã kích hoạt chương trình'
      )
    },
  },
]
