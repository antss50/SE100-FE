import { Calendar, RotateCcw } from 'lucide-react'
import {
  TIME_FILTER_MODE_LABELS,
  getSelectableYears,
  type TimeFilterMode,
  type TimeFilterState,
} from './order-time-filter'

interface OrderTimeFilterProps {
  value: TimeFilterState
  onChange: (next: TimeFilterState) => void
  onReset: () => void
}

const QUARTER_OPTIONS = [
  { value: 1, label: 'Quý 1 (T1–T3)' },
  { value: 2, label: 'Quý 2 (T4–T6)' },
  { value: 3, label: 'Quý 3 (T7–T9)' },
  { value: 4, label: 'Quý 4 (T10–T12)' },
]

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, idx) => ({
  value: idx + 1,
  label: `Tháng ${idx + 1}`,
}))

export function OrderTimeFilter({ value, onChange, onReset }: OrderTimeFilterProps) {
  const selectClass =
    'rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'
  const years = getSelectableYears()

  const update = (patch: Partial<TimeFilterState>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc doanh thu theo thời gian">
      <label className="inline-flex items-center gap-1.5">
        <Calendar className="size-4 text-muted" aria-hidden="true" />
        <span className="sr-only">Kiểu lọc thời gian</span>
        <select
          aria-label="Kiểu lọc thời gian"
          value={value.mode}
          onChange={(e) => update({ mode: e.target.value as TimeFilterMode })}
          className={`${selectClass} font-medium ${value.mode !== 'ALL' ? 'border-accent text-accent' : 'text-ink'}`}
        >
          {(Object.keys(TIME_FILTER_MODE_LABELS) as TimeFilterMode[]).map((m) => (
            <option key={m} value={m}>
              {TIME_FILTER_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      {value.mode === 'DAY' && (
        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <span>Ngày</span>
          <input
            type="date"
            aria-label="Chọn ngày"
            value={value.day}
            onChange={(e) => update({ day: e.target.value })}
            className={selectClass}
          />
        </label>
      )}

      {value.mode === 'MONTH' && (
        <>
          <label>
            <span className="sr-only">Chọn tháng</span>
            <select
              aria-label="Chọn tháng"
              value={value.month}
              onChange={(e) => update({ month: Number(e.target.value) })}
              className={selectClass}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Chọn năm</span>
            <select
              aria-label="Chọn năm"
              value={value.year}
              onChange={(e) => update({ year: Number(e.target.value) })}
              className={selectClass}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {value.mode === 'QUARTER' && (
        <>
          <label>
            <span className="sr-only">Chọn quý</span>
            <select
              aria-label="Chọn quý"
              value={value.quarter}
              onChange={(e) => update({ quarter: Number(e.target.value) })}
              className={selectClass}
            >
              {QUARTER_OPTIONS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Chọn năm</span>
            <select
              aria-label="Chọn năm"
              value={value.year}
              onChange={(e) => update({ year: Number(e.target.value) })}
              className={selectClass}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {value.mode === 'YEAR' && (
        <label>
          <span className="sr-only">Chọn năm</span>
          <select
            aria-label="Chọn năm"
            value={value.year}
            onChange={(e) => update({ year: Number(e.target.value) })}
            className={selectClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>
        </label>
      )}

      {value.mode === 'CUSTOM' && (
        <>
          <label className="text-xs text-muted">
            Từ ngày
            <input
              type="date"
              aria-label="Từ ngày"
              value={value.fromDate}
              onChange={(e) => update({ fromDate: e.target.value })}
              className={`${selectClass} ml-2`}
            />
          </label>
          <label className="text-xs text-muted">
            Đến ngày
            <input
              type="date"
              aria-label="Đến ngày"
              value={value.toDate}
              onChange={(e) => update({ toDate: e.target.value })}
              className={`${selectClass} ml-2`}
            />
          </label>
        </>
      )}

      {value.mode !== 'ALL' && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-2.5 py-2 text-xs font-medium text-muted hover:border-danger/30 hover:bg-danger-soft/30 hover:text-danger transition cursor-pointer"
          title="Xóa lọc thời gian"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          <span>Đặt lại</span>
        </button>
      )}
    </div>
  )
}

