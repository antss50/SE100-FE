import { ApiClientError, apiRequest } from '../lib/api-client'
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
import { toQueryString } from './query'

export { normalizeProductImages, parsePackagingSpec } from '../utils/product'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILES_PER_UPLOAD = 5
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

const seg = (value: string) => encodeURIComponent(value.trim())
const get = <T>(url: string) => apiRequest<T>(url, { method: 'GET' })
const send = <T>(method: string, url: string, body?: unknown) =>
  apiRequest<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })

type StatusChange<K extends string, S> = Record<K, string> & { status: S }

function productBody(payload: UpdateProductRequest) {
  return {
    productName: payload.productName?.trim(),
    categoryCode: payload.categoryCode?.trim(),
    brandCode: payload.brandCode?.trim(),
    unit: payload.unit?.trim(),
    volume: payload.volume?.trim() || undefined,
    skinType: payload.skinType || 'ALL_SKIN_TYPES',
    retailPrice: Number(payload.retailPrice),
    taxRate: Number(payload.taxRate),
    minStockAlert: payload.minStockAlert !== undefined ? Number(payload.minStockAlert) : undefined,
    barcode: payload.barcode?.trim() || undefined,
    packagingDetail: payload.packagingDetail,
    shelfLifeMonths: payload.shelfLifeMonths,
    shelfLifeValue: payload.shelfLifeValue,
    shelfLifeUnit: payload.shelfLifeUnit,
    expiryWarningDays: payload.expiryWarningDays,
    expiryWarningValue: payload.expiryWarningValue,
    expiryWarningUnit: payload.expiryWarningUnit,
    description: payload.description,
  }
}

