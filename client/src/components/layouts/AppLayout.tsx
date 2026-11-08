import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { ChangePasswordModal } from '../../features/auth/ChangePasswordModal'
import { ShiftModal } from '../../features/auth/ShiftModal'
import { LoadingState } from '../ui/Feedback'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface text-ink lg:flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
          <Suspense fallback={<LoadingState label="Đang tải màn hình..." />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <ChangePasswordModal />
      <ShiftModal />
    </div>
  )
}
