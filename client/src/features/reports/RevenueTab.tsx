import { useQuery } from '@tanstack/react-query'
import { Coins, Percent, Receipt, TrendingUp } from 'lucide-react'
import { DataTable, ErrorState, LoadingState, StatCard, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { reportsService } from '../../services/reports.service'
import type { RevenueFigures, RevenuePoint } from '../../types/reports'
import { downloadCsv } from '../../utils/csv'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatNumber } from '../../utils/format'
import { BarChart, Delta, Panel } from './charts'
import { ReportFilters } from './ReportFilters'
import type { ReportRangeController } from './report-range'

/** REP-02: doanh thu và lợi nhuận gộp. Manager không thấy lợi nhuận/giá vốn (`REPORT_PROFIT`). */
export function RevenueTab({ controller }: { controller: ReportRangeController }) {
  const { state, error } = controller
  const params = { fromDate: state.fromDate, toDate: state.toDate, granularity: state.granularity, compare: state.compare }
  const query = useQuery({
    queryKey: queryKeys.reports.report('revenue', params),
    queryFn: () => reportsService.revenue(params),
    enabled: error === null,
    placeholderData: (prev) => prev,
  })
  const report = query.data?.data

  const exportCsv = () => {
    if (!report) return
    const profit = report.showProfit
    downloadCsv(
      `doanh-thu_${state.fromDate}_${state.toDate}.csv`,
      ['Kỳ', 'Số đơn', 'Tiền hàng', 'Giảm giá', 'Hàng bán bị trả', 'Doanh thu thuần', 'VAT', 'Doanh thu chưa VAT', ...(profit ? ['Giá vốn', 'Lợi nhuận gộp'] : [])],
      report.series.map((p) => [
        p.label,
        p.orderCount,
        p.grossAmount,
        p.discountAmount,
        p.returnedAmount,
        p.netRevenue,
        p.vatAmount,
        p.netRevenueExVat,
        ...(profit ? [p.cogs, p.grossProfit] : []),
      ])
    )
  }

  const columns: Column<RevenuePoint>[] = [
    { key: 'label', header: 'Kỳ', render: (p) => <span className="font-semibold">{p.label}</span> },
    { key: 'orders', header: 'Số đơn', align: 'right', render: (p) => formatNumber(p.orderCount) },
    { key: 'gross', header: 'Tiền hàng', align: 'right', render: (p) => formatCurrency(p.grossAmount) },
    { key: 'discount', header: 'Giảm giá', align: 'right', render: (p) => formatCurrency(p.discountAmount) },
    { key: 'returned', header: 'Hàng bán bị trả', align: 'right', render: (p) => formatCurrency(p.returnedAmount) },
    { key: 'net', header: 'Doanh thu thuần', align: 'right', render: (p) => <span className="font-semibold">{formatCurrency(p.netRevenue)}</span> },
    ...(report?.showProfit
      ? ([
          { key: 'cogs', header: 'Giá vốn', align: 'right', render: (p) => formatCurrency(p.cogs ?? 0) },
          { key: 'profit', header: 'Lợi nhuận gộp', align: 'right', render: (p) => formatCurrency(p.grossProfit ?? 0) },
        ] satisfies Column<RevenuePoint>[])
      : []),
  ]

  const t = report?.totals
  const prev = report?.previous
  const hint = (pick: (f: RevenueFigures) => number) =>
    t && prev ? (
      <span>
        <Delta current={pick(t)} previous={pick(prev)} /> so với kỳ trước ({formatCurrency(pick(prev))})
      </span>
    ) : undefined

  return (
    <div className="space-y-5">
      <ReportFilters controller={controller} showGranularity showCompare onExport={exportCsv} exportDisabled={!report} />
      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {report && t && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tiền hàng" value={formatCurrency(t.grossAmount)} icon={Receipt} hint={`${formatNumber(t.orderCount)} đơn hoàn tất`} />
            <StatCard
              label="Giảm giá"
              value={formatCurrency(t.discountAmount)}
              icon={Percent}
              hint={`Hạng ${formatCurrency(t.tierDiscountAmount)} · Dòng ${formatCurrency(t.lineDiscountAmount)} · Đơn ${formatCurrency(t.orderDiscountAmount)} · Điểm ${formatCurrency(t.pointsDiscountAmount)}`}
            />
            <StatCard label="Hàng bán bị trả" value={formatCurrency(t.returnedAmount)} icon={Coins} hint={`${formatNumber(t.returnCount)} phiếu trả trong kỳ`} />
            <StatCard label="Doanh thu thuần" value={formatCurrency(t.netRevenue)} icon={TrendingUp} hint={hint((f) => f.netRevenue) ?? `Chưa VAT ${formatCurrency(t.netRevenueExVat)}`} />
          </div>
          {report.showProfit && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Giá vốn (COGS)" value={formatCurrency(t.cogs ?? 0)} hint="Giá vốn hàng bán trừ giá vốn hàng trả" />
              <StatCard label="Lợi nhuận gộp" value={formatCurrency(t.grossProfit ?? 0)} hint={hint((f) => f.grossProfit ?? 0) ?? 'Doanh thu thuần chưa VAT − giá vốn'} />
              <StatCard label="Biên lợi nhuận gộp" value={`${t.marginPercent ?? 0}%`} hint="Lợi nhuận gộp / doanh thu thuần chưa VAT" />
            </div>
          )}
          {!report.showProfit && (
            <p className="rounded-xl bg-info-soft p-3 text-sm text-info">Tài khoản của bạn chỉ xem được doanh thu; giá vốn và lợi nhuận gộp dành cho quản trị viên.</p>
          )}
          <Panel title="Doanh thu thuần theo kỳ">
            <BarChart title="Doanh thu thuần theo kỳ" data={report.series.map((p) => ({ label: p.label, value: Math.max(0, p.netRevenue) }))} />
          </Panel>
          <Panel
            title={`Chi tiết từ ${formatDate(report.range.fromDate)} đến ${formatDate(report.range.toDate)}`}
            right={<span className="text-xs text-muted">Doanh thu theo ngày hoàn tất đơn; hàng trả trừ vào kỳ trả</span>}
          >
            <DataTable columns={columns} rows={report.series} rowKey={(p) => p.periodStart} caption="Doanh thu theo kỳ" emptyTitle="Không có dữ liệu trong kỳ" />
          </Panel>
        </>
      )}
    </div>
  )
}
