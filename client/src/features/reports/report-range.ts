import { useState } from 'react'
import { addDaysTo, validateRange } from '../../domain/reports/period'
import type { ReportGranularity, ReportRange } from '../../types/reports'

const pad = (n: number) => String(n).padStart(2, '0')

/** Hôm nay `YYYY-MM-DD` theo giờ máy. */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export type RangePreset = 'TODAY' | 'LAST7' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER'

export const PRESET_LABELS: Record<RangePreset, string> = {
  TODAY: 'Hôm nay',
  LAST7: '7 ngày qua',
  THIS_MONTH: 'Tháng này',
  LAST_MONTH: 'Tháng trước',
  THIS_QUARTER: 'Quý này',
}

export function presetRange(preset: RangePreset, today: string = todayLocal()): ReportRange {
  const [y, m] = today.split('-').map(Number)
  const lastDayOf = (year: number, month: number) => `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
  if (preset === 'TODAY') return { fromDate: today, toDate: today }
  if (preset === 'LAST7') return { fromDate: addDaysTo(today, -6), toDate: today }
  if (preset === 'THIS_MONTH') return { fromDate: `${y}-${pad(m)}-01`, toDate: today }
  if (preset === 'LAST_MONTH') {
    const year = m === 1 ? y - 1 : y
    const month = m === 1 ? 12 : m - 1
    return { fromDate: `${year}-${pad(month)}-01`, toDate: lastDayOf(year, month) }
  }
  const quarterStart = Math.floor((m - 1) / 3) * 3 + 1
  return { fromDate: `${y}-${pad(quarterStart)}-01`, toDate: today }
}

export interface RangeState extends ReportRange {
  granularity: ReportGranularity
  compare: boolean
}

/** Trạng thái bộ lọc dùng chung của các báo cáo; `error` khác null thì không nên gọi API. */
export function useReportRange(initial: RangePreset = 'THIS_MONTH') {
  const [state, setState] = useState<RangeState>(() => ({ ...presetRange(initial), granularity: 'DAY', compare: false }))
  const error = validateRange(state)
  return {
    state,
    error,
    setRange: (range: ReportRange) => setState((s) => ({ ...s, ...range })),
    setGranularity: (granularity: ReportGranularity) => setState((s) => ({ ...s, granularity })),
    setCompare: (compare: boolean) => setState((s) => ({ ...s, compare })),
  }
}

export type ReportRangeController = ReturnType<typeof useReportRange>
