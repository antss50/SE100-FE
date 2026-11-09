import {
  AlertCircle,
  ArrowRight,
  Award,
  Ban,
  Barcode,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FolderPlus,
  Layers,
  PlusCircle,
  RefreshCw,
  Search,
  Tag,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiClientError } from '../../lib/api-client'
import { productsService } from '../../services/products.service'
import type { BrandItem, CategoryItem, ProductItem } from '../../types/api'
import { formatNumber } from '../../utils/format'
import { CreateBrandModal } from './CreateBrandModal'
import { CreateCategoryModal } from './CreateCategoryModal'
import { CreateProductModal } from './CreateProductModal'

function ProductThumbnail({ product }: { product: ProductItem }) {
  const thumbUrl = product.imageUrl || product.images?.[0]?.url
  if (thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt={product.productName}
        className="size-12 rounded-2xl object-cover border border-[#ead9ce] shrink-0 bg-white"
      />
    )
  }

  const theme = product.visualTheme || 'serum'
  const palette: Record<
    string,
    { bg: string; bottle: string; cap: string; label: string }
  > = {
    serum: {
      bg: 'bg-[#f4ebe4]',
      bottle: 'bg-[#6e3b1e]',
      cap: 'bg-[#d4af37]',
      label: 'ANR',
    },
    lipstick: {
      bg: 'bg-[#f7e9e4]',
      bottle: 'bg-[#b91c1c]',
      cap: 'bg-[#d97706]',
      label: 'YSL',
    },
    sunscreen: {
      bg: 'bg-[#f5efe2]',
      bottle: 'bg-[#e6c687]',
      cap: 'bg-[#38bdf8]',
      label: 'UV',
    },
    cleanser: {
      bg: 'bg-[#f7eff2]',
      bottle: 'bg-white border border-pink-200',
      cap: 'bg-pink-400',
      label: 'H2O',
    },
    tint: {
      bg: 'bg-[#f9eae8]',
      bottle: 'bg-[#c25953]',
      cap: 'bg-[#e7a9a4]',
      label: 'ROM',
    },
  }
  const style = palette[theme] || palette.serum

  return (
    <div
      className={`size-12 rounded-2xl ${style.bg} border border-[#ebdcd2] flex flex-col items-center justify-center shrink-0 relative overflow-hidden shadow-2xs`}
    >
      <span className={`w-2.5 h-1.5 rounded-t-xs ${style.cap}`} />
      <div
        className={`w-5 h-7 rounded-sm ${style.bottle} flex items-center justify-center text-[7px] font-mono font-bold text-white shadow-2xs`}
      >
        {style.label}
      </div>
    </div>
  )
}

