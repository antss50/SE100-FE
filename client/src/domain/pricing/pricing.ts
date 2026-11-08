// Port nguyên văn từ docs/mau-code/khuyen-mai/tinh-gia.ts (chỉ đổi đường dẫn import). Không sửa thuật toán.
// Tính giá hóa đơn có khuyến mãi (POS-02 / POS-03).
// Hàm thuần: không đọc/ghi DB. Service nạp dữ liệu, gọi hàm, rồi lưu kết quả vào ORDERS / ORDER_DETAILS.
// POS gọi mỗi khi giỏ hàng đổi để hiện giá; lúc thanh toán server gọi lại để kiểm tra, không tin số từ FE.
//
// Thứ tự 4 tầng:
//   1. Dòng hàng: PRODUCT_DISCOUNT, FLASH_PRICE, BUY_X_GET_Y, COMBO. Mỗi đơn vị sản phẩm hưởng tối đa 1 KM.
//      Chọn lần lượt KM có giá trị lớn nhất cho khách trên phần hàng còn lại (tham lam).
//   2. Hạng thẻ: % trên tiền sau tầng 1 (áp cả món đã giảm ở tầng 1).
//   3. Đơn hàng: tối đa 1 khoản giảm tiền (ORDER_TIERED hoặc VOUCHER, lấy cái lợi hơn, bằng nhau lấy bậc thang).
//      ORDER_GIFT tặng quà, cộng thêm được. Ngưỡng xét trên tiền sau tầng 2.
//   4. Điểm thưởng: trừ trên phần còn lại, tối đa POINT_MAX_REDEEM_PERCENT.

import type { Customer, PricedLine, Product, Promotion, Settings } from './types';

export interface CartItem { productId: number; quantity: number }

export interface PricingInput {
  cart: CartItem[];
  products: Map<number, Product>;
  promotions: Promotion[];            // mọi KM status ACTIVE còn hạn, kể cả voucher
  customer: Customer | null;          // null = khách vãng lai
  voucherCode: string | null;
  pointsRequested: number;
  now: Date;
  settings: Settings;
  hasStock: (productId: number, quantity: number) => boolean; // kiểm tồn quà
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalAmount: number;             // ORDERS.subtotal_amount = Σ qty × unitPrice
  lineDiscountAmount: number;         // ORDERS.line_discount_amount
  tierDiscountAmount: number;         // ORDERS.tier_discount_amount
  orderPromotionId: number | null;    // ORDERS.order_promotion_id
  orderDiscountAmount: number;        // ORDERS.order_discount_amount
  pointsUsed: number;                 // ORDERS.points_used
  pointsDiscountAmount: number;       // ORDERS.points_discount_amount
  discountAmount: number;             // ORDERS.discount_amount = tổng 4 khoản
  taxAmount: number;
  totalAmount: number;                // ORDERS.total_amount
  messages: string[];                 // thông báo cho thu ngân
}

// ---------- Tiện ích ----------

// Chia `amount` theo tỷ lệ `weights`. Làm tròn đến đồng, dòng cuối nhận phần dư để tổng luôn khớp.
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (amount === 0 || total === 0) return weights.map(() => 0);
  const out: number[] = [];
  let used = 0;
  weights.forEach((w, i) => {
    const part = i === weights.length - 1 ? amount - used : Math.round((amount * w) / total);
    out.push(part);
    used += part;
  });
  return out;
}

function discountOf(base: number, type: string | null, value: number | null, cap: number | null): number {
  if (type === null || value === null) return 0;
  let d = type === 'PERCENT' ? Math.round((base * value) / 100) : value;
  if (cap !== null) d = Math.min(d, cap);
  return Math.max(0, Math.min(d, base));
}

const isoWeekday = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay());
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Điều kiện chung: trạng thái, thời gian, khung giờ, hạng, khách riêng, lượt dùng.
function isUsable(p: Promotion, customer: Customer | null, now: Date): boolean {
  if (p.status !== 'ACTIVE' || now < p.startAt || now > p.endAt) return false;
  if (p.weekdays && !p.weekdays.includes(isoWeekday(now))) return false;
  if (p.dailyStart && p.dailyEnd && (hhmm(now) < p.dailyStart || hhmm(now) >= p.dailyEnd)) return false;
  const needsCustomer = p.minTierRank !== null || p.limitPerCustomer !== null || p.customerId !== null;
  if (needsCustomer && !customer) return false;
  if (p.minTierRank !== null && customer!.tierRank < p.minTierRank) return false;
  if (p.customerId !== null && customer!.id !== p.customerId) return false;
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit) return false;
  if (p.limitPerCustomer !== null && p.usedByCustomer >= p.limitPerCustomer) return false;
  return true;
}

