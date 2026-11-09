import type { PromotionRecord } from '../../types/promotions'
import { addDays, toIsoLocal } from '../time'

/**
 * 11 khuyến mãi mẫu phủ đủ 7 loại, ngày tính tương đối so với `today`.
 * Sản phẩm: 2 son YSL (1.150.000), 3 chống nắng Anessa (685.000), 4 tẩy trang Bioderma (495.000),
 * 5 son bóng Romand (195.000), 6 chống nắng LRP (465.000), 7 Kiehl's, 8 Clinique.
 */
export function seedPromotions(today: Date): PromotionRecord[] {
  const at = (days: number, h = 0, m = 0) => {
    const d = addDays(today, days)
    d.setHours(h, m, 0, 0)
    return toIsoLocal(d)
  }
  const base = (
    id: number,
    promotionType: PromotionRecord['promotionType'],
    promotionName: string,
    extra: Partial<PromotionRecord>
  ): PromotionRecord => ({
    id,
    promotionName,
    description: null,
    promotionType,
    status: 'ACTIVE',
    voucherCode: null,
    customerId: null,
    applyScope: null,
    discountType: null,
    discountValue: null,
    maxDiscountAmount: null,
    fixedPrice: null,
    comboPrice: null,
    buyQuantity: null,
    isRepeatable: false,
    minOrderValue: 0,
    minTierId: null,
    startAt: at(-30),
    endAt: at(60, 23, 59),
    dailyStartTime: null,
    dailyEndTime: null,
    weekdays: null,
    maxQuantity: null,
    usageLimit: null,
    limitPerCustomer: null,
    createdBy: 2,
    createdAt: at(-31, 9),
    updatedAt: null,
    items: [],
    brandIds: [],
    categoryIds: [],
    steps: [],
    ...extra,
  })

  return [
    base(1, 'PRODUCT_DISCOUNT', 'Son YSL giảm 20%', {
      description: 'Giảm 20% son YSL Rouge Pur Couture, tối đa 200.000 đ mỗi dòng.',
      applyScope: 'PRODUCT',
      discountType: 'PERCENT',
      discountValue: 20,
      maxDiscountAmount: 200000,
      items: [{ productId: 2, role: 'TARGET', quantity: 1 }],
    }),
    base(2, 'PRODUCT_DISCOUNT', 'Chống nắng giảm 50.000 đ', {
      description: 'Mọi sản phẩm danh mục Chống nắng giảm 50.000 đ mỗi sản phẩm.',
      applyScope: 'CATEGORY',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50000,
      categoryIds: [3],
    }),
    base(3, 'FLASH_PRICE', 'Giờ vàng đồng giá Bioderma', {
      description: 'Đồng giá 399.000 đ trong khung 09:00-21:00 các ngày thứ Hai, Tư, Sáu.',
      fixedPrice: 399000,
      dailyStartTime: '09:00',
      dailyEndTime: '21:00',
      weekdays: '1,3,5',
      maxQuantity: 100,
      items: [{ productId: 4, role: 'TARGET', quantity: 1 }],
    }),
    base(4, 'BUY_X_GET_Y', 'Mua 2 chống nắng LRP tặng son bóng Romand', {
      buyQuantity: 2,
      isRepeatable: true,
      items: [
        { productId: 6, role: 'BUY', quantity: 1 },
        { productId: 5, role: 'GIFT', quantity: 1 },
      ],
    }),
    base(5, 'COMBO', 'Combo làm sạch và chống nắng', {
      description: 'Bioderma 500ml + Anessa UV 60ml chỉ 1.050.000 đ.',
      comboPrice: 1050000,
      items: [
        { productId: 4, role: 'COMBO_ITEM', quantity: 1 },
        { productId: 3, role: 'COMBO_ITEM', quantity: 1 },
      ],
    }),
    base(6, 'ORDER_TIERED', 'Hóa đơn càng lớn giảm càng nhiều', {
      steps: [
        { id: 1, minOrderValue: 1000000, discountType: 'FIXED_AMOUNT', discountValue: 50000, maxDiscountAmount: null },
        { id: 2, minOrderValue: 3000000, discountType: 'FIXED_AMOUNT', discountValue: 200000, maxDiscountAmount: null },
        { id: 3, minOrderValue: 6000000, discountType: 'PERCENT', discountValue: 8, maxDiscountAmount: 600000 },
      ],
    }),
    base(7, 'VOUCHER', 'Chào bạn mới WELCOME10', {
      description: 'Giảm 10% đơn từ 300.000 đ, tối đa 100.000 đ. Mỗi khách dùng 1 lần, từ hạng Bạc.',
      voucherCode: 'WELCOME10',
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscountAmount: 100000,
      minOrderValue: 300000,
      minTierId: 2,
      usageLimit: 500,
      limitPerCustomer: 1,
    }),
    base(8, 'VOUCHER', 'Voucher giảm 100.000 đ', {
      voucherCode: 'GIAM100',
      discountType: 'FIXED_AMOUNT',
      discountValue: 100000,
      minOrderValue: 800000,
      usageLimit: 200,
    }),
    base(9, 'ORDER_GIFT', 'Đơn từ 2.000.000 đ tặng son bóng', {
      minOrderValue: 2000000,
      items: [{ productId: 5, role: 'GIFT', quantity: 1 }],
    }),
    base(10, 'VOUCHER', 'Tạm dừng NEWPROMO01', {
      status: 'PAUSED',
      voucherCode: 'NEWPROMO01',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50000,
      minOrderValue: 500000,
      usageLimit: 200,
    }),
    base(11, 'PRODUCT_DISCOUNT', 'Mừng Black Friday (sắp diễn ra)', {
      status: 'ACTIVE',
      applyScope: 'BRAND',
      discountType: 'PERCENT',
      discountValue: 30,
      brandIds: [1, 7],
      startAt: at(14),
      endAt: at(21, 23, 59),
    }),
    base(12, 'PRODUCT_DISCOUNT', 'Ưu đãi Thu Đông (đã kết thúc)', {
      applyScope: 'ALL',
      discountType: 'PERCENT',
      discountValue: 5,
      startAt: at(-60),
      endAt: at(-5, 23, 59),
    }),
    base(13, 'FLASH_PRICE', 'Flash sale tuần sau (nháp)', {
      status: 'DRAFT',
      fixedPrice: 169000,
      items: [{ productId: 5, role: 'TARGET', quantity: 1 }],
      startAt: at(7),
      endAt: at(8, 23, 59),
    }),
  ]
}
