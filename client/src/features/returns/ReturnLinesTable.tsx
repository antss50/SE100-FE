import type { ItemCondition, ReturnableLine } from '../../types/pos'
import { formatCurrency } from '../../utils/format'

export interface ReturnSelection {
  selected: boolean
  quantity: number
  condition: ItemCondition
}

interface ReturnLinesTableProps {
  lines: ReturnableLine[]
  selection: Record<number, ReturnSelection>
  onChange: (lineId: number, next: ReturnSelection) => void
  /** Khách đổi ý: không có lựa chọn "đã mở seal" (sẽ bị từ chối). */
  changeOfMind: boolean
}

/** Chọn dòng hàng, số lượng và tình trạng (còn seal / đã mở hoặc hỏng) của hàng trả. */
export function ReturnLinesTable({ lines, selection, onChange, changeOfMind }: ReturnLinesTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">Sản phẩm trong đơn hàng gốc</caption>
        <thead className="bg-card text-left text-xs uppercase text-muted">
          <tr>
            <th className="w-10 px-3 py-2">
              <span className="sr-only">Chọn</span>
            </th>
            <th className="px-2 py-2">Sản phẩm</th>
            <th className="px-2 py-2 text-right">Đã mua</th>
            <th className="px-2 py-2 text-right">Đã trả</th>
            <th className="px-2 py-2 text-right">Thành tiền</th>
            <th className="px-2 py-2">Số lượng trả</th>
            <th className="px-2 py-2">Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const sel = selection[l.id] ?? { selected: false, quantity: 1, condition: 'INTACT' as ItemCondition }
            const disabled = l.returnableQuantity <= 0
            return (
              <tr key={l.id} className={`border-t border-line ${disabled ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="size-6 accent-accent"
                    aria-label={`Chọn ${l.productName}`}
                    disabled={disabled}
                    checked={sel.selected}
                    onChange={(e) => onChange(l.id, { ...sel, selected: e.target.checked, quantity: Math.min(sel.quantity, l.returnableQuantity) || 1 })}
                  />
                </td>
                <td className="px-2 py-2.5">
                  <p className="font-semibold text-ink">
                    {l.productName}
                    {l.lineType === 'GIFT' && <span className="ml-1 text-xs text-success">(quà tặng)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {l.sku} · Lô {l.lotCode}
                  </p>
                </td>
                <td className="px-2 py-2.5 text-right">{l.quantity}</td>
                <td className="px-2 py-2.5 text-right">{l.returnedQuantity}</td>
                <td className="px-2 py-2.5 text-right">{formatCurrency(l.lineTotal)}</td>
                <td className="px-2 py-2.5">
                  <input
                    type="number"
                    min={1}
                    max={l.returnableQuantity}
                    aria-label={`Số lượng trả ${l.productName}`}
                    disabled={disabled || !sel.selected}
                    value={sel.quantity}
                    onChange={(e) =>
                      onChange(l.id, { ...sel, quantity: Math.max(1, Math.min(l.returnableQuantity, Math.floor(Number(e.target.value) || 1))) })
                    }
                    className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm disabled:bg-neutral-soft"
                  />
                  <span className="ml-1 text-xs text-muted">tối đa {l.returnableQuantity}</span>
                </td>
                <td className="px-2 py-2.5">
                  <select
                    aria-label={`Tình trạng ${l.productName}`}
                    disabled={disabled || !sel.selected}
                    value={sel.condition}
                    onChange={(e) => onChange(l.id, { ...sel, condition: e.target.value as ItemCondition })}
                    className="rounded-lg border border-line bg-white px-2 py-1 text-sm disabled:bg-neutral-soft"
                  >
                    <option value="INTACT">Còn nguyên seal</option>
                    <option value="DAMAGED_OR_OPENED">{changeOfMind ? 'Đã mở seal (bị từ chối)' : 'Đã mở / hư hỏng'}</option>
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
