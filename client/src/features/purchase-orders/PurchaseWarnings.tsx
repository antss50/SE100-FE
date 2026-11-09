import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { queryKeys } from '../../lib/query-keys'
import { purchaseOrdersService } from '../../services/purchase-orders.service'
import type { PurchaseOrderLineInput, PurchaseWarning } from '../../types/stock'

/** Cảnh báo xoay kệ / cận hạn / giá vốn bình quân khi xem trước phiếu nhập (luật 29, 31). */
export function usePurchaseWarnings(lines: PurchaseOrderLineInput[]) {
  const valid = lines.filter((l) => l.productId > 0 && l.lotCode.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(l.expDate))
  return useQuery({
    queryKey: queryKeys.purchaseOrders.warnings(valid),
    queryFn: () => purchaseOrdersService.previewWarnings(valid),
    enabled: valid.length > 0,
    select: (res) => res.data,
    placeholderData: (prev) => prev,
  })
}

const TITLES: Record<PurchaseWarning['type'], string> = {
  ROTATE_SHELF: 'Cần xoay kệ',
  NEAR_EXPIRY: 'Cận hạn',
  EXPIRED: 'Quá hạn',
  COST_AVERAGED: 'Cập nhật giá vốn bình quân',
}

export function PurchaseWarningList({ warnings }: { warnings: PurchaseWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="space-y-2" aria-label="Cảnh báo nghiệp vụ cần duyệt">
      {warnings.map((w, i) => {
        const info = w.type === 'COST_AVERAGED'
        const Icon = info ? RefreshCw : AlertTriangle
        return (
          <li
            key={`${w.type}-${w.lotCode}-${i}`}
            className={`flex gap-2 rounded-xl border p-3 text-xs ${
              info ? 'border-info/30 bg-info-soft text-info' : 'border-warning/30 bg-warning-soft text-warning'
            }`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="block">
                {TITLES[w.type]} · {w.sku}
              </strong>
              {w.message}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
