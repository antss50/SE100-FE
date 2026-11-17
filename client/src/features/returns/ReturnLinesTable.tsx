import { useEffect, useRef, useState } from 'react'
import { NumberInput } from '../../components/ui/NumberInput'
import { RETURN_REASON_LABELS, type ItemCondition, type ReturnReason, type ReturnableLine } from '../../types/pos'
import { formatCurrency } from '../../utils/format'

export interface ReturnSelection {
  selected: boolean
  quantity: number
  reason: ReturnReason | ''
  condition: ItemCondition | ''
}

interface ReturnLinesTableProps {
  lines: ReturnableLine[]
  selection: Record<number, ReturnSelection>
  onChange: (lineId: number, next: ReturnSelection) => void
}

const REASON_OPTIONS = Object.keys(RETURN_REASON_LABELS) as ReturnReason[]

export function conditionForReason(reason: ReturnReason): ItemCondition {
  return reason === 'CHANGE_OF_MIND' ? 'INTACT' : 'DAMAGED_OR_OPENED'
}

/** Chọn dòng hàng, số lượng, lý do trả hàng và tình trạng (còn seal / đã mở hoặc hỏng) cho từng sản phẩm. */
export function ReturnLinesTable({ lines, selection, onChange }: ReturnLinesTableProps) {
  const [focusedLineId, setFocusedLineId] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableSectionElement | null>(null)

  useEffect(() => {
    if (focusedLineId === null || !tableRef.current) return
    const row = tableRef.current.querySelector<HTMLElement>(`[data-return-line-id="${focusedLineId}"]`)
    row?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [focusedLineId])

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
            <th className="px-2 py-2">Lý do trả hàng</th>
            <th className="px-2 py-2">Tình trạng</th>
          </tr>
        </thead>
        <tbody ref={tableRef}>
          {lines.map((l) => {
            const sel = selection[l.id] ?? {
              selected: false,
              quantity: 1,
              reason: '' as ReturnReason | '',
              condition: '' as ItemCondition | '',
            }
            const disabled = l.returnableQuantity <= 0
            const isFocused = focusedLineId === l.id && sel.selected
            const displayReason: ReturnReason | '' = sel.selected ? sel.reason : ''
            const displayCondition: ItemCondition | '' = sel.selected ? sel.condition : ''
            const isChangeOfMind = sel.selected && sel.reason === 'CHANGE_OF_MIND'

            return (
              <tr
                key={l.id}
                data-return-line-id={l.id}
                aria-selected={sel.selected}
                onClick={() => {
                  if (!disabled && sel.selected) setFocusedLineId(l.id)
                }}
                className={`border-t border-line transition-colors ${
                  disabled
                    ? 'opacity-50'
                    : isFocused
                      ? 'bg-accent-soft/75 ring-2 ring-inset ring-accent/45'
                      : sel.selected
                        ? 'bg-accent-soft/35'
                        : 'hover:bg-neutral-soft/30'
                }`}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="size-6 cursor-pointer accent-accent disabled:cursor-not-allowed"
                    aria-label={`Chọn ${l.productName}`}
                    disabled={disabled}
                    checked={sel.selected}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setFocusedLineId(checked ? l.id : null)
                      const nextReason: ReturnReason | '' = checked ? sel.reason || 'DEFECTIVE' : ''
                      onChange(l.id, {
                        ...sel,
                        selected: checked,
                        quantity: Math.min(sel.quantity, l.returnableQuantity) || 1,
                        reason: nextReason,
                        condition: nextReason ? conditionForReason(nextReason) : '',
                      })
                    }}
                  />
                </td>
                <td className="px-2 py-2.5">
                  <p className={`font-semibold ${isFocused ? 'text-accent' : 'text-ink'}`}>
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
                  <NumberInput
                    type="number"
                    min={1}
                    max={l.returnableQuantity}
                    aria-label={`Số lượng trả ${l.productName}`}
                    disabled={disabled || !sel.selected}
                    value={sel.quantity}
                    onFocus={() => setFocusedLineId(l.id)}
                    onChange={(e) =>
                      onChange(l.id, {
                        ...sel,
                        quantity: Math.max(1, Math.min(l.returnableQuantity, Math.floor(Number(e.target.value) || 1))),
                      })
                    }
                    className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm disabled:bg-neutral-soft"
                  />
                  <span className="ml-1 text-xs text-muted">tối đa {l.returnableQuantity}</span>
                </td>
                <td className="px-2 py-2.5">
                  <select
                    aria-label={`Lý do trả hàng ${l.productName}`}
                    disabled={disabled || !sel.selected}
                    value={displayReason}
                    onFocus={() => setFocusedLineId(l.id)}
                    onChange={(e) => {
                      const nextReason = e.target.value as ReturnReason | ''
                      setFocusedLineId(l.id)
                      onChange(l.id, {
                        ...sel,
                        reason: nextReason,
                        condition: nextReason ? conditionForReason(nextReason) : '',
                      })
                    }}
                    className="rounded-lg border border-line bg-white px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-neutral-soft disabled:text-muted"
                  >
                    <option value="">--</option>
                    {REASON_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {RETURN_REASON_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2.5">
                  <select
                    aria-label={`Tình trạng ${l.productName}`}
                    disabled
                    value={displayCondition}
                    className={`appearance-none rounded-lg border border-line px-2 py-1 text-sm ${
                      sel.selected ? 'bg-white font-medium text-ink' : 'bg-neutral-soft text-muted'
                    }`}
                  >
                    <option value="">--</option>
                    <option value="INTACT">Còn nguyên seal</option>
                    <option value="DAMAGED_OR_OPENED">{isChangeOfMind ? 'Đã mở seal (bị từ chối)' : 'Đã mở / hư hỏng'}</option>
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