function newLine(productId: number, quantity: number, unitPrice: number, extra: Partial<PricedLine> = {}): PricedLine {
  return {
    productId, quantity, unitPrice, lineType: 'NORMAL', linePromotionId: null, promoGroupNo: null,
    lineDiscount: 0, tierDiscount: 0, orderDiscount: 0, pointsDiscount: 0, lineTotal: 0, taxAmount: 0,
    ...extra,
  };
}

// Giá trị quà để so sánh / trừ khi trả: hàng bán lấy giá niêm yết, hàng không bán lấy giá vốn.
export const giftValue = (p: Product) => (p.isSellable ? p.retailPrice : p.costPrice);

// ---------- Tầng 1: dòng hàng ----------

interface Candidate {
  promo: Promotion;
  value: number;                      // lợi ích cho khách (tiền giảm hoặc giá trị quà)
  consume: Map<number, number>;       // productId -> số lượng dùng
  build: (groupNo: number) => PricedLine[];
}

function inScope(p: Promotion, prod: Product): boolean {
  const targets = p.items.filter(i => i.role === 'TARGET').map(i => i.productId);
  switch (p.applyScope) {
    case 'ALL': return true;
    case 'PRODUCT': return targets.includes(prod.id);
    case 'BRAND': return p.brandIds.includes(prod.brandId);
    case 'CATEGORY': return p.categoryIds.includes(prod.categoryId);
    default: return false;
  }
}

function candidatesFor(p: Promotion, free: Map<number, number>, input: PricingInput): Candidate[] {
  const prod = (id: number) => input.products.get(id)!;
  const out: Candidate[] = [];

  if (p.type === 'PRODUCT_DISCOUNT') {
    for (const [pid, qty] of free) {
      if (qty <= 0 || !inScope(p, prod(pid))) continue;
      const price = prod(pid).retailPrice;
      const d = p.discountType === 'FIXED_AMOUNT'
        ? Math.min(p.discountValue! * qty, price * qty, p.maxDiscountAmount ?? Infinity)
        : discountOf(price * qty, p.discountType, p.discountValue, p.maxDiscountAmount);
      if (d > 0) out.push({
        promo: p, value: d, consume: new Map([[pid, qty]]),
        build: () => [newLine(pid, qty, price, { linePromotionId: p.id, lineDiscount: d })],
      });
    }
  }

  if (p.type === 'FLASH_PRICE') {
    let quota = p.maxQuantity === null ? Infinity : Math.max(0, p.maxQuantity - p.soldQuantity);
    for (const it of p.items.filter(i => i.role === 'TARGET')) {
      const qty = Math.min(free.get(it.productId) ?? 0, quota);
      const price = prod(it.productId).retailPrice;
      if (qty <= 0 || p.fixedPrice === null || p.fixedPrice >= price) continue; // chỉ áp khi rẻ hơn giá hiện tại
      quota -= qty;
      const d = (price - p.fixedPrice) * qty;
      out.push({
        promo: p, value: d, consume: new Map([[it.productId, qty]]),
        build: () => [newLine(it.productId, qty, price, { linePromotionId: p.id, lineDiscount: d })],
      });
    }
  }

  if (p.type === 'COMBO' && p.comboPrice !== null) {
    const parts = p.items.filter(i => i.role === 'COMBO_ITEM');
    const sets = Math.min(...parts.map(i => Math.floor((free.get(i.productId) ?? 0) / i.quantity)));
    const listPerSet = parts.reduce((s, i) => s + prod(i.productId).retailPrice * i.quantity, 0);
    if (sets > 0 && p.comboPrice < listPerSet) {
      const totalDiscount = (listPerSet - p.comboPrice) * sets;
      out.push({
        promo: p, value: totalDiscount,
        consume: new Map(parts.map(i => [i.productId, i.quantity * sets])),
        build: g => {
          // Tách giá bộ về từng món theo tỷ lệ giá niêm yết.
          const shares = allocate(totalDiscount, parts.map(i => prod(i.productId).retailPrice * i.quantity));
          return parts.map((i, k) => newLine(i.productId, i.quantity * sets, prod(i.productId).retailPrice,
            { linePromotionId: p.id, promoGroupNo: g, lineDiscount: shares[k] }));
        },
      });
    }
  }

  if (p.type === 'BUY_X_GET_Y' && p.buyQuantity) {
    const buys = p.items.filter(i => i.role === 'BUY');
    const gifts = p.items.filter(i => i.role === 'GIFT');
    const buyCount = buys.reduce((s, i) => s + (free.get(i.productId) ?? 0), 0);
    const sets = p.isRepeatable ? Math.floor(buyCount / p.buyQuantity) : (buyCount >= p.buyQuantity ? 1 : 0);
    const stockOk = gifts.every(g => input.hasStock(g.productId, g.quantity * sets));
    if (sets > 0 && stockOk) {
      // Dùng đúng buyQuantity × sets đơn vị hàng mua, phần dư để KM khác xét tiếp.
      let need = p.buyQuantity * sets;
      const consume = new Map<number, number>();
      for (const b of buys) {
        const take = Math.min(need, free.get(b.productId) ?? 0);
        if (take > 0) { consume.set(b.productId, take); need -= take; }
      }
      const value = gifts.reduce((s, g) => s + giftValue(prod(g.productId)) * g.quantity * sets, 0);
      out.push({
        promo: p, value, consume,
        build: g => [
          ...[...consume].map(([pid, q]) => newLine(pid, q, prod(pid).retailPrice, { linePromotionId: p.id, promoGroupNo: g })),
          ...gifts.map(gi => newLine(gi.productId, gi.quantity * sets, 0,
            { lineType: 'GIFT', linePromotionId: p.id, promoGroupNo: g })),
        ],
      });
    } // quà hết tồn: không tạo ứng viên, thông báo ở applyLineLevel
  }
  return out;
}

