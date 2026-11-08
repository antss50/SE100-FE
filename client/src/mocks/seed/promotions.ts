import type { PromotionItem } from '../../types/api'
import { addDays, toDateOnly } from '../time'

/** Ngày tính tương đối so với `today` để trạng thái "đang chạy" luôn đúng. */
export function seedPromotions(today: Date): PromotionItem[] {
  const start = toDateOnly(addDays(today, -30))
  const end = toDateOnly(addDays(today, 60))
  const recentStart = toDateOnly(addDays(today, -7))
  return [
    {
      voucherCode: 'WELCOME10',
      promotionName: 'Chào Bạn Mới - WELCOME10',
      promotionType: 'PERCENT_ORDER',
      applyScope: 'ALL',
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscountAmount: 100000,
      minOrderValue: 300000,
      startDate: start,
      endDate: end,
      status: 'ACTIVE',
      usedCount: 35,
      usageLimit: 500,
      limitPerCustomer: 1,
      minTierLabel: 'Bạc',
      valueSummaryTitle: '10%',
      valueSummarySub:
        'Áp dụng với hóa đơn trên 300.000 VNĐ (Tối đa 100.000 VNĐ)',
    },
    {
      voucherCode: 'FLASH1010',
      promotionName: 'Flash Sales 10/10',
      promotionType: 'PERCENT_ORDER',
      applyScope: 'CATEGORY',
      discountType: 'PERCENT',
      discountValue: 30,
      maxDiscountAmount: 250000,
      minOrderValue: 0,
      startDate: start,
      endDate: end,
      status: 'ACTIVE',
      usedCount: 12,
      usageLimit: 500,
      limitPerCustomer: 2,
      minTierLabel: 'Đồng',
      valueSummaryTitle: '30%',
      valueSummarySub:
        'Áp dụng với các sản phẩm thuộc danh mục Nước hoa, Serum',
    },
    {
      voucherCode: 'BDAYVIP11',
      promotionName: 'Mừng Sinh Nhật',
      promotionType: 'BUY_X_GET_Y',
      applyScope: 'PRODUCT',
      discountType: null,
      discountValue: null,
      minOrderValue: 0,
      startDate: start,
      endDate: end,
      status: 'ACTIVE',
      usedCount: 54,
      usageLimit: 100,
      limitPerCustomer: 1,
      minTierLabel: 'Kim Cương',
      valueSummaryTitle: 'Mua 1 tặng 1 sản phẩm cùng giá',
      valueSummarySub: '',
    },
    {
      voucherCode: 'NEWPROMO01',
      promotionName: 'Ưu đãi Mở bán Bộ sưu tập Thu Đông',
      promotionType: 'FIXED_ORDER',
      applyScope: 'ALL',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50000,
      minOrderValue: 500000,
      startDate: recentStart,
      endDate: end,
      status: 'PAUSED',
      usedCount: 0,
      usageLimit: 200,
      limitPerCustomer: 1,
      minTierLabel: 'Đồng',
      valueSummaryTitle: '-50.000 đ',
      valueSummarySub: 'Chưa phát sinh đơn COMPLETED (Cho phép sửa toàn bộ)',
    },
  ]
}
