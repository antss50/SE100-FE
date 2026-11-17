import { ArrowDown, ArrowUpDown, ArrowUp, Barcode, Search } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { ErrorState, LoadingState, StatusBadge } from '../../../components/ui'
import type { PosProduct } from '../../../types/pos'
import { getErrorMessage } from '../../../utils/error'
import { formatCurrency, formatDate, formatNumber } from '../../../utils/format'
import { usePosProducts } from '../hooks/usePosProducts'
import { usePosStore } from '../pos-store'
import { ProductFilterBar } from './ProductFilterBar'

interface ProductSearchPanelProps {
  searchRef: RefObject<HTMLInputElement | null>
  scanRef: RefObject<HTMLInputElement | null>
  disabled: boolean
  onAdd: (product: PosProduct) => void
}

/**
 * POS-02: Tìm hàng, quét barcode và lọc sản phẩm.
 * Chỉ hiện SKU bán được còn tồn bán được; lô FEFO đầu tiên hiện ở cột Lô.
 * Tách biệt logic truy vấn (usePosProducts) và thanh bộ lọc (ProductFilterBar).
 */
export function ProductSearchPanel({ searchRef, scanRef, disabled, onAdd }: ProductSearchPanelProps) {
  const [scan, setScan] = useState('')
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const selectedProductId = usePosStore((s) => s.selectedProductId)
  const setSelectedProductId = usePosStore((s) => s.setSelectedProductId)

  const {
    products,
    totalItems,
    isLoading,
    error,
    refetch,
    keyword,
    setKeyword,
    scanProduct,
    categoryCode,
    setCategoryCode,
    brandCode,
    setBrandCode,
    priceSort,
    setPriceSort,
    togglePriceSort,
    nearExpiryOnly,
    toggleNearExpiry,
    categories,
    brands,
    hasActiveFilters,
    resetFilters,
  } = usePosProducts()

  // Tự động cuộn đến sản phẩm đang được chọn/focus khi selectedProductId thay đổi
  useEffect(() => {
    if (selectedProductId === null || !tableContainerRef.current) return
    const row = tableContainerRef.current.querySelector<HTMLElement>(`[data-pos-product-id="${selectedProductId}"]`)
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedProductId])

  const submitScan = async () => {
    const code = scan.trim()
    if (!code) return
    const success = await scanProduct(code, (product) => {
      setSelectedProductId(product.id)
      onAdd(product)
    })
    if (success) {
      setScan('')
    }
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-neutral-soft'

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-line bg-white" aria-label="Chọn sản phẩm">
      {/* Ô tìm kiếm từ khóa và quét Barcode */}
      <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[2fr_1fr]">
        <label className="relative">
          <span className="sr-only">Tìm sản phẩm</span>
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
          <span className="sr-only">Quét barcode</span>
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

      {/* Thanh bộ lọc sản phẩm: Danh mục, Brand, Giá, HSD cận hạn */}
      <ProductFilterBar
        categoryCode={categoryCode}
        onCategoryChange={setCategoryCode}
        brandCode={brandCode}
        onBrandChange={setBrandCode}
        priceSort={priceSort}
        onPriceSortChange={setPriceSort}
        nearExpiryOnly={nearExpiryOnly}
        onNearExpiryToggle={toggleNearExpiry}
        categories={categories}
        brands={brands}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        disabled={disabled}
      />

      {/* Thông tin quy tắc FEFO & kết quả tìm kiếm */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-4 py-2 text-xs text-muted">
        {hasActiveFilters && (
          <span className="font-semibold text-accent">
            Tìm thấy {totalItems} sản phẩm
          </span>
        )}
      </div>

      {/* Danh sách bảng sản phẩm */}
      <div ref={tableContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Sản phẩm bán được</caption>
            <thead className="sticky top-0 z-10 bg-card text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Sản phẩm</th>
                <th className="px-2 py-2 text-right font-semibold">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={togglePriceSort}
                    title="Bấm để sắp xếp theo giá"
                    className="inline-flex items-center gap-1 hover:text-ink transition cursor-pointer disabled:cursor-default"
                  >
                    <span>Giá</span>
                    {priceSort === 'asc' ? (
                      <ArrowUp className="size-3 text-accent" />
                    ) : priceSort === 'desc' ? (
                      <ArrowDown className="size-3 text-accent" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted/50" />
                    )}
                  </button>
                </th>
                <th className="px-2 py-2 font-semibold">Lô FEFO</th>
                <th className="px-2 py-2 text-right font-semibold">Tồn</th>
                <th className="px-2 py-2 font-semibold">HSD</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: PosProduct) => {
                const isSelected = p.id === selectedProductId
                return (
                  <tr
                    key={p.id}
                    data-pos-product-id={p.id}
                    tabIndex={0}
                    aria-selected={isSelected}
                    className={`cursor-pointer border-t transition-all ${isSelected
                        ? 'bg-accent-soft/80 ring-2 ring-accent/40 font-medium shadow-2xs'
                        : 'border-line hover:bg-accent-soft/40'
                      }`}
                    onClick={() => {
                      if (!disabled) {
                        setSelectedProductId(p.id)
                        onAdd(p)
                      }
                    }}
                    onFocus={() => setSelectedProductId(p.id)}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProductId(p.id)
                          onAdd(p)
                        }}
                        className={`text-left font-semibold hover:text-accent disabled:opacity-50 ${isSelected ? 'text-accent font-bold' : 'text-ink'
                          }`}
                      >
                        {p.productName}
                      </button>
                      <p className="text-xs text-muted">
                        {p.sku}
                        {p.brandName && ` · ${p.brandName}`}
                        {p.categoryName && ` · ${p.categoryName}`}
                      </p>
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold text-ink">
                      {formatCurrency(p.retailPrice)}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-ink-soft">
                      {p.firstLotCode ?? '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right font-medium">
                      {formatNumber(p.sellableQty)}
                    </td>
                    <td className="px-2 py-2.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{formatDate(p.firstLotExpDate)}</span>
                        {p.nearExpiry && (
                          <StatusBadge tone="warning">Cận hạn</StatusBadge>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    <p>Không có sản phẩm bán được phù hợp.</p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 text-xs font-semibold text-accent hover:underline cursor-pointer"
                      >
                        Xóa bộ lọc để xem lại toàn bộ
                      </button>
                    )}
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
