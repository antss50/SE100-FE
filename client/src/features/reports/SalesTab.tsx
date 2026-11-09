import { useQuery } from '@tanstack/react-query'
import { Package, ReceiptText, Undo2, Wallet } from 'lucide-react'
import { DataTable, ErrorState, LoadingState, StatCard, StatusBadge, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { reportsService } from '../../services/reports.service'
import { PAYMENT_METHOD_LABELS } from '../../types/pos'
import type { SalesCashierRow, SalesProductRow, SalesShiftRow } from '../../types/reports'
import { downloadCsv } from '../../utils/csv'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime, formatNumber } from '../../utils/format'
import { HBarList, Panel } from './charts'
import { ReportFilters } from './ReportFilters'
import type { ReportRangeController } from './report-range'

const productColumns: Column<SalesProductRow>[] = [
  { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
  { key: 'name', header: 'Sản phẩm', render: (p) => p.productName },
  { key: 'qty', header: 'Đã bán', align: 'right', render: (p) => formatNumber(p.quantity) },
  { key: 'ret', header: 'Bị trả', align: 'right', render: (p) => formatNumber(p.returnedQuantity) },
  { key: 'rev', header: 'Doanh thu', align: 'right', render: (p) => formatCurrency(p.revenue) },
]

const cashierColumns: Column<SalesCashierRow>[] = [
  { key: 'name', header: 'Thu ngân', render: (c) => c.cashierName },
  { key: 'orders', header: 'Số đơn', align: 'right', render: (c) => formatNumber(c.orderCount) },
  { key: 'amount', header: 'Doanh số', align: 'right', render: (c) => formatCurrency(c.amount) },
  { key: 'returns', header: 'Phiếu trả', align: 'right', render: (c) => formatNumber(c.returnCount) },
  { key: 'refund', header: 'Tiền hoàn', align: 'right', render: (c) => formatCurrency(c.returnedAmount) },
]

const shiftColumns: Column<SalesShiftRow>[] = [
  { key: 'code', header: 'Mã ca', render: (s) => <span className="font-mono text-xs font-semibold text-accent">{s.shiftCode}</span> },
  { key: 'cashier', header: 'Thu ngân', render: (s) => s.cashierName },
  { key: 'time', header: 'Mở lúc', render: (s) => formatDateTime(s.openedAt) },
  { key: 'orders', header: 'Số đơn', align: 'right', render: (s) => formatNumber(s.orderCount) },
  { key: 'amount', header: 'Doanh số', align: 'right', render: (s) => formatCurrency(s.amount) },
  {
    key: 'diff',
    header: 'Chênh lệch tiền',
    align: 'right',
    render: (s) =>
      s.status === 'OPEN' ? (
        <StatusBadge tone="info">Đang mở</StatusBadge>
      ) : s.differenceAmount ? (
        <span className="font-semibold text-danger">{formatCurrency(s.differenceAmount)}</span>
      ) : (
        'Khớp'
      ),
  },
]

/** REP-03: báo cáo bán hàng. Thu ngân (`REPORT_SALES_OWN_SHIFT`) chỉ nhận dữ liệu của mình. */
export function SalesTab({ controller }: { controller: ReportRangeController }) {
  const { state, error } = controller
  const params = { fromDate: state.fromDate, toDate: state.toDate }
  const query = useQuery({
    queryKey: queryKeys.reports.report('sales', params),
    queryFn: () => reportsService.sales(params),
    enabled: error === null,
    placeholderData: (prev) => prev,
  })
  const report = query.data?.data

  const exportCsv = () => {
    if (!report) return
    downloadCsv(
      `ban-hang_${state.fromDate}_${state.toDate}.csv`,
      ['Mục', 'Tên', 'Số đơn / Số lượng', 'Giá trị'],
      [
        ...report.topProducts.map((p) => ['Top sản phẩm', `${p.sku} - ${p.productName}`, p.quantity, p.revenue]),
        ...report.byPayment.map((p) => ['Phương thức thanh toán', PAYMENT_METHOD_LABELS[p.method], p.orderCount, p.amount]),
        ...report.byCashier.map((c) => ['Thu ngân', c.cashierName, c.orderCount, c.amount]),
        ...report.byShift.map((s) => ['Ca', `${s.shiftCode} - ${s.cashierName}`, s.orderCount, s.amount]),
      ]
    )
  }

  return (
    <div className="space-y-5">
      <ReportFilters controller={controller} onExport={exportCsv} exportDisabled={!report} />
      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {report && (
        <>
          {report.scope === 'OWN' && (
            <p className="rounded-xl bg-info-soft p-3 text-sm text-info">Bạn chỉ xem được số liệu bán hàng của các ca do mình phụ trách.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Số đơn" value={formatNumber(report.summary.orderCount)} icon={ReceiptText} hint={`Trung bình ${formatCurrency(report.summary.averageOrderValue)}/đơn`} />
            <StatCard label="Doanh số" value={formatCurrency(report.summary.totalAmount)} icon={Wallet} hint="Tổng tiền đơn hoàn tất" />
            <StatCard label="Số lượng bán" value={formatNumber(report.summary.itemsSold)} icon={Package} />
            <StatCard label="Hoàn trả" value={formatCurrency(report.summary.returnedAmount)} icon={Undo2} hint={`${formatNumber(report.summary.returnCount)} phiếu trả`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Theo phương thức thanh toán">
              <HBarList
                items={report.byPayment.map((p) => ({ label: `${PAYMENT_METHOD_LABELS[p.method]} (${p.orderCount} đơn)`, value: p.amount }))}
              />
            </Panel>
            <Panel title="Theo thu ngân">
              <DataTable columns={cashierColumns} rows={report.byCashier} rowKey={(c) => c.cashierId} caption="Bán hàng theo thu ngân" emptyTitle="Không có dữ liệu" />
            </Panel>
          </div>
          <Panel title="Sản phẩm bán chạy">
            <DataTable columns={productColumns} rows={report.topProducts} rowKey={(p) => p.productId} caption="Top sản phẩm" emptyTitle="Chưa bán được sản phẩm nào trong kỳ" />
          </Panel>
          <Panel title="Sản phẩm bán chậm" right={<span className="text-xs text-muted">Kể cả hàng chưa bán được cái nào</span>}>
            <DataTable columns={productColumns} rows={report.slowProducts} rowKey={(p) => p.productId} caption="Sản phẩm bán chậm" emptyTitle="Không có dữ liệu" />
          </Panel>
          <Panel title="Theo ca bán hàng">
            <DataTable columns={shiftColumns} rows={report.byShift} rowKey={(s) => s.shiftId} caption="Bán hàng theo ca" emptyTitle="Không có ca nào trong kỳ" />
          </Panel>
        </>
      )}
    </div>
  )
}
