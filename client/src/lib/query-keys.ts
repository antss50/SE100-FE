/** Khai báo tập trung query key cho TanStack Query (CLAUDE.md mục 4). */
export const queryKeys = {
  shifts: {
    all: ['shifts'] as const,
    current: ['shifts', 'current'] as const,
    list: (params: object) => ['shifts', 'list', params] as const,
    detail: (id: number | string) => ['shifts', 'detail', String(id)] as const,
  },
  promotions: {
    all: ['promotions'] as const,
    list: (params: object) => ['promotions', 'list', params] as const,
    detail: (id: number | string) => ['promotions', 'detail', String(id)] as const,
  },
  catalog: {
    forPromotions: ['catalog', 'for-promotions'] as const,
  },
  pos: {
    all: ['pos'] as const,
    products: (params: object) => ['pos', 'products', params] as const,
    lots: (productId: number) => ['pos', 'lots', productId] as const,
    drafts: ['pos', 'drafts'] as const,
    quote: (cart: object) => ['pos', 'quote', cart] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (params: object) => ['orders', 'list', params] as const,
    detail: (id: number | string) => ['orders', 'detail', String(id)] as const,
  },
  returns: {
    all: ['returns'] as const,
    list: (params: object) => ['returns', 'list', params] as const,
    detail: (id: number | string) => ['returns', 'detail', String(id)] as const,
    quote: (request: object) => ['returns', 'quote', request] as const,
    returnable: (orderId: number | string) => ['returns', 'returnable', String(orderId)] as const,
  },
  settings: {
    all: ['settings'] as const,
    store: ['settings', 'store'] as const,
  },
  customers: {
    all: ['customers'] as const,
    byPhone: (phone: string) => ['customers', 'by-phone', phone] as const,
    detail: (id: number | string) => ['customers', 'detail', String(id)] as const,
  },
  suppliers: {
    all: ['suppliers'] as const,
    list: (params: object) => ['suppliers', 'list', params] as const,
    detail: (id: number | string) => ['suppliers', 'detail', String(id)] as const,
    products: (id: number | string) => ['suppliers', 'products', String(id)] as const,
  },
  purchaseOrders: {
    all: ['purchase-orders'] as const,
    list: (params: object) => ['purchase-orders', 'list', params] as const,
    detail: (id: number | string) => ['purchase-orders', 'detail', String(id)] as const,
    warnings: (lines: object) => ['purchase-orders', 'warnings', lines] as const,
  },
  stock: {
    all: ['stock'] as const,
    batches: (params: object) => ['stock', 'batches', params] as const,
    summary: ['stock', 'summary'] as const,
    product: (id: number | string) => ['stock', 'product', String(id)] as const,
    fefo: (code: string) => ['stock', 'fefo', code] as const,
  },
  inventoryChecks: {
    all: ['inventory-checks'] as const,
    list: (params: object) => ['inventory-checks', 'list', params] as const,
    detail: (id: number | string) => ['inventory-checks', 'detail', String(id)] as const,
  },
  disposals: {
    all: ['disposals'] as const,
    list: (params: object) => ['disposals', 'list', params] as const,
    detail: (id: number | string) => ['disposals', 'detail', String(id)] as const,
  },
}
