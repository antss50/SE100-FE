import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/layouts/AppLayout'
import { CrmPage } from '../features/crm/CrmPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { PosPage } from '../features/pos/PosPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="pos" element={<PosPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="crm" element={<CrmPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