function applyLineLevel(input: PricingInput, messages: string[]): PricedLine[] {
  const free = new Map<number, number>();
  for (const c of input.cart) free.set(c.productId, (free.get(c.productId) ?? 0) + c.quantity);

  const linePromos = input.promotions.filter(p =>
    ['PRODUCT_DISCOUNT', 'FLASH_PRICE', 'BUY_X_GET_Y', 'COMBO'].includes(p.type) && isUsable(p, input.customer, input.now));

  const lines: PricedLine[] = [];
  let groupNo = 0;
  for (;;) {
    const cands = linePromos.flatMap(p => candidatesFor(p, free, input));
    if (cands.length === 0) break;
    cands.sort((a, b) => b.value - a.value || a.promo.id - b.promo.id); // bằng nhau: KM tạo trước
    const best = cands[0];
    const needsGroup = best.promo.type === 'COMBO' || best.promo.type === 'BUY_X_GET_Y';
    lines.push(...best.build(needsGroup ? ++groupNo : 0));
    for (const [pid, q] of best.consume) free.set(pid, free.get(pid)! - q);
  }
  for (const p of linePromos.filter(p => p.type === 'BUY_X_GET_Y')) {
    if (!lines.some(l => l.linePromotionId === p.id) &&
        p.items.some(i => i.role === 'GIFT' && !input.hasStock(i.productId, i.quantity)))
      messages.push(`KM "${p.name}": quà đã hết, không tặng.`);
  }
  // Phần còn lại không có KM tầng 1.
  for (const [pid, q] of free) if (q > 0) lines.push(newLine(pid, q, input.products.get(pid)!.retailPrice));
  return lines;
}

// ---------- Hàm chính ----------

