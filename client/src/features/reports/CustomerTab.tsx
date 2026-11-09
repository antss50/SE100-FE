import { useQuery } from '@tanstack/react-query'
import { Gift, Repeat, ShoppingBag, UserPlus } from 'lucide-react'
import { DataTable, ErrorState, LoadingState, StatCard, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { reportsService } from '../../services/reports.service'
import type { CustomerTierRow, CustomerTopRow } from '../../types/reports'
import { downloadCsv } from '../../utils/csv'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatNumber } from '../../utils/format'
import { BarChart, HBarList, Panel } from './charts'
import { ReportFilters } from './ReportFilters'
import type { ReportRangeController } from './report-range'

const topColumns: Column<CustomerTopRow>[] = [
  { key: 'code', header: 'Mã KH', render: (c) => <span className="font-mono text-xs">{c.customerCode}</span> },
  { key: 'name', header: 'Khách hàng', render: (c) => c.fullName },
  { key: 'tier', header: 'Hạng', render: (c) => c.tierName },
  { key: 'orders', header: 'Số đơn', align: 'right', render: (c) => formatNumber(c.orderCount) },
  { key: 'spent', header: 'Chi tiêu trong kỳ', align: 'right', render: (c) => formatCurrency(c.spent) },
]

const tierColumns: Column<CustomerTierRow>[] = [
  { key: 'name', header: 'Hạng', render: (t) => t.tierName },
  { key: 'count', header: 'Số khách', align: 'right', render: (t) => formatNumber(t.customerCount) },
  { key: 'spent', header: 'Tổng chi tiêu', align: 'right', render: (t) => formatCurrency(t.totalSpent) },
]

/** REP-06: khách mới, hạng, top chi tiêu, điểm tích/dùng/thu hồi. */
export function CustomerTab({ controller }: { controller: ReportRangeController }) {
  const { state, error } = controller
  const params = { fromDate: state.fromDate, toDate: state.toDate, granularity: state.granularity }
  const query = useQuery({
    queryKey: queryKeys.reports.report('customers', params),
    queryFn: () => reportsService.customers(params),
    enabled: error === null,
    placeholderData: (prev) => prev,
  })
  const report = query.data?.data

  const exportCsv = () => {
    if (!report) return
    downloadCsv(
      `khach-hang_${state.fromDate}_${state.toDate}.csv`,
      ['Mục', 'Tên', 'Số lượng', 'Giá trị'],
      [
        ...report.byTier.map((t) => ['Hạng thẻ', t.tierName, t.customerCount, t.totalSpent]),
        ...report.topSpenders.map((c) => ['Top chi tiêu', `${c.customerCode} - ${c.fullName}`, c.orderCount, c.spent]),
        ...report.series.map((p) => ['Khách mới theo kỳ', p.label, p.newCustomers, '']),
      ]
    )
  }

  return (
    <div className="space-y-5">
      <ReportFilters controller={controller} showGranularity onExport={exportCsv} exportDisabled={!report} />
      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Khách mới trong kỳ" value={formatNumber(report.summary.newCustomers)} icon={UserPlus} hint={`Tổng ${formatNumber(report.summary.totalCustomers)} khách`} />
            <StatCard label="Khách có mua hàng" value={formatNumber(report.summary.activeBuyers)} icon={ShoppingBag} hint="Có đơn hoàn tất trong kỳ" />
            <StatCard label="Khách quay lại" value={formatNumber(report.summary.returningBuyers)} icon={Repeat} hint="Mua trong kỳ và đã mua từ trước kỳ" />
            <StatCard
              label="Điểm tích trong kỳ"
              value={formatNumber(report.summary.pointsEarned)}
              icon={Gift}
              hint={`Đã dùng ${formatNumber(report.summary.pointsRedeemed)} · Thu hồi ${formatNumber(report.summary.pointsRevoked)}`}
            />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Khách mới theo kỳ">
              <BarChart title="Khách mới theo kỳ" money={false} data={report.series.map((p) => ({ label: p.label, value: p.newCustomers }))} />
            </Panel>
            <Panel title="Phân bổ theo hạng thẻ">
              <HBarList money={false} items={report.byTier.map((t) => ({ label: t.tierName, value: t.customerCount }))} />
              <div className="mt-4">
                <DataTable columns={tierColumns} rows={report.byTier} rowKey={(t) => t.tierCode} caption="Khách theo hạng" />
              </div>
            </Panel>
          </div>
          <Panel title="Top khách chi tiêu trong kỳ" right={<span className="text-xs text-muted">Đã trừ tiền hoàn trả</span>}>
            <DataTable columns={topColumns} rows={report.topSpenders} rowKey={(c) => c.customerId} caption="Top chi tiêu" emptyTitle="Không có khách thành viên mua hàng trong kỳ" />
          </Panel>
        </>
      )}
    </div>
  )
}
