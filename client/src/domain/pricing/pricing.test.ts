// Chép từ docs/mau-code/khuyen-mai/test.ts (12 test), chuyển node:test/assert sang Vitest.
import { expect, test } from 'vitest';
import { calculateOrder, splitByBatches, type PricingInput } from './pricing';
import { calculateReturn, type StoredLine } from './returns';
import type { Customer, Product, Promotion } from './types';

const A = 1, B = 2, C = 3, D = 4, MINI_B = 5, TOTE = 6;
const product = (id: number, retailPrice: number, costPrice: number, isSellable = true): Product =>
  ({ id, retailPrice, costPrice, brandId: 10, categoryId: 20, isSellable, taxRate: 0.1 });
const products = new Map([
  [A, product(A, 400_000, 200_000)],          // Serum A
  [B, product(B, 300_000, 150_000)],          // Kem chống nắng B
  [C, product(C, 200_000, 90_000)],           // Toner C
  [D, product(D, 250_000, 110_000)],          // Kem D
  [MINI_B, product(MINI_B, 80_000, 30_000)],  // Mini B (quà)
  [TOTE, product(TOTE, 0, 15_000, false)],    // Túi tote, không bán
]);

const base: Omit<Promotion, 'id' | 'name' | 'type'> = {
  status: 'ACTIVE', voucherCode: null, customerId: null, applyScope: null, brandIds: [], categoryIds: [],
  discountType: null, discountValue: null, maxDiscountAmount: null, fixedPrice: null, comboPrice: null,
  buyQuantity: null, isRepeatable: false, minOrderValue: 0, minTierRank: null,
  startAt: new Date('2026-01-01'), endAt: new Date('2026-12-31T23:59:59'),
  dailyStart: null, dailyEnd: null, weekdays: null, usageLimit: null, limitPerCustomer: null, maxQuantity: null,
  items: [], steps: [], usedCount: 0, usedByCustomer: 0, soldQuantity: 0,
};
const KM1: Promotion = { ...base, id: 101, name: 'Giảm 20% B', type: 'PRODUCT_DISCOUNT', applyScope: 'PRODUCT',
  discountType: 'PERCENT', discountValue: 20, items: [{ productId: B, role: 'TARGET', quantity: 1 }] };
const KM3: Promotion = { ...base, id: 103, name: 'Mua 2 B tặng mini', type: 'BUY_X_GET_Y', buyQuantity: 2,
  items: [{ productId: B, role: 'BUY', quantity: 1 }, { productId: MINI_B, role: 'GIFT', quantity: 1 }] };
const COMBO_CD: Promotion = { ...base, id: 105, name: 'Combo C+D', type: 'COMBO', comboPrice: 380_000,
  items: [{ productId: C, role: 'COMBO_ITEM', quantity: 1 }, { productId: D, role: 'COMBO_ITEM', quantity: 1 }] };
const TIERED: Promotion = { ...base, id: 106, name: 'Bậc thang', type: 'ORDER_TIERED', steps: [
  { minOrderValue: 500_000, discountType: 'FIXED_AMOUNT', discountValue: 50_000, maxDiscountAmount: null },
  { minOrderValue: 1_000_000, discountType: 'FIXED_AMOUNT', discountValue: 120_000, maxDiscountAmount: null }] };
const GIFT_TOTE: Promotion = { ...base, id: 107, name: 'Đơn từ 800k tặng tote', type: 'ORDER_GIFT',
  minOrderValue: 800_000, items: [{ productId: TOTE, role: 'GIFT', quantity: 1 }] };
const THU10: Promotion = { ...base, id: 108, name: 'THU10', type: 'VOUCHER', voucherCode: 'THU10',
  discountType: 'PERCENT', discountValue: 10, maxDiscountAmount: 50_000, minOrderValue: 300_000 };
const GIAM100: Promotion = { ...base, id: 109, name: 'GIAM100', type: 'VOUCHER', voucherCode: 'GIAM100',
  discountType: 'FIXED_AMOUNT', discountValue: 100_000, minOrderValue: 800_000 };

const vang: Customer = { id: 7, tierRank: 3, tierDiscountRate: 0.05, points: 2_000 };

