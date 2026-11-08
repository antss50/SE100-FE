import { ApiClientError, apiRequest } from '../lib/api-client'
import {
  INITIAL_BRANDS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  mockDb,
} from '../lib/mock-db'
import type {
  ApiSuccessResponse,
  BrandItem,
  CategoryItem,
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  GetBrandsParams,
  GetCategoriesParams,
  GetProductsParams,
  PaginatedData,
  ProductImageItem,
  ProductItem,
  UpdateBrandRequest,
  UpdateCategoryRequest,
  UpdateProductRequest,
} from '../types/api'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILES_PER_UPLOAD = 5
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export function parsePackagingSpec(specInput: string): {
  unit: string
  volume: string
  packagingDetail: string
} {
  const trimmed = specInput.trim()
  if (!trimmed) {
    return { unit: 'Chai', volume: '', packagingDetail: '' }
  }

  const volMatch = trimmed.match(
    /(\d+(?:[.,]\d+)?\s*(?:ml|g|oz|l|miếng|viên))/i
  )
  const volume = volMatch ? volMatch[1].replace(/\s+/g, '') : ''

  const knownUnits = [
    'Chai',
    'Thỏi',
    'Tuýp',
    'Lọ',
    'Hộp',
    'Bộ',
    'Túi',
    'Miếng',
  ]
  const matchedUnit =
    knownUnits.find((u) =>
      trimmed.toLowerCase().startsWith(u.toLowerCase())
    ) ||
    knownUnits.find((u) => trimmed.toLowerCase().includes(u.toLowerCase())) ||
    trimmed.split(/\s+/)[0] ||
    'Chai'

  return {
    unit: matchedUnit,
    volume,
    packagingDetail: trimmed,
  }
}

export function normalizeProductImages(
  rawImages: unknown,
  imageUrl?: string | null
): ProductImageItem[] {
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    return rawImages
      .map((item, idx) => {
        if (typeof item === 'string') {
          return { imageId: idx + 1, url: item }
        }
        if (item && typeof item === 'object' && 'url' in item) {
          const obj = item as { imageId?: number; url?: string }
          return {
            imageId: Number(obj.imageId) || idx + 1,
            url: String(obj.url || ''),
          }
        }
        return null
      })
      .filter((x): x is ProductImageItem => Boolean(x && x.url))
  }
  if (imageUrl) {
    return [{ imageId: 1, url: imageUrl }]
  }
  return []
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function enrichProduct(raw: ProductItem): ProductItem {
  const categories = mockDb.getCategories()
  const brands = mockDb.getBrands()
  const template = INITIAL_PRODUCTS.find(
    (p) => p.sku.toLowerCase() === raw.sku?.toLowerCase()
  )
  const cat =
    categories.find((c) => c.categoryCode === raw.categoryCode) ||
    INITIAL_CATEGORIES.find((c) => c.categoryCode === raw.categoryCode)
  const brand =
    brands.find((b) => b.brandCode === raw.brandCode) ||
    INITIAL_BRANDS.find((b) => b.brandCode === raw.brandCode)

  const normalizedImages = normalizeProductImages(
    raw.images ?? template?.images,
    raw.imageUrl
  )
  const primaryImageUrl =
    raw.imageUrl !== undefined
      ? raw.imageUrl
      : normalizedImages[0]?.url ?? null

  return {
    ...template,
    ...raw,
    categoryName: raw.categoryName || cat?.categoryName || raw.categoryCode,
    brandName: raw.brandName || brand?.brandName || raw.brandCode,
    unit: raw.unit || template?.unit || 'Chai',
    volume: raw.volume ?? template?.volume ?? '50ml',
    packagingDetail:
      raw.packagingDetail ?? template?.packagingDetail ?? 'Quy cách tiêu chuẩn',
    currentStock: raw.currentStock ?? template?.currentStock ?? 20,
    minStockAlert: raw.minStockAlert ?? template?.minStockAlert ?? 10,
    images: normalizedImages,
    imageUrl: primaryImageUrl,
    visualTheme: raw.visualTheme ?? template?.visualTheme ?? 'serum',
  }
}

function enrichCategory(cat: CategoryItem): CategoryItem {
  const activeMatchingCount = mockDb
    .getProducts()
    .filter(
      (p) => p.categoryCode === cat.categoryCode && p.status === 'ACTIVE'
    ).length
  return {
    ...cat,
    productCount: cat.productCount ?? activeMatchingCount,
    status: cat.status || 'ACTIVE',
  }
}

