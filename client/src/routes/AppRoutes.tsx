import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingState } from '../components/ui/Feedback'
import type { PermissionRequirement } from '../domain/permissions'
import { ForbiddenPage, HomeGate, RequireAuth, RequirePermission } from './guards'
import { NAV_GROUPS } from './nav-config'

/** React.lazy cho component export theo tên. */
function lazyNamed<M, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }))
}

const AppLayout = lazyNamed(() => import('../components/layouts/AppLayout'), 'AppLayout')
const LoginPage = lazyNamed(() => import('../features/auth/LoginPage'), 'LoginPage')
const DashboardPage = lazyNamed(() => import('../features/dashboard/DashboardPage'), 'DashboardPage')
const InventoryPage = lazyNamed(() => import('../features/inventory/InventoryPage'), 'InventoryPage')
const PosPage = lazyNamed(() => import('../features/pos/PosPage'), 'PosPage')
const PromotionsPage = lazyNamed(() => import('../features/promotions/PromotionsPage'), 'PromotionsPage')
const LoyaltyPage = lazyNamed(() => import('../features/promotions/LoyaltyPage'), 'LoyaltyPage')
const CustomersListPage = lazyNamed(() => import('../features/customers/CustomersListPage'), 'CustomersListPage')
const CreateCustomerPage = lazyNamed(() => import('../features/customers/CreateCustomerPage'), 'CreateCustomerPage')
const CustomerDetailPage = lazyNamed(() => import('../features/customers/CustomerDetailPage'), 'CustomerDetailPage')
const UsersListPage = lazyNamed(() => import('../features/users/UsersListPage'), 'UsersListPage')
const UserDetailPage = lazyNamed(() => import('../features/users/UserDetailPage'), 'UserDetailPage')
const RbacPage = lazyNamed(() => import('../features/rbac/RbacPage'), 'RbacPage')
const ComingSoonPage = lazy(async () => ({ default: (await import('../features/common/ComingSoonPage')).ComingSoonPage }))

/** Màn hình đã có, theo đường dẫn mục menu. Mục không có ở đây dùng trang "Đang phát triển". */
const PAGES: Record<string, ComponentType> = {
  '/products': InventoryPage,
  '/pos': PosPage,
  '/promotions': PromotionsPage,
  '/customers': CustomersListPage,
  '/loyalty': LoyaltyPage,
  '/users': UsersListPage,
  '/rbac': RbacPage,
}

/** Route con không có trên menu. */
const SUB_ROUTES: { path: string; permission: PermissionRequirement; element: ReactNode }[] = [
  { path: 'customers/new', permission: 'CUSTOMER_EDIT', element: <CreateCustomerPage /> },
  { path: 'customers/:customerCode', permission: 'CUSTOMER_VIEW', element: <CustomerDetailPage /> },
  { path: 'users/:userId', permission: 'USER_MANAGE', element: <UserDetailPage /> },
]

const fallback = <LoadingState label="Đang tải màn hình..." />

export function AppRoutes() {
  const [home, ...menuGroups] = NAV_GROUPS
  const dashboard = home.items[0]
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route
            index
            element={
              <HomeGate permission={dashboard.permission}>
                <DashboardPage />
              </HomeGate>
            }
          />
          {menuGroups.flatMap((group) =>
            group.items.map((item) => {
              const Page = PAGES[item.to]
              return (
                <Route
                  key={item.to}
                  path={item.to.slice(1)}
                  element={
                    <RequirePermission permission={item.permission}>
                      {Page ? <Page /> : <ComingSoonPage item={item} section={group.section} />}
                    </RequirePermission>
                  }
                />
              )
            })
          )}
          {SUB_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={<RequirePermission permission={r.permission}>{r.element}</RequirePermission>} />
          ))}
          <Route path="inventory" element={<Navigate to="/products" replace />} />
          <Route path="forbidden" element={<ForbiddenPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
