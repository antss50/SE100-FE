/** Hàm thuần xử lý khoảng ngày và kỳ báo cáo (ngày dạng `YYYY-MM-DD`, tính theo UTC để không lệch múi giờ). */
import type { ReportGranularity, ReportRange } from '../../types/reports'

const DAY_MS = 86_400_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const toTime = (date: string): number => Date.parse(`${date}T00:00:00Z`)
const fromTime = (t: number): string => new Date(t).toISOString().slice(0, 10)

/** Ngày (`YYYY-MM-DD`) của một chuỗi ISO có múi giờ địa phương. */
export const dateOf = (iso: string): string => iso.slice(0, 10)

export function isValidDate(date: string): boolean {
  return DATE_RE.test(date) && !Number.isNaN(toTime(date)) && fromTime(toTime(date)) === date
}

export const addDaysTo = (date: string, days: number): string => fromTime(toTime(date) + days * DAY_MS)

/** Số ngày giữa hai ngày (b − a). */
export const diffDays = (a: string, b: string): number => Math.round((toTime(b) - toTime(a)) / DAY_MS)

export const inRange = (date: string, range: ReportRange): boolean => date >= range.fromDate && date <= range.toDate

/** Lỗi nhập khoảng ngày (tiếng Việt) hoặc `null` nếu hợp lệ: `fromDate ≤ toDate` (QUY_TAC mục 7). */
export function validateRange(range: ReportRange): string | null {
  if (!isValidDate(range.fromDate) || !isValidDate(range.toDate)) return 'Ngày không hợp lệ (định dạng YYYY-MM-DD)'
  if (range.fromDate > range.toDate) return 'Từ ngày phải nhỏ hơn hoặc bằng đến ngày'
  return null
}

/** Kỳ liền trước, cùng số ngày với `range`. */
export function previousRange(range: ReportRange): ReportRange {
  const length = diffDays(range.fromDate, range.toDate) + 1
  return { fromDate: addDaysTo(range.fromDate, -length), toDate: addDaysTo(range.fromDate, -1) }
}

/** Ngày đầu của kỳ chứa `date` (tuần bắt đầu thứ Hai). */
export function periodStart(date: string, granularity: ReportGranularity): string {
  if (granularity === 'DAY') return date
  if (granularity === 'MONTH') return `${date.slice(0, 7)}-01`
  const weekday = new Date(toTime(date)).getUTCDay() // 0 = Chủ nhật
  return addDaysTo(date, -((weekday + 6) % 7))
}

/** Ngày cuối của kỳ bắt đầu ở `start`. */
export function periodEnd(start: string, granularity: ReportGranularity): string {
  if (granularity === 'DAY') return start
  if (granularity === 'WEEK') return addDaysTo(start, 6)
  const [y, m] = start.split('-').map(Number)
  return fromTime(Date.UTC(y, m, 0))
}

export function periodLabel(start: string, granularity: ReportGranularity): string {
  const [y, m, d] = start.split('-')
  if (granularity === 'MONTH') return `${m}/${y}`
  if (granularity === 'WEEK') return `Tuần ${d}/${m}`
  return `${d}/${m}`
}

/** Danh sách đầu kỳ phủ hết `range`, theo thứ tự tăng dần (kỳ rỗng vẫn có mặt để biểu đồ liền mạch). */
export function listPeriods(range: ReportRange, granularity: ReportGranularity): string[] {
  const out: string[] = []
  let cursor = periodStart(range.fromDate, granularity)
  while (cursor <= range.toDate) {
    out.push(cursor)
    if (granularity === 'DAY') cursor = addDaysTo(cursor, 1)
    else if (granularity === 'WEEK') cursor = addDaysTo(cursor, 7)
    else {
      const [y, m] = cursor.split('-').map(Number)
      cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    }
  }
  return out
}
