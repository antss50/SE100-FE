import { z } from 'zod'
import type { BrandItem, CategoryItem, ProductImageItem, ProductItem } from '../../types/api'
import { normalizeProductImages } from '../../utils/product'
import type { MockTransaction } from '../db'
import { MockHttpError, keywordOf, notFound, ok, paginate, parseBody, sameText } from '../http'
import type { MockRoute } from '../router'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILES_PER_UPLOAD = 5
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

const skinTypes = ['ALL_SKIN_TYPES', 'OILY', 'DRY', 'COMBINATION', 'SENSITIVE', 'NORMAL'] as const

const productFields = {
  productName: z.string().trim().min(1, 'Vui lòng nhập tên sản phẩm'),
  categoryCode: z.string().trim().min(1, 'Vui lòng chọn danh mục'),
  brandCode: z.string().trim().min(1, 'Vui lòng chọn thương hiệu'),
  unit: z.string().trim().min(1, 'Vui lòng nhập đơn vị tính'),
  volume: z.string().trim().optional(),
  skinType: z.union([z.enum(skinTypes), z.array(z.enum(skinTypes)).min(1)]).optional(),
  retailPrice: z.number({ error: 'Giá bán phải là số' }).positive('Giá bán phải lớn hơn 0'),
  taxRate: z.number({ error: 'Thuế suất phải là số' }).min(0, 'Thuế suất không được âm'),
  minStockAlert: z.number().int().min(0).optional(),
  barcode: z.string().trim().optional(),
  packagingDetail: z.string().optional(),
  shelfLifeMonths: z.number().int().positive().optional(),
  description: z.string().optional(),
}

const createProductSchema = z.object({
  ...productFields,
  sku: z.string().trim().min(1, 'Vui lòng nhập SKU'),
  images: z.array(z.string()).optional(),
})
const updateProductSchema = z.object(productFields)

const codeNameSchema = (codeKey: 'categoryCode' | 'brandCode', nameKey: 'categoryName' | 'brandName') => ({
  create: z.object({
    [codeKey]: z.string().trim().min(1, 'Vui lòng nhập mã'),
    [nameKey]: z.string().trim().min(1, 'Vui lòng nhập tên'),
    description: z.string().trim().optional(),
  }),
  update: z.object({
    [nameKey]: z.string().trim().min(1, 'Vui lòng nhập tên'),
    description: z.string().trim().optional(),
  }),
})
const categorySchemas = codeNameSchema('categoryCode', 'categoryName')
const brandSchemas = codeNameSchema('brandCode', 'brandName')

function withNames(db: MockTransaction, p: ProductItem): ProductItem {
  const cat = db.read('categories').find((c) => c.categoryCode === p.categoryCode)
  const brand = db.read('brands').find((b) => b.brandCode === p.brandCode)
  const images = normalizeProductImages(p.images, p.imageUrl)
  return {
    ...p,
    categoryName: cat?.categoryName ?? p.categoryCode,
    brandName: brand?.brandName ?? p.brandCode,
    images,
    imageUrl: p.imageUrl !== undefined ? p.imageUrl : (images[0]?.url ?? null),
  }
}

const activeCount = (db: MockTransaction, match: (p: ProductItem) => boolean) =>
  db.read('products').filter((p) => p.status === 'ACTIVE' && match(p)).length

const withCategoryCount = (db: MockTransaction, c: CategoryItem): CategoryItem => ({
  ...c,
  status: c.status || 'ACTIVE',
  productCount: c.productCount ?? activeCount(db, (p) => p.categoryCode === c.categoryCode),
})

const withBrandCount = (db: MockTransaction, b: BrandItem): BrandItem => ({
  ...b,
  status: b.status || 'ACTIVE',
  productCount: b.productCount ?? activeCount(db, (p) => p.brandCode === b.brandCode),
})

function findProduct(db: MockTransaction, sku: string): ProductItem {
  const found = db.read('products').find((p) => sameText(p.sku, sku))
  if (!found) throw notFound('PROD_NOT_FOUND', 'Không tìm thấy sản phẩm')
  return found
}

function findCategory(db: MockTransaction, code: string): CategoryItem {
  const found = db.read('categories').find((c) => sameText(c.categoryCode, code))
  if (!found) throw notFound('PROD_CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục')
  return found
}

