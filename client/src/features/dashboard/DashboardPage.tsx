import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, ClipboardCheck, PackageMinus, ReceiptText, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import { DataTable, ErrorState, LoadingState, PageHeader, StatCard, StatusBadge, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { reportsService } from '../../services/reports.service'
import type { DashboardAlertLot, DashboardLowStock } from '../../types/reports'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { BarChart, Delta, Panel } from '../reports/charts'

const lotColumns: Column<DashboardAlertLot>[] = [
  { key: 'name', header: 'Sản phẩm', render: (l) => l.productName },
  { key: 'lot', header: 'Lô', render: (l) => <span className="font-mono text-xs">{l.lotCode}</span> },
  { key: 'exp', header: 'Hạn dùng', render: (l) => formatDate(l.expDate) },
  {
    key: 'days',
    header: 'Còn lại',
    align: 'right',
    render: (l) =>
      l.daysToExpiry < 0 ? (
        <StatusBadge tone="danger">Quá hạn {-l.daysToExpiry} ngày</StatusBadge>
      ) : (
        <StatusBadge tone="warning">{l.daysToExpiry} ngày</StatusBadge>
      ),
  },
  { key: 'qty', header: 'Tồn', align: 'right', render: (l) => formatNumber(l.onHandQty) },
]

const lowColumns: Column<DashboardLowStock>[] = [
  { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
  { key: 'name', header: 'Sản phẩm', render: (p) => p.productName },
  { key: 'qty', header: 'Tồn', align: 'right', render: (p) => <span className="font-semibold text-danger">{formatNumber(p.onHandQty)}</span> },
  { key: 'min', header: 'Ngưỡng', align: 'right', render: (p) => formatNumber(p.minStockAlert) },
]

/** REP-01: dashboard theo quyền. NV kho chỉ có widget kho; thu ngân không có dashboard. */
export function DashboardPage() {
  const canApproveCheck = useCan('STOCK_ADJUST_APPROVE')
  const canApproveDisposal = useCan('STOCK_DISPOSAL_APPROVE')
  const canViewStock = useCan(['STOCK_VIEW', 'STOCK_EXPIRY_VIEW'])
  const query = useQuery({ queryKey: queryKeys.reports.report('dashboard', {}), queryFn: () => reportsService.dashboard(), refetchInterval: 60_000 })
  const data = query.data?.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard tổng quan"
        description={data ? `Cập nhật lúc ${formatDateTime(data.generatedAt)}` : 'Doanh thu, cảnh báo kho và chứng từ chờ duyệt'}
      />
      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {data && (
        <>
          {data.sales && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Doanh thu hôm nay"
                  value={formatCurrency(data.sales.todayRevenue)}
                  icon={TrendingUp}
                  hint={
                    <span>
                      <Delta current={data.sales.todayRevenue} previous={data.sales.yesterdayRevenue} /> so với hôm qua
                    </span>
                  }
                />
                <StatCard label="Đơn hôm nay" value={formatNumber(data.sales.todayOrders)} icon={ReceiptText} hint="Đơn đã hoàn tất" />
                <StatCard label="Ca đang mở" value={formatNumber(data.sales.openShifts)} icon={Clock} />
                <StatCard
                  label="Chờ duyệt"
                  value={formatNumber(data.pending.waitingChecks + data.pending.waitingDisposals)}
                  icon={ClipboardCheck}
                  hint={`${data.pending.waitingChecks} kiểm kho · ${data.pending.waitingDisposals} xuất khác`}
                />
              </div>
              <Panel title="Doanh thu thuần 7 ngày gần nhất">
                <BarChart title="Doanh thu thuần 7 ngày" data={data.sales.last7Days.map((d) => ({ label: d.label, value: Math.max(0, d.netRevenue) }))} />
              </Panel>
            </>
          )}

          {!data.sales && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Lô cận hạn" value={formatNumber(data.stock.nearExpiry.length)} icon={AlertTriangle} hint="Theo ngưỡng riêng từng sản phẩm" />
              <StatCard label="Lô hết hạn còn tồn" value={formatNumber(data.stock.expired.length)} icon={PackageMinus} />
              <StatCard label="Phiếu chờ duyệt" value={formatNumber(data.pending.waitingChecks + data.pending.waitingDisposals)} icon={ClipboardCheck} hint={`${data.pending.waitingChecks} kiểm kho · ${data.pending.waitingDisposals} xuất khác`} />
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel
              title="Lô cận hạn"
              right={canViewStock && <Link to="/stock" className="text-xs font-semibold text-accent hover:underline">Xem tồn kho</Link>}
            >
              <DataTable columns={lotColumns} rows={data.stock.nearExpiry} rowKey={(l) => l.batchId} caption="Lô cận hạn" emptyTitle="Không có lô cận hạn" />
            </Panel>
            <Panel title="Lô đã hết hạn còn tồn">
              <DataTable columns={lotColumns} rows={data.stock.expired} rowKey={(l) => l.batchId} caption="Lô hết hạn" emptyTitle="Không có lô hết hạn còn tồn" />
            </Panel>
            <Panel title="Sản phẩm tồn dưới ngưỡng">
              <DataTable columns={lowColumns} rows={data.stock.lowStock} rowKey={(p) => p.productId} caption="Tồn dưới ngưỡng" emptyTitle="Không có sản phẩm dưới ngưỡng" />
            </Panel>
            <Panel title="Chứng từ chờ duyệt">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between gap-3 rounded-xl bg-card p-3">
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="size-4 text-accent" aria-hidden="true" />
                    Phiếu kiểm kho chờ duyệt
                  </span>
                  <span className="flex items-center gap-3">
                    <strong>{data.pending.waitingChecks}</strong>
                    {canApproveCheck && <Link to="/inventory-checks" className="text-xs font-semibold text-accent hover:underline">Xem</Link>}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-xl bg-card p-3">
                  <span className="flex items-center gap-2">
                    <PackageMinus className="size-4 text-accent" aria-hidden="true" />
                    Phiếu xuất khác chờ duyệt
                  </span>
                  <span className="flex items-center gap-3">
                    <strong>{data.pending.waitingDisposals}</strong>
                    {canApproveDisposal && <Link to="/disposals" className="text-xs font-semibold text-accent hover:underline">Xem</Link>}
                  </span>
                </li>
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
