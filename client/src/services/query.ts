/** Dựng query string, bỏ giá trị rỗng và giá trị lọc `ALL`. */
export function toQueryString(params: object): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'ALL') continue
    query.set(key, String(value).trim())
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}