function findBrand(db: MockTransaction, code: string): BrandItem {
  const found = db.read('brands').find((b) => sameText(b.brandCode, code))
  if (!found) throw notFound('PROD_BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu')
  return found
}

function assertBarcodeUnique(db: MockTransaction, barcode: string | undefined, exceptSku?: string) {
  if (!barcode) return
  if (db.read('products').some((p) => p.barcode === barcode && !sameText(p.sku, exceptSku))) {
    throw new MockHttpError(409, 'PROD_BARCODE_DUPLICATED', 'Mã vạch đã tồn tại')
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Không đọc được tệp'))
    reader.onerror = () => reject(new Error('Không đọc được tệp'))
    reader.readAsDataURL(file)
  })
}

const productRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/products',
    permission: 'PRODUCT_VIEW',
    handler: ({ db, query }) => {
      const kw = keywordOf(query)
      const brandCode = query.get('brandCode')
      const categoryCode = query.get('categoryCode')
      const status = query.get('status')
      const items = db
        .read('products')
        .map((p) => withNames(db, p))
        .filter(
          (p) =>
            (!kw ||
              [p.productName, p.sku, p.barcode ?? '', p.brandName ?? ''].some((v) => v.toLowerCase().includes(kw))) &&
            (!brandCode || p.brandCode === brandCode) &&
            (!categoryCode || p.categoryCode === categoryCode) &&
            (!status ||
              (status === 'LOW_STOCK' ? (p.currentStock ?? 0) <= (p.minStockAlert ?? 10) : p.status === status))
        )
      return ok(paginate(items, query), 'Lấy danh sách sản phẩm thành công')
    },
  },
  {
    method: 'GET',
    path: '/products/:sku',
    permission: 'PRODUCT_VIEW',
    handler: ({ db, params }) => ok(withNames(db, findProduct(db, params.sku))),
  },
  {
    method: 'POST',
    path: '/products',
    permission: 'PRODUCT_MANAGE',
    handler: ({ db, body }) => {
      const input = parseBody(createProductSchema, body)
      const products = db.read('products')
      if (products.some((p) => sameText(p.sku, input.sku))) {
        throw new MockHttpError(409, 'PROD_SKU_DUPLICATED', 'SKU đã tồn tại')
      }
      findCategory(db, input.categoryCode)
      findBrand(db, input.brandCode)
      assertBarcodeUnique(db, input.barcode)
      const images: ProductImageItem[] = (input.images ?? []).map((url, idx) => ({ imageId: idx + 1, url }))
      const created: ProductItem = {
        id: products.reduce((max, p) => Math.max(max, p.id ?? 0), 0) + 1,
        sku: input.sku.toUpperCase(),
        productName: input.productName,
        categoryCode: input.categoryCode,
        brandCode: input.brandCode,
        unit: input.unit,
        volume: input.volume,
        skinType: input.skinType ?? 'ALL_SKIN_TYPES',
        retailPrice: input.retailPrice,
        taxRate: input.taxRate,
        minStockAlert: input.minStockAlert ?? 5,
        currentStock: 0,
        isSellable: true,
        barcode: input.barcode || undefined,
        images,
        imageUrl: images[0]?.url ?? null,
        packagingDetail: input.packagingDetail,
        shelfLifeMonths: input.shelfLifeMonths,
        description: input.description,
        status: 'ACTIVE',
      }
      db.write('products', [created, ...products])
      return ok(withNames(db, created), 'Thêm sản phẩm thành công', 201)
    },
  },
  {
    method: 'PUT',
    path: '/products/:sku',
    permission: 'PRODUCT_MANAGE',
    handler: ({ db, params, body }) => {
      const input = parseBody(updateProductSchema, body)
      const target = findProduct(db, params.sku)
      findCategory(db, input.categoryCode)
      findBrand(db, input.brandCode)
      assertBarcodeUnique(db, input.barcode, target.sku)
      Object.assign(target, {
        ...input,
        barcode: input.barcode || undefined,
        skinType: input.skinType ?? target.skinType,
        minStockAlert: input.minStockAlert ?? target.minStockAlert,
        packagingDetail: input.packagingDetail ?? target.packagingDetail,
        shelfLifeMonths: input.shelfLifeMonths ?? target.shelfLifeMonths,
        description: input.description ?? target.description,
      })
      db.touch('products')
      return ok(withNames(db, target), 'Cập nhật sản phẩm thành công')
    },
  },
  {
    method: 'PATCH',
    path: '/products/:sku/deactivate',
    permission: 'PRODUCT_MANAGE',
    handler: ({ db, params }) => {
      const target = findProduct(db, params.sku)
      if ((target.currentStock ?? 0) > 0) {
        throw new MockHttpError(409, 'PROD_HAS_STOCK', 'Sản phẩm còn tồn kho, không thể ngừng kinh doanh')
      }
      target.status = 'DISCONTINUED'
      db.touch('products')
      return ok({ sku: target.sku, status: 'DISCONTINUED' as const }, 'Ngừng kinh doanh sản phẩm thành công')
    },
  },
  {
    method: 'PATCH',
    path: '/products/:sku/restore',
    permission: 'PRODUCT_MANAGE',
    handler: ({ db, params }) => {
      const target = findProduct(db, params.sku)
      target.status = 'ACTIVE'
      db.touch('products')
      return ok({ sku: target.sku, status: 'ACTIVE' as const }, 'Khôi phục sản phẩm thành công')
    },
  },
  {
    method: 'POST',
    path: '/products/:sku/images',
    permission: 'PRODUCT_MANAGE',
    handler: async ({ db, params, body }) => {
      const files = body instanceof FormData ? body.getAll('files').filter((f): f is File => f instanceof File) : []
      if (
        files.length === 0 ||
        files.length > MAX_FILES_PER_UPLOAD ||
        files.some((f) => !ALLOWED_IMAGE_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE_BYTES)
      ) {
        throw new MockHttpError(422, 'PROD_IMAGE_INVALID', 'File không đúng định dạng hoặc vượt quá dung lượng')
      }
      const target = findProduct(db, params.sku)
      const existing = normalizeProductImages(target.images, target.imageUrl)
      const maxId = existing.reduce((max, img) => Math.max(max, img.imageId), 0)
      const urls = await Promise.all(files.map(readFileAsDataUrl))
      const images = [...existing, ...urls.map((url, idx) => ({ imageId: maxId + idx + 1, url }))]
      target.images = images
      target.imageUrl = images[0]?.url ?? null
      db.touch('products')
      return ok({ sku: target.sku, images }, 'Tải lên hình ảnh thành công', 201)
    },
  },
  {
    method: 'DELETE',
    path: '/products/:sku/images/:imageId',
    permission: 'PRODUCT_MANAGE',
    handler: ({ db, params }) => {
      const target = findProduct(db, params.sku)
      const existing = normalizeProductImages(target.images, target.imageUrl)
      const imageId = Number(params.imageId)
      if (!existing.some((img) => img.imageId === imageId)) {
        throw notFound('PROD_IMAGE_NOT_FOUND', 'Không tìm thấy hình ảnh')
      }
      const remaining = existing.filter((img) => img.imageId !== imageId)
      target.images = remaining
      target.imageUrl = remaining[0]?.url ?? null
      db.touch('products')
      return ok(null, 'Xóa hình ảnh thành công')
    },
  },
]

