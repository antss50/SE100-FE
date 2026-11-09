import type { Batch, PurchaseOrderDetail, StockMovement } from '../types/stock'
import type { Supplier } from '../types/suppliers'
import type {
  AuditLogItem,
  BrandItem,
  CategoryItem,
  CustomerItem,
  LoyaltyConfigData,
  ProductItem,
  PromotionItem,
  ShiftInfo,
} from '../types/api'
import { SEED_AUDIT_LOGS } from './seed/audit-logs'
import { SEED_BRANDS, SEED_CATEGORIES, SEED_PRODUCTS } from './seed/catalog'
import { SEED_CUSTOMERS } from './seed/customers'
import { SEED_LOYALTY_CONFIG } from './seed/loyalty'
import { seedPromotions } from './seed/promotions'
import { SEED_SYSTEM_SETTINGS, seedStock } from './seed/stock'
import { seedSuppliers } from './seed/suppliers'
import { seedPermissions, seedRoles, type MockPermission, type MockRole } from './seed/rbac'
import { SEED_PASSWORD, SEED_USERS, type MockUser } from './seed/users'

/** Phiên đăng nhập trong mock (tương ứng REFRESH_TOKENS). */
export interface MockSession {
  accessToken: string
  refreshToken: string
  userId: number
  createdAt: string
}

/** Ca làm việc (CASHIER_SHIFTS) — GĐ0 chỉ giữ các trường màn hình cũ đang dùng. */
export interface MockShift extends ShiftInfo {
  closedAt?: string | null
}

export interface MockTables {
  users: MockUser[]
  /** userId → mật khẩu (mock lưu thô). */
  passwords: Record<string, string>
  sessions: MockSession[]
  permissions: MockPermission[]
  roles: MockRole[]
  auditLogs: AuditLogItem[]
  shifts: MockShift[]
  customers: CustomerItem[]
  categories: CategoryItem[]
  brands: BrandItem[]
  products: ProductItem[]
  loyaltyConfig: LoyaltyConfigData
  promotions: PromotionItem[]
  suppliers: Supplier[]
  /** Phiếu nhập kho kèm dòng chi tiết (PURCHASE_ORDERS + PURCHASE_ORDER_DETAILS). */
  purchaseOrders: PurchaseOrderDetail[]
  batches: Batch[]
  /** Thẻ kho (STOCK_MOVEMENTS): mọi thay đổi tồn đều có một dòng ở đây (luật 28). */
  stockMovements: StockMovement[]
  /** SYSTEM_SETTINGS dạng khóa → giá trị chuỗi. */
  systemSettings: Record<string, string>
  /** Idempotency-Key đã xử lý → id chứng từ (luật 30). */
  idempotencyKeys: Record<string, number>
  /** Bộ đếm sinh id/mã tất định. */
  counters: Record<string, number>
}

export type TableName = keyof MockTables

/**
 * Phiên bản cấu trúc seed. Đổi cấu trúc bảng hoặc dữ liệu seed thì tăng số này
 * (CLAUDE.md mục 5.2) để trình duyệt bỏ dữ liệu cũ.
 */
export const MOCK_DB_VERSION = 4
const KEY_PREFIX = 'se100_mock_'
const keyOf = (table: string) => `${KEY_PREFIX}${table}_v${MOCK_DB_VERSION}`
const META_KEY = keyOf('meta')

/** Seed tất định; ngày tính tương đối so với `today`. */
export function buildSeed(today: Date = new Date()): MockTables {
  const permissions = seedPermissions()
  const clone = <T>(value: T): T => structuredClone(value)
  const suppliers = seedSuppliers(today)
  const stock = seedStock(today, suppliers, SEED_PRODUCTS)
  const stockByProduct = new Map<number, number>()
  for (const b of stock.batches) stockByProduct.set(b.productId, (stockByProduct.get(b.productId) ?? 0) + b.onHandQty)
  const products = clone(SEED_PRODUCTS).map((p) => ({
    ...p,
    isSellable: p.isSellable ?? true,
    currentStock: stockByProduct.get(p.id as number) ?? 0,
  }))
  return {
    users: clone(SEED_USERS),
    passwords: Object.fromEntries(SEED_USERS.map((u) => [String(u.id), SEED_PASSWORD])),
    sessions: [],
    permissions,
    roles: seedRoles(permissions),
    auditLogs: clone(SEED_AUDIT_LOGS),
    shifts: [],
    customers: clone(SEED_CUSTOMERS),
    categories: clone(SEED_CATEGORIES),
    brands: clone(SEED_BRANDS),
    products,
    loyaltyConfig: clone(SEED_LOYALTY_CONFIG),
    promotions: seedPromotions(today),
    suppliers,
    purchaseOrders: stock.purchaseOrders,
    batches: stock.batches,
    stockMovements: stock.stockMovements,
    systemSettings: { ...SEED_SYSTEM_SETTINGS },
    idempotencyKeys: {},
    counters: {},
  }
}

function readRaw<T>(key: string): T | undefined {
  const raw = localStorage.getItem(key)
  if (raw === null) return undefined
  return JSON.parse(raw) as T
}

function writeAll(tables: Partial<MockTables>): void {
  for (const [name, value] of Object.entries(tables)) {
    localStorage.setItem(keyOf(name), JSON.stringify(value))
  }
}

function ensureSeeded(): void {
  if (localStorage.getItem(META_KEY) !== null) return
  writeAll(buildSeed())
  localStorage.setItem(META_KEY, JSON.stringify({ seededAt: new Date().toISOString() }))
}

/** Xóa toàn bộ dữ liệu mock (mọi phiên bản) rồi seed lại. */
export function resetMockDb(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(KEY_PREFIX)) keys.push(key)
  }
  keys.forEach((k) => localStorage.removeItem(k))
  ensureSeeded()
}

/**
 * Giao dịch: đọc bản sao từng bảng, ghi vào vùng tạm; chỉ `commit()` mới ghi xuống
 * localStorage. Handler ném lỗi thì không ghi gì (luật 40).
 */
export class MockTransaction {
  private readonly cache = new Map<TableName, unknown>()
  private readonly dirty = new Set<TableName>()

  constructor() {
    ensureSeeded()
  }

  /** Bản sao có thể sửa trực tiếp; sửa xong gọi `write` hoặc `touch`. */
  read<K extends TableName>(table: K): MockTables[K] {
    if (!this.cache.has(table)) {
      const stored = readRaw<MockTables[K]>(keyOf(table))
      this.cache.set(table, stored ?? buildSeed()[table])
    }
    return this.cache.get(table) as MockTables[K]
  }

  write<K extends TableName>(table: K, value: MockTables[K]): void {
    this.cache.set(table, value)
    this.dirty.add(table)
  }

  /** Đánh dấu bảng đã sửa tại chỗ (qua tham chiếu từ `read`). */
  touch(table: TableName): void {
    this.read(table)
    this.dirty.add(table)
  }

  /** Sinh số tăng dần tất định theo tên bộ đếm, bắt đầu từ `start`. */
  nextSeq(name: string, start = 1): number {
    const counters = this.read('counters')
    const next = (counters[name] ?? start - 1) + 1
    counters[name] = next
    this.touch('counters')
    return next
  }

  commit(): void {
    const changed: Partial<MockTables> = {}
    for (const table of this.dirty) {
      ;(changed as Record<string, unknown>)[table] = this.cache.get(table)
    }
    writeAll(changed)
    this.dirty.clear()
  }
}
