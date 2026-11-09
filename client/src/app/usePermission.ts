import { hasPermission, type PermissionRequirement } from '../domain/permissions'
import { useAuthStore } from './store'

/** `true` nếu người dùng hiện tại có quyền (mảng = một trong các quyền). */
export function useCan(requirement: PermissionRequirement): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions)
  return hasPermission(permissions ?? [], requirement)
}
