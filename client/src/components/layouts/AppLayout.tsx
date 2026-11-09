import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuthStore } from '../../app/store'
import { ChangePasswordModal } from '../../features/auth/ChangePasswordModal'
import { ShiftModal } from '../../features/auth/ShiftModal'
import { LoadingState } from '../ui/Feedback'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  // Luật 47: chưa đổi mật khẩu lần đầu thì không dùng được ứng dụng; chỉ hiện hộp đổi mật khẩu.
  const mustChangePassword = useAuthStore((s) => Boolean(s.user?.mustChangePassword))
  if (mustChangePassword) {
    return (
      <div className="min-h-screen bg-surface text-ink">
        <ChangePasswordModal />
      </div>
    )
  }
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
