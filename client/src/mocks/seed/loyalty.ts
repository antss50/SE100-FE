import type { LoyaltyConfigData } from '../../types/api'

export const SEED_LOYALTY_CONFIG: LoyaltyConfigData = {
  amountPerPoint: 10000,
  redemptionValuePerPoint: 100,
  tiers: [
    {
      tier: 'BRONZE',
      minSpend: 0,
      tierName: 'Hạng ĐỒNG',
      discountPercent: 0,
      perks: [
        'Voucher sinh nhật 50.000 đ',
        'Đổi trả theo chính sách chung của cửa hàng',
        'Nhận thông báo Flash sale qua Zalo OA',
      ],
    },
    {
      tier: 'SILVER',
      minSpend: 3000000,
      tierName: 'Hạng BẠC',
      discountPercent: 5,
      perks: [
        'Giảm 5% đơn hàng trong tháng sinh nhật',
        'Giảm 5% mọi đơn hàng (tầng 2)',
        'Freeship đơn bán lẻ nội thành TP.HCM',
      ],
    },
    {
      tier: 'GOLD',
      minSpend: 10000000,
      tierName: 'Hạng VÀNG',
      discountPercent: 8,
      perks: [
        'Giảm 10% hóa đơn tháng sinh nhật',
        'Miễn phí soi da & phác đồ định kỳ',
        'Giảm 8% mọi đơn hàng (tầng 2)',
      ],
    },
    {
      tier: 'DIAMOND',
      minSpend: 25000000,
      tierName: 'Hạng KIM CƯƠNG',
      discountPercent: 12,
      perks: [
        'Chăm sóc da chuyên sâu 1 lần/quý',
        'Vé mời Private Launch mỹ phẩm mới',
        'Dedicated Skincare Specialist tư vấn riêng',
        'Giảm 12% mọi đơn hàng (tầng 2)',
      ],
    },
  ],
}
