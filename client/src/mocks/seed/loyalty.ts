import type { LoyaltyConfigData } from '../../types/api'

export const SEED_LOYALTY_CONFIG: LoyaltyConfigData = {
  amountPerPoint: 10000,
  redemptionValuePerPoint: 100,
  tiers: [
    {
      tier: 'BRONZE',
      minSpend: 0,
      tierName: 'Hạng ĐỒNG',
      earnRatePercent: 0,
      perks: [
        'Voucher sinh nhật 50.000 đ',
        'Đổi trả theo tiêu chuẩn (3 ngày)',
        'Nhận thông báo Flash sale qua Zalo OA',
      ],
    },
    {
      tier: 'SILVER',
      minSpend: 3000000,
      tierName: 'Hạng BẠC',
      earnRatePercent: 3,
      perks: [
        'Giảm 5% đơn hàng trong tháng sinh nhật',
        'Hạn đổi trả mở rộng: 07 ngày',
        'Freeship đơn bán lẻ nội thành TP.HCM',
      ],
    },
    {
      tier: 'GOLD',
      minSpend: 10000000,
      tierName: 'Hạng VÀNG',
      earnRatePercent: 5,
      perks: [
        'Giảm 10% hóa đơn tháng sinh nhật',
        'Miễn phí soi da & phác đồ định kỳ',
        'Hạn đổi trả đặc cách: 15 ngày',
      ],
    },
    {
      tier: 'DIAMOND',
      minSpend: 25000000,
      tierName: 'Hạng KIM CƯƠNG',
      earnRatePercent: 8,
      perks: [
        'Chăm sóc da chuyên sâu 1 lần/quý',
        'Vé mời Private Launch mỹ phẩm mới',
        'Dedicated Skincare Specialist tư vấn riêng',
        'Bảo hành đổi trả VIP: 30 ngày',
      ],
    },
  ],
}
