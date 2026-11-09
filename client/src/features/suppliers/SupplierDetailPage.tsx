import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Pencil, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import {
  Button,
  ConfirmDialog,
  DataTable,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  cn,
  toast,
  type Column,
} from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { purchaseOrdersService } from '../../services/purchase-orders.service'
import { suppliersService } from '../../services/suppliers.service'
import type { PurchaseOrder } from '../../types/stock'
import type { SupplierProductItem } from '../../types/suppliers'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { PurchaseOrderStatusBadge } from '../purchase-orders/PurchaseOrderStatusBadge'
import { SupplierFormModal } from './SupplierFormModal'

type Tab = 'history' | 'products'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value || '—'}</dd>
    </div>
  )
}

/** SUPP-02, SUPP-03: hồ sơ nhà cung cấp, sản phẩm cung ứng, lịch sử phiếu nhập. */
export function SupplierDetailPage() {
  const { supplierId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = useCan('SUPPLIER_MANAGE')
  const canSeeOrders = useCan('STOCK_IMPORT_VIEW')
  const [tab, setTab] = useState<Tab>('history')
  const [editOpen, setEditOpen] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)

  const supplierQuery = useQuery({
    queryKey: queryKeys.suppliers.detail(supplierId),
    queryFn: () => suppliersService.get(supplierId),
  })
  const supplier = supplierQuery.data?.data
  const ordersQuery = useQuery({
    queryKey: queryKeys.purchaseOrders.list({ supplierId }),
    queryFn: () => purchaseOrdersService.list({ supplierId: Number(supplierId), pageSize: 100 }),
    enabled: canSeeOrders && Boolean(supplier),
  })
  const productsQuery = useQuery({
    queryKey: queryKeys.suppliers.products(supplierId),
    queryFn: () => suppliersService.products(supplierId),
    enabled: Boolean(supplier),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })

  const deactivate = useMutation({
    mutationFn: () => suppliersService.deactivate(Number(supplierId), true),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã ngừng hợp tác')
      setConfirmStop(false)
      void refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const activate = useMutation({
    mutationFn: () => suppliersService.activate(Number(supplierId)),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã khôi phục hợp tác')
      void refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (supplierQuery.isLoading) return <LoadingState />
  if (supplierQuery.error || !supplier) {
    return <ErrorState message={getErrorMessage(supplierQuery.error, 'Không tìm thấy nhà cung cấp')} onRetry={() => void supplierQuery.refetch()} />
  }

  const orderColumns: Column<PurchaseOrder>[] = [
    { key: 'code', header: 'Mã phiếu', render: (o) => <span className="font-mono font-semibold">{o.poCode}</span> },
    { key: 'date', header: 'Ngày tạo', render: (o) => formatDateTime(o.createdAt) },
    { key: 'invoice', header: 'Số hóa đơn NCC', render: (o) => o.supplierInvoiceNo ?? '—' },
    { key: 'lines', header: 'Số lô', align: 'right', render: (o) => formatNumber(o.lineCount) },
    { key: 'qty', header: 'Số lượng', align: 'right', render: (o) => formatNumber(o.totalQuantity) },
    { key: 'total', header: 'Tổng tiền', align: 'right', render: (o) => formatCurrency(o.totalAmount) },
    { key: 'status', header: 'Trạng thái', render: (o) => <PurchaseOrderStatusBadge status={o.status} /> },
  ]
  const productColumns: Column<SupplierProductItem>[] = [
    { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
    { key: 'name', header: 'Sản phẩm', render: (p) => p.productName },
    { key: 'brand', header: 'Thương hiệu', render: (p) => p.brandName ?? '—' },
    { key: 'qty', header: 'Tổng đã nhập', align: 'right', render: (p) => formatNumber(p.totalQuantity) },
    { key: 'cost', header: 'Giá nhập gần nhất', align: 'right', render: (p) => formatCurrency(p.lastUnitCost) },
    { key: 'date', header: 'Lần nhập gần nhất', render: (p) => formatDate(p.lastPurchaseDate) },
  ]

  const tabClass = (t: Tab) =>
    cn(
      'rounded-lg px-4 py-2 text-sm font-semibold transition',
      tab === t ? 'bg-accent text-white' : 'text-ink-soft hover:bg-accent-soft'
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.supplierName}
        description={`${supplier.supplierCode}${supplier.taxCode ? ` · MST ${supplier.taxCode}` : ''}`}
        breadcrumbs={[{ label: 'Nhà cung cấp', to: '/suppliers' }, { label: supplier.supplierCode }]}
        actions={
          <>
            {supplier.status === 'ACTIVE' ? (
              <StatusBadge tone="success">Đang hợp tác</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Ngừng hợp tác</StatusBadge>
            )}
            {canManage && (
              <>
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditOpen(true)}>
                  Sửa thông tin
                </Button>
                {supplier.status === 'ACTIVE' ? (
                  <Button variant="danger" icon={<Ban className="size-4" aria-hidden="true" />} onClick={() => setConfirmStop(true)}>
                    Ngừng hợp tác
                  </Button>
                ) : (
                  <Button
                    icon={<RotateCcw className="size-4" aria-hidden="true" />}
                    loading={activate.isPending}
                    onClick={() => activate.mutate()}
                  >
                    Khôi phục hợp tác
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold text-ink">Thông tin liên hệ</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoRow label="Người đại diện" value={supplier.contactPerson} />
            <InfoRow label="Số điện thoại" value={supplier.phoneNumber} />
            <InfoRow label="Email đặt hàng" value={supplier.email} />
            <InfoRow label="Địa chỉ" value={supplier.address} />
            <div className="sm:col-span-2">
              <InfoRow label="Chính sách chiết khấu" value={supplier.note} />
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-ink">Tóm tắt nhập hàng</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Số phiếu hoàn tất</dt>
              <dd className="font-semibold">{formatNumber(supplier.orderCount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tổng giá trị nhập</dt>
              <dd className="font-semibold">{formatCurrency(supplier.totalPurchaseAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Nhập gần nhất</dt>
              <dd className="font-semibold">{formatDate(supplier.lastPurchaseDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Phiếu nháp còn dở</dt>
              <dd className="font-semibold">{formatNumber(supplier.draftOrderCount)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3" role="tablist">
          {canSeeOrders && (
            <button type="button" role="tab" aria-selected={tab === 'history'} className={tabClass('history')} onClick={() => setTab('history')}>
              Lịch sử nhập hàng
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'products' || !canSeeOrders}
            className={tabClass('products')}
            onClick={() => setTab('products')}
          >
            Sản phẩm cung ứng
          </button>
        </div>
        {tab === 'history' && canSeeOrders ? (
          <DataTable
            caption="Lịch sử phiếu nhập của nhà cung cấp"
            columns={orderColumns}
            rows={ordersQuery.data?.data.items}
            rowKey={(o) => o.id}
            loading={ordersQuery.isLoading}
            error={ordersQuery.error ? getErrorMessage(ordersQuery.error) : null}
            onRetry={() => void ordersQuery.refetch()}
            emptyTitle="Chưa có phiếu nhập nào"
            emptyDescription="Phiếu nhập kho của nhà cung cấp này sẽ hiện ở đây."
            onRowClick={(o) => navigate(`/purchase-orders/${o.id}`)}
          />
        ) : (
          <DataTable
            caption="Sản phẩm đã nhập từ nhà cung cấp"
            columns={productColumns}
            rows={productsQuery.data?.data}
            rowKey={(p) => p.productId}
            loading={productsQuery.isLoading}
            error={productsQuery.error ? getErrorMessage(productsQuery.error) : null}
            onRetry={() => void productsQuery.refetch()}
            emptyTitle="Chưa có sản phẩm cung ứng"
            emptyDescription="Sản phẩm cung ứng là các sản phẩm đã từng có trong phiếu nhập hoàn tất của nhà cung cấp."
          />
        )}
      </section>

      <SupplierFormModal open={editOpen} supplier={supplier} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={confirmStop}
        tone="danger"
        title="Ngừng hợp tác với nhà cung cấp?"
        message={
          supplier.draftOrderCount > 0
            ? `Nhà cung cấp còn ${supplier.draftOrderCount} phiếu nhập nháp. Dữ liệu cũ được giữ nguyên, nhưng nhà cung cấp sẽ không chọn được cho phiếu nhập mới.`
            : 'Dữ liệu cũ được giữ nguyên, nhưng nhà cung cấp sẽ không chọn được cho phiếu nhập mới. Có thể khôi phục bất cứ lúc nào.'
        }
        confirmLabel="Ngừng hợp tác"
        loading={deactivate.isPending}
        onConfirm={() => deactivate.mutate()}
        onCancel={() => setConfirmStop(false)}
      />
    </div>
  )
}
