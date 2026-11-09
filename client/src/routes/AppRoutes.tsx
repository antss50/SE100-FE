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
const SuppliersListPage = lazyNamed(() => import('../features/suppliers/SuppliersListPage'), 'SuppliersListPage')
const SupplierDetailPage = lazyNamed(() => import('../features/suppliers/SupplierDetailPage'), 'SupplierDetailPage')
const PurchaseOrdersListPage = lazyNamed(() => import('../features/purchase-orders/PurchaseOrdersListPage'), 'PurchaseOrdersListPage')
const PurchaseOrderFormPage = lazyNamed(() => import('../features/purchase-orders/PurchaseOrderFormPage'), 'PurchaseOrderFormPage')
const PurchaseOrderDetailPage = lazyNamed(() => import('../features/purchase-orders/PurchaseOrderDetailPage'), 'PurchaseOrderDetailPage')
const StockPage = lazyNamed(() => import('../features/stock/StockPage'), 'StockPage')
const StockBatchDetailPage = lazyNamed(() => import('../features/stock/StockBatchDetailPage'), 'StockBatchDetailPage')
const InventoryChecksListPage = lazyNamed(() => import('../features/inventory-checks/InventoryChecksListPage'), 'InventoryChecksListPage')
const InventoryCheckCreatePage = lazyNamed(() => import('../features/inventory-checks/InventoryCheckCreatePage'), 'InventoryCheckCreatePage')
const InventoryCheckDetailPage = lazyNamed(() => import('../features/inventory-checks/InventoryCheckDetailPage'), 'InventoryCheckDetailPage')
const DisposalsListPage = lazyNamed(() => import('../features/disposals/DisposalsListPage'), 'DisposalsListPage')
const DisposalCreatePage = lazyNamed(() => import('../features/disposals/DisposalCreatePage'), 'DisposalCreatePage')
const DisposalDetailPage = lazyNamed(() => import('../features/disposals/DisposalDetailPage'), 'DisposalDetailPage')
const ShiftsPage = lazyNamed(() => import('../features/shifts/ShiftsPage'), 'ShiftsPage')
const ShiftDetailPage = lazyNamed(() => import('../features/shifts/ShiftDetailPage'), 'ShiftDetailPage')
const OrdersListPage = lazyNamed(() => import('../features/orders/OrdersListPage'), 'OrdersListPage')
const OrderDetailPage = lazyNamed(() => import('../features/orders/OrderDetailPage'), 'OrderDetailPage')
const ReturnsListPage = lazyNamed(() => import('../features/returns/ReturnsListPage'), 'ReturnsListPage')
const ReturnCreatePage = lazyNamed(() => import('../features/returns/ReturnCreatePage'), 'ReturnCreatePage')
const ReturnDetailPage = lazyNamed(() => import('../features/returns/ReturnDetailPage'), 'ReturnDetailPage')
const PromotionEffectPage = lazyNamed(() => import('../features/reports/PromotionEffectPage'), 'PromotionEffectPage')
const AuditLogsPage = lazyNamed(() => import('../features/audit/AuditLogsPage'), 'AuditLogsPage')
const ReportsPage = lazyNamed(() => import('../features/reports/ReportsPage'), 'ReportsPage')
const SettingsPage = lazyNamed(() => import('../features/settings/SettingsPage'), 'SettingsPage')
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
  '/suppliers': SuppliersListPage,
  '/stock': StockPage,
  '/inventory-checks': InventoryChecksListPage,
  '/disposals': DisposalsListPage,
  '/purchase-orders': PurchaseOrdersListPage,
  '/shifts': ShiftsPage,
  '/orders': OrdersListPage,
  '/returns': ReturnsListPage,
  '/reports': ReportsPage,
  '/audit-logs': AuditLogsPage,
  '/settings': SettingsPage,
}

/** Route con không có trên menu. */
const SUB_ROUTES: { path: string; permission: PermissionRequirement; element: ReactNode }[] = [
  { path: 'customers/new', permission: 'CUSTOMER_EDIT', element: <CreateCustomerPage /> },
  { path: 'customers/:customerCode', permission: 'CUSTOMER_VIEW', element: <CustomerDetailPage /> },
  { path: 'purchase-orders/new', permission: 'STOCK_IMPORT_CREATE', element: <PurchaseOrderFormPage /> },
  { path: 'purchase-orders/:purchaseOrderId/edit', permission: 'STOCK_IMPORT_CREATE', element: <PurchaseOrderFormPage /> },
  { path: 'purchase-orders/:purchaseOrderId', permission: 'STOCK_IMPORT_VIEW', element: <PurchaseOrderDetailPage /> },
  { path: 'stock/:batchId', permission: ['STOCK_VIEW', 'STOCK_EXPIRY_VIEW'], element: <StockBatchDetailPage /> },
  { path: 'inventory-checks/new', permission: 'STOCK_CHECK_CREATE', element: <InventoryCheckCreatePage /> },
  { path: 'inventory-checks/:checkId', permission: 'STOCK_CHECK_VIEW', element: <InventoryCheckDetailPage /> },
  { path: 'disposals/new', permission: 'STOCK_DISPOSAL_CREATE', element: <DisposalCreatePage /> },
  { path: 'disposals/:disposalId', permission: 'STOCK_DISPOSAL_VIEW', element: <DisposalDetailPage /> },
  { path: 'suppliers/:supplierId', permission: 'SUPPLIER_VIEW', element: <SupplierDetailPage /> },
  { path: 'returns/new', permission: 'POS_RETURN', element: <ReturnCreatePage /> },
  { path: 'returns/:id', permission: 'POS_VIEW', element: <ReturnDetailPage /> },
  { path: 'orders/:id', permission: 'POS_VIEW', element: <OrderDetailPage /> },
  { path: 'shifts/:id', permission: 'POS_VIEW', element: <ShiftDetailPage /> },
  { path: 'promotions/:promotionId/report', permission: 'PROMOTION_REPORT', element: <PromotionEffectPage /> },
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
