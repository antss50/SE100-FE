import { Plus, Trash2 } from 'lucide-react'
import { Fragment } from 'react'
import type { FieldArrayWithId, FieldErrors, UseFormRegister } from 'react-hook-form'
import { cn, NumberInput } from '../../components/ui'
import type { ProductItem } from '../../types/api'
import { formatCurrency } from '../../utils/format'
import type { PurchaseOrderFormValues } from './purchase-order-form'

const CELL =
  'w-full rounded-lg border bg-white px-2 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'

interface Props {
  fields: FieldArrayWithId<PurchaseOrderFormValues, 'lines'>[]
  watchedLines: PurchaseOrderFormValues['lines']
  products: ProductItem[]
  register: UseFormRegister<PurchaseOrderFormValues>
  errors: FieldErrors<PurchaseOrderFormValues>
  /** Thành tiền từng dòng, tính từ giá trị đang nhập. */
  lineTotals: number[]
  existingLots: boolean[]
  onProductGroupChange: (indices: number[], productId: string) => void
  onAddLotForProduct: (productId: string, afterIndex: number) => void
  onRemove: (index: number) => void
}

interface EditorGroup {
  productId: string
  indices: number[]
}

/** Gộp các dòng liên tiếp có cùng sản phẩm (khi đã chọn sản phẩm) để merge cột Sản phẩm & SKU. */
function buildEditorGroups(fields: FieldArrayWithId<PurchaseOrderFormValues, 'lines'>[], watchedLines: PurchaseOrderFormValues['lines']): EditorGroup[] {
  const groups: EditorGroup[] = []
  for (let i = 0; i < fields.length; i++) {
    const pid = watchedLines?.[i]?.productId ?? ''
    const prev = groups[groups.length - 1]
    if (pid && prev && prev.productId === pid) {
      prev.indices.push(i)
    } else {
      groups.push({ productId: pid, indices: [i] })
    }
  }
  return groups
}

/** Bảng dòng lô của phiếu nhập: gộp cột Sản phẩm & SKU cho các lô cùng sản phẩm. */
export function PurchaseOrderLinesEditor({
  fields,
  watchedLines,
  products,
  register,
  errors,
  lineTotals,
  existingLots,
  onProductGroupChange,
  onAddLotForProduct,
  onRemove,
}: Props) {
  const err = (index: number, name: keyof PurchaseOrderFormValues['lines'][number]) => errors.lines?.[index]?.[name]?.message
  const groups = buildEditorGroups(fields, watchedLines)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-6" />
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
          {groups.map((group) => (
            <Fragment key={fields[group.indices[0]].id}>
              {group.indices.map((index, posInGroup) => {
                const field = fields[index]
                const firstIndex = group.indices[0]
                const lastIndex = group.indices[group.indices.length - 1]
                const groupError = group.indices.map((idx) => err(idx, 'productId')).find(Boolean)
                const registered = register(`lines.${firstIndex}.productId`)

                return (
                  <tr key={field.id} className="border-t border-line align-top">
                    <td className="px-1 py-1.5 text-muted">{index + 1}</td>
                    {posInGroup === 0 && (
                      <td
                        rowSpan={group.indices.length}
                        className="min-w-64 border-r border-line/60 px-1 py-1.5 align-top"
                      >
                        <select
                          aria-label={`Sản phẩm dòng ${firstIndex + 1}`}
                          className={cn(CELL, groupError ? 'border-danger' : 'border-line')}
                          name={registered.name}
                          ref={registered.ref}
                          onBlur={registered.onBlur}
                          value={group.productId}
                          onChange={(e) => {
                            onProductGroupChange(group.indices, e.target.value)
                          }}
                        >
                          <option value="">Chọn sản phẩm</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} · {p.productName}
                              {p.isSellable === false ? ' (tester hãng)' : ''}
                            </option>
                          ))}
                        </select>
                        {group.productId && (
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            {group.indices.length > 1 ? (
                              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                                {group.indices.length} lô
                              </span>
                            ) : (
                              <span />
                            )}
                            <button
                              type="button"
                              onClick={() => onAddLotForProduct(group.productId, lastIndex)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                            >
                              <Plus className="size-3" aria-hidden="true" />
                              <span>Thêm lô</span>
                            </button>
                          </div>
                        )}
                        {groupError && <p className="mt-1 text-xs text-danger">{groupError}</p>}
                      </td>
                    )}
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
                      <NumberInput
                        type="number"
                        min={1}
                        aria-label={`Số lượng dòng ${index + 1}`}
                        className={cn(CELL, 'text-right', err(index, 'quantity') ? 'border-danger' : 'border-line')}
                        {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                      />
                      {err(index, 'quantity') && <p className="mt-1 text-xs text-danger">{err(index, 'quantity')}</p>}
                    </td>
                    <td className="w-36 px-1 py-1.5">
                      <NumberInput
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
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