export function InventoryPage() {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [reloadTick, setReloadTick] = useState(0)

  // Directory modal filter state (UC-PROD-11 & UC-PROD-16)
  const [dirKeyword, setDirKeyword] = useState('')
  const [dirStatus, setDirStatus] = useState('ALL')
  const [dirError, setDirError] = useState<string | null>(null)

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(
    null
  )

  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null)

  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [pageError, setPageError] = useState<{
    message: string
    sku?: string
    isStockConflict?: boolean
  } | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      productsService.getProducts({
        keyword,
        brandCode: brandFilter,
        categoryCode: categoryFilter,
        status: statusFilter,
        page,
        pageSize,
      }),
      productsService.getCategories({
        keyword: dirKeyword,
        status: dirStatus,
        page: 1,
        pageSize: 100,
      }),
      productsService.getBrands({
        keyword: dirKeyword,
        status: dirStatus,
        page: 1,
        pageSize: 100,
      }),
    ])
      .then(([prodRes, catRes, brandRes]) => {
        if (!active) return
        setProducts(prodRes.data.items)
        setTotalItems(prodRes.data.totalItems)
        setCategories(catRes.data.items)
        setBrands(brandRes.data.items)
      })
      .catch(() => {
        // ignore
      })

    return () => {
      active = false
    }
  }, [
    keyword,
    brandFilter,
    categoryFilter,
    statusFilter,
    page,
    pageSize,
    dirKeyword,
    dirStatus,
    reloadTick,
  ])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3800)
  }

  const handleOpenCreateProduct = () => {
    setEditingProduct(null)
    setIsProductModalOpen(true)
  }

  const handleOpenEditProduct = (product: ProductItem) => {
    setEditingProduct(product)
    setIsProductModalOpen(true)
  }

  const handleOpenCreateCategory = () => {
    setEditingCategory(null)
    setIsCategoryModalOpen(true)
  }

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat)
    setIsCategoryModalOpen(true)
  }

  const handleOpenCreateBrand = () => {
    setEditingBrand(null)
    setIsBrandModalOpen(true)
  }

  const handleOpenEditBrand = (brand: BrandItem) => {
    setEditingBrand(brand)
    setIsBrandModalOpen(true)
  }

  // UC-PROD-07 & UC-PROD-08: Ngừng kinh doanh / Khôi phục sản phẩm
  const handleToggleProductStatus = async (product: ProductItem) => {
    setPageError(null)
    try {
      if (product.status === 'ACTIVE') {
        const res = await productsService.deactivateProduct(product.sku)
        setReloadTick((t) => t + 1)
        showToast(`${res.message} (${res.data.sku} → ${res.data.status})`)
      } else {
        const res = await productsService.restoreProduct(product.sku)
        setReloadTick((t) => t + 1)
        showToast(`${res.message} (${res.data.sku} → ${res.data.status})`)
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPageError({
          message: `${err.message} (${err.errorCode})`,
          sku: product.sku,
          isStockConflict: err.errorCode === 'PROD_HAS_STOCK',
        })
      }
    }
  }

  // UC-PROD-14 & UC-PROD-15: Ngừng sử dụng / Khôi phục danh mục
  const handleToggleCategoryStatus = async (cat: CategoryItem) => {
    setDirError(null)
    try {
      if (cat.status === 'ACTIVE') {
        const res = await productsService.deactivateCategory(cat.categoryCode)
        setReloadTick((t) => t + 1)
        showToast(
          `${res.message} (${res.data.categoryCode} → ${res.data.status})`
        )
      } else {
        const res = await productsService.restoreCategory(cat.categoryCode)
        setReloadTick((t) => t + 1)
        showToast(
          `${res.message} (${res.data.categoryCode} → ${res.data.status})`
        )
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDirError(`${err.message} (${err.errorCode})`)
      }
    }
  }

  // UC-PROD-19 & UC-PROD-20: Ngừng sử dụng / Khôi phục thương hiệu
  const handleToggleBrandStatus = async (brand: BrandItem) => {
    setDirError(null)
    try {
      if (brand.status === 'ACTIVE') {
        const res = await productsService.deactivateBrand(brand.brandCode)
        setReloadTick((t) => t + 1)
        showToast(`${res.message} (${res.data.brandCode} → ${res.data.status})`)
      } else {
        const res = await productsService.restoreBrand(brand.brandCode)
        setReloadTick((t) => t + 1)
        showToast(`${res.message} (${res.data.brandCode} → ${res.data.status})`)
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDirError(`${err.message} (${err.errorCode})`)
      }
    }
  }

  const activeCategoryRatio =
    categories.length > 0
      ? Math.round(
          (categories.filter((c) => c.status === 'ACTIVE').length /
            categories.length) *
            100
        )
      : 100

  return (
    <div className="space-y-6">
      {/* Top Page Title & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-[#221712] tracking-tight">
            Quản lý Sản phẩm, Danh mục & Thương hiệu
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#7c6356] max-w-2xl leading-relaxed">
            Khởi tạo quy cách đóng gói, giá niêm yết, định mức an toàn và cấu
            trúc chuẩn bị lô xuất nhập trước khi kích hoạt POS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDirError(null)
              setIsDirectoryModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#fbf3ed] border border-[#e5d2c6] hover:bg-[#f5e6db] px-4 py-2.5 text-xs font-bold text-[#7a3f28] shadow-2xs transition cursor-pointer"
          >
            <Layers className="size-4 text-[#9a462d]" />
            <span>Danh mục & Thương hiệu</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateCategory}
            className="inline-flex items-center gap-2 rounded-2xl bg-white border border-[#e5d2c6] hover:bg-[#faf2ec] px-4 py-2.5 text-xs font-bold text-[#5e3c28] shadow-2xs transition cursor-pointer"
          >
            <FolderPlus className="size-4 text-[#9a462d]" />
            <span>+ Thêm danh mục</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateBrand}
            className="inline-flex items-center gap-2 rounded-2xl bg-white border border-[#e5d2c6] hover:bg-[#faf2ec] px-4 py-2.5 text-xs font-bold text-[#5e3c28] shadow-2xs transition cursor-pointer"
          >
            <Tag className="size-4 text-[#9a462d]" />
            <span>+ Thêm thương hiệu</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateProduct}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#da7756] hover:bg-[#c46343] text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-[0_10px_20px_-6px_rgba(218,119,86,0.55)] transition cursor-pointer"
          >
            <PlusCircle className="size-4" />
            <span>Thêm sản phẩm mới</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl bg-[#2b1d16] text-amber-50 px-4 py-3 text-xs font-medium shadow-md flex items-center justify-between">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-[11px] font-bold text-amber-200 hover:text-white"
          >
            Đóng
          </button>
        </div>
      )}

      {pageError && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-800 flex flex-wrap items-center justify-between gap-3">
          <span>{pageError.message}</span>
          <div className="flex items-center gap-2">
            {pageError.isStockConflict && (
              <span className="text-[11px] font-medium text-red-700">
                Muốn hết tồn hãy lập phiếu xuất hủy hoặc trả NCC (mọi thay đổi tồn phải có thẻ kho).
              </span>
            )}
            <button
              type="button"
              onClick={() => setPageError(null)}
              className="text-[11px] font-bold text-red-700 hover:underline cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TỔNG SKU HOẠT ĐỘNG */}
        <div className="rounded-3xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8c7265]">
                TỔNG SKU HOẠT ĐỘNG
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-[#a13d22]">
                1.240
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-[#faece3] text-[#a13d22] grid place-items-center">
              <Boxes className="size-5" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-lg bg-[#fde8e0] text-[#b4482a] font-mono text-[11px] font-bold">
              ↗ +38
            </span>
            <span className="text-[#7c6356]">thêm mới trong tháng</span>
          </div>
        </div>

        {/* Card 2: THƯƠNG HIỆU PHÂN PHỐI */}
        <div
          onClick={() => {
            setDirError(null)
            setIsDirectoryModalOpen(true)
          }}
          className="rounded-3xl bg-white border border-[#ead9ce] hover:border-[#d57252] p-5 shadow-2xs flex flex-col justify-between cursor-pointer transition"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8c7265]">
                THƯƠNG HIỆU PHÂN PHỐI
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-[#221712]">
                {Math.max(42, brands.length)}
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-[#faefe4] text-[#9a6b36] grid place-items-center">
              <Award className="size-5" />
            </div>
          </div>

          <p className="mt-4 text-xs font-semibold text-[#85582a] truncate">
            {brands
              .slice(0, 3)
              .map((b) => b.brandName)
              .join(', ')}
            ...
          </p>
        </div>

        {/* Card 3: DANH MỤC NGÀNH HÀNG */}
        <div
          onClick={() => {
            setDirError(null)
            setIsDirectoryModalOpen(true)
          }}
          className="rounded-3xl bg-white border border-[#ead9ce] hover:border-[#d57252] p-5 shadow-2xs flex flex-col justify-between cursor-pointer transition"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8c7265]">
                DANH MỤC NGÀNH HÀNG
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-[#221712]">
                {categories.length}
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-[#f5ece4] text-[#4b382d] grid place-items-center">
              <Layers className="size-5" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-[#7c6356] truncate pr-2">
              Skincare, Makeup, Bodycare...
            </span>
            <span className="font-mono text-[11px] font-bold text-[#9a462d] shrink-0">
              {activeCategoryRatio}% Active
            </span>
          </div>
        </div>

        {/* Card 4: DƯỚI ĐỊNH MỨC AN TOÀN */}
        <div
          onClick={() =>
            setStatusFilter((prev) =>
              prev === 'LOW_STOCK' ? 'ACTIVE' : 'LOW_STOCK'
            )
          }
          className={`rounded-3xl border p-5 shadow-2xs flex flex-col justify-between cursor-pointer transition ${
            statusFilter === 'LOW_STOCK'
              ? 'bg-red-50/90 border-red-300'
              : 'bg-[#fff9f7] border-[#f3d4ca] hover:border-red-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-red-700">
                DƯỚI ĐỊNH MỨC AN TOÀN
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-red-600">
                15
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-red-100/80 text-red-600 grid place-items-center">
              <AlertCircle className="size-5" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-[#695246]">
            <span>
              {statusFilter === 'LOW_STOCK'
                ? 'Đang lọc SKU dưới định mức'
                : 'Cần lên đơn bổ sung gấp'}
            </span>
            <ArrowRight className="size-3.5 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar (UC-PROD-04) */}
      <div className="rounded-3xl bg-white border border-[#ead9ce] p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-[#9a7e70] absolute left-4 top-3" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            placeholder="Nhập sản phẩm muốn tìm kiếm (SKU, tên, mã vạch)"
            className="w-full rounded-2xl bg-[#fbf3ed] border border-transparent focus:border-[#d57252] focus:bg-white pl-11 pr-4 py-2.5 text-xs text-[#221712] placeholder:text-[#967c70] outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-2xl bg-[#fbf3ed] border border-[#efe0d6] px-4 py-2.5 text-xs font-semibold text-[#3b2920] outline-none cursor-pointer"
          >
            <option value="ALL">
              Tất cả Thương hiệu ({Math.max(42, brands.length)})
            </option>
            {brands.map((b) => (
              <option key={b.brandCode} value={b.brandCode}>
                {b.brandName} ({b.brandCode})
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-2xl bg-[#fbf3ed] border border-[#efe0d6] px-4 py-2.5 text-xs font-semibold text-[#3b2920] outline-none cursor-pointer"
          >
            <option value="ALL">
              Tất cả Danh mục ({categories.length})
            </option>
            {categories.map((c) => (
              <option key={c.categoryCode} value={c.categoryCode}>
                {c.categoryName} ({c.categoryCode})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-2xl bg-[#fbf3ed] border border-[#efe0d6] px-4 py-2.5 text-xs font-semibold text-[#3b2920] outline-none cursor-pointer"
          >
            <option value="ACTIVE">Đang kinh doanh (ACTIVE)</option>
            <option value="LOW_STOCK">Dưới định mức an toàn</option>
            <option value="DISCONTINUED">Ngừng kinh doanh</option>
            <option value="ALL">Tất cả trạng thái</option>
          </select>

          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            title="Làm mới dữ liệu"
            className="rounded-2xl bg-[#fbf3ed] border border-[#efe0d6] p-2.5 text-[#5e473b] hover:bg-[#f2e2d7] cursor-pointer"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Product Table */}
      <div className="rounded-3xl bg-white border border-[#ead9ce] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f9efe7] border-b border-[#eeddd2] text-[10px] font-extrabold uppercase tracking-wider text-[#7e6457]">
                <th className="py-4 px-6">SẢN PHẨM & QUY CHUẨN</th>
                <th className="py-4 px-4">MÃ SKU & BARCODE EAN</th>
                <th className="py-4 px-4">THƯƠNG HIỆU / NHÓM</th>
                <th className="py-4 px-4">QUY CÁCH</th>
                <th className="py-4 px-6 text-right">
                  GIÁ NIÊM YẾT (VAT) & THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3e7df] text-xs">
              {products.map((prod) => {
                const vatPct = Math.round((prod.taxRate || 0.1) * 100)
                const isLowStock =
                  (prod.currentStock ?? 20) <= (prod.minStockAlert ?? 10)

                return (
                  <tr
                    key={prod.sku}
                    onClick={() => handleOpenEditProduct(prod)}
                    title="Bấm để xem chi tiết hoặc chỉnh sửa sản phẩm"
                    className={`hover:bg-[#fdf9f6] transition cursor-pointer group ${
                      prod.status === 'DISCONTINUED' ? 'opacity-70 bg-zinc-50/40' : ''
                    }`}
                  >
                    {/* Column 1: Product Thumbnail + Name + Description */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3.5">
                        <ProductThumbnail product={prod} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold text-sm text-[#221712] group-hover:text-[#9a3b20] transition">
                              {prod.productName}
                            </p>
                            {prod.status === 'DISCONTINUED' ? (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-bold">
                                Ngừng KD
                              </span>
                            ) : (
                              isLowStock && (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold">
                                  Sắp hết ({prod.currentStock}/
                                  {prod.minStockAlert})
                                </span>
                              )
                            )}
                          </div>
                          <p className="text-[11px] text-[#7c6356] mt-0.5">
                            {prod.description ||
                              'Sản phẩm phân phối chính hãng Lumina POS'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: SKU & Barcode EAN */}
                    <td className="py-4 px-4 font-mono">
                      <p className="font-bold text-xs text-[#a13d22]">
                        {prod.sku}
                      </p>
                      <p className="text-[11px] text-[#5e473b] mt-1 flex items-center gap-1">
                        <Barcode className="size-3.5 text-[#7c6356]" />
                        <span>{prod.barcode || '8935001234567'}</span>
                      </p>
                    </td>

                    {/* Column 3: Brand / Category */}
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#f6ebe4] text-[#3a281f] text-[11px] font-bold">
                        {prod.brandName || prod.brandCode}
                      </span>
                      <p className="text-[11px] text-[#7c6356] mt-1">
                        {prod.categoryName || prod.categoryCode}
                      </p>
                    </td>

                    {/* Column 4: Packaging Spec */}
                    <td className="py-4 px-4">
                      <p className="font-bold text-[#221712]">
                        {prod.unit} {prod.volume}
                      </p>
                      <p className="text-[11px] text-[#7c6356] mt-0.5">
                        {prod.packagingDetail || 'Tiêu chuẩn hãng'}
                      </p>
                    </td>

                    {/* Column 5: Retail Price, VAT & Quick Deactivate/Restore */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div>
                          <p className="font-mono text-sm font-extrabold text-[#a13d22]">
                            {prod.retailPrice.toLocaleString('vi-VN')} đ
                          </p>
                          <span className="mt-1 inline-block px-2 py-0.5 rounded bg-[#f9ebe2] text-[#b4533c] font-mono text-[10px] font-bold">
                            VAT {vatPct}%
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Xem chi tiết & Cập nhật (UC-PROD-05, UC-PROD-06)"
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-2 rounded-xl bg-[#fbf3ed] hover:bg-[#f2e2d6] text-[#6d4934] transition cursor-pointer"
                          >
                            <Edit3 className="size-3.5" />
                          </button>

                          {prod.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              title="Ngừng kinh doanh sản phẩm (UC-PROD-07)"
                              onClick={() =>
                                handleToggleProductStatus(prod)
                              }
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer"
                            >
                              <Ban className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Khôi phục sản phẩm (UC-PROD-08)"
                              onClick={() =>
                                handleToggleProductStatus(prod)
                              }
                              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                            >
                              <CheckCircle2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-xs text-[#8a7062]"
                  >
                    Không tìm thấy sản phẩm nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Pagination */}
        <div className="px-6 py-4 bg-[#faf1ea] border-t border-[#eeddd2] flex flex-wrap items-center justify-between gap-4 text-xs text-[#6d5549]">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Hiển thị <strong>1 – {products.length}</strong> trên tổng số{' '}
              <strong>
                {formatNumber(Math.max(1240, totalItems, products.length))}
              </strong>{' '}
              sản phẩm
            </span>
            <span className="text-[#cfb8aa]">•</span>
            <div className="flex items-center gap-2">
              <span>Dòng mỗi trang:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg bg-white border border-[#e5d2c6] px-2.5 py-1 text-xs font-bold text-[#221712] outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="size-8 rounded-lg border border-[#e5d2c6] bg-white/70 grid place-items-center text-[#6d5549] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>

            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`size-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                  page === p
                    ? 'bg-[#da7756] text-white shadow-xs'
                    : 'bg-white border border-[#e5d2c6] text-[#4a362c] hover:bg-[#f7ebe2]'
                }`}
              >
                {p}
              </button>
            ))}
            <span className="px-1 text-[#8c7265]">...</span>
            <button
              type="button"
              onClick={() => setPage(62)}
              className="size-8 rounded-lg bg-white border border-[#e5d2c6] text-xs font-bold text-[#4a362c]"
            >
              62
            </button>

            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="size-8 rounded-lg border border-[#e5d2c6] bg-white/70 grid place-items-center text-[#6d5549] cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals for Product, Category, Brand & Directory */}
      <CreateProductModal
        key={
          editingProduct
            ? `edit-${editingProduct.sku}`
            : `create-${isProductModalOpen}`
        }
        isOpen={isProductModalOpen}
        categories={categories}
        brands={brands}
        editingProduct={editingProduct}
        onClose={() => setIsProductModalOpen(false)}
        onSaved={(saved) => {
          setReloadTick((t) => t + 1)
          showToast(
            editingProduct
              ? `Đã cập nhật sản phẩm "${saved.productName}" (${saved.sku})`
              : `Thêm sản phẩm "${saved.productName}" (${saved.sku}) thành công (HTTP 201)`
          )
        }}
        onOpenCreateCategory={handleOpenCreateCategory}
        onOpenCreateBrand={handleOpenCreateBrand}
      />

      <CreateCategoryModal
        key={
          editingCategory
            ? `cat-edit-${editingCategory.categoryCode}`
            : `cat-create-${isCategoryModalOpen}`
        }
        isOpen={isCategoryModalOpen}
        editingCategory={editingCategory}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaved={(cat, mode) => {
          setReloadTick((t) => t + 1)
          if (mode === 'create') {
            showToast(
              `Thêm danh mục "${cat.categoryName}" (${cat.categoryCode}) thành công (HTTP 201)`
            )
          } else if (mode === 'update') {
            showToast(
              `Cập nhật danh mục "${cat.categoryName}" (${cat.categoryCode}) thành công (HTTP 200)`
            )
          } else {
            showToast(
              `Đã chuyển trạng thái danh mục ${cat.categoryCode} → ${cat.status}`
            )
          }
        }}
      />

      <CreateBrandModal
        key={
          editingBrand
            ? `brand-edit-${editingBrand.brandCode}`
            : `brand-create-${isBrandModalOpen}`
        }
        isOpen={isBrandModalOpen}
        editingBrand={editingBrand}
        onClose={() => setIsBrandModalOpen(false)}
        onSaved={(brand, mode) => {
          setReloadTick((t) => t + 1)
          if (mode === 'create') {
            showToast(
              `Thêm thương hiệu "${brand.brandName}" (${brand.brandCode}) thành công (HTTP 201)`
            )
          } else if (mode === 'update') {
            showToast(
              `Cập nhật thương hiệu "${brand.brandName}" (${brand.brandCode}) thành công (HTTP 200)`
            )
          } else {
            showToast(
              `Đã chuyển trạng thái thương hiệu ${brand.brandCode} → ${brand.status}`
            )
          }
        }}
      />

      {/* Directory Modal to view/edit/deactivate/restore all Categories (UC-PROD-11..15) & Brands (UC-PROD-16..20) */}
      {isDirectoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] overflow-hidden border border-[#ead9ce] shadow-2xl flex flex-col">
            <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd] shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-[#221712]">
                  Quản lý Danh mục Ngành hàng ({categories.length}) & Thương
                  hiệu ({brands.length})
                </h3>
                <p className="text-[11px] text-[#7c6356] mt-0.5">
                  Xem danh sách, chi tiết, cập nhật, ngừng sử dụng và khôi phục
                  (UC-PROD-11 đến UC-PROD-20)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectoryModalOpen(false)}
                className="rounded-lg p-1.5 text-[#5e473b] hover:bg-black/5 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Search & Status Filter for Categories & Brands (UC-PROD-11, UC-PROD-16) */}
            <div className="px-6 py-3 bg-[#fdf8f4] border-b border-[#f1e4dc] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="size-3.5 text-[#9a7e70] absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={dirKeyword}
                  onChange={(e) => setDirKeyword(e.target.value)}
                  placeholder="Tìm theo mã hoặc tên danh mục / thương hiệu..."
                  className="w-full rounded-xl bg-white border border-[#e7d6cb] pl-9 pr-3 py-1.5 text-xs text-[#221712] outline-none focus:border-[#d57252]"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#7c6356] font-semibold">
                  Trạng thái:
                </span>
                <select
                  value={dirStatus}
                  onChange={(e) => setDirStatus(e.target.value)}
                  className="rounded-xl bg-white border border-[#e7d6cb] px-3 py-1.5 text-xs font-bold text-[#221712] outline-none"
                >
                  <option value="ALL">Tất cả (ACTIVE & INACTIVE)</option>
                  <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                  <option value="INACTIVE">Ngừng sử dụng (INACTIVE)</option>
                </select>
              </div>
            </div>

            {dirError && (
              <div className="mx-6 mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-800 flex items-center justify-between">
                <span>{dirError}</span>
                <button
                  type="button"
                  onClick={() => setDirError(null)}
                  className="text-[11px] font-bold text-red-700 hover:underline cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            )}

            <div className="p-6 overflow-y-auto grid md:grid-cols-2 gap-6 text-xs">
              {/* Column 1: Categories (UC-PROD-11..15) */}
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-[#f1e4dc]">
                  <span className="font-extrabold uppercase text-[#8c673a]">
                    Danh mục ngành hàng (UC-PROD-11..15)
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenCreateCategory}
                    className="font-bold text-[#9a462d] hover:underline cursor-pointer"
                  >
                    + Thêm danh mục
                  </button>
                </div>
                <div className="mt-3 space-y-2.5">
                  {categories.map((cat) => (
                    <div
                      key={cat.categoryCode}
                      className={`rounded-2xl border p-3.5 flex items-start justify-between gap-3 transition ${
                        cat.status === 'INACTIVE'
                          ? 'bg-zinc-50 border-zinc-200 opacity-75'
                          : 'bg-[#fcf7f4] border-[#ebd9ce]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#221712]">
                            {cat.categoryName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#f5e3d8] text-[#9a462d] font-mono text-[10px] font-bold">
                            {cat.categoryCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cat.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {cat.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7c6356]">
                          {cat.description || 'Danh mục mỹ phẩm chuẩn'}
                        </p>
                        <p className="text-[10px] font-mono font-semibold text-[#8c673a]">
                          Số lượng sản phẩm: {cat.productCount ?? 0}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title="Xem chi tiết & Cập nhật danh mục (UC-PROD-12, UC-PROD-13)"
                          onClick={() => handleOpenEditCategory(cat)}
                          className="p-2 rounded-xl bg-white border border-[#e5d2c6] hover:bg-[#f6eae2] text-[#6d4934] cursor-pointer"
                        >
                          <Edit3 className="size-3.5" />
                        </button>

                        {cat.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            title="Ngừng sử dụng danh mục (UC-PROD-14)"
                            onClick={() => handleToggleCategoryStatus(cat)}
                            className="p-2 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 cursor-pointer"
                          >
                            <Ban className="size-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Khôi phục danh mục (UC-PROD-15)"
                            onClick={() => handleToggleCategoryStatus(cat)}
                            className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                          >
                            <CheckCircle2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Brands (UC-PROD-16..20) */}
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-[#f1e4dc]">
                  <span className="font-extrabold uppercase text-[#8c673a]">
                    Thương hiệu phân phối (UC-PROD-16..20)
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenCreateBrand}
                    className="font-bold text-[#9a462d] hover:underline cursor-pointer"
                  >
                    + Thêm thương hiệu
                  </button>
                </div>
                <div className="mt-3 space-y-2.5">
                  {brands.map((b) => (
                    <div
                      key={b.brandCode}
                      className={`rounded-2xl border p-3.5 flex items-start justify-between gap-3 transition ${
                        b.status === 'INACTIVE'
                          ? 'bg-zinc-50 border-zinc-200 opacity-75'
                          : 'bg-[#fcf7f4] border-[#ebd9ce]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#221712]">
                            {b.brandName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#f5e3d8] text-[#9a462d] font-mono text-[10px] font-bold">
                            {b.brandCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7c6356]">
                          {b.description || 'Thương hiệu phân phối chính hãng'}
                        </p>
                        <p className="text-[10px] font-mono font-semibold text-[#8c673a]">
                          Số lượng sản phẩm: {b.productCount ?? 0}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title="Xem chi tiết & Cập nhật thương hiệu (UC-PROD-17, UC-PROD-18)"
                          onClick={() => handleOpenEditBrand(b)}
                          className="p-2 rounded-xl bg-white border border-[#e5d2c6] hover:bg-[#f6eae2] text-[#6d4934] cursor-pointer"
                        >
                          <Edit3 className="size-3.5" />
                        </button>

                        {b.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            title="Ngừng sử dụng thương hiệu (UC-PROD-19)"
                            onClick={() => handleToggleBrandStatus(b)}
                            className="p-2 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 cursor-pointer"
                          >
                            <Ban className="size-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Khôi phục thương hiệu (UC-PROD-20)"
                            onClick={() => handleToggleBrandStatus(b)}
                            className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                          >
                            <CheckCircle2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
