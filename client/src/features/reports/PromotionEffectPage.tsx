import { useQuery } from '@tanstack/react-query'
import { Coins, Receipt, TrendingUp, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DataTable, ErrorState, LoadingState, PageHeader, StatCard, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { reportsService } from '../../services/reports.service'
import type { PromotionEffectCustomer, PromotionEffectDay } from '../../types/reports'
import { downloadCsv } from '../../utils/csv'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatNumber } from '../../utils/format'
import { BarChart, Panel } from './charts'
import { ReportFilters } from './ReportFilters'
import { useReportRange } from './report-range'

const customerColumns: Column<PromotionEffectCustomer>[] = [
  { key: 'name', header: 'Khách hàng', render: (c) => c.customerName },
  { key: 'count', header: 'Lượt dùng', align: 'right', render: (c) => formatNumber(c.usageCount) },
  { key: 'discount', header: 'Tiền giảm', align: 'right', render: (c) => formatCurrency(c.discountAmount) },
  { key: 'revenue', header: 'Doanh thu', align: 'right', render: (c) => formatCurrency(c.revenue) },
]

const dayColumns: Column<PromotionEffectDay>[] = [
  { key: 'date', header: 'Ngày', render: (d) => formatDate(d.date) },
  { key: 'count', header: 'Lượt dùng', align: 'right', render: (d) => formatNumber(d.usageCount) },
  { key: 'discount', header: 'Tiền giảm', align: 'right', render: (d) => formatCurrency(d.discountAmount) },
  { key: 'revenue', header: 'Doanh thu', align: 'right', render: (d) => formatCurrency(d.revenue) },
]

/** PROM-04: hiệu quả một khuyến mãi theo đơn COMPLETED trong kỳ. */
export function PromotionEffectPage() {
  const { promotionId = '' } = useParams()
  const controller = useReportRange('THIS_QUARTER')
  const { state, error } = controller
  const params = { fromDate: state.fromDate, toDate: state.toDate }
  const query = useQuery({
    queryKey: queryKeys.reports.report(`promotion-${promotionId}`, params),
    queryFn: () => reportsService.promotionEffect(promotionId, params),
    enabled: error === null,
    placeholderData: (prev) => prev,
  })
  const report = query.data?.data

  const exportCsv = () => {
    if (!report) return
    downloadCsv(
      `khuyen-mai-${promotionId}_${state.fromDate}_${state.toDate}.csv`,
      ['Ngày', 'Lượt dùng', 'Tiền giảm', 'Doanh thu'],
      report.byDay.map((d) => [d.date, d.usageCount, d.discountAmount, d.revenue])
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={report ? `Hiệu quả: ${report.promotionName}` : 'Hiệu quả khuyến mãi'}
        description="Tính từ các đơn đã hoàn tất trong kỳ có dùng khuyến mãi này."
        breadcrumbs={[{ label: 'Chăm sóc & CS bán hàng' }, { label: 'Khuyến mãi', to: '/promotions' }, { label: 'Hiệu quả' }]}
        actions={
          <Link to="/promotions" className="text-sm font-semibold text-accent hover:underline">
            Về danh sách khuyến mãi
          </Link>
        }
      />
      <ReportFilters controller={controller} onExport={exportCsv} exportDisabled={!report} />
      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Lượt dùng" value={formatNumber(report.usageCount)} icon={Receipt} hint="Số đơn hoàn tất có dùng" />
            <StatCard label="Tổng tiền giảm" value={formatCurrency(report.totalDiscount)} icon={Coins} hint="Phần giảm của khuyến mãi này" />
            <StatCard label="Doanh thu tạo ra" value={formatCurrency(report.revenue)} icon={TrendingUp} hint={`TB ${formatCurrency(report.averageOrderValue)}/đơn`} />
            <StatCard label="Số khách" value={formatNumber(report.customerCount)} icon={Users} hint="Khách thành viên khác nhau" />
          </div>
          <Panel title="Lượt dùng theo ngày">
            <BarChart title="Lượt dùng theo ngày" money={false} data={report.byDay.map((d) => ({ label: formatDate(d.date), value: d.usageCount }))} />
            <div className="mt-4">
              <DataTable columns={dayColumns} rows={report.byDay} rowKey={(d) => d.date} caption="Theo ngày" emptyTitle="Chưa có đơn dùng khuyến mãi trong kỳ" />
            </div>
          </Panel>
          <Panel title="Top khách dùng nhiều nhất">
            <DataTable columns={customerColumns} rows={report.topCustomers} rowKey={(c) => c.customerId} caption="Top khách" emptyTitle="Chưa có khách thành viên dùng khuyến mãi" />
          </Panel>
        </>
      )}
    </div>
  )
}
