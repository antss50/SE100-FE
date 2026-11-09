import { daysUntilExpiry, expiryStatusForProduct, type BatchLike, type ExpiryWarningProduct } from './batch'

export interface PurchaseLineForWarning {
  productId: number
  sku: string
  lotCode: string
  expDate: string
}

export interface ExistingBatchForWarning extends BatchLike {
  id: number
  productId: number
  lotCode: string
}

export type PurchaseWarningKind = 'ROTATE_SHELF' | 'NEAR_EXPIRY' | 'EXPIRED' | 'COST_AVERAGED'

export interface PurchaseWarningResult {
  type: PurchaseWarningKind
  /** Chỉ số dòng trong phiếu (bắt đầu từ 0). */
  lineIndex: number
  sku: string
  lotCode: string
  message: string
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/**
 * Cảnh báo cho các dòng phiếu nhập (không chặn):
 * - xoay kệ khi lô mới hạn sớm hơn một lô còn tồn của cùng sản phẩm (luật 31);
 * - cận hạn / quá hạn theo ngưỡng riêng của từng sản phẩm;
 * - nhập thêm vào lô đã có thì giá vốn được tính bình quân (luật 29).
 */
export function collectPurchaseWarnings(
  lines: readonly PurchaseLineForWarning[],
  batches: readonly ExistingBatchForWarning[],
  products: readonly ({ id?: number } & ExpiryWarningProduct)[],
  today: string
): PurchaseWarningResult[] {
  const result: PurchaseWarningResult[] = []
  lines.forEach((line, lineIndex) => {
    const base = { lineIndex, sku: line.sku, lotCode: line.lotCode }
    const sameLot = batches.find((b) => b.productId === line.productId && b.lotCode === line.lotCode)
    const later = batches
      .filter((b) => b.productId === line.productId && b.lotCode !== line.lotCode && b.onHandQty > 0 && b.expDate > line.expDate)
      .sort((a, b) => a.expDate.localeCompare(b.expDate))[0]
    if (later) {
      result.push({
        ...base,
        type: 'ROTATE_SHELF',
        message: `Lô ${line.lotCode} (HSD ${fmt(line.expDate)}) có hạn sớm hơn lô ${later.lotCode} đang tồn (HSD ${fmt(later.expDate)}). Cần xoay kệ: xếp lô mới ra trước.`,
      })
    }
    const product = products.find((p) => p.id === line.productId)
    const status = expiryStatusForProduct(line.expDate, today, product)
    if (status === 'EXPIRED') {
      result.push({ ...base, type: 'EXPIRED', message: `Lô ${line.lotCode} đã quá hạn dùng (HSD ${fmt(line.expDate)}).` })
    } else if (status === 'NEAR_EXPIRY') {
      result.push({
        ...base,
        type: 'NEAR_EXPIRY',
        message: `Lô ${line.lotCode} cận hạn: còn ${daysUntilExpiry(line.expDate, today)} ngày (HSD ${fmt(line.expDate)}).`,
      })
    }
    if (sameLot) {
      result.push({
        ...base,
        type: 'COST_AVERAGED',
        message: `Lô ${line.lotCode} đã có trong kho: số lượng cộng dồn và giá vốn tính bình quân gia quyền.`,
      })
    }
  })
  return result
}
