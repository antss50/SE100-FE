/** Khai báo tập trung query key cho TanStack Query (CLAUDE.md mục 4). */
export const queryKeys = {
  shifts: {
    current: ['shifts', 'current'] as const,
  },
  customers: {
    all: ['customers'] as const,
    byPhone: (phone: string) => ['customers', 'by-phone', phone] as const,
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
