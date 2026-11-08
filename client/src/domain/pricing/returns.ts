// Port nguyên văn từ docs/mau-code/khuyen-mai/tra-hang.ts (chỉ đổi đường dẫn import). Không sửa thuật toán.
// Tính tiền trả hàng cho đơn có khuyến mãi (POS-04).
// Nguyên tắc: KHÔNG tính lại khuyến mãi. Mọi con số lấy từ ORDER_DETAILS đã lưu lúc bán.
// Chỉ xét lại một việc: khách còn đủ điều kiện giữ quà (BUY_X_GET_Y, ORDER_GIFT) hay không.
// Dữ liệu KM lúc trả = lúc bán, vì KM đã có lượt dùng thì bị khóa sửa (PROM-02).
//
// Với lý do CHANGE_OF_MIND, "tiền hoàn" ở đây là giá trị quy đổi để mua hàng đổi (không chi tiền);
// đơn đổi phải có tổng ≥ giá trị này. Không phát voucher bù; điểm đã dùng không hoàn.

import { giftValue } from './pricing';
import type { PricedLine, Product, Promotion } from './types';

export interface StoredLine extends PricedLine { orderDetailId: number; batchId: number }

export interface ReturnRequestItem {
  orderDetailId: number;
  quantity: number;
  condition: 'INTACT' | 'DAMAGED_OR_OPENED';
}

export interface ReturnInput {
  order: { totalAmount: number; pointsEarned: number };  // pointsEarned: POINT_HISTORIES EARN của đơn
  lines: StoredLine[];
  // Đã trả ở các phiếu trước: Σ RETURN_ORDER_DETAILS theo order_detail_id (kể cả dòng GIFT_CHARGE).
  history: Map<number, { quantity: number; amount: number }>;
  items: ReturnRequestItem[];
  reason: 'DEFECTIVE' | 'CHANGE_OF_MIND';  // không có giao nhầm: hàng được quét mã khi bán
  promotions: Map<number, Promotion>;
  products: Map<number, Product>;
}

// Mỗi phần tử = 1 dòng RETURN_ORDER_DETAILS.
export interface ReturnLine {
  orderDetailId: number;
  kind: 'RETURN' | 'GIFT_CHARGE';  // GIFT_CHARGE: tính tiền quà khách không trả lại, không nhập kho
  quantity: number;
  refundAmount: number;            // âm với GIFT_CHARGE
  toBlocked: boolean;              // true: cộng cả blocked_qty (hàng lỗi/đã mở)
}

export interface ReturnResult {
  lines: ReturnLine[];
  totalRefund: number;             // RETURN_ORDERS.total_refund_amount
  pointsRevoked: number;           // RETURN_ORDERS.points_revoked
  messages: string[];
}

export function calculateReturn(input: ReturnInput): ReturnResult {
  const { lines, history, items } = input;
  const byId = new Map(lines.map(l => [l.orderDetailId, l]));
  const done = (id: number) => history.get(id) ?? { quantity: 0, amount: 0 };
  const nowQty = (id: number) => items.filter(i => i.orderDetailId === id).reduce((s, i) => s + i.quantity, 0);
  const kept = (l: StoredLine) => l.quantity - done(l.orderDetailId).quantity - nowQty(l.orderDetailId);
  const messages: string[] = [];

  if (input.reason === 'CHANGE_OF_MIND' && items.some(i => i.condition === 'DAMAGED_OR_OPENED'))
    throw new Error('Đổi ý chỉ nhận hàng còn nguyên seal.');

  // 1. Tiền từng dòng trả = phần tương ứng của line_total đã lưu.
  const out: ReturnLine[] = [];
  for (const it of items) {
    const l = byId.get(it.orderDetailId)!;
    const left = l.quantity - done(l.orderDetailId).quantity;
    if (it.quantity <= 0 || it.quantity > left) throw new Error(`Dòng ${l.orderDetailId}: số lượng trả vượt số còn lại.`);
    const isLast = it.quantity === left;
    const refund = isLast ? l.lineTotal - done(l.orderDetailId).amount : Math.round((l.lineTotal * it.quantity) / l.quantity);
    out.push({
      orderDetailId: l.orderDetailId, kind: 'RETURN', quantity: it.quantity, refundAmount: refund,
      // Hàng lỗi luôn cách ly; quà trả kèm thì xét theo tình trạng thực tế của quà.
      toBlocked: it.condition === 'DAMAGED_OR_OPENED' || (input.reason === 'DEFECTIVE' && l.lineType === 'NORMAL'),
    });
  }

  // 2. Quà: tính số quà khách còn được giữ sau lần trả này; quà dư mà không trả lại thì tính tiền.
  const charge = (giftLines: StoredLine[], allowedQty: number) => {
    let excess = giftLines.reduce((s, g) => s + kept(g), 0) - allowedQty;
    for (const g of giftLines) {
      if (excess <= 0) break;
      const q = Math.min(excess, kept(g));
      if (q <= 0) continue;
      const value = giftValue(input.products.get(g.productId)!) * q;
      out.push({ orderDetailId: g.orderDetailId, kind: 'GIFT_CHARGE', quantity: q, refundAmount: -value, toBlocked: false });
      messages.push(`Không còn đủ điều kiện nhận quà (sản phẩm ${g.productId}) × ${q}: trừ ${value}đ. Khách trả lại quà thì không trừ.`);
      excess -= q;
    }
  };

  // 2a. Mua X tặng Y: xét theo từng nhóm (line_promotion_id, promo_group_no).
  const groups = new Map<string, StoredLine[]>();
  for (const l of lines) {
    const p = l.linePromotionId ? input.promotions.get(l.linePromotionId) : undefined;
    if (p?.type !== 'BUY_X_GET_Y') continue;
    const key = `${p.id}-${l.promoGroupNo}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  for (const group of groups.values()) {
    const p = input.promotions.get(group[0].linePromotionId!)!;
    const buyKept = group.filter(l => l.lineType === 'NORMAL').reduce((s, l) => s + kept(l), 0);
    const sets = p.isRepeatable ? Math.floor(buyKept / p.buyQuantity!) : (buyKept >= p.buyQuantity! ? 1 : 0);
    for (const gi of p.items.filter(i => i.role === 'GIFT')) {
      charge(group.filter(l => l.lineType === 'GIFT' && l.productId === gi.productId), gi.quantity * sets);
    }
  }

  // 2b. Quà theo hóa đơn: ngưỡng xét trên tiền sau tầng 1 và 2 của phần hàng còn giữ.
  const keptAfterT2 = lines.filter(l => l.lineType === 'NORMAL')
    .reduce((s, l) => s + Math.round(((l.quantity * l.unitPrice - l.lineDiscount - l.tierDiscount) * kept(l)) / l.quantity), 0);
  for (const g of lines.filter(l => l.lineType === 'GIFT')) {
    const p = input.promotions.get(g.linePromotionId!)!;
    if (p.type === 'ORDER_GIFT' && keptAfterT2 < p.minOrderValue) charge([g], 0);
  }

  const totalRefund = Math.max(0, out.reduce((s, l) => s + l.refundAmount, 0));
  return {
    lines: out,
    totalRefund,
    pointsRevoked: Math.floor((input.order.pointsEarned * totalRefund) / input.order.totalAmount),
    messages,
  };
}
