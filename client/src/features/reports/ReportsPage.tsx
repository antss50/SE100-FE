import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../app/store'
import { PageHeader, cn } from '../../components/ui'
import { hasPermission, type PermissionRequirement } from '../../domain/permissions'
import { EmptyState } from '../../components/ui'
import { RevenueTab } from './RevenueTab'
import { SalesTab } from './SalesTab'
import { useReportRange } from './report-range'

interface TabDef {
  id: string
  label: string
  uc: string
  permission: PermissionRequirement
}

const TABS: TabDef[] = [
  { id: 'revenue', label: 'Doanh thu & lợi nhuận', uc: 'REP-02', permission: 'REPORT_REVENUE' },
  { id: 'sales', label: 'Bán hàng', uc: 'REP-03', permission: ['REPORT_SALES', 'REPORT_SALES_OWN_SHIFT'] },
]

/** REP-02..06: báo cáo theo tab; tab nào người dùng không có quyền thì ẩn. */
export function ReportsPage() {
  const permissions = useAuthStore((s) => s.user?.permissions) ?? []
  const [params, setParams] = useSearchParams()
  const controller = useReportRange()

  const visible = TABS.filter((t) => hasPermission(permissions, t.permission))
  const active = visible.find((t) => t.id === params.get('tab')) ?? visible[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo"
        description="Số liệu tính trực tiếp từ đơn hàng, phiếu trả, kho và khách hàng. Lọc theo khoảng ngày và xuất CSV."
        breadcrumbs={[{ label: 'Hệ thống' }, { label: 'Báo cáo' }]}
      />
      {visible.length === 0 || !active ? (
        <EmptyState title="Bạn chưa có quyền xem báo cáo nào" />
      ) : (
        <>
          <div role="tablist" aria-label="Loại báo cáo" className="flex flex-wrap gap-2 border-b border-line">
            {visible.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === active.id}
                onClick={() => setParams({ tab: t.id })}
                className={cn(
                  '-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition',
                  t.id === active.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={active.label}>
            {active.id === 'revenue' && <RevenueTab controller={controller} />}
            {active.id === 'sales' && <SalesTab controller={controller} />}
          </div>
        </>
      )}
    </div>
  )
}
