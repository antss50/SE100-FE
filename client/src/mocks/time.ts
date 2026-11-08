/** Tiện ích ngày giờ cho mock: tính tương đối so với hôm nay (giờ máy). */

export function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

export function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD` theo giờ địa phương. */
export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO 8601 kèm độ lệch múi giờ địa phương, ví dụ `2026-11-08T09:30:00+07:00`. */
export function toIsoLocal(d: Date): string {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${toDateOnly(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}
