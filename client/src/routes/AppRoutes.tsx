import { ShieldAlert } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '../app/store'
import { AppLayout } from '../components/layouts/AppLayout'
import { LoginPage } from '../features/auth/LoginPage'
import { CreateCustomerPage } from '../features/customers/CreateCustomerPage'
import { CustomerDetailPage } from '../features/customers/CustomerDetailPage'
import { CustomersListPage } from '../features/customers/CustomersListPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { PosPage } from '../features/pos/PosPage'
import { LoyaltyPage } from '../features/promotions/LoyaltyPage'
import { PromotionsPage } from '../features/promotions/PromotionsPage'
import { RbacPage } from '../features/rbac/RbacPage'
import { UserDetailPage } from '../features/users/UserDetailPage'
import { UsersListPage } from '../features/users/UsersListPage'
import type { RoleCode } from '../types/api'

function RequireAuth({ children }: PropsWithChildren) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

interface RequireRolesProps extends PropsWithChildren {
  allowedRoles: RoleCode[]
}

function RequireRoles({ allowedRoles, children }: RequireRolesProps) {
  const user = useAuthStore((s) => s.user)
  const switchDemoRole = useAuthStore((s) => s.switchDemoRole)

  const userRoles = user?.roles || []
  const isAllowed = userRoles.some((r) => allowedRoles.includes(r))

  if (!isAllowed) {
    return (
      <div className="rounded-3xl bg-white border border-red-200 p-8 max-w-xl mx-auto my-8 text-center space-y-4 shadow-xs">
        <div className="size-12 rounded-2xl bg-red-50 text-red-600 grid place-items-center mx-auto">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="text-lg font-extrabold text-[#221712]">
          Không đủ quyền truy cập phân hệ (HTTP 403 Forbidden)
        </h2>
        <p className="text-xs text-[#6e564a] leading-relaxed">
          Tài khoản hiện tại (Vai trò:{' '}
          <strong className="font-mono text-red-700">
            {userRoles.join(', ') || 'NONE'}
          </strong>
          ) không có quyền truy cập chức năng này. Theo API Contract, chức năng
          yêu cầu một trong các vai trò:{' '}
          <strong className="font-mono text-[#9a462d]">
            {allowedRoles.join(', ')}
          </strong>
          .
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => switchDemoRole(allowedRoles[0])}
            className="px-4 py-2 rounded-xl bg-[#9a462d] hover:bg-[#823821] text-white text-xs font-bold cursor-pointer"
          >
            Chuyển nhanh sang vai trò {allowedRoles[0]}
          </button>
          <Link
            to="/"
            className="px-4 py-2 rounded-xl border border-[#e3d2c7] text-xs font-semibold text-[#543e33] hover:bg-[#faf3ee]"
          >
            Về trang Tổng quan
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="pos" element={<PosPage />} />

        {/* Module 6: Quản lý Sản phẩm, Danh mục & Thương hiệu (ADMIN, STORE_MANAGER, INVENTORY_STAFF) */}
        <Route
          path="inventory"
          element={
            <RequireRoles
              allowedRoles={['ADMIN', 'STORE_MANAGER', 'INVENTORY_STAFF']}
            >
              <InventoryPage />
            </RequireRoles>
          }
        />
        <Route path="products" element={<Navigate to="/inventory" replace />} />

        {/* Module 3: Quản lý Tài khoản & Hồ sơ Nhân viên (G02 - ADMIN, STORE_MANAGER) */}
        <Route
          path="users"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <UsersListPage />
            </RequireRoles>
          }
        />
        <Route
          path="users/:userId"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <UserDetailPage />
            </RequireRoles>
          }
        />

        {/* Module 4: Phân quyền & Ma trận Vai trò RBAC (G02 - ADMIN, STORE_MANAGER) */}
        <Route
          path="rbac"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <RbacPage />
            </RequireRoles>
          }
        />

        {/* Module 5: Quản lý Khách hàng (G06 - ADMIN, STORE_MANAGER, CASHIER) */}
        <Route
          path="customers"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER', 'CASHIER']}>
              <CustomersListPage />
            </RequireRoles>
          }
        />
        <Route
          path="customers/new"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER', 'CASHIER']}>
              <CreateCustomerPage />
            </RequireRoles>
          }
        />
        <Route
          path="customers/:customerCode"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER', 'CASHIER']}>
              <CustomerDetailPage />
            </RequireRoles>
          }
        />
        <Route path="crm" element={<Navigate to="/customers" replace />} />

        {/* Module 7 & 8: Hạng thẻ & Tích điểm (G10) + Khuyến mãi 4 tầng & Voucher (G11) */}
        <Route
          path="loyalty"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER', 'CASHIER']}>
              <LoyaltyPage />
            </RequireRoles>
          }
        />
        <Route
          path="promotions"
          element={
            <RequireRoles allowedRoles={['ADMIN', 'STORE_MANAGER', 'CASHIER']}>
              <PromotionsPage />
            </RequireRoles>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
