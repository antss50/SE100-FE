import type { ReactNode } from 'react'
import { cn } from './cn'
import { EmptyState, ErrorState, LoadingState } from './Feedback'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  caption?: string
  onRowClick?: (row: T) => void
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' }

/** Bảng dữ liệu có đủ 3 trạng thái: đang tải, lỗi, rỗng. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  onRetry,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  caption,
  onRowClick,
}: DataTableProps<T>) {
  let body: ReactNode = null
  if (loading) body = <LoadingState />
  else if (error) body = <ErrorState message={error} onRetry={onRetry} />
  else if (!rows || rows.length === 0) body = <EmptyState title={emptyTitle} description={emptyDescription} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-accent-soft/60">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('px-4 py-3 text-xs font-semibold text-muted', ALIGN[c.align ?? 'left'], c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        {!body && (
          <tbody>
            {rows?.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-t border-line', onRowClick && 'cursor-pointer hover:bg-card')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 text-ink', ALIGN[c.align ?? 'left'], c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {body}
    </div>
  )
}
