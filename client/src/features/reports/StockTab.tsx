import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Archive, Boxes, Trash2 } from 'lucide-react'
import { DataTable, ErrorState, LoadingState, StatCard, StatusBadge, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { reportsService } from '../../services/reports.service'
import type { StockReportLotRow, StockReportProductRow } from '../../types/reports'
import { downloadCsv } from '../../utils/csv'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatNumber } from '../../utils/format'
import { Panel } from './charts'
import { ReportFilters } from './ReportFilters'
import type { ReportRangeController } from './report-range'

const DISPOSAL_LABELS = { DESTROY: 'Hủy hàng', TESTER: 'Xuất tester', RETURN_TO_SUPPLIER: 'Trả nhà cung cấp' } as const

const productColumns: Column<StockReportProductRow>[] = [
  { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
  { key: 'name', header: 'Sản phẩm', render: (p) => p.productName },
  { key: 'cat', header: 'Danh mục', render: (p) => p.categoryName || '—' },
  { key: 'onHand', header: 'Tồn', align: 'right', render: (p) => formatNumber(p.onHandQty) },
  { key: 'blocked', header: 'Cách ly', align: 'right', render: (p) => formatNumber(p.blockedQty) },
  { key: 'min', header: 'Ngưỡng', align: 'right', render: (p) => formatNumber(p.minStockAlert) },
  { key: 'value', header: 'Giá trị tồn', align: 'right', render: (p) => formatCurrency(p.value) },
  { key: 'state', header: 'Trạng thái', render: (p) => (p.belowMin ? <StatusBadge tone="danger">Dưới ngưỡng</StatusBadge> : <StatusBadge tone="success">Đủ</StatusBadge>) },
]

const lotColumns: Column<StockReportLotRow>[] = [
  { key: 'sku', header: 'SKU', render: (l) => <span className="font-mono text-xs">{l.sku}</span> },
  { key: 'name', header: 'Sản phẩm', render: (l) => l.productName },
  { key: 'lot', header: 'Lô', render: (l) => <span className="font-mono text-xs">{l.lotCode}</span> },
  { key: 'exp', header: 'Hạn dùng', render: (l) => formatDate(l.expDate) },
  {
    key: 'days',
    header: 'Còn lại',
    align: 'right',
    render: (l) => (l.daysToExpiry < 0 ? `Quá hạn ${-l.daysToExpiry} ngày` : `${l.daysToExpiry} ngày`),
  },
  { key: 'qty', header: 'Tồn', align: 'right', render: (l) => formatNumber(l.onHandQty) },
  { key: 'stay', header: 'Lưu kho', align: 'right', render: (l) => `${l.daysInStock} ngày` },
  { key: 'value', header: 'Giá trị', align: 'right', render: (l) => formatCurrency(l.value) },
]

/** REP-04: tồn kho và hạn dùng. Tồn chụp tại thời điểm xem; khoảng ngày chỉ áp cho hàng hủy. */
export function StockTab({ controller }: { controller: ReportRangeController }) {
  const { state, error } = controller
  const params = { fromDate: state.fromDate, toDate: state.toDate }
  const query = useQuery({
    queryKey: queryKeys.reports.report('stock', params),
    queryFn: () => reportsService.stock(params),
    enabled: error === null,
    placeholderData: (prev) => prev,
  })
  const report = query.data?.data

  const exportCsv = () => {
    if (!report) return
    downloadCsv(
      `ton-kho_${state.toDate}.csv`,
      ['SKU', 'Sản phẩm', 'Danh mục', 'Tồn', 'Cách ly', 'Ngưỡng cảnh báo', 'Giá trị tồn', 'Dưới ngưỡng'],
      report.products.map((p) => [p.sku, p.productName, p.categoryName, p.onHandQty, p.blockedQty, p.minStockAlert, p.value, p.belowMin ? 'Có' : 'Không'])
    )
  }

  return (
    <div className="space-y-5">
      <ReportFilters controller={controller} onExport={exportCsv} exportDisabled={!report} />
      <p className="text-xs text-muted">Tồn kho và hạn dùng tính tại thời điểm xem; khoảng ngày chỉ dùng cho giá trị hàng hủy.</p>
      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Giá trị tồn kho" value={formatCurrency(report.summary.inventoryValue)} icon={Boxes} hint={`${report.summary.skuCount} SKU · ${report.summary.lotCount} lô · ${formatNumber(report.summary.totalQty)} sản phẩm`} />
            <StatCard label="Dưới ngưỡng tồn" value={formatNumber(report.summary.belowMinCount)} icon={AlertTriangle} hint="SKU đang bán có tồn ≤ ngưỡng cảnh báo" />
            <StatCard
              label="Cận hạn"
              value={formatNumber(report.summary.nearExpiryLots)}
              icon={Archive}
              hint={`Theo ngưỡng từng sản phẩm · Giá trị ${formatCurrency(report.summary.nearExpiryValue)}`}
            />
            <StatCard label="Đã hết hạn còn tồn" value={formatNumber(report.summary.expiredLots)} icon={Trash2} hint={`Giá trị ${formatCurrency(report.summary.expiredValue)}`} />
          </div>
          <Panel title="Tồn kho theo sản phẩm">
            <DataTable columns={productColumns} rows={report.products} rowKey={(p) => p.productId} caption="Tồn kho theo sản phẩm" emptyTitle="Kho đang trống" />
          </Panel>
          <Panel title="Lô cận hạn">
            <DataTable columns={lotColumns} rows={report.nearExpiryLots} rowKey={(l) => l.batchId} caption="Lô cận hạn" emptyTitle="Không có lô cận hạn" />
          </Panel>
          <Panel title="Lô đã hết hạn còn tồn">
            <DataTable columns={lotColumns} rows={report.expiredLots} rowKey={(l) => l.batchId} caption="Lô hết hạn" emptyTitle="Không có lô hết hạn còn tồn" />
          </Panel>
          <Panel title="Hàng xuất hủy / tester / trả NCC đã duyệt trong kỳ" right={<span className="text-sm font-semibold text-danger">Tổn thất do hủy: {formatCurrency(report.summary.disposalLoss)}</span>}>
            <DataTable
              columns={[
                { key: 'type', header: 'Loại', render: (d) => DISPOSAL_LABELS[d.issueType] },
                { key: 'count', header: 'Số phiếu', align: 'right', render: (d) => formatNumber(d.count) },
                { key: 'qty', header: 'Số lượng', align: 'right', render: (d) => formatNumber(d.quantity) },
                { key: 'cost', header: 'Giá trị (giá vốn)', align: 'right', render: (d) => formatCurrency(d.totalCost) },
              ]}
              rows={report.disposals}
              rowKey={(d) => d.issueType}
              caption="Hàng xuất khác"
              emptyTitle="Không có phiếu xuất được duyệt trong kỳ"
            />
          </Panel>
        </>
      )}
    </div>
  )
}
