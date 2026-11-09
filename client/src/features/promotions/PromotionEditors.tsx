import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui'
import type { DiscountType, PromotionItemRole, PromotionItemRow, PromotionStepRow } from '../../types/promotions'

export interface PickerOption {
  id: number
  label: string
}

const SELECT_CLASS =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-neutral-soft'
const INPUT_CLASS = SELECT_CLASS

interface ProductRowsEditorProps {
  title: string
  role: PromotionItemRole
  items: PromotionItemRow[]
  products: PickerOption[]
  onChange: (items: PromotionItemRow[]) => void
  quantityLabel?: string
  disabled?: boolean
}

/** Danh sách sản phẩm theo một vai trò (TARGET, BUY, GIFT, COMBO_ITEM) kèm số lượng. */
export function ProductRowsEditor({ title, role, items, products, onChange, quantityLabel, disabled }: ProductRowsEditorProps) {
  const rows = items.map((item, index) => ({ item, index })).filter((r) => r.item.role === role)
  const update = (index: number, patch: Partial<PromotionItemRow>) =>
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  const add = () => onChange([...items, { productId: products[0]?.id ?? 0, role, quantity: 1 }])
  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-3" disabled={disabled}>
      <legend className="px-1 text-xs font-semibold text-ink-soft">{title}</legend>
      {rows.length === 0 && <p className="text-xs text-muted">Chưa chọn sản phẩm nào.</p>}
      {rows.map(({ item, index }) => (
        <div key={index} className="flex items-center gap-2">
          <select
            aria-label={`${title}: sản phẩm`}
            value={item.productId}
            onChange={(e) => update(index, { productId: Number(e.target.value) })}
            className={SELECT_CLASS}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {quantityLabel && (
            <input
              type="number"
              min={1}
              aria-label={quantityLabel}
              value={item.quantity}
              onChange={(e) => update(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              className={`${INPUT_CLASS} w-24`}
            />
          )}
          <button
            type="button"
            aria-label="Bỏ sản phẩm"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" icon={<Plus className="size-3.5" aria-hidden="true" />} onClick={add}>
        Thêm sản phẩm
      </Button>
    </fieldset>
  )
}

interface StepsEditorProps {
  steps: PromotionStepRow[]
  onChange: (steps: PromotionStepRow[]) => void
  disabled?: boolean
}

/** Các bậc thang giảm theo giá trị hóa đơn (PROMOTION_STEPS). */
export function StepsEditor({ steps, onChange, disabled }: StepsEditorProps) {
  const update = (index: number, patch: Partial<PromotionStepRow>) =>
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-3" disabled={disabled}>
      <legend className="px-1 text-xs font-semibold text-ink-soft">Các bậc giảm</legend>
      {steps.length === 0 && <p className="text-xs text-muted">Cần ít nhất một bậc.</p>}
      {steps.map((s, i) => (
        <div key={i} className="grid grid-cols-[1fr_8rem_1fr_1fr_auto] items-end gap-2">
          <label className="text-xs text-muted">
            Đơn từ (đ)
            <input
              type="number"
              min={0}
              value={s.minOrderValue}
              onChange={(e) => update(i, { minOrderValue: Number(e.target.value) })}
              className={INPUT_CLASS}
            />
          </label>
          <label className="text-xs text-muted">
            Kiểu giảm
            <select
              value={s.discountType}
              onChange={(e) => update(i, { discountType: e.target.value as DiscountType })}
              className={SELECT_CLASS}
            >
              <option value="PERCENT">Phần trăm</option>
              <option value="FIXED_AMOUNT">Số tiền</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Mức giảm
            <input
              type="number"
              min={0}
              value={s.discountValue}
              onChange={(e) => update(i, { discountValue: Number(e.target.value) })}
              className={INPUT_CLASS}
            />
          </label>
          <label className="text-xs text-muted">
            Trần giảm (đ)
            <input
              type="number"
              min={0}
              value={s.maxDiscountAmount ?? ''}
              onChange={(e) => update(i, { maxDiscountAmount: e.target.value === '' ? null : Number(e.target.value) })}
              className={INPUT_CLASS}
            />
          </label>
          <button
            type="button"
            aria-label="Bỏ bậc"
            onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
            className="mb-1 rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Plus className="size-3.5" aria-hidden="true" />}
        onClick={() =>
          onChange([...steps, { minOrderValue: 0, discountType: 'FIXED_AMOUNT', discountValue: 0, maxDiscountAmount: null }])
        }
      >
        Thêm bậc
      </Button>
    </fieldset>
  )
}

interface CheckGroupProps {
  title: string
  options: PickerOption[]
  selected: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function CheckGroup({ title, options, selected, onChange, disabled }: CheckGroupProps) {
  return (
    <fieldset className="rounded-xl border border-line p-3" disabled={disabled}>
      <legend className="px-1 text-xs font-semibold text-ink-soft">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.id} className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export function WeekdaysPicker({
  value,
  onChange,
  disabled,
}: {
  value: number[]
  onChange: (days: number[]) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="rounded-xl border border-line p-3" disabled={disabled}>
      <legend className="px-1 text-xs font-semibold text-ink-soft">Các thứ áp dụng (bỏ trống = mọi ngày)</legend>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_LABELS.map((label, i) => {
          const day = i + 1
          return (
            <label key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={value.includes(day)}
                onChange={(e) => onChange(e.target.checked ? [...value, day] : value.filter((d) => d !== day))}
              />
              {label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
