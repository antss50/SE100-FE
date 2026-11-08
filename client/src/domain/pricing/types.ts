// Port nguyên văn từ docs/mau-code/khuyen-mai/types.ts (chỉ đổi đường dẫn import).
// Kiểu dữ liệu dùng chung cho tính giá khuyến mãi và trả hàng.
// Tiền tính bằng số nguyên VNĐ. Tên trường ứng với cột trong docs/KHUYEN_MAI.md.

export type PromotionType =
  | 'PRODUCT_DISCOUNT' // (1) giảm % / tiền theo sản phẩm, thương hiệu, danh mục
  | 'FLASH_PRICE'      // (2) đồng giá giờ vàng
  | 'BUY_X_GET_Y'      // (3) mua X tặng Y
  | 'COMBO'            // (5) combo giá cố định
  | 'ORDER_TIERED'     // (6) bậc thang theo hóa đơn
  | 'ORDER_GIFT'       // (7) quà tặng theo hóa đơn
  | 'VOUCHER';         // (8) voucher nhập mã

export type DiscountType = 'PERCENT' | 'FIXED_AMOUNT';
export type ItemRole = 'TARGET' | 'BUY' | 'GIFT' | 'COMBO_ITEM';
export type LineType = 'NORMAL' | 'GIFT';

export interface Product {
  id: number;
  retailPrice: number;  // PRODUCTS.retail_price (giá niêm yết, đã gồm VAT)
  costPrice: number;    // giá vốn tham chiếu, dùng khi quà là hàng không bán
  brandId: number;
  categoryId: number;
  isSellable: boolean;  // PRODUCTS.is_sellable
  taxRate: number;      // 0.1 = 10%
}

export interface PromotionItem {   // PROMOTION_ITEMS
  productId: number;
  role: ItemRole;
  quantity: number;
}

export interface PromotionStep {   // PROMOTION_STEPS (bậc thang)
  minOrderValue: number;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
}

export interface Promotion {       // PROMOTIONS + các bảng con đã nạp sẵn
  id: number;
  name: string;
  type: PromotionType;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  voucherCode: string | null;
  customerId: number | null;          // voucher riêng 1 khách
  applyScope: 'ALL' | 'PRODUCT' | 'BRAND' | 'CATEGORY' | null;
  brandIds: number[];                 // PROMOTION_BRANDS
  categoryIds: number[];              // PROMOTION_CATEGORIES
  discountType: DiscountType | null;
  discountValue: number | null;
  maxDiscountAmount: number | null;
  fixedPrice: number | null;          // FLASH_PRICE
  comboPrice: number | null;          // COMBO
  buyQuantity: number | null;         // BUY_X_GET_Y
  isRepeatable: boolean;              // BUY_X_GET_Y: lặp theo bội số
  minOrderValue: number;
  minTierRank: number | null;         // hạng tối thiểu (rank của CUSTOMER_TIERS)
  startAt: Date;
  endAt: Date;
  dailyStart: string | null;          // 'HH:MM'
  dailyEnd: string | null;
  weekdays: number[] | null;          // 1 = thứ Hai ... 7 = Chủ nhật
  usageLimit: number | null;
  limitPerCustomer: number | null;
  maxQuantity: number | null;         // FLASH_PRICE: tổng số lượng bán giá KM
  items: PromotionItem[];
  steps: PromotionStep[];
  // Số liệu đếm sẵn từ DB trước khi gọi hàm tính:
  usedCount: number;                  // số đơn COMPLETED đã dùng KM này
  usedByCustomer: number;             // số đơn của khách hiện tại đã dùng
  soldQuantity: number;               // FLASH_PRICE: số lượng đã bán giá KM
}

export interface Customer {
  id: number;
  tierRank: number;
  tierDiscountRate: number;           // 0.05 = 5%
  points: number;                     // CUSTOMERS.reward_points
}

export interface Settings {
  pointRedeemValue: number;           // SYSTEM_SETTINGS.POINT_REDEEM_VALUE (1 điểm = ? đ)
  pointMaxRedeemPercent: number;      // SYSTEM_SETTINGS.POINT_MAX_REDEEM_PERCENT
}

// Một dòng đã tính giá = một dòng ORDER_DETAILS (trước khi tách lô FEFO).
export interface PricedLine {
  productId: number;
  quantity: number;
  unitPrice: number;                  // giá niêm yết lúc bán; dòng quà = 0
  lineType: LineType;
  linePromotionId: number | null;     // KM tầng 1, hoặc KM sinh ra dòng quà
  promoGroupNo: number | null;        // các dòng cùng 1 combo / 1 bộ mua-tặng
  lineDiscount: number;               // giảm tầng 1
  tierDiscount: number;               // giảm tầng 2 phân bổ
  orderDiscount: number;              // giảm tầng 3 phân bổ
  pointsDiscount: number;             // giảm tầng 4 phân bổ
  lineTotal: number;                  // qty × unitPrice − 4 khoản giảm
  taxAmount: number;                  // VAT tách ngược từ lineTotal
}
