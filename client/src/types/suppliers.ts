/** Kiểu dữ liệu nhà cung cấp (SUPPLIERS, DATABASE.md mục 18). Không có công nợ (luật 58). */

export type SupplierStatus = 'ACTIVE' | 'INACTIVE'

export interface Supplier {
  id: number
  supplierCode: string
  supplierName: string
  taxCode?: string | null
  phoneNumber: string
  email?: string | null
  address: string
  contactPerson?: string | null
  /** Ghi chú chính sách chiết khấu. */
  note?: string | null
  status: SupplierStatus
  createdAt: string
  updatedAt?: string | null
}

/** Số liệu tính từ các phiếu nhập `COMPLETED` của nhà cung cấp. */
export interface SupplierStats {
  orderCount: number
  totalPurchaseAmount: number
  lastPurchaseDate: string | null
  /** Thương hiệu của các sản phẩm đã từng nhập. */
  brands: string[]
  /** Số phiếu nhập `DRAFT` còn dở. */
  draftOrderCount: number
}

export type SupplierItem = Supplier & SupplierStats

export interface SupplierSummary {
  total: number
  active: number
  inactive: number
  totalOrders: number
  totalPurchaseAmount: number
}

export interface SupplierListData {
  items: SupplierItem[]
  page: number
  pageSize: number
  totalItems: number
  summary: SupplierSummary
}

export interface SupplierProductItem {
  productId: number
  sku: string
  productName: string
  brandName?: string
  totalQuantity: number
  lastUnitCost: number
  lastPurchaseDate: string
}

export interface GetSuppliersParams {
  keyword?: string
  status?: SupplierStatus | 'ALL'
  page?: number
  pageSize?: number
}

export interface SupplierInput {
  supplierName: string
  taxCode?: string
  phoneNumber: string
  email?: string
  address: string
  contactPerson?: string
  note?: string
}
