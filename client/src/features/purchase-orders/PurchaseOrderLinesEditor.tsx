import { Trash2 } from 'lucide-react'
import type { FieldArrayWithId, FieldErrors, UseFormRegister } from 'react-hook-form'
import { cn } from '../../components/ui'
import type { ProductItem } from '../../types/api'
import { formatCurrency } from '../../utils/format'
import type { PurchaseOrderFormValues } from './purchase-order-form'

const CELL =
  'w-full rounded-lg border bg-white px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'

interface Props {
  fields: FieldArrayWithId<PurchaseOrderFormValues, 'lines'>[]
  products: ProductItem[]
  register: UseFormRegister<PurchaseOrderFormValues>
  errors: FieldErrors<PurchaseOrderFormValues>
  /** Thành tiền từng dòng, tính từ giá trị đang nhập. */
  lineTotals: number[]
  existingLots: boolean[]
  onRemove: (index: number) => void
}

/** Bảng dòng lô của phiếu nhập: sản phẩm, mã lô, NSX, HSD, số lượng, giá nhập. */
export function PurchaseOrderLinesEditor({ fields, products, register, errors, lineTotals, existingLots, onRemove }: Props) {
  const err = (index: number, name: keyof PurchaseOrderFormValues['lines'][number]) => errors.lines?.[index]?.[name]?.message
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-5" />
          <col className="w-[280px]" />
          <col className="w-[120px]" />
          <col className="w-[140px]" />
          <col className="w-[140px]" />
          <col className="w-20" />
          <col className="w-[130px]" />
          <col className="w-[110px]" />
          <col className="w-11" />
        </colgroup>
        <thead>
          <tr className="bg-accent-soft/60 text-left text-xs font-semibold text-muted">
            <th className="px-1 py-1.5">#</th>
            <th className="px-1 py-1.5">Sản phẩm & SKU</th>
            <th className="px-1 py-1.5">Mã lô nhập</th>
            <th className="px-1 py-1.5">NSX</th>
            <th className="px-1 py-1.5">HSD</th>
            <th className="px-1 py-1.5 text-right">SL</th>
            <th className="px-1 py-1.5 text-right">Giá nhập</th>
            <th className="px-1 py-1.5 text-right">Thành tiền</th>
            <th className="px-1 py-1.5">
              <span className="sr-only">Xóa dòng</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id} className="border-t border-line align-top">
              <td className="px-1 py-1.5 text-muted">{index + 1}</td>
              <td className="min-w-64 px-1 py-1.5">
                <select
                  aria-label={`Sản phẩm dòng ${index + 1}`}
                  className={cn(CELL, err(index, 'productId') ? 'border-danger' : 'border-line')}
                  {...register(`lines.${index}.productId`)}
                >
                  <option value="">Chọn sản phẩm</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.productName}
                      {p.isSellable === false ? ' (tester hãng)' : ''}
                    </option>
                  ))}
                </select>
                {err(index, 'productId') && <p className="mt-1 text-xs text-danger">{err(index, 'productId')}</p>}
              </td>
              <td className="px-1 py-1.5">
                <input
                  aria-label={`Mã lô dòng ${index + 1}`}
                  className={cn(CELL, 'font-mono', err(index, 'lotCode') ? 'border-danger' : 'border-line')}
                  {...register(`lines.${index}.lotCode`)}
                />
                {existingLots[index] && <p className="mt-1 text-xs text-info">Lô đã có trong kho</p>}
                {err(index, 'lotCode') && <p className="mt-1 text-xs text-danger">{err(index, 'lotCode')}</p>}
              </td>
              <td className="px-1 py-1.5">
                <input type="date" aria-label={`Ngày sản xuất dòng ${index + 1}`} className={cn(CELL, 'border-line')} {...register(`lines.${index}.mfgDate`)} />
              </td>
              <td className="px-1 py-1.5">
                <input
                  type="date"
                  aria-label={`Hạn dùng dòng ${index + 1}`}
                  className={cn(CELL, err(index, 'expDate') ? 'border-danger' : 'border-line')}
                  {...register(`lines.${index}.expDate`)}
                />
                {err(index, 'expDate') && <p className="mt-1 text-xs text-danger">{err(index, 'expDate')}</p>}
              </td>
              <td className="w-20 px-1 py-1.5">
                <input
                  type="number"
                  min={1}
                  aria-label={`Số lượng dòng ${index + 1}`}
                  className={cn(CELL, 'text-right', err(index, 'quantity') ? 'border-danger' : 'border-line')}
                  {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                />
                {err(index, 'quantity') && <p className="mt-1 text-xs text-danger">{err(index, 'quantity')}</p>}
              </td>
              <td className="w-36 px-1 py-1.5">
                <input
                  type="number"
                  min={0}
                  aria-label={`Giá nhập dòng ${index + 1}`}
                  className={cn(CELL, 'text-right', err(index, 'unitCost') ? 'border-danger' : 'border-line')}
                  {...register(`lines.${index}.unitCost`, { valueAsNumber: true })}
                />
                {err(index, 'unitCost') && <p className="mt-1 text-xs text-danger">{err(index, 'unitCost')}</p>}
              </td>
              <td className="whitespace-nowrap px-1 py-1.5 text-right font-semibold">{formatCurrency(lineTotals[index] ?? 0)}</td>
              <td className="px-1 py-1.5">
                <button
                  type="button"
                  aria-label={`Xóa dòng ${index + 1}`}
                  onClick={() => onRemove(index)}
                  className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
