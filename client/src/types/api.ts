export interface ApiSuccessResponse<T> {
  success: true
  message?: string
  data: T
}

export interface ApiErrorResponse {
  success: false
  errorCode: string
  message: string
  errors?: unknown[]
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export interface PaginatedData<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
}

// 2. MODULE AUTH (G02)
export type RoleCode = 'ADMIN' | 'STORE_MANAGER' | 'INVENTORY_STAFF' | 'CASHIER' | string

export interface AuthUser {
  id: number
  employeeCode: string
  username: string
  fullName: string
  email: string
  phoneNumber?: string
  mustChangePassword?: boolean
  roles: RoleCode[]
  permissions: string[]
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponseData {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponseData {
  accessToken: string
  refreshToken: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface LogoutRequest {
  refreshToken: string
}

// 3. MODULE USERS (G02)
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'INACTIVE'

export interface StaffActivityLog {
  id: string
  category: 'LOGIN' | 'PASSWORD' | 'OVERRIDE_FEFO' | 'DISCARD_APPROVAL' | 'ORDER'
  title: string
  highlightCode?: string
  description: string
  timestamp: string
  severity?: 'normal' | 'warning' | 'success'
}

export interface UserItem {
  id: number
  employeeCode: string
  username: string
  fullName: string
  email: string
  phoneNumber: string
  status: UserStatus
  roles: RoleCode[]
  // Extended UI fields (fallback when backend does not return them)
  avatarUrl?: string
  jobTitle?: string
  lastLoginAt?: string
  lastLoginDevice?: string
  currentShiftLabel?: string
  isOnline?: boolean
  lockReason?: string
  lockedDate?: string
  mustChangePassword?: boolean
  failedLoginCount?: number
  monthlyNetRevenue?: number
  monthlyCompletedOrders?: number
  monthlyReturnOrders?: number
  returnRatePercent?: number
  weeklyRevenue?: { day: string; amount: number; isPeak?: boolean }[]
  activityLogs?: StaffActivityLog[]
}

export interface GetUsersParams {
  keyword?: string
  page?: number
  pageSize?: number
  role?: string
  status?: string
  sortBy?: string
}

export interface CreateUserRequest {
  employeeCode: string
  username: string
  password: string
  fullName: string
  email: string
  phoneNumber: string
  roleIds: number[]
}

export interface CreateUserResponseData {
  id: number
  employeeCode: string
  username: string
}

// 4. MODULE RBAC (G02)
export interface RbacRole {
  id: number
  roleCode: RoleCode
  roleName: string
  isSystem: boolean
  _count: {
    userRoles: number
  }
  // UI metadata
  shortCode?: string
  description?: string
  badgeNote?: string
  permissionIds?: number[]
}

export interface RbacPermissionItem {
  id: number
  permissionCode: string
  permissionName: string
  // UI metadata
  module?: string
  moduleTitle?: string
  categoryTag?: 'ALL' | 'INVENTORY_FEFO' | 'FINANCE'
  isStrict?: boolean
  immutableForRoles?: RoleCode[]
  forbiddenForRoles?: RoleCode[]
}

export type RbacPermissionsGrouped = Record<string, RbacPermissionItem[]>

export interface UpdateRolePermissionsRequest {
  permissionIds: number[]
}

export interface UpdateRolePermissionsResponseData {
  roleId: number
  totalPermissions: number
}

export interface AuditLogItem {
  id: string
  timestamp: string
  date: string
  actorName: string
  roleCode: RoleCode
  actionTitle: string
  referenceCode: string
  detailNote: string
  riskStatus: string
  ipAndTerminal: string
}

// 5. MODULE CUSTOMERS (G06)
export type SkinType = 'OILY' | 'COMBINATION' | 'DRY' | 'SENSITIVE' | 'NORMAL'
export type GenderType = 'MALE' | 'FEMALE' | 'OTHER'
export type CustomerTierCode = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'

export interface CustomerTierInfo {
  id?: number
  tierCode: CustomerTierCode
  tierName: string
  discountRate?: string
}

export interface PointHistoryItem {
  id?: number
  orderId?: string
  returnId?: string
  actionType: 'EARN' | 'REVOKE' | 'REDEEM' | 'ADJUST'
  pointsChanged: number
  balanceAfter: number
  createdAt: string
  description?: string
}

export interface CustomerOrderHistoryItem {
  orderCode: string
  purchasedAt: string
  brandShort: string
  mainProductName: string
  subNote: string
  totalPaid: number
  pointsEarned: number
  status: 'COMPLETED' | 'RETURNED'
}

export interface CustomerItem {
  id: number
  customerCode: string
  phoneNumber: string
  fullName: string
  email?: string
  skinType?: SkinType
  rewardPoints: number
  totalSpent: string
  status: 'ACTIVE' | 'INACTIVE'
  tier: CustomerTierInfo
  // Detail / Form fields
  dateOfBirth?: string
  gender?: GenderType
  address?: string
  note?: string
  joinedAt?: string
  completedOrdersCount?: number
  lastOrderText?: string
  lastOrderCode?: string
  lastOrderBranch?: string
  favoriteBrands?: string
  pointHistories?: PointHistoryItem[]
  orderHistories?: CustomerOrderHistoryItem[]
}

export interface GetCustomersParams {
  keyword?: string
  tierId?: number
  page?: number
  pageSize?: number
  status?: string
  sortBy?: string
}

export interface CreateCustomerRequest {
  fullName: string
  phoneNumber: string
  email?: string
  dateOfBirth?: string
  gender?: GenderType
  address?: string
  skinType?: SkinType
  note?: string
}

// G12 - MỞ CA LÀM VIỆC
export interface ShiftInfo {
  shiftId: number
  cashierId: number
  openedAt: string
  openingCash: number
  status: 'OPEN' | 'CLOSED'
}

export interface CurrentShiftResponseData {
  hasOpenShift: boolean
  shift: ShiftInfo | null
}

// 6. MODULE PRODUCTS, CATEGORIES & BRANDS (UC-PROD-01 .. UC-PROD-20)
export type ProductSkinType =
  | 'ALL_SKIN_TYPES'
  | 'OILY'
  | 'DRY'
  | 'COMBINATION'
  | 'SENSITIVE'
  | 'NORMAL'

export interface ProductImageItem {
  imageId: number
  url: string
}

export interface CategoryItem {
  id?: number
  categoryCode: string
  categoryName: string
  description?: string
  productCount?: number
  status: 'ACTIVE' | 'INACTIVE'
}

export interface GetCategoriesParams {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface CreateCategoryRequest {
  categoryCode: string
  categoryName: string
  description?: string
}

export interface UpdateCategoryRequest {
  categoryName: string
  description?: string
}

export interface BrandItem {
  id?: number
  brandCode: string
  brandName: string
  description?: string
  productCount?: number
  status: 'ACTIVE' | 'INACTIVE'
}

export interface GetBrandsParams {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface CreateBrandRequest {
  brandCode: string
  brandName: string
  description?: string
}

export interface UpdateBrandRequest {
  brandName: string
  description?: string
}

export interface ProductItem {
  id?: number
  sku: string
  productName: string
  categoryCode: string
  categoryName?: string
  brandCode: string
  brandName?: string
  unit: string
  volume?: string
  packagingDetail?: string
  skinType?: ProductSkinType
  retailPrice: number
  taxRate: number
  minStockAlert?: number
  currentStock?: number
  barcode?: string
  shelfLifeMonths?: number
  description?: string
  imageUrl?: string | null
  images?: ProductImageItem[]
  /** `false` = SKU tester của hãng: không bao giờ bán ở POS, chỉ xuất bằng phiếu TESTER/DESTROY (DATABASE.md mục 11). */
  isSellable?: boolean
  status: 'ACTIVE' | 'INACTIVE'
  visualTheme?: 'serum' | 'lipstick' | 'sunscreen' | 'cleanser' | 'tint'
}

export interface CreateProductRequest {
  sku: string
  productName: string
  categoryCode: string
  brandCode: string
  unit: string
  volume?: string
  skinType?: ProductSkinType
  retailPrice: number
  taxRate: number
  minStockAlert?: number
  barcode?: string
  images?: string[]
  // Optional UI fields
  packagingDetail?: string
  shelfLifeMonths?: number
  description?: string
}

export interface UpdateProductRequest {
  productName: string
  categoryCode: string
  brandCode: string
  unit: string
  volume?: string
  skinType?: ProductSkinType
  retailPrice: number
  taxRate: number
  minStockAlert?: number
  barcode?: string
  // Optional UI fields
  packagingDetail?: string
  shelfLifeMonths?: number
  description?: string
}

export interface GetProductsParams {
  keyword?: string
  brandCode?: string
  categoryCode?: string
  status?: string
  page?: number
  pageSize?: number
}

// 7. G10 - HẠNG THẺ VÀ TÍCH ĐIỂM (UC-CUS-09)
export interface LoyaltyTierThreshold {
  tier: CustomerTierCode
  minSpend: number
  // UI enriched fields
  tierName?: string
  earnRatePercent?: number
  perks?: string[]
}

export interface LoyaltyConfigData {
  amountPerPoint: number
  redemptionValuePerPoint?: number
  tiers: LoyaltyTierThreshold[]
}