export function calculateOrder(input: PricingInput): PricingResult {
  const messages: string[] = [];
  const lines = applyLineLevel(input, messages);
  const normal = lines.filter(l => l.lineType === 'NORMAL');
  const gross = (l: PricedLine) => l.quantity * l.unitPrice;
  const remaining = (l: PricedLine) => gross(l) - l.lineDiscount - l.tierDiscount - l.orderDiscount - l.pointsDiscount;
  const sum = (f: (l: PricedLine) => number) => normal.reduce((s, l) => s + f(l), 0);

  // Tầng 2: hạng thẻ.
  const afterT1 = sum(remaining);
  const tierDiscount = input.customer ? Math.round(afterT1 * input.customer.tierDiscountRate) : 0;
  allocate(tierDiscount, normal.map(remaining)).forEach((v, i) => (normal[i].tierDiscount = v));
  const afterT2 = afterT1 - tierDiscount;

  // Tầng 3: 1 khoản giảm tiền cấp đơn.
  const usable = input.promotions.filter(p => isUsable(p, input.customer, input.now));
  let orderPromotionId: number | null = null;
  let orderDiscount = 0;
  for (const p of usable.filter(p => p.type === 'ORDER_TIERED')) {
    const step = p.steps.filter(s => s.minOrderValue <= afterT2).sort((a, b) => b.minOrderValue - a.minOrderValue)[0];
    if (!step) continue;
    const d = discountOf(afterT2, step.discountType, step.discountValue, step.maxDiscountAmount);
    if (d > orderDiscount) { orderDiscount = d; orderPromotionId = p.id; }
  }
  if (input.voucherCode) {
    const v = input.promotions.find(p => p.type === 'VOUCHER' && p.voucherCode === input.voucherCode);
    if (!v || !isUsable(v, input.customer, input.now)) messages.push(`Mã ${input.voucherCode} không hợp lệ hoặc đã hết lượt.`);
    else if (afterT2 < v.minOrderValue) messages.push(`Mã ${input.voucherCode} cần đơn từ ${v.minOrderValue}đ.`);
    else {
      const d = discountOf(afterT2, v.discountType, v.discountValue, v.maxDiscountAmount);
      if (d > orderDiscount) { orderDiscount = d; orderPromotionId = v.id; }  // bằng nhau: giữ bậc thang
      else messages.push(`Mã ${input.voucherCode} không được áp dụng vì ưu đãi hiện tại có lợi hơn (mã không bị trừ lượt).`);
    }
  }
  allocate(orderDiscount, normal.map(remaining)).forEach((v, i) => (normal[i].orderDiscount = v));

  // Quà theo hóa đơn: chọn chương trình có ngưỡng cao nhất đạt được.
  const giftPromo = usable
    .filter(p => p.type === 'ORDER_GIFT' && afterT2 >= p.minOrderValue)
    .sort((a, b) => b.minOrderValue - a.minOrderValue)[0];
  if (giftPromo) {
    const gifts = giftPromo.items.filter(i => i.role === 'GIFT');
    if (gifts.every(g => input.hasStock(g.productId, g.quantity)))
      gifts.forEach(g => lines.push(newLine(g.productId, g.quantity, 0, { lineType: 'GIFT', linePromotionId: giftPromo.id })));
    else messages.push(`KM "${giftPromo.name}": quà đã hết, không tặng.`);
  }

  // Tầng 4: điểm thưởng.
  const afterT3 = afterT2 - orderDiscount;
  let pointsUsed = 0;
  if (input.customer && input.pointsRequested > 0) {
    const maxValue = Math.floor((afterT3 * input.settings.pointMaxRedeemPercent) / 100);
    pointsUsed = Math.min(input.pointsRequested, input.customer.points,
      Math.floor(maxValue / input.settings.pointRedeemValue));
  }
  const pointsDiscount = pointsUsed * input.settings.pointRedeemValue;
  allocate(pointsDiscount, normal.map(remaining)).forEach((v, i) => (normal[i].pointsDiscount = v));

  // Chốt từng dòng.
  for (const l of lines) {
    l.lineTotal = remaining(l);
    const rate = input.products.get(l.productId)!.taxRate;
    l.taxAmount = Math.round((l.lineTotal * rate) / (1 + rate)); // giá đã gồm VAT
  }
  const all = (f: (l: PricedLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  const lineDiscountAmount = all(l => l.lineDiscount);
  return {
    lines,
    subtotalAmount: all(gross),
    lineDiscountAmount,
    tierDiscountAmount: tierDiscount,
    orderPromotionId,
    orderDiscountAmount: orderDiscount,
    pointsUsed,
    pointsDiscountAmount: pointsDiscount,
    discountAmount: lineDiscountAmount + tierDiscount + orderDiscount + pointsDiscount,
    taxAmount: all(l => l.taxAmount),
    totalAmount: all(l => l.lineTotal),
    messages,
  };
}

// Sau khi tính giá, mỗi dòng được tách theo lô FEFO (mỗi dòng ORDER_DETAILS gắn 1 lô).
// Các khoản tiền chia theo số lượng, dòng cuối nhận phần dư.
export function splitByBatches(line: PricedLine, batches: { batchId: number; quantity: number }[]) {
  const qty = batches.map(b => b.quantity);
  const keys = ['lineDiscount', 'tierDiscount', 'orderDiscount', 'pointsDiscount', 'lineTotal', 'taxAmount'] as const;
  const parts = Object.fromEntries(keys.map(k => [k, allocate(line[k], qty)])) as Record<(typeof keys)[number], number[]>;
  return batches.map((b, i) => ({
    ...line, batchId: b.batchId, quantity: b.quantity,
    ...Object.fromEntries(keys.map(k => [k, parts[k][i]])),
  }));
}