export const productsService = {
  /** PROD-01: GET /products */
  getProducts(params: GetProductsParams = {}): Promise<ApiSuccessResponse<PaginatedData<ProductItem>>> {
    return get(`/products${toQueryString(params)}`)
  },

  /** PROD-01: GET /products/{sku} */
  getProductDetail(sku: string): Promise<ApiSuccessResponse<ProductItem>> {
    return get(`/products/${seg(sku)}`)
  },

  /** PROD-01: POST /products */
  createProduct(payload: CreateProductRequest): Promise<ApiSuccessResponse<ProductItem>> {
    return send('POST', '/products', {
      ...productBody(payload),
      sku: payload.sku?.trim(),
      images: payload.images && payload.images.length > 0 ? payload.images : undefined,
    })
  },

  /** PROD-01: PUT /products/{sku} */
  updateProduct(sku: string, payload: UpdateProductRequest): Promise<ApiSuccessResponse<ProductItem>> {
    return send('PUT', `/products/${seg(sku)}`, productBody(payload))
  },

  /** PROD-01: PATCH /products/{sku}/deactivate */
  deactivateProduct(sku: string): Promise<ApiSuccessResponse<StatusChange<'sku', 'DISCONTINUED'>>> {
    return send('PATCH', `/products/${seg(sku)}/deactivate`)
  },

  /** PROD-01: PATCH /products/{sku}/restore */
  restoreProduct(sku: string): Promise<ApiSuccessResponse<StatusChange<'sku', 'ACTIVE'>>> {
    return send('PATCH', `/products/${seg(sku)}/restore`)
  },

  /** PROD-01: POST /products/{sku}/images (multipart, trường `files`) */
  uploadProductImages(
    sku: string,
    files: File[]
  ): Promise<ApiSuccessResponse<{ sku: string; images: ProductImageItem[] }>> {
    if (
      files.length === 0 ||
      files.length > MAX_FILES_PER_UPLOAD ||
      files.some((f) => !ALLOWED_IMAGE_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE_BYTES)
    ) {
      return Promise.reject(
        new ApiClientError(400, {
          success: false,
          errorCode: 'PROD_IMAGE_INVALID',
          message: 'File không đúng định dạng hoặc vượt quá dung lượng',
        })
      )
    }
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    return apiRequest(`/products/${seg(sku)}/images`, { method: 'POST', body: formData })
  },

  /** PROD-01: DELETE /products/{sku}/images/{imageId} */
  deleteProductImage(sku: string, imageId: number): Promise<ApiSuccessResponse<null>> {
    return send('DELETE', `/products/${seg(sku)}/images/${imageId}`)
  },

  /** PROD-02: GET /categories */
  getCategories(params: GetCategoriesParams = {}): Promise<ApiSuccessResponse<PaginatedData<CategoryItem>>> {
    return get(`/categories${toQueryString(params)}`)
  },

  /** PROD-02: GET /categories/{categoryCode} */
  getCategoryDetail(categoryCode: string): Promise<ApiSuccessResponse<CategoryItem>> {
    return get(`/categories/${seg(categoryCode)}`)
  },

  /** PROD-02: POST /categories */
  createCategory(payload: CreateCategoryRequest): Promise<ApiSuccessResponse<CategoryItem>> {
    return send('POST', '/categories', {
      categoryCode: payload.categoryCode?.trim().toUpperCase(),
      categoryName: payload.categoryName?.trim(),
      description: payload.description?.trim() || undefined,
    })
  },

  /** PROD-02: PUT /categories/{categoryCode} */
  updateCategory(categoryCode: string, payload: UpdateCategoryRequest): Promise<ApiSuccessResponse<CategoryItem>> {
    return send('PUT', `/categories/${seg(categoryCode)}`, {
      categoryName: payload.categoryName?.trim(),
      description: payload.description?.trim() || undefined,
    })
  },

  /** PROD-02: PATCH /categories/{categoryCode}/deactivate */
  deactivateCategory(categoryCode: string): Promise<ApiSuccessResponse<StatusChange<'categoryCode', 'INACTIVE'>>> {
    return send('PATCH', `/categories/${seg(categoryCode)}/deactivate`)
  },

  /** PROD-02: PATCH /categories/{categoryCode}/restore */
  restoreCategory(categoryCode: string): Promise<ApiSuccessResponse<StatusChange<'categoryCode', 'ACTIVE'>>> {
    return send('PATCH', `/categories/${seg(categoryCode)}/restore`)
  },

  /** PROD-03: GET /brands */
  getBrands(params: GetBrandsParams = {}): Promise<ApiSuccessResponse<PaginatedData<BrandItem>>> {
    return get(`/brands${toQueryString(params)}`)
  },

  /** PROD-03: GET /brands/{brandCode} */
  getBrandDetail(brandCode: string): Promise<ApiSuccessResponse<BrandItem>> {
    return get(`/brands/${seg(brandCode)}`)
  },

  /** PROD-03: POST /brands */
  createBrand(payload: CreateBrandRequest): Promise<ApiSuccessResponse<BrandItem>> {
    return send('POST', '/brands', {
      brandCode: payload.brandCode?.trim().toUpperCase(),
      brandName: payload.brandName?.trim(),
      description: payload.description?.trim() || undefined,
    })
  },

  /** PROD-03: PUT /brands/{brandCode} */
  updateBrand(brandCode: string, payload: UpdateBrandRequest): Promise<ApiSuccessResponse<BrandItem>> {
    return send('PUT', `/brands/${seg(brandCode)}`, {
      brandName: payload.brandName?.trim(),
      description: payload.description?.trim() || undefined,
    })
  },

  /** PROD-03: PATCH /brands/{brandCode}/deactivate */
  deactivateBrand(brandCode: string): Promise<ApiSuccessResponse<StatusChange<'brandCode', 'INACTIVE'>>> {
    return send('PATCH', `/brands/${seg(brandCode)}/deactivate`)
  },

  /** PROD-03: PATCH /brands/{brandCode}/restore */
  restoreBrand(brandCode: string): Promise<ApiSuccessResponse<StatusChange<'brandCode', 'ACTIVE'>>> {
    return send('PATCH', `/brands/${seg(brandCode)}/restore`)
  },
}