const run = (cart: [number, number][], opts: Partial<PricingInput> = {}, promos = [KM1, KM3, COMBO_CD, TIERED, GIFT_TOTE, THU10, GIAM100]) =>
  calculateOrder({
    cart: cart.map(([productId, quantity]) => ({ productId, quantity })), products, promotions: promos,
    customer: null, voucherCode: null, pointsRequested: 0, now: new Date('2026-10-12T10:00:00'),
    settings: { pointRedeemValue: 100, pointMaxRedeemPercent: 50 }, hasStock: () => true, ...opts,
  });
const totalOf = (r: ReturnType<typeof run>, pid: number) =>
  r.lines.filter(l => l.productId === pid && l.lineType === 'NORMAL').reduce((s, l) => s + l.lineTotal, 0);
const store = (r: ReturnType<typeof run>): StoredLine[] => r.lines.map((l, i) => ({ ...l, orderDetailId: i + 1, batchId: 1 }));
const promoMap = new Map([KM1, KM3, COMBO_CD, TIERED, GIFT_TOTE, THU10, GIAM100].map(p => [p.id, p]));

test('VD1: voucher bằng bậc thang thì lấy bậc thang, mã không bị trừ lượt', () => {
  const r = run([[A, 1], [B, 1]], { customer: vang, voucherCode: 'THU10' });
  expect(r.lineDiscountAmount).toBe(60_000);
  expect(r.tierDiscountAmount).toBe(32_000);
  expect(r.orderPromotionId).toBe(TIERED.id);
  expect(r.orderDiscountAmount).toBe(50_000);
  expect(totalOf(r, A)).toBe(348_750);
  expect(totalOf(r, B)).toBe(209_250);
  expect(r.totalAmount).toBe(558_000);
  expect(r.messages.join()).toMatch(/THU10 không được áp dụng/);
});

test('VD2: voucher thua bậc thang; đơn đủ 800k được tặng tote', () => {
  const r = run([[A, 2], [B, 1]], { voucherCode: 'GIAM100' });
  expect(r.orderPromotionId).toBe(TIERED.id);
  expect(r.orderDiscountAmount).toBe(120_000);
  expect(r.totalAmount).toBe(920_000);
  expect(r.lines.some(l => l.lineType === 'GIFT' && l.productId === TOTE && l.lineTotal === 0)).toBe(true);
  expect(totalOf(r, A)).toBe(707_692);
});

test('VD3: hai KM tầng 1 cùng nhắm B thì chọn KM có lợi hơn (giảm 20% > tặng mini 80k)', () => {
  const r = run([[B, 2]]);
  expect(r.lineDiscountAmount).toBe(120_000);
  expect(!r.lines.some(l => l.lineType === 'GIFT')).toBe(true);
});

test('VD3b: không có KM giảm 20% thì mua 2 B được tặng 1 mini', () => {
  const r = run([[B, 2]], {}, [KM3]);
  const gift = r.lines.find(l => l.lineType === 'GIFT')!;
  expect(gift.productId).toBe(MINI_B);
  expect(gift.lineTotal).toBe(0);
  expect(r.totalAmount).toBe(600_000);
});

test('VD4: combo tách giá theo tỷ lệ giá niêm yết, cộng voucher %', () => {
  const r = run([[C, 1], [D, 1]], { voucherCode: 'THU10' });
  const c = r.lines.find(l => l.productId === C)!, d = r.lines.find(l => l.productId === D)!;
  expect(c.lineDiscount).toBe(31_111);
  expect(d.lineDiscount).toBe(38_889);
  expect(c.promoGroupNo).toBe(d.promoGroupNo);
  expect(r.orderDiscountAmount).toBe(38_000);
  expect(c.lineTotal).toBe(152_000);
  expect(d.lineTotal).toBe(190_000);
});

test('VD5: dùng điểm, trả B vì lỗi → hoàn 190.500, không voucher bù, thu hồi 18 điểm', () => {
  const r = run([[A, 1], [B, 1]], { customer: vang, pointsRequested: 500 });
  expect(r.pointsDiscountAmount).toBe(50_000);
  expect(r.totalAmount).toBe(508_000);
  const lines = store(r);
  const b = lines.find(l => l.productId === B)!;
  const ret = calculateReturn({
    order: { totalAmount: r.totalAmount, pointsEarned: Math.floor(r.totalAmount / 10_000) },
    lines, history: new Map(), reason: 'DEFECTIVE', promotions: promoMap, products,
    items: [{ orderDetailId: b.orderDetailId, quantity: 1, condition: 'DAMAGED_OR_OPENED' }],
  });
  expect(ret.totalRefund).toBe(190_500);
  expect(ret.pointsRevoked).toBe(18);
  expect(ret.lines[0].toBlocked).toBe(true);
});

