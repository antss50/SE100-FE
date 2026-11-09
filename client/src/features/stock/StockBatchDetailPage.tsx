import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardCheck, PackageMinus, PackagePlus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import {
  Button,
  DataTable,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  type Column,
} from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { stockService } from '../../services/stock.service'
import type { StockMovementItem, StockReferenceType } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { ExpiryBadge } from './ExpiryBadge'

const MOVEMENT_LABELS: Record<StockReferenceType, string> = {
  PURCHASE: 'Nhập kho',
  SALE: 'Bán lẻ tại POS',
  RETURN: 'Khách trả hàng',
  CHECK_ADJUST: 'Điều chỉnh kiểm kho',
  DISPOSAL: 'Xuất hủy',
  TESTER: 'Xuất tester',
  SUPPLIER_RETURN: 'Trả nhà cung cấp',
}

/** STK-02: chi tiết một lô và thẻ kho (STOCK_MOVEMENTS). */
export function StockBatchDetailPage() {
  const { batchId = '' } = useParams()
  const navigate = useNavigate()
  const canImport = useCan('STOCK_IMPORT_CREATE')
  const canCheck = useCan('STOCK_CHECK_CREATE')
  const canDispose = useCan('STOCK_DISPOSAL_CREATE')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.stock.product(`batch-${batchId}`),
    queryFn: () => stockService.batch(batchId),
  })
  const batch = data?.data

  if (isLoading) return <LoadingState />
  if (error || !batch) return <ErrorState message={getErrorMessage(error, 'Không tìm thấy lô hàng')} onRetry={() => void refetch()} />

  const onHand = batch.onHandQty ?? 0
  const blocked = batch.blockedQty ?? 0
  const cost = batch.costPrice ?? 0

  const columns: Column<StockMovementItem>[] = [
    { key: 'time', header: 'Thời gian', render: (m) => formatDateTime(m.createdAt) },
    { key: 'type', header: 'Loại biến động', render: (m) => MOVEMENT_LABELS[m.referenceType] },
    { key: 'ref', header: 'Mã tham chiếu', render: (m) => <span className="font-mono text-xs">{m.referenceCode}</span> },
    {
      key: 'change',
      header: 'Số lượng',
      align: 'right',
      render: (m) => (
        <span className={m.quantityChange > 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>
          {m.quantityChange > 0 ? '+' : ''}
          {formatNumber(m.quantityChange)}
        </span>
      ),
    },
    { key: 'balance', header: 'Tồn sau giao dịch', align: 'right', render: (m) => formatNumber(m.balanceAfter) },
    { key: 'by', header: 'Người thực hiện', render: (m) => m.createdByName ?? '—' },
    { key: 'reason', header: 'Ghi chú', render: (m) => m.reason ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.lotCode}
        description={`${batch.productName} · SKU ${batch.sku}${batch.barcode ? ` · Mã vạch ${batch.barcode}` : ''}`}
        breadcrumbs={[{ label: 'Tồn kho theo lô', to: '/stock' }, { label: batch.lotCode }]}
        actions={
          <>
            <ExpiryBadge status={batch.expiryStatus} days={batch.daysToExpiry} />
            {canImport && (
              <Button variant="secondary" icon={<PackagePlus className="size-4" aria-hidden="true" />} onClick={() => navigate('/purchase-orders/new')}>
                Nhập thêm lô này
              </Button>
            )}
            {canCheck && (
              <Button variant="secondary" icon={<ClipboardCheck className="size-4" aria-hidden="true" />} onClick={() => navigate('/inventory-checks/new', { state: { batchIds: [batch.id] } })}>
                Lập phiếu kiểm kê
              </Button>
            )}
            {canDispose && (
              <Button variant="danger" icon={<PackageMinus className="size-4" aria-hidden="true" />} onClick={() => navigate('/disposals/new', { state: { batchIds: [batch.id], issueType: 'DESTROY' } })}>
                Đề xuất xuất hủy / cách ly
              </Button>
            )}
          </>
        }
      />

      {batch.expiryStatus !== 'OK' && onHand > 0 && (
        <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {batch.expiryStatus === 'EXPIRED'
              ? 'Lô đã hết hạn nên POS không bán. Lập đề nghị xuất hủy để loại khỏi kho.'
              : `Lô hết hạn trong ${batch.daysToExpiry} ngày. POS tự ưu tiên xuất lô này trước (FEFO); cần xoay kệ để hàng hạn sớm ra trước.`}
          </span>
        </div>
      )}
      {batch.lockedByCheckId ? (
        <div className="rounded-xl border border-info/30 bg-info-soft p-3 text-sm text-info">
          Lô đang bị khóa để kiểm kho, tạm thời không bán và không nhập thêm.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tồn thực tế hiện tại" value={formatNumber(onHand)} hint={batch.unit} />
        <StatCard label="Đang cách ly" value={formatNumber(blocked)} hint={batch.pendingDisposalQty > 0 ? `${batch.pendingDisposalQty} đang chờ duyệt xuất khác` : 'Chờ hủy / lỗi bao bì'} />
        <StatCard label="Bán được tại POS" value={formatNumber(batch.availableQty)} hint="= tồn thực − cách ly (còn hạn, không khóa)" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-ink">Thông tin lô</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Ngày sản xuất</dt>
              <dd className="mt-1">{formatDate(batch.mfgDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Hạn sử dụng</dt>
              <dd className="mt-1">{formatDate(batch.expDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Ngày nhập kho</dt>
              <dd className="mt-1">{formatDate(batch.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Nhà cung cấp</dt>
              <dd className="mt-1">{batch.supplierName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Thứ tự FEFO</dt>
              <dd className="mt-1">{batch.fefoRank ? `#${batch.fefoRank} (ưu tiên xuất)` : batch.isSellable ? 'Không bán được' : 'Tester hãng, không bán'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Giá niêm yết</dt>
              <dd className="mt-1">{formatCurrency(batch.retailPrice)}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-ink">Giá trị tồn</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Giá vốn đơn vị</dt>
              <dd className="mt-1 font-semibold">{formatCurrency(cost)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Tổng giá trị tồn</dt>
              <dd className="mt-1 font-semibold">{formatCurrency(onHand * cost)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Vốn đang cách ly</dt>
              <dd className="mt-1 font-semibold">{formatCurrency(blocked * cost)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line p-4 text-sm font-bold text-ink">Nhật ký biến động thẻ kho ({batch.movements.length})</h2>
        <DataTable caption="Thẻ kho của lô" columns={columns} rows={batch.movements} rowKey={(m) => m.id} emptyTitle="Chưa có biến động" />
      </section>
    </div>
  )
}
