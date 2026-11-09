import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTable, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { productsService } from '../../services/products.service'
import { stockService } from '../../services/stock.service'
import type { StockBatchItem } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatDate, formatNumber } from '../../utils/format'
import { ExpiryBadge } from './ExpiryBadge'

interface Props {
  /** Id các lô được chọn sẵn (vd. từ màn Tồn kho). */
  initialIds?: number[]
  /** Trả về các lô đang chọn (đủ dữ liệu để hiện lại ở bước sau). */
  onChange: (items: StockBatchItem[]) => void
  /** Lô không được chọn (kèm lý do hiển thị). */
  disabledReason?: (item: StockBatchItem) => string | null
  /** Lọc cố định phía client, vd. chỉ lô còn hạn. */
  filter?: (item: StockBatchItem) => boolean
}

/** Chọn lô theo tìm kiếm và danh mục; dùng cho kiểm kho (STK-04) và xuất kho khác (STK-06). */
export function LotPicker({ initialIds = [], onChange, disabledReason, filter }: Props) {
  const [keyword, setKeyword] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds)
  const cache = useRef(new Map<number, StockBatchItem>())

  const params = { keyword, categoryCode, inStockOnly: true, pageSize: 200 }
  const batches = useQuery({
    queryKey: queryKeys.stock.batches({ ...params, scope: 'picker' }),
    queryFn: () => stockService.batches(params),
    placeholderData: (prev) => prev,
  })
  const categories = useQuery({
    queryKey: ['categories', 'for-stock'],
    queryFn: () => productsService.getCategories({ pageSize: 100 }),
  })
  const items = useMemo(() => (batches.data?.data.items ?? []).filter((i) => !filter || filter(i)), [batches.data, filter])

  useEffect(() => {
    for (const item of batches.data?.data.items ?? []) cache.current.set(item.id, item)
    onChange(selectedIds.flatMap((id) => cache.current.get(id) ?? []))
    // onChange đổi tham chiếu mỗi lần render ở cha; chỉ phản ứng khi dữ liệu hoặc lựa chọn đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches.data, selectedIds])

  const toggle = (id: number) => setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const columns: Column<StockBatchItem>[] = [
    {
      key: 'pick',
      header: 'Chọn',
      render: (b) => {
        const reason = disabledReason?.(b) ?? null
        return (
          <input
            type="checkbox"
            className="size-6 accent-accent"
            aria-label={`Chọn lô ${b.lotCode}`}
            checked={selectedIds.includes(b.id)}
            disabled={reason !== null}
            title={reason ?? undefined}
            onChange={() => toggle(b.id)}
          />
        )
      },
    },
    {
      key: 'product',
      header: 'Sản phẩm / Mã lô',
      render: (b) => (
        <div>
          <p className="font-medium">{b.productName}</p>
          <p className="font-mono text-xs text-muted">
            {b.sku} · {b.lotCode}
          </p>
          {disabledReason?.(b) && <p className="text-xs text-warning">{disabledReason(b)}</p>}
        </div>
      ),
    },
    {
      key: 'exp',
      header: 'Hạn sử dụng',
      render: (b) => (
        <div className="space-y-1">
          <p>{formatDate(b.expDate)}</p>
          <ExpiryBadge status={b.expiryStatus} days={b.daysToExpiry} />
        </div>
      ),
    },
    { key: 'onhand', header: 'Tồn sổ sách hiện tại', align: 'right', render: (b) => formatNumber(b.onHandQty) },
    { key: 'blocked', header: 'Cách ly', align: 'right', render: (b) => formatNumber(b.blockedQty) },
  ]

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <label className="min-w-64 flex-1">
          <span className="sr-only">Tìm lô</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm mã lô, SKU hoặc tên sản phẩm..."
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
        <label>
          <span className="sr-only">Nhóm sản phẩm</span>
          <select
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Mọi danh mục</option>
            {(categories.data?.data.items ?? []).map((c) => (
              <option key={c.categoryCode} value={c.categoryCode}>
                {c.categoryName}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-muted">
          {items.length} lô phù hợp · đã chọn {selectedIds.length} lô
        </span>
      </div>
      <DataTable
        caption="Chọn lô hàng"
        columns={columns}
        rows={items}
        rowKey={(b) => b.id}
        loading={batches.isLoading}
        error={batches.error ? getErrorMessage(batches.error) : null}
        onRetry={() => void batches.refetch()}
        emptyTitle="Không có lô phù hợp"
      />
    </div>
  )
}
