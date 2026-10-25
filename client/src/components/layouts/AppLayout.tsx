import {
  BarChart3,
  Boxes,
  ContactRound,
  LayoutDashboard,
  Menu,
  Store,
  X,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useUiStore } from '../../app/store'

const navigation = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/pos', label: 'Bán hàng', icon: Store },
  { to: '/inventory', label: 'Kho hàng', icon: Boxes },
  { to: '/crm', label: 'Khách hàng', icon: ContactRound },
]

export function AppLayout() {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const closeSidebar = useUiStore((state) => state.closeSidebar)

  return (
    <div className="min-h-screen lg:flex">
      {isSidebarOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
          onClick={closeSidebar}
          type="button"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
          <a className="flex items-center gap-3 font-semibold text-slate-900" href="/">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">
              <BarChart3 size={20} />
            </span>
            <span>SE100 <span className="text-indigo-600">Manage</span></span>
          </a>
          <button
            aria-label="Đóng menu"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={closeSidebar}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 space-y-1 px-3 py-6">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Không gian làm việc
          </p>
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
              end={end}
              onClick={closeSidebar}
              to={to}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <p className="text-xs text-slate-400">Khởi tạo ứng dụng</p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            React · TypeScript · Vite
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-8">
          <button
            aria-label="Mở menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={toggleSidebar}
            type="button"
          >
            <Menu size={20} />
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            Hệ thống quản lý bán hàng
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">
              Quản trị viên
            </span>
            <div
              aria-label="Ảnh đại diện quản trị viên"
              className="grid size-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
            >
              Q
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
