import { AlertTriangle, ArrowDown, ArrowUpDown, ArrowUp, RotateCcw } from 'lucide-react'
import type { BrandItem, CategoryItem } from '../../../types/api'
import type { PriceSortOrder } from '../../../types/pos'

export interface ProductFilterBarProps {
  categoryCode: string
  onCategoryChange: (value: string) => void
  brandCode: string
  onBrandChange: (value: string) => void
  priceSort: PriceSortOrder
  onPriceSortChange: (value: PriceSortOrder) => void
  nearExpiryOnly: boolean
  onNearExpiryToggle: () => void
  categories: CategoryItem[]
  brands: BrandItem[]
  hasActiveFilters: boolean
  onReset: () => void
  disabled?: boolean
}

/**
 * UI thanh bộ lọc sản phẩm POS:
 * - Lọc theo Danh mục
 * - Lọc theo Thương hiệu (Brand)
 * - Sắp xếp theo Giá (tăng dần / giảm dần)
 * - Lọc HSD (Hàng cận hạn)
 * - Nút xóa / đặt lại bộ lọc
 */
export function ProductFilterBar({
  categoryCode,
  onCategoryChange,
  brandCode,
  onBrandChange,
  priceSort,
  onPriceSortChange,
  nearExpiryOnly,
  onNearExpiryToggle,
  categories,
  brands,
  hasActiveFilters,
  onReset,
  disabled = false,
}: ProductFilterBarProps) {
  const selectBaseClass =
    'rounded-xl border bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition ' +
    'focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-neutral-soft disabled:text-muted cursor-pointer'

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-line bg-card/60 px-4 py-2 text-xs"
      role="search"
      aria-label="Bộ lọc sản phẩm"
    >
      {/* 1. Lọc theo Danh mục */}
      <label className="flex items-center gap-1">
        <span className="sr-only">Lọc theo danh mục</span>
        <select
          value={categoryCode}
          disabled={disabled}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="Lọc theo danh mục"
          className={`${selectBaseClass} ${
            categoryCode && categoryCode !== 'ALL'
              ? 'border-accent font-semibold text-accent'
              : 'border-line text-ink'
          }`}
        >
          <option value="ALL">Tất cả danh mục{categories.length > 0 ? ` (${categories.length})` : ''}</option>
          {categories.map((c) => (
            <option key={c.categoryCode} value={c.categoryCode}>
              {c.categoryName}
            </option>
          ))}
        </select>
      </label>

      {/* 2. Lọc theo Thương hiệu (Brand) */}
      <label className="flex items-center gap-1">
        <span className="sr-only">Lọc theo thương hiệu</span>
        <select
          value={brandCode}
          disabled={disabled}
          onChange={(e) => onBrandChange(e.target.value)}
          aria-label="Lọc theo thương hiệu"
          className={`${selectBaseClass} ${
            brandCode && brandCode !== 'ALL'
              ? 'border-accent font-semibold text-accent'
              : 'border-line text-ink'
          }`}
        >
          <option value="ALL">Tất cả thương hiệu{brands.length > 0 ? ` (${brands.length})` : ''}</option>
          {brands.map((b) => (
            <option key={b.brandCode} value={b.brandCode}>
              {b.brandName}
            </option>
          ))}
        </select>
      </label>

      {/* 3. Lọc / Sắp xếp theo Giá (tăng dần / giảm dần) */}
      <label className="flex items-center gap-1">
        <span className="sr-only">Sắp xếp theo giá</span>
        <div className="relative inline-flex items-center">
          <select
            value={priceSort}
            disabled={disabled}
            onChange={(e) => onPriceSortChange(e.target.value as PriceSortOrder)}
            aria-label="Sắp xếp theo giá"
            className={`${selectBaseClass} pr-6 ${
              priceSort ? 'border-accent font-semibold text-accent' : 'border-line text-ink'
            }`}
          >
            <option value="">Giá: Mặc định</option>
            <option value="asc">Giá: Thấp → Cao (tăng dần)</option>
            <option value="desc">Giá: Cao → Thấp (giảm dần)</option>
          </select>
          <span className="pointer-events-none absolute right-2 text-muted" aria-hidden="true">
            {priceSort === 'asc' ? (
              <ArrowUp className="size-3 text-accent" />
            ) : priceSort === 'desc' ? (
              <ArrowDown className="size-3 text-accent" />
            ) : (
              <ArrowUpDown className="size-3 text-muted/60" />
            )}
          </span>
        </div>
      </label>

      {/* 4. Lọc HSD (Cận hạn) */}
      <button
        type="button"
        disabled={disabled}
        onClick={onNearExpiryToggle}
        aria-pressed={nearExpiryOnly}
        title="Lọc chỉ các sản phẩm có lô hàng sắp hết hạn"
        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
          nearExpiryOnly
            ? 'border-warning bg-warning-soft text-warning ring-2 ring-warning/20 shadow-2xs'
            : 'border-line bg-white text-muted hover:border-neutral-focus hover:text-ink'
        }`}
      >
        <AlertTriangle className={`size-3.5 ${nearExpiryOnly ? 'text-warning' : 'text-muted'}`} aria-hidden="true" />
        <span>HSD: Cận hạn</span>
      </button>

      {/* 5. Nút xóa / đặt lại bộ lọc */}
      {hasActiveFilters && (
        <button
          type="button"
          disabled={disabled}
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-xl border border-line bg-white px-2 py-1.5 text-xs font-medium text-muted hover:border-danger/30 hover:bg-danger-soft/30 hover:text-danger transition cursor-pointer disabled:opacity-50"
          title="Xóa tất cả bộ lọc hiện tại"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          <span>Đặt lại</span>
        </button>
      )}
    </div>
  )
}