test('VD6: trả 1 serum làm đơn dưới 800k, không trả tote → trừ giá vốn tote', () => {
  const r = run([[A, 2], [B, 1]]);
  const lines = store(r);
  const a = lines.find(l => l.productId === A)!;
  const ret = calculateReturn({
    order: { totalAmount: r.totalAmount, pointsEarned: 0 }, lines, history: new Map(),
    reason: 'DEFECTIVE', promotions: promoMap, products,
    items: [{ orderDetailId: a.orderDetailId, quantity: 1, condition: 'DAMAGED_OR_OPENED' }],
  });
  expect(ret.lines.find(l => l.kind === 'RETURN')!.refundAmount).toBe(353_846);
  expect(ret.lines.find(l => l.kind === 'GIFT_CHARGE')!.refundAmount).toBe(-15_000);
  expect(ret.totalRefund).toBe(338_846);
});

test('VD6b: trả kèm tote thì không bị trừ', () => {
  const r = run([[A, 2], [B, 1]]);
  const lines = store(r);
  const a = lines.find(l => l.productId === A)!, tote = lines.find(l => l.productId === TOTE)!;
  const ret = calculateReturn({
    order: { totalAmount: r.totalAmount, pointsEarned: 0 }, lines, history: new Map(),
    reason: 'DEFECTIVE', promotions: promoMap, products,
    items: [{ orderDetailId: a.orderDetailId, quantity: 1, condition: 'DAMAGED_OR_OPENED' },
            { orderDetailId: tote.orderDetailId, quantity: 1, condition: 'INTACT' }],
  });
  expect(ret.totalRefund).toBe(353_846);
  expect(!ret.lines.some(l => l.kind === 'GIFT_CHARGE')).toBe(true);
  expect(ret.lines.find(l => l.orderDetailId === tote.orderDetailId)!.toBlocked).toBe(false); // quà còn nguyên không bị cách ly
});

test('VD7: mua 2 B tặng mini, trả 1 B → mất điều kiện, không trả mini thì trừ 80.000', () => {
  const r = run([[B, 2]], {}, [KM3]);
  const lines = store(r);
  const b = lines.find(l => l.productId === B)!;
  const ret = calculateReturn({
    order: { totalAmount: r.totalAmount, pointsEarned: 0 }, lines, history: new Map(),
    reason: 'DEFECTIVE', promotions: new Map([[KM3.id, KM3]]), products,
    items: [{ orderDetailId: b.orderDetailId, quantity: 1, condition: 'DAMAGED_OR_OPENED' }],
  });
  expect(ret.totalRefund).toBe(300_000 - 80_000);
});

test('Đổi ý mà hàng đã mở thì từ chối', () => {
  const r = run([[A, 1]]);
  const lines = store(r);
  expect(() => calculateReturn({
    order: { totalAmount: r.totalAmount, pointsEarned: 0 }, lines, history: new Map(),
    reason: 'CHANGE_OF_MIND', promotions: promoMap, products,
    items: [{ orderDetailId: 1, quantity: 1, condition: 'DAMAGED_OR_OPENED' }],
  })).toThrow();
});

test('Tách lô FEFO giữ nguyên tổng tiền', () => {
  const r = run([[A, 2], [B, 1]]);
  const a = r.lines.find(l => l.productId === A)!;
  const parts = splitByBatches(a, [{ batchId: 11, quantity: 1 }, { batchId: 12, quantity: 1 }]);
  expect(parts.reduce((s, p) => s + p.lineTotal, 0)).toBe(a.lineTotal);
  expect(parts.reduce((s, p) => s + p.orderDiscount, 0)).toBe(a.orderDiscount);
});

test('Giờ vàng: ngoài khung giờ thì không áp', () => {
  const flash: Promotion = { ...base, id: 102, name: 'Serum 199k', type: 'FLASH_PRICE', fixedPrice: 199_000,
    dailyStart: '12:00', dailyEnd: '14:00', maxQuantity: 10, items: [{ productId: A, role: 'TARGET', quantity: 1 }] };
  expect(run([[A, 1]], {}, [flash]).totalAmount).toBe(400_000);
  expect(run([[A, 1]], { now: new Date('2026-10-12T12:30:00') }, [flash]).totalAmount).toBe(199_000);
});
