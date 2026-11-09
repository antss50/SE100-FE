import { useQuery } from '@tanstack/react-query'
import { Boxes, PackageOpen, Truck, Wallet } from 'lucide-react'
import { DataTable, ErrorState, LoadingState, StatCard, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { reportsService } from '../../services/reports.service'
import type { PurchaseBrandRow, PurchaseSupplierRow } from '../../types/reports'
import { downloadCsv } from '../../utils/csv'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatNumber } from '../../utils/format'
import { BarChart, Panel } from './charts'
import { ReportFilters } from './ReportFilters'
import type { ReportRangeController } from './report-range'

const supplierColumns: Column<PurchaseSupplierRow>[] = [
  { key: 'name', header: 'Nhà cung cấp', render: (s) => s.supplierName },
  { key: 'orders', header: 'Số phiếu', align: 'right', render: (s) => formatNumber(s.orderCount) },
  { key: 'qty', header: 'Số lượng', align: 'right', render: (s) => formatNumber(s.quantity) },
  { key: 'amount', header: 'Giá trị nhập', align: 'right', render: (s) => formatCurrency(s.amount) },
]

const brandColumns: Column<PurchaseBrandRow>[] = [
  { key: 'name', header: 'Thương hiệu', render: (b) => b.brandName },
  { key: 'qty', header: 'Số lượng', align: 'right', render: (b) => formatNumber(b.quantity) },
  { key: 'amount', header: 'Giá trị nhập', align: 'right', render: (b) => formatCurrency(b.amount) },
]

/** REP-05: nhập hàng theo NCC, thương hiệu, kỳ (phiếu COMPLETED theo ngày xác nhận). */
export function PurchaseTab({ controller }: { controller: ReportRangeController }) {
  const { state, error } = controller
  const params = { fromDate: state.fromDate, toDate: state.toDate, granularity: state.granularity }
  const query = useQuery({
    queryKey: queryKeys.reports.report('purchases', params),
    queryFn: () => reportsService.purchases(params),
    enabled: error === null,
    placeholderData: (prev) => prev,
  })
  const report = query.data?.data

  const exportCsv = () => {
    if (!report) return
    downloadCsv(
      `nhap-hang_${state.fromDate}_${state.toDate}.csv`,
      ['Mục', 'Tên', 'Số phiếu', 'Số lượng', 'Giá trị nhập'],
      [
        ...report.bySupplier.map((s) => ['Nhà cung cấp', s.supplierName, s.orderCount, s.quantity, s.amount]),
        ...report.byBrand.map((b) => ['Thương hiệu', b.brandName, '', b.quantity, b.amount]),
        ...report.series.map((p) => ['Kỳ', p.label, p.orderCount, '', p.amount]),
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
            <StatCard label="Giá trị nhập" value={formatCurrency(report.summary.totalAmount)} icon={Wallet} />
            <StatCard label="Phiếu nhập" value={formatNumber(report.summary.orderCount)} icon={PackageOpen} hint="Phiếu đã hoàn tất" />
            <StatCard label="Số lượng nhập" value={formatNumber(report.summary.quantity)} icon={Boxes} />
            <StatCard label="Nhà cung cấp" value={formatNumber(report.summary.supplierCount)} icon={Truck} hint="Có phát sinh nhập trong kỳ" />
          </div>
          <Panel title="Giá trị nhập theo kỳ">
            <BarChart title="Giá trị nhập theo kỳ" data={report.series.map((p) => ({ label: p.label, value: p.amount }))} />
          </Panel>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Theo nhà cung cấp">
              <DataTable columns={supplierColumns} rows={report.bySupplier} rowKey={(s) => s.supplierId} caption="Nhập hàng theo NCC" emptyTitle="Không có phiếu nhập trong kỳ" />
            </Panel>
            <Panel title="Theo thương hiệu">
              <DataTable columns={brandColumns} rows={report.byBrand} rowKey={(b) => b.brandName} caption="Nhập hàng theo thương hiệu" emptyTitle="Không có dữ liệu" />
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
