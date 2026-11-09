import { Download } from 'lucide-react'
import { Button, Input, Select, cn } from '../../components/ui'
import type { ReportGranularity } from '../../types/reports'
import { PRESET_LABELS, presetRange, type RangePreset, type ReportRangeController } from './report-range'

const GRANULARITY_OPTIONS = [
  { value: 'DAY', label: 'Theo ngày' },
  { value: 'WEEK', label: 'Theo tuần' },
  { value: 'MONTH', label: 'Theo tháng' },
]

export interface ReportFiltersProps {
  controller: ReportRangeController
  showGranularity?: boolean
  showCompare?: boolean
  /** Bỏ trống thì không hiện nút xuất. */
  onExport?: () => void
  exportDisabled?: boolean
}

/** Bộ lọc chung: nút nhanh, từ ngày/đến ngày (kiểm `fromDate ≤ toDate`), kỳ gộp, so sánh kỳ trước, xuất CSV. */
export function ReportFilters({ controller, showGranularity, showCompare, onExport, exportDisabled }: ReportFiltersProps) {
  const { state, error, setRange, setGranularity, setCompare } = controller
  return (
    <section aria-label="Bộ lọc báo cáo" className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PRESET_LABELS) as RangePreset[]).map((preset) => {
          const range = presetRange(preset)
          const active = range.fromDate === state.fromDate && range.toDate === state.toDate
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setRange(range)}
              aria-pressed={active}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-white text-muted hover:bg-card'
              )}
            >
              {PRESET_LABELS[preset]}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Từ ngày"
          type="date"
          value={state.fromDate}
          onChange={(e) => setRange({ fromDate: e.target.value, toDate: state.toDate })}
        />
        <Input
          label="Đến ngày"
          type="date"
          value={state.toDate}
          onChange={(e) => setRange({ fromDate: state.fromDate, toDate: e.target.value })}
        />
        {showGranularity && (
          <Select
            label="Gộp theo"
            value={state.granularity}
            options={GRANULARITY_OPTIONS}
            onChange={(e) => setGranularity(e.target.value as ReportGranularity)}
          />
        )}
        {showCompare && (
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={state.compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-accent" />
            So sánh kỳ trước
          </label>
        )}
        {onExport && (
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden="true" />}
            onClick={onExport}
            disabled={exportDisabled || error !== null}
            className="ml-auto"
          >
            Xuất CSV
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  )
}
