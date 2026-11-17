import { useQuery } from '@tanstack/react-query'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/query-keys'
import { ordersService } from '../../../services/orders.service'
import { productsService } from '../../../services/products.service'
import type { BrandItem, CategoryItem } from '../../../types/api'
import type { PosProduct, PosProductsParams, PriceSortOrder } from '../../../types/pos'
import { getErrorMessage } from '../../../utils/error'

export interface UsePosProductsReturn {
  // Products Data & Query State
  products: PosProduct[]
  totalItems: number
  isLoading: boolean
  isFetching: boolean
  error: unknown
  refetch: () => void

  // Search & Barcode Scan
  keyword: string
  setKeyword: (value: string) => void
  scanProduct: (code: string, onAdd: (product: PosProduct) => void) => Promise<boolean>

  // Filters State & Setters
  categoryCode: string
  setCategoryCode: (value: string) => void
  brandCode: string
  setBrandCode: (value: string) => void
  priceSort: PriceSortOrder
  setPriceSort: (value: PriceSortOrder) => void
  togglePriceSort: () => void
  nearExpiryOnly: boolean
  setNearExpiryOnly: (value: boolean) => void
  toggleNearExpiry: () => void

  // Catalog Options
  categories: CategoryItem[]
  brands: BrandItem[]
  isLoadingCatalog: boolean

  // Filter Utilities
  hasActiveFilters: boolean
  activeFilterCount: number
  resetFilters: () => void
}

/**
 * Hook quản lý logic xử lý query sản phẩm POS, bao gồm tìm kiếm, quét barcode,
 * tải danh mục/thương hiệu, và lọc theo danh mục, brand, giá, HSD cận hạn.
 */
export function usePosProducts(pageSize = 24): UsePosProductsReturn {
  const [keyword, setKeyword] = useState('')
  const [categoryCode, setCategoryCode] = useState('ALL')
  const [brandCode, setBrandCode] = useState('ALL')
  const [priceSort, setPriceSort] = useState<PriceSortOrder>('')
  const [nearExpiryOnly, setNearExpiryOnly] = useState(false)

  // Tối ưu gõ phím không block UI với deferred value
  const deferredKeyword = useDeferredValue(keyword)

  // Danh mục sản phẩm hoạt động
  const categoriesQuery = useQuery({
    queryKey: queryKeys.catalog.categories({ status: 'ACTIVE', pageSize: 100 }),
    queryFn: () => productsService.getCategories({ status: 'ACTIVE', pageSize: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  // Thương hiệu hoạt động
  const brandsQuery = useQuery({
    queryKey: queryKeys.catalog.brands({ status: 'ACTIVE', pageSize: 100 }),
    queryFn: () => productsService.getBrands({ status: 'ACTIVE', pageSize: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  // Tham số truy vấn sản phẩm POS
  const params: PosProductsParams = useMemo(
    () => ({
      keyword: deferredKeyword.trim() || undefined,
      categoryCode: categoryCode && categoryCode !== 'ALL' ? categoryCode : undefined,
      brandCode: brandCode && brandCode !== 'ALL' ? brandCode : undefined,
      nearExpiry: nearExpiryOnly ? true : undefined,
      priceSort: priceSort || undefined,
      pageSize,
    }),
    [deferredKeyword, categoryCode, brandCode, nearExpiryOnly, priceSort, pageSize]
  )

  // Danh sách sản phẩm bán được theo bộ lọc
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.pos.products(params),
    queryFn: () => ordersService.posProducts(params),
    placeholderData: (prev) => prev,
  })

  // Quét barcode / nhập SKU trực tiếp
  const scanProduct = useCallback(async (code: string, onAdd: (product: PosProduct) => void): Promise<boolean> => {
    const trimmed = code.trim()
    if (!trimmed) return false
    try {
      const res = await ordersService.posProducts({ code: trimmed })
      const product = res.data.items[0]
      if (!product) {
        toast.error(`Không có hàng bán được với mã ${trimmed}`)
        return false
      }
      onAdd(product)
      return true
    } catch (e) {
      toast.error(getErrorMessage(e))
      return false
    }
  }, [])

  // Chuyển đổi vòng lặp sắp xếp giá: '' (mặc định) -> 'asc' (tăng dần) -> 'desc' (giảm dần) -> ''
  const togglePriceSort = useCallback(() => {
    setPriceSort((prev) => {
      if (prev === '') return 'asc'
      if (prev === 'asc') return 'desc'
      return ''
    })
  }, [])

  const toggleNearExpiry = useCallback(() => {
    setNearExpiryOnly((prev) => !prev)
  }, [])

  // Đặt lại các bộ lọc về mặc định
  const resetFilters = useCallback(() => {
    setKeyword('')
    setCategoryCode('ALL')
    setBrandCode('ALL')
    setPriceSort('')
    setNearExpiryOnly(false)
  }, [])

  // Kiểm tra trạng thái bộ lọc đang áp dụng
  const isCategoryActive = Boolean(categoryCode && categoryCode !== 'ALL')
  const isBrandActive = Boolean(brandCode && brandCode !== 'ALL')
  const isPriceSortActive = Boolean(priceSort)
  const isNearExpiryActive = Boolean(nearExpiryOnly)
  const isKeywordActive = Boolean(keyword.trim())

  const activeFilterCount =
    (isCategoryActive ? 1 : 0) +
    (isBrandActive ? 1 : 0) +
    (isPriceSortActive ? 1 : 0) +
    (isNearExpiryActive ? 1 : 0) +
    (isKeywordActive ? 1 : 0)

  const hasActiveFilters = activeFilterCount > 0

  return {
    products: data?.data.items ?? [],
    totalItems: data?.data.totalItems ?? 0,
    isLoading,
    isFetching,
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
    setNearExpiryOnly,
    toggleNearExpiry,

    categories: categoriesQuery.data?.data.items ?? [],
    brands: brandsQuery.data?.data.items ?? [],
    isLoadingCatalog: categoriesQuery.isLoading || brandsQuery.isLoading,

    hasActiveFilters,
    activeFilterCount,
    resetFilters,
  }
}

