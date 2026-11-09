const pad = (n: number) => String(n).padStart(2, '0')

/** ISO 8601 kèm múi giờ địa phương, ví dụ `2026-11-08T09:30:00+07:00`. */
export function toIsoWithOffset(d: Date): string {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** Giá trị `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`) → ISO có múi giờ. */
export function localInputToIso(value: string): string {
  return toIsoWithOffset(new Date(value))
}

/** ISO → giá trị `<input type="datetime-local">`. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Hôm nay dạng `YYYY-MM-DD` theo giờ máy. */
export function todayDateOnly(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
