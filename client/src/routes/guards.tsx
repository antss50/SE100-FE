import { ShieldAlert } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../app/store'
import { EmptyState } from '../components/ui/Feedback'
import { hasPermission, type PermissionRequirement } from '../domain/permissions'
import { homePathFor } from './nav-config'

/** Chưa đăng nhập thì về `/login` (nhớ trang đang mở để quay lại). */
export function RequireAuth({ children }: PropsWithChildren) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export function ForbiddenPage() {
  return (
    <section className="mx-auto my-8 max-w-xl rounded-2xl border border-line bg-white">
      <EmptyState
        icon={ShieldAlert}
        title="Bạn không có quyền truy cập chức năng này"
        description="Liên hệ quản trị viên nếu bạn cần được cấp quyền."
        action={
          <Link to="/" className="text-sm font-semibold text-accent hover:underline">
            Về trang chính
          </Link>
        }
      />
    </section>
  )
}

/** Bọc route theo quyền; thiếu quyền thì hiện trang 403. */
export function RequirePermission({ permission, children }: PropsWithChildren<{ permission?: PermissionRequirement }>) {
  const permissions = useAuthStore((s) => s.user?.permissions)
  if (!hasPermission(permissions, permission)) return <ForbiddenPage />
  return <>{children}</>
}

/**
 * Trang `/`: có quyền dashboard thì hiện dashboard, không thì chuyển tới mục đầu tiên
 * được phép (ví dụ thu ngân về POS).
 */
export function HomeGate({ permission, children }: PropsWithChildren<{ permission: PermissionRequirement }>) {
  const permissions = useAuthStore((s) => s.user?.permissions) ?? []
  if (hasPermission(permissions, permission)) return <>{children}</>
  const home = homePathFor(permissions)
  return home && home !== '/' ? <Navigate to={home} replace /> : <ForbiddenPage />
}
