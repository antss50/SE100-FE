import { useQuery } from '@tanstack/react-query'
import { Barcode, Search } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { ErrorState, LoadingState, StatusBadge, toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/query-keys'
import { ordersService } from '../../../services/orders.service'
import type { PosProduct } from '../../../types/pos'
import { getErrorMessage } from '../../../utils/error'
import { formatCurrency, formatDate, formatNumber } from '../../../utils/format'

interface ProductSearchPanelProps {
  searchRef: RefObject<HTMLInputElement | null>
  scanRef: RefObject<HTMLInputElement | null>
  disabled: boolean
  onAdd: (product: PosProduct) => void
}

/** POS-02: tìm hàng (F1) và quét barcode (F2). Chỉ hiện SKU bán được còn tồn bán được; lô FEFO đầu tiên hiện ở cột Lô. */
export function ProductSearchPanel({ searchRef, scanRef, disabled, onAdd }: ProductSearchPanelProps) {
  const [keyword, setKeyword] = useState('')
  const [scan, setScan] = useState('')
  const params = { keyword: keyword.trim(), pageSize: 24 }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.pos.products(params),
    queryFn: () => ordersService.posProducts(params),
    placeholderData: (prev) => prev,
  })

  const submitScan = async () => {
    const code = scan.trim()
    if (!code) return
    try {
      const res = await ordersService.posProducts({ code })
      const product = res.data.items[0]
      if (!product) toast.error(`Không có hàng bán được với mã ${code}`)
      else onAdd(product)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
    setScan('')
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-neutral-soft'

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-white" aria-label="Chọn sản phẩm">
      <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[2fr_1fr]">
        <label className="relative">
          <span className="sr-only">Tìm sản phẩm (F1)</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            ref={searchRef}
            value={keyword}
            disabled={disabled}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên, SKU, barcode (F1)"
            className={inputClass}
          />
        </label>
        <label className="relative">
          <span className="sr-only">Quét barcode (F2)</span>
          <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            ref={scanRef}
            value={scan}
            disabled={disabled}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submitScan()
              }
            }}
            placeholder="Quét mã vạch (F2)"
            className={inputClass}
          />
        </label>
      </div>
      <p className="border-b border-line bg-card px-4 py-2 text-xs text-muted">
        Quy tắc xuất kho FEFO: hệ thống tự chọn lô hết hạn sớm nhất, thiếu thì tách sang lô kế tiếp. Chỉ hiện hàng còn tồn bán được.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Sản phẩm bán được</caption>
            <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Sản phẩm</th>
                <th className="px-2 py-2 text-right font-semibold">Giá</th>
                <th className="px-2 py-2 font-semibold">Lô FEFO</th>
                <th className="px-2 py-2 text-right font-semibold">Tồn</th>
                <th className="px-2 py-2 font-semibold">HSD</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.items.map((p: PosProduct) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-t border-line hover:bg-accent-soft/50"
                  onClick={() => !disabled && onAdd(p)}
                >
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        onAdd(p)
                      }}
                      className="text-left font-semibold text-ink hover:text-accent disabled:opacity-50"
                    >
                      {p.productName}
                    </button>
                    <p className="text-xs text-muted">
                      {p.sku} · {p.brandName ?? ''}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold">{formatCurrency(p.retailPrice)}</td>
                  <td className="px-2 py-2.5 font-mono text-xs">{p.firstLotCode ?? '—'}</td>
                  <td className="px-2 py-2.5 text-right">{formatNumber(p.sellableQty)}</td>
                  <td className="px-2 py-2.5 text-xs">
                    {formatDate(p.firstLotExpDate)}
                    {p.nearExpiry && (
                      <span className="ml-1">
                        <StatusBadge tone="warning">Cận hạn</StatusBadge>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {data?.data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    Không có sản phẩm bán được phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
