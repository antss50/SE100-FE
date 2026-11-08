import { Flower2, ShieldCheck, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuthStore, useUiStore } from '../../app/store'
import { visibleNavGroups } from '../../routes/nav-config'
import { cn } from '../ui/cn'

/** Sidebar theo bản LUMINA POS; chỉ hiện mục người dùng có quyền. Dưới 1024px thu thành ngăn kéo. */
export function Sidebar() {
  const isOpen = useUiStore((s) => s.isSidebarOpen)
  const close = useUiStore((s) => s.closeSidebar)
  const permissions = useAuthStore((s) => s.user?.permissions) ?? []
  const groups = visibleNavGroups(permissions)

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={close}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-line bg-sidebar transition-transform',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent-bright text-white">
              <Flower2 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base leading-none font-bold tracking-wide text-accent">LUMINA POS</p>
              <p className="mt-1 text-[11px] text-muted">Cửa hàng mỹ phẩm</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng menu"
            className="rounded-lg p-1.5 text-muted hover:bg-accent-soft lg:hidden"
            onClick={close}
          >
            <X className="size-4" />
          </button>
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {groups.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">{group.section}</p>
              <ul className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={close}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition',
                          isActive
                            ? 'bg-accent-bright font-semibold text-white shadow-xs'
                            : 'text-ink-soft hover:bg-accent-soft hover:text-ink'
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-3">
            <ShieldCheck className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-ink">FEFO Active Guard</p>
              <p className="text-[11px] text-muted">Kiểm soát hạn dùng lô</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