interface CodeNameEntity {
  id?: number
  status?: 'ACTIVE' | 'INACTIVE'
  description?: string
  productCount?: number
}

/** Danh mục và thương hiệu có cùng bộ API: danh sách, chi tiết, thêm, sửa, ngừng, khôi phục. */
function codeNameRoutes<T extends CodeNameEntity>(cfg: {
  resource: '/categories' | '/brands'
  table: 'categories' | 'brands'
  codeKey: 'categoryCode' | 'brandCode'
  nameKey: 'categoryName' | 'brandName'
  label: string
  errorPrefix: 'PROD_CATEGORY' | 'PROD_BRAND'
  schemas: { create: z.ZodType; update: z.ZodType }
  find: (db: MockTransaction, code: string) => T
  withCount: (db: MockTransaction, item: T) => T
  productKey: 'categoryCode' | 'brandCode'
}): MockRoute[] {
  const code = (item: T) => String((item as unknown as Record<string, string>)[cfg.codeKey])
  const rows = (db: MockTransaction) => db.read(cfg.table) as unknown as T[]
  return [
    {
      method: 'GET',
      path: cfg.resource,
      permission: 'PRODUCT_VIEW',
      handler: ({ db, query }) => {
        const kw = keywordOf(query)
        const status = query.get('status')
        const items = rows(db)
          .map((item) => cfg.withCount(db, item))
          .filter((item) => {
            const rec = item as unknown as Record<string, string>
            return (
              (!kw || [rec[cfg.codeKey], rec[cfg.nameKey]].some((v) => v.toLowerCase().includes(kw))) &&
              (!status || item.status === status)
            )
          })
        return ok(paginate(items, query), `Lấy danh sách ${cfg.label} thành công`)
      },
    },
    {
      method: 'GET',
      path: `${cfg.resource}/:code`,
      permission: 'PRODUCT_VIEW',
      handler: ({ db, params }) => ok(cfg.withCount(db, cfg.find(db, params.code))),
    },
    {
      method: 'POST',
      path: cfg.resource,
      permission: 'PRODUCT_MANAGE',
      handler: ({ db, body }) => {
        const input = parseBody(cfg.schemas.create, body) as Record<string, string | undefined>
        const newCode = String(input[cfg.codeKey]).toUpperCase()
        const list = rows(db)
        if (list.some((item) => sameText(code(item), newCode))) {
          throw new MockHttpError(409, `${cfg.errorPrefix}_DUPLICATED`, `Mã ${cfg.label} đã tồn tại`)
        }
        const created = {
          id: list.reduce((max, item) => Math.max(max, item.id ?? 0), 0) + 1,
          [cfg.codeKey]: newCode,
          [cfg.nameKey]: input[cfg.nameKey],
          description: input.description || undefined,
          status: 'ACTIVE',
          productCount: 0,
        } as unknown as T
        db.write(cfg.table, [created, ...list] as never)
        return ok(created, `Thêm ${cfg.label} thành công`, 201)
      },
    },
    {
      method: 'PUT',
      path: `${cfg.resource}/:code`,
      permission: 'PRODUCT_MANAGE',
      handler: ({ db, params, body }) => {
        const input = parseBody(cfg.schemas.update, body) as Record<string, string | undefined>
        const target = cfg.find(db, params.code)
        Object.assign(target, { [cfg.nameKey]: input[cfg.nameKey], description: input.description || undefined })
        db.touch(cfg.table)
        return ok(cfg.withCount(db, target), `Cập nhật ${cfg.label} thành công`)
      },
    },
    {
      method: 'PATCH',
      path: `${cfg.resource}/:code/deactivate`,
      permission: 'PRODUCT_MANAGE',
      handler: ({ db, params }) => {
        const target = cfg.find(db, params.code)
        const inUse = db
          .read('products')
          .some((p) => p.status === 'ACTIVE' && sameText(p[cfg.productKey], code(target)))
        if (inUse) {
          throw new MockHttpError(
            409,
            `${cfg.errorPrefix}_HAS_PRODUCTS`,
            `${cfg.label[0].toUpperCase()}${cfg.label.slice(1)} còn sản phẩm đang kinh doanh, không thể ngừng sử dụng`
          )
        }
        target.status = 'INACTIVE'
        db.touch(cfg.table)
        return ok({ [cfg.codeKey]: code(target), status: 'INACTIVE' }, `Ngừng sử dụng ${cfg.label} thành công`)
      },
    },
    {
      method: 'PATCH',
      path: `${cfg.resource}/:code/restore`,
      permission: 'PRODUCT_MANAGE',
      handler: ({ db, params }) => {
        const target = cfg.find(db, params.code)
        target.status = 'ACTIVE'
        db.touch(cfg.table)
        return ok({ [cfg.codeKey]: code(target), status: 'ACTIVE' }, `Khôi phục ${cfg.label} thành công`)
      },
    },
  ]
}

export const catalogRoutes: MockRoute[] = [
  ...productRoutes,
  ...codeNameRoutes<CategoryItem>({
    resource: '/categories',
    table: 'categories',
    codeKey: 'categoryCode',
    nameKey: 'categoryName',
    label: 'danh mục',
    errorPrefix: 'PROD_CATEGORY',
    schemas: categorySchemas,
    find: findCategory,
    withCount: withCategoryCount,
    productKey: 'categoryCode',
  }),
  ...codeNameRoutes<BrandItem>({
    resource: '/brands',
    table: 'brands',
    codeKey: 'brandCode',
    nameKey: 'brandName',
    label: 'thương hiệu',
    errorPrefix: 'PROD_BRAND',
    schemas: brandSchemas,
    find: findBrand,
    withCount: withBrandCount,
    productKey: 'brandCode',
  }),
]
