/** Xuất CSV phía client (báo cáo dùng chung). Có BOM UTF-8 để Excel đọc đúng tiếng Việt. */

export type CsvCell = string | number | null | undefined

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const escape = (cell: CsvCell): string => {
    const text = cell === null || cell === undefined ? '' : String(cell)
    return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
}

/** Tải file CSV về máy; trả `false` nếu môi trường không hỗ trợ tải. */
export function downloadCsv(filename: string, headers: readonly string[], rows: readonly (readonly CsvCell[])[]): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false
  const blob = new Blob([`﻿${toCsv(headers, rows)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return true
}