function enrichBrand(brand: BrandItem): BrandItem {
  const activeMatchingCount = mockDb
    .getProducts()
    .filter(
      (p) => p.brandCode === brand.brandCode && p.status === 'ACTIVE'
    ).length
  return {
    ...brand,
    productCount: brand.productCount ?? activeMatchingCount,
    status: brand.status || 'ACTIVE',
  }
}

export const productsService = {
  // UC-PROD-04: Xem danh sách sản phẩm - GET /api/v1/products
  async getProducts(
    params: GetProductsParams = {}
  ): Promise<ApiSuccessResponse<PaginatedData<ProductItem>>> {
    const query = new URLSearchParams()
    if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
    if (params.brandCode && params.brandCode !== 'ALL') {
      query.set('brandCode', params.brandCode)
    }
    if (params.categoryCode && params.categoryCode !== 'ALL') {
      query.set('categoryCode', params.categoryCode)
    }
    if (
      params.status &&
      params.status !== 'ALL' &&
      params.status !== 'LOW_STOCK'
    ) {
      query.set('status', params.status)
    }
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))

    const qs = query.toString()
    const res = await apiRequest<PaginatedData<ProductItem>>(
      `/products${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      () => {
        let all = mockDb.getProducts().map(enrichProduct)

        if (params.keyword?.trim()) {
          const kw = params.keyword.trim().toLowerCase()
          all = all.filter(
            (p) =>
              p.productName.toLowerCase().includes(kw) ||
              p.sku.toLowerCase().includes(kw) ||
              (p.barcode && p.barcode.toLowerCase().includes(kw)) ||
              (p.brandName && p.brandName.toLowerCase().includes(kw))
          )
        }

        if (params.brandCode && params.brandCode !== 'ALL') {
          all = all.filter((p) => p.brandCode === params.brandCode)
        }

        if (params.categoryCode && params.categoryCode !== 'ALL') {
          all = all.filter((p) => p.categoryCode === params.categoryCode)
        }

        if (params.status === 'LOW_STOCK') {
          all = all.filter(
            (p) => (p.currentStock ?? 0) <= (p.minStockAlert ?? 10)
          )
        } else if (params.status && params.status !== 'ALL') {
          all = all.filter((p) => p.status === params.status)
        }

        const page = params.page ?? 1
        const pageSize = params.pageSize ?? 20
        const start = (page - 1) * pageSize
        const items = all.slice(start, start + pageSize)

        return {
          success: true,
          message: 'Lấy danh sách sản phẩm thành công',
          data: {
            items,
            page,
            pageSize,
            totalItems: all.length,
          },
        }
      }
    )

    const rawItems = Array.isArray(res.data)
      ? (res.data as unknown as ProductItem[])
      : res.data.items || []

    return {
      ...res,
      data: {
        items: rawItems.map(enrichProduct),
        page: res.data.page ?? (params.page || 1),
        pageSize: res.data.pageSize ?? (params.pageSize || 20),
        totalItems: res.data.totalItems ?? rawItems.length,
      },
    }
  },

  // UC-PROD-05: Xem chi tiết sản phẩm - GET /api/v1/products/{sku}
  async getProductDetail(
    sku: string
  ): Promise<ApiSuccessResponse<ProductItem>> {
    const res = await apiRequest<ProductItem>(
      `/products/${encodeURIComponent(sku)}`,
      { method: 'GET' },
      () => {
        const products = mockDb.getProducts()
        const found = products.find(
          (p) => p.sku.toLowerCase() === sku.trim().toLowerCase()
        )
        if (!found) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_NOT_FOUND',
            message: 'Không tìm thấy sản phẩm',
          })
        }
        return {
          success: true,
          message: 'Lấy thông tin thành công',
          data: enrichProduct(found),
        }
      }
    )

    return {
      ...res,
      data: enrichProduct(res.data),
    }
  },

  // UC-PROD-01: Quản lý sản phẩm/SKU (Thêm mới) - POST /api/v1/products
  async createProduct(
    payload: CreateProductRequest
  ): Promise<ApiSuccessResponse<ProductItem>> {
    const requestBody = {
      sku: payload.sku?.trim(),
      productName: payload.productName?.trim(),
      categoryCode: payload.categoryCode?.trim(),
      brandCode: payload.brandCode?.trim(),
      unit: payload.unit?.trim(),
      volume: payload.volume?.trim() || undefined,
      skinType: payload.skinType || 'ALL_SKIN_TYPES',
      retailPrice: Number(payload.retailPrice),
      taxRate: Number(payload.taxRate),
      minStockAlert:
        payload.minStockAlert !== undefined
          ? Number(payload.minStockAlert)
          : undefined,
      barcode: payload.barcode?.trim() || undefined,
      images:
        payload.images && payload.images.length > 0
          ? payload.images
          : undefined,
    }

    return apiRequest<ProductItem>(
      '/products',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (
          !requestBody.sku ||
          !requestBody.productName ||
          !requestBody.categoryCode ||
          !requestBody.brandCode ||
          !requestBody.unit ||
          !Number.isFinite(requestBody.retailPrice) ||
          requestBody.retailPrice <= 0 ||
          !Number.isFinite(requestBody.taxRate) ||
          requestBody.taxRate < 0
        ) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Dữ liệu không hợp lệ hoặc thiếu giá bán/thuế suất',
          })
        }

        const products = mockDb.getProducts()

        const skuDup = products.find(
          (p) => p.sku.toLowerCase() === requestBody.sku.toLowerCase()
        )
        if (skuDup) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROD_SKU_DUPLICATED',
            message: 'SKU đã tồn tại',
          })
        }

        if (requestBody.barcode) {
          const barcodeDup = products.find(
            (p) => p.barcode && p.barcode === requestBody.barcode
          )
          if (barcodeDup) {
            throw new ApiClientError(409, {
              success: false,
              errorCode: 'PROD_BARCODE_DUPLICATED',
              message: 'Mã vạch đã tồn tại',
            })
          }
        }

        const nextId =
          products.reduce((max, p) => Math.max(max, p.id ?? 0), 0) + 1
        const mappedImages: ProductImageItem[] = (
          requestBody.images || []
        ).map((url, idx) => ({
          imageId: idx + 1,
          url,
        }))

        const newProduct: ProductItem = enrichProduct({
          id: nextId,
          sku: requestBody.sku.toUpperCase(),
          productName: requestBody.productName,
          categoryCode: requestBody.categoryCode,
          brandCode: requestBody.brandCode,
          unit: requestBody.unit,
          volume: requestBody.volume,
          skinType: requestBody.skinType,
          retailPrice: requestBody.retailPrice,
          taxRate: requestBody.taxRate,
          minStockAlert: requestBody.minStockAlert ?? 5,
          currentStock: 0,
          barcode: requestBody.barcode,
          images: mappedImages,
          imageUrl: mappedImages[0]?.url ?? null,
          packagingDetail:
            payload.packagingDetail || 'Chai thủy tinh tiêu chuẩn',
          shelfLifeMonths: payload.shelfLifeMonths ?? 36,
          description:
            payload.description || 'Sản phẩm mỹ phẩm chính hãng Lumina POS',
          status: 'ACTIVE',
        })

        mockDb.saveProducts([newProduct, ...products])

        return {
          success: true,
          message: 'Thêm sản phẩm thành công',
          data: newProduct,
        }
      }
    )
  },

  // UC-PROD-06: Cập nhật sản phẩm - PUT /api/v1/products/{sku}
  async updateProduct(
    sku: string,
    payload: UpdateProductRequest
  ): Promise<ApiSuccessResponse<ProductItem>> {
    const requestBody = {
      productName: payload.productName?.trim(),
      categoryCode: payload.categoryCode?.trim(),
      brandCode: payload.brandCode?.trim(),
      unit: payload.unit?.trim(),
      volume: payload.volume?.trim() || undefined,
      skinType: payload.skinType || 'ALL_SKIN_TYPES',
      retailPrice: Number(payload.retailPrice),
      taxRate: Number(payload.taxRate),
      minStockAlert:
        payload.minStockAlert !== undefined
          ? Number(payload.minStockAlert)
          : undefined,
      barcode: payload.barcode?.trim() || undefined,
    }

    return apiRequest<ProductItem>(
      `/products/${encodeURIComponent(sku)}`,
      {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (
          !requestBody.productName ||
          !requestBody.categoryCode ||
          !requestBody.brandCode ||
          !requestBody.unit ||
          !Number.isFinite(requestBody.retailPrice) ||
          requestBody.retailPrice <= 0 ||
          !Number.isFinite(requestBody.taxRate) ||
          requestBody.taxRate < 0
        ) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Dữ liệu không hợp lệ hoặc thiếu giá bán/thuế suất',
          })
        }

        const products = mockDb.getProducts()
        const target = products.find(
          (p) => p.sku.toLowerCase() === sku.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_NOT_FOUND',
            message: 'Không tìm thấy sản phẩm',
          })
        }

        const categories = mockDb.getCategories()
        const categoryExists = categories.some(
          (c) =>
            c.categoryCode.toLowerCase() ===
            requestBody.categoryCode.toLowerCase()
        )
        if (!categoryExists) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_CATEGORY_NOT_FOUND',
            message: 'Không tìm thấy danh mục',
          })
        }

        const brands = mockDb.getBrands()
        const brandExists = brands.some(
          (b) =>
            b.brandCode.toLowerCase() === requestBody.brandCode.toLowerCase()
        )
        if (!brandExists) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_BRAND_NOT_FOUND',
            message: 'Không tìm thấy thương hiệu',
          })
        }

        if (requestBody.barcode) {
          const barcodeDup = products.find(
            (p) =>
              p.sku.toLowerCase() !== target.sku.toLowerCase() &&
              p.barcode === requestBody.barcode
          )
          if (barcodeDup) {
            throw new ApiClientError(409, {
              success: false,
              errorCode: 'PROD_BARCODE_DUPLICATED',
              message: 'Mã vạch đã tồn tại',
            })
          }
        }

        Object.assign(target, {
          productName: requestBody.productName,
          categoryCode: requestBody.categoryCode,
          brandCode: requestBody.brandCode,
          unit: requestBody.unit,
          volume: requestBody.volume,
          skinType: requestBody.skinType,
          retailPrice: requestBody.retailPrice,
          taxRate: requestBody.taxRate,
          minStockAlert: requestBody.minStockAlert ?? target.minStockAlert ?? 5,
          barcode: requestBody.barcode,
          packagingDetail: payload.packagingDetail ?? target.packagingDetail,
          shelfLifeMonths: payload.shelfLifeMonths ?? target.shelfLifeMonths,
          description: payload.description ?? target.description,
        })

        const enriched = enrichProduct(target)
        Object.assign(target, enriched)
        mockDb.saveProducts(products)

        return {
          success: true,
          message: 'Cập nhật sản phẩm thành công',
          data: enriched,
        }
      }
    )
  },

  // UC-PROD-07: Ngừng kinh doanh sản phẩm - PATCH /api/v1/products/{sku}/deactivate
  async deactivateProduct(
    sku: string,
    clearStockFirst = false
  ): Promise<ApiSuccessResponse<{ sku: string; status: 'INACTIVE' }>> {
    return apiRequest<{ sku: string; status: 'INACTIVE' }>(
      `/products/${encodeURIComponent(sku)}/deactivate`,
      { method: 'PATCH' },
      () => {
        const products = mockDb.getProducts()
        const target = products.find(
          (p) => p.sku.toLowerCase() === sku.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_NOT_FOUND',
            message: 'Không tìm thấy sản phẩm',
          })
        }

        if (clearStockFirst) {
          target.currentStock = 0
        }

        if ((target.currentStock ?? 0) > 0) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROD_HAS_STOCK',
            message:
              'Sản phẩm còn tồn kho hoặc còn đơn chưa xử lý, không thể ngừng kinh doanh',
          })
        }

        target.status = 'INACTIVE'
        mockDb.saveProducts(products)

        return {
          success: true,
          message: 'Ngừng kinh doanh sản phẩm thành công',
          data: {
            sku: target.sku,
            status: 'INACTIVE',
          },
        }
      }
    )
  },

  // UC-PROD-08: Khôi phục sản phẩm - PATCH /api/v1/products/{sku}/restore
  async restoreProduct(
    sku: string
  ): Promise<ApiSuccessResponse<{ sku: string; status: 'ACTIVE' }>> {
    return apiRequest<{ sku: string; status: 'ACTIVE' }>(
      `/products/${encodeURIComponent(sku)}/restore`,
      { method: 'PATCH' },
      () => {
        const products = mockDb.getProducts()
        const target = products.find(
          (p) => p.sku.toLowerCase() === sku.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_NOT_FOUND',
            message: 'Không tìm thấy sản phẩm',
          })
        }

        target.status = 'ACTIVE'
        mockDb.saveProducts(products)

        return {
          success: true,
          message: 'Khôi phục sản phẩm thành công',
          data: {
            sku: target.sku,
            status: 'ACTIVE',
          },
        }
      }
    )
  },

  // UC-PROD-09: Tải lên hình ảnh sản phẩm - POST /api/v1/products/{sku}/images
  async uploadProductImages(
    sku: string,
    files: File[]
  ): Promise<
    ApiSuccessResponse<{ sku: string; images: ProductImageItem[] }>
  > {
    if (
      !files ||
      files.length === 0 ||
      files.length > MAX_FILES_PER_UPLOAD ||
      files.some(
        (f) =>
          !ALLOWED_IMAGE_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE_BYTES
      )
    ) {
      throw new ApiClientError(422, {
        success: false,
        errorCode: 'COMMON_VALIDATION_FAILED',
        message: 'File không đúng định dạng hoặc vượt quá dung lượng',
      })
    }

    const formData = new FormData()
    files.forEach((f) => {
      formData.append('files', f)
    })

    return apiRequest<{ sku: string; images: ProductImageItem[] }>(
      `/products/${encodeURIComponent(sku)}/images`,
      {
        method: 'POST',
        body: formData,
      },
      async () => {
        const products = mockDb.getProducts()
        const target = products.find(
          (p) => p.sku.toLowerCase() === sku.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_NOT_FOUND',
            message: 'Không tìm thấy sản phẩm',
          })
        }

        const existingImages = normalizeProductImages(
          target.images,
          target.imageUrl
        )
        const maxImageId = existingImages.reduce(
          (max, img) => Math.max(max, img.imageId),
          0
        )

        const dataUrls = await Promise.all(files.map(readFileAsDataUrl))
        const uploadedImages: ProductImageItem[] = dataUrls.map((url, idx) => ({
          imageId: maxImageId + idx + 1,
          url,
        }))

        const updatedImages = [...existingImages, ...uploadedImages]
        target.images = updatedImages
        target.imageUrl = updatedImages[0]?.url ?? null
        mockDb.saveProducts(products)

        return {
          success: true,
          message: 'Tải lên hình ảnh thành công',
          data: {
            sku: target.sku,
            images: updatedImages,
          },
        }
      }
    )
  },

  // UC-PROD-10: Xóa hình ảnh sản phẩm - DELETE /api/v1/products/{sku}/images/{imageId}
  async deleteProductImage(
    sku: string,
    imageId: number
  ): Promise<ApiSuccessResponse<null>> {
    return apiRequest<null>(
      `/products/${encodeURIComponent(sku)}/images/${imageId}`,
      { method: 'DELETE' },
      () => {
        const products = mockDb.getProducts()
        const target = products.find(
          (p) => p.sku.toLowerCase() === sku.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_NOT_FOUND',
            message: 'Không tìm thấy sản phẩm',
          })
        }

        const existingImages = normalizeProductImages(
          target.images,
          target.imageUrl
        )
        const exists = existingImages.some((img) => img.imageId === imageId)
        if (!exists) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_IMAGE_NOT_FOUND',
            message: 'Không tìm thấy hình ảnh',
          })
        }

        const remaining = existingImages.filter(
          (img) => img.imageId !== imageId
        )
        target.images = remaining
        target.imageUrl = remaining[0]?.url ?? null
        mockDb.saveProducts(products)

        return {
          success: true,
          message: 'Xóa hình ảnh thành công',
          data: null,
        }
      }
    )
  },

  // UC-PROD-11: Xem danh sách danh mục - GET /api/v1/categories
  async getCategories(
    params: GetCategoriesParams = {}
  ): Promise<ApiSuccessResponse<PaginatedData<CategoryItem>>> {
    const query = new URLSearchParams()
    if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
    if (params.status && params.status !== 'ALL') {
      query.set('status', params.status)
    }
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))

    const qs = query.toString()
    const res = await apiRequest<PaginatedData<CategoryItem>>(
      `/categories${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      () => {
        let all = mockDb.getCategories().map(enrichCategory)

        if (params.keyword?.trim()) {
          const kw = params.keyword.trim().toLowerCase()
          all = all.filter(
            (c) =>
              c.categoryCode.toLowerCase().includes(kw) ||
              c.categoryName.toLowerCase().includes(kw)
          )
        }

        if (params.status && params.status !== 'ALL') {
          all = all.filter((c) => c.status === params.status)
        }

        const page = params.page ?? 1
        const pageSize = params.pageSize ?? 20
        const start = (page - 1) * pageSize
        const items = all.slice(start, start + pageSize)

        return {
          success: true,
          message: 'Lấy danh sách danh mục thành công',
          data: {
            items,
            page,
            pageSize,
            totalItems: all.length,
          },
        }
      }
    )

    const rawItems = Array.isArray(res.data)
      ? (res.data as unknown as CategoryItem[])
      : res.data.items || []

    return {
      ...res,
      data: {
        items: rawItems.map(enrichCategory),
        page: res.data.page ?? (params.page || 1),
        pageSize: res.data.pageSize ?? (params.pageSize || 20),
        totalItems: res.data.totalItems ?? rawItems.length,
      },
    }
  },

  // UC-PROD-12: Xem chi tiết danh mục - GET /api/v1/categories/{categoryCode}
  async getCategoryDetail(
    categoryCode: string
  ): Promise<ApiSuccessResponse<CategoryItem>> {
    const res = await apiRequest<CategoryItem>(
      `/categories/${encodeURIComponent(categoryCode)}`,
      { method: 'GET' },
      () => {
        const categories = mockDb.getCategories()
        const found = categories.find(
          (c) =>
            c.categoryCode.toLowerCase() === categoryCode.trim().toLowerCase()
        )
        if (!found) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_CATEGORY_NOT_FOUND',
            message: 'Không tìm thấy danh mục',
          })
        }
        return {
          success: true,
          message: 'Lấy thông tin thành công',
          data: enrichCategory(found),
        }
      }
    )

    return {
      ...res,
      data: enrichCategory(res.data),
    }
  },

  // UC-PROD-02: Thêm danh mục - POST /api/v1/categories
  async createCategory(
    payload: CreateCategoryRequest
  ): Promise<ApiSuccessResponse<CategoryItem>> {
    const requestBody: CreateCategoryRequest = {
      categoryCode: payload.categoryCode?.trim().toUpperCase(),
      categoryName: payload.categoryName?.trim(),
      description: payload.description?.trim() || undefined,
    }

    return apiRequest<CategoryItem>(
      '/categories',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (!requestBody.categoryCode || !requestBody.categoryName) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Thiếu thông tin bắt buộc',
          })
        }

        const categories = mockDb.getCategories()
        const duplicate = categories.find(
          (c) =>
            c.categoryCode.toLowerCase() ===
            requestBody.categoryCode.toLowerCase()
        )
        if (duplicate) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROD_CATEGORY_DUPLICATED',
            message: 'Mã danh mục đã tồn tại',
          })
        }

        const created: CategoryItem = {
          id: categories.length + 1,
          categoryCode: requestBody.categoryCode,
          categoryName: requestBody.categoryName,
          description: requestBody.description,
          status: 'ACTIVE',
          productCount: 0,
        }

        mockDb.saveCategories([created, ...categories])

        return {
          success: true,
          message: 'Thêm danh mục thành công',
          data: created,
        }
      }
    )
  },

  // UC-PROD-13: Cập nhật danh mục - PUT /api/v1/categories/{categoryCode}
  async updateCategory(
    categoryCode: string,
    payload: UpdateCategoryRequest
  ): Promise<ApiSuccessResponse<CategoryItem>> {
    const requestBody: UpdateCategoryRequest = {
      categoryName: payload.categoryName?.trim(),
      description: payload.description?.trim() || undefined,
    }

    return apiRequest<CategoryItem>(
      `/categories/${encodeURIComponent(categoryCode)}`,
      {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (!requestBody.categoryName) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Thiếu thông tin bắt buộc',
          })
        }

        const categories = mockDb.getCategories()
        const target = categories.find(
          (c) =>
            c.categoryCode.toLowerCase() === categoryCode.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_CATEGORY_NOT_FOUND',
            message: 'Không tìm thấy danh mục',
          })
        }

        target.categoryName = requestBody.categoryName
        target.description = requestBody.description
        mockDb.saveCategories(categories)

        return {
          success: true,
          message: 'Cập nhật danh mục thành công',
          data: enrichCategory(target),
        }
      }
    )
  },

  // UC-PROD-14: Ngừng sử dụng danh mục - PATCH /api/v1/categories/{categoryCode}/deactivate
  async deactivateCategory(
    categoryCode: string
  ): Promise<
    ApiSuccessResponse<{ categoryCode: string; status: 'INACTIVE' }>
  > {
    return apiRequest<{ categoryCode: string; status: 'INACTIVE' }>(
      `/categories/${encodeURIComponent(categoryCode)}/deactivate`,
      { method: 'PATCH' },
      () => {
        const categories = mockDb.getCategories()
        const target = categories.find(
          (c) =>
            c.categoryCode.toLowerCase() === categoryCode.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_CATEGORY_NOT_FOUND',
            message: 'Không tìm thấy danh mục',
          })
        }

        const hasActiveProducts = mockDb
          .getProducts()
          .some(
            (p) =>
              p.categoryCode.toLowerCase() ===
                target.categoryCode.toLowerCase() && p.status === 'ACTIVE'
          )
        if (hasActiveProducts) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROD_CATEGORY_HAS_PRODUCTS',
            message:
              'Danh mục còn sản phẩm đang kinh doanh, không thể ngừng sử dụng',
          })
        }

        target.status = 'INACTIVE'
        mockDb.saveCategories(categories)

        return {
          success: true,
          message: 'Ngừng sử dụng danh mục thành công',
          data: {
            categoryCode: target.categoryCode,
            status: 'INACTIVE',
          },
        }
      }
    )
  },

  // UC-PROD-15: Khôi phục danh mục - PATCH /api/v1/categories/{categoryCode}/restore
  async restoreCategory(
    categoryCode: string
  ): Promise<ApiSuccessResponse<{ categoryCode: string; status: 'ACTIVE' }>> {
    return apiRequest<{ categoryCode: string; status: 'ACTIVE' }>(
      `/categories/${encodeURIComponent(categoryCode)}/restore`,
      { method: 'PATCH' },
      () => {
        const categories = mockDb.getCategories()
        const target = categories.find(
          (c) =>
            c.categoryCode.toLowerCase() === categoryCode.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_CATEGORY_NOT_FOUND',
            message: 'Không tìm thấy danh mục',
          })
        }

        target.status = 'ACTIVE'
        mockDb.saveCategories(categories)

        return {
          success: true,
          message: 'Khôi phục danh mục thành công',
          data: {
            categoryCode: target.categoryCode,
            status: 'ACTIVE',
          },
        }
      }
    )
  },

  // UC-PROD-16: Xem danh sách thương hiệu - GET /api/v1/brands
  async getBrands(
    params: GetBrandsParams = {}
  ): Promise<ApiSuccessResponse<PaginatedData<BrandItem>>> {
    const query = new URLSearchParams()
    if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
    if (params.status && params.status !== 'ALL') {
      query.set('status', params.status)
    }
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))

    const qs = query.toString()
    const res = await apiRequest<PaginatedData<BrandItem>>(
      `/brands${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      () => {
        let all = mockDb.getBrands().map(enrichBrand)

        if (params.keyword?.trim()) {
          const kw = params.keyword.trim().toLowerCase()
          all = all.filter(
            (b) =>
              b.brandCode.toLowerCase().includes(kw) ||
              b.brandName.toLowerCase().includes(kw)
          )
        }

        if (params.status && params.status !== 'ALL') {
          all = all.filter((b) => b.status === params.status)
        }

        const page = params.page ?? 1
        const pageSize = params.pageSize ?? 20
        const start = (page - 1) * pageSize
        const items = all.slice(start, start + pageSize)

        return {
          success: true,
          message: 'Lấy danh sách thương hiệu thành công',
          data: {
            items,
            page,
            pageSize,
            totalItems: all.length,
          },
        }
      }
    )

    const rawItems = Array.isArray(res.data)
      ? (res.data as unknown as BrandItem[])
      : res.data.items || []

    return {
      ...res,
      data: {
        items: rawItems.map(enrichBrand),
        page: res.data.page ?? (params.page || 1),
        pageSize: res.data.pageSize ?? (params.pageSize || 20),
        totalItems: res.data.totalItems ?? rawItems.length,
      },
    }
  },

  // UC-PROD-17: Xem chi tiết thương hiệu - GET /api/v1/brands/{brandCode}
  async getBrandDetail(
    brandCode: string
  ): Promise<ApiSuccessResponse<BrandItem>> {
    const res = await apiRequest<BrandItem>(
      `/brands/${encodeURIComponent(brandCode)}`,
      { method: 'GET' },
      () => {
        const brands = mockDb.getBrands()
        const found = brands.find(
          (b) => b.brandCode.toLowerCase() === brandCode.trim().toLowerCase()
        )
        if (!found) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_BRAND_NOT_FOUND',
            message: 'Không tìm thấy thương hiệu',
          })
        }
        return {
          success: true,
          message: 'Lấy thông tin thành công',
          data: enrichBrand(found),
        }
      }
    )

    return {
      ...res,
      data: enrichBrand(res.data),
    }
  },

  // UC-PROD-03: Thêm thương hiệu - POST /api/v1/brands
  async createBrand(
    payload: CreateBrandRequest
  ): Promise<ApiSuccessResponse<BrandItem>> {
    const requestBody: CreateBrandRequest = {
      brandCode: payload.brandCode?.trim().toUpperCase(),
      brandName: payload.brandName?.trim(),
      description: payload.description?.trim() || undefined,
    }

    return apiRequest<BrandItem>(
      '/brands',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (!requestBody.brandCode || !requestBody.brandName) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Thiếu thông tin bắt buộc',
          })
        }

        const brands = mockDb.getBrands()
        const duplicate = brands.find(
          (b) =>
            b.brandCode.toLowerCase() === requestBody.brandCode.toLowerCase()
        )
        if (duplicate) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROD_BRAND_DUPLICATED',
            message: 'Mã thương hiệu đã tồn tại',
          })
        }

        const created: BrandItem = {
          id: brands.length + 1,
          brandCode: requestBody.brandCode,
          brandName: requestBody.brandName,
          description: requestBody.description,
          productCount: 0,
          status: 'ACTIVE',
        }

        mockDb.saveBrands([created, ...brands])

        return {
          success: true,
          message: 'Thêm thương hiệu thành công',
          data: created,
        }
      }
    )
  },

  // UC-PROD-18: Cập nhật thương hiệu - PUT /api/v1/brands/{brandCode}
  async updateBrand(
    brandCode: string,
    payload: UpdateBrandRequest
  ): Promise<ApiSuccessResponse<BrandItem>> {
    const requestBody: UpdateBrandRequest = {
      brandName: payload.brandName?.trim(),
      description: payload.description?.trim() || undefined,
    }

    return apiRequest<BrandItem>(
      `/brands/${encodeURIComponent(brandCode)}`,
      {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      },
      () => {
        if (!requestBody.brandName) {
          throw new ApiClientError(422, {
            success: false,
            errorCode: 'COMMON_VALIDATION_FAILED',
            message: 'Thiếu thông tin bắt buộc',
          })
        }

        const brands = mockDb.getBrands()
        const target = brands.find(
          (b) => b.brandCode.toLowerCase() === brandCode.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_BRAND_NOT_FOUND',
            message: 'Không tìm thấy thương hiệu',
          })
        }

        target.brandName = requestBody.brandName
        target.description = requestBody.description
        mockDb.saveBrands(brands)

        return {
          success: true,
          message: 'Cập nhật thương hiệu thành công',
          data: enrichBrand(target),
        }
      }
    )
  },

  // UC-PROD-19: Ngừng sử dụng thương hiệu - PATCH /api/v1/brands/{brandCode}/deactivate
  async deactivateBrand(
    brandCode: string
  ): Promise<ApiSuccessResponse<{ brandCode: string; status: 'INACTIVE' }>> {
    return apiRequest<{ brandCode: string; status: 'INACTIVE' }>(
      `/brands/${encodeURIComponent(brandCode)}/deactivate`,
      { method: 'PATCH' },
      () => {
        const brands = mockDb.getBrands()
        const target = brands.find(
          (b) => b.brandCode.toLowerCase() === brandCode.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_BRAND_NOT_FOUND',
            message: 'Không tìm thấy thương hiệu',
          })
        }

        const hasActiveProducts = mockDb
          .getProducts()
          .some(
            (p) =>
              p.brandCode.toLowerCase() === target.brandCode.toLowerCase() &&
              p.status === 'ACTIVE'
          )
        if (hasActiveProducts) {
          throw new ApiClientError(409, {
            success: false,
            errorCode: 'PROD_BRAND_HAS_PRODUCTS',
            message:
              'Thương hiệu còn sản phẩm đang kinh doanh, không thể ngừng sử dụng',
          })
        }

        target.status = 'INACTIVE'
        mockDb.saveBrands(brands)

        return {
          success: true,
          message: 'Ngừng sử dụng thương hiệu thành công',
          data: {
            brandCode: target.brandCode,
            status: 'INACTIVE',
          },
        }
      }
    )
  },

  // UC-PROD-20: Khôi phục thương hiệu - PATCH /api/v1/brands/{brandCode}/restore
  async restoreBrand(
    brandCode: string
  ): Promise<ApiSuccessResponse<{ brandCode: string; status: 'ACTIVE' }>> {
    return apiRequest<{ brandCode: string; status: 'ACTIVE' }>(
      `/brands/${encodeURIComponent(brandCode)}/restore`,
      { method: 'PATCH' },
      () => {
        const brands = mockDb.getBrands()
        const target = brands.find(
          (b) => b.brandCode.toLowerCase() === brandCode.trim().toLowerCase()
        )
        if (!target) {
          throw new ApiClientError(404, {
            success: false,
            errorCode: 'PROD_BRAND_NOT_FOUND',
            message: 'Không tìm thấy thương hiệu',
          })
        }

        target.status = 'ACTIVE'
        mockDb.saveBrands(brands)

        return {
          success: true,
          message: 'Khôi phục thương hiệu thành công',
          data: {
            brandCode: target.brandCode,
            status: 'ACTIVE',
          },
        }
      }
    )
  },
}
