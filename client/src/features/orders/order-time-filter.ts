export type TimeFilterMode = 'ALL' | 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM'

export interface TimeFilterState {
  mode: TimeFilterMode
  /** Ngày cụ thể YYYY-MM-DD (dùng cho mode DAY). */
  day: string
  /** Tháng 1..12 (dùng cho mode MONTH). */
  month: number
  /** Quý 1..4 (dùng cho mode QUARTER). */
  quarter: number
  /** Năm YYYY (dùng cho mode MONTH, QUARTER, YEAR). */
  year: number
  /** Khoảng ngày tùy chỉnh YYYY-MM-DD (dùng cho mode CUSTOM). */
  fromDate: string
  toDate: string
}

export const TIME_FILTER_MODE_LABELS: Record<TimeFilterMode, string> = {
  ALL: 'Mọi thời gian',
  DAY: 'Theo ngày',
  MONTH: 'Theo tháng',
  QUARTER: 'Theo quý',
  YEAR: 'Theo năm',
  CUSTOM: 'Khoảng ngày',
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function todayYmd(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function createInitialTimeFilter(now: Date = new Date()): TimeFilterState {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const quarter = Math.floor((month - 1) / 3) + 1
  const today = todayYmd(now)
  return {
    mode: 'ALL',
    day: today,
    month,
    quarter,
    year,
    fromDate: '',
    toDate: '',
  }
}

/** Trả về số ngày của tháng (month = 1..12), tính theo UTC để tránh lệch múi giờ. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Quy đổi trạng thái lọc thời gian thành cặp `fromDate` / `toDate` (`YYYY-MM-DD`). */
export function resolveTimeRange(state: TimeFilterState): { fromDate: string; toDate: string } {
  switch (state.mode) {
    case 'ALL':
      return { fromDate: '', toDate: '' }
    case 'DAY':
      return { fromDate: state.day, toDate: state.day }
    case 'MONTH': {
      const m = pad2(state.month)
      const last = pad2(daysInMonth(state.year, state.month))
      return {
        fromDate: `${state.year}-${m}-01`,
        toDate: `${state.year}-${m}-${last}`,
      }
    }
    case 'QUARTER': {
      const startMonth = (state.quarter - 1) * 3 + 1
      const endMonth = state.quarter * 3
      const last = pad2(daysInMonth(state.year, endMonth))
      return {
        fromDate: `${state.year}-${pad2(startMonth)}-01`,
        toDate: `${state.year}-${pad2(endMonth)}-${last}`,
      }
    }
    case 'YEAR':
      return {
        fromDate: `${state.year}-01-01`,
        toDate: `${state.year}-12-31`,
      }
    case 'CUSTOM':
      return { fromDate: state.fromDate, toDate: state.toDate }
  }
}

/** Danh sách năm hiển thị trong dropdown lọc (mới nhất trước). */
export function getSelectableYears(baseYear: number = new Date().getFullYear()): number[] {
  const years: number[] = []
  for (let y = baseYear + 1; y >= baseYear - 5; y--) {
    years.push(y)
  }
  return years
}

