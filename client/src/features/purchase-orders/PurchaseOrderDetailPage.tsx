import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Lock, Pencil } from 'lucide-react'
import { Fragment, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import {
  Button,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  PageHeader,
  toast,
} from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { purchaseOrdersService } from '../../services/purchase-orders.service'
import type { PurchaseOrderLine, PurchaseWarning } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format'
import { PurchaseOrderStatusBadge } from './PurchaseOrderStatusBadge'
import { PurchaseWarningList, usePurchaseWarnings } from './PurchaseWarnings'

interface ProductGroup {
  productId: number
  sku: string
  productName: string
  lines: PurchaseOrderLine[]
}

/** Gộp các dòng lô theo từng sản phẩm (giữ thứ tự xuất hiện đầu tiên của sản phẩm). */
function groupLinesByProduct(lines: PurchaseOrderLine[]): ProductGroup[] {
  const map = new Map<number, ProductGroup>()
  for (const l of lines) {
    const existing = map.get(l.productId)
    if (existing) {
      existing.lines.push(l)
    } else {
      map.set(l.productId, { productId: l.productId, sku: l.sku, productName: l.productName, lines: [l] })
    }
  }
  return [...map.values()]
}

/** STK-01: chi tiết phiếu nhập. Phiếu hoàn tất bị khóa sổ, không có nút sửa/xóa (luật 41). */
export function PurchaseOrderDetailPage() {
  const { purchaseOrderId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const canCreate = useCan('STOCK_IMPORT_CREATE')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const idempotencyKey = useRef(crypto.randomUUID())
  const confirmWarnings = (location.state as { warnings?: PurchaseWarning[] } | null)?.warnings ?? []

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.purchaseOrders.detail(purchaseOrderId),
    queryFn: () => purchaseOrdersService.get(purchaseOrderId),
  })
  const order = data?.data
  const previewWarnings = usePurchaseWarnings(
    order?.status === 'DRAFT'
      ? order.lines.map((l) => ({
          productId: l.productId,
          lotCode: l.lotCode,
          expDate: l.expDate,
          quantity: l.quantity,
          unitCost: l.unitCost,
        }))
      : []
  ).data

  const productGroups = useMemo(() => groupLinesByProduct(order?.lines ?? []), [order?.lines])
  const distinctProductCount = order ? (order.productCount ?? productGroups.length) : 0

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
  }

  const confirm = useMutation({
    mutationFn: () => purchaseOrdersService.confirm(Number(purchaseOrderId), idempotencyKey.current),
    onSuccess: (res) => {
      toast.success('Xác nhận nhập kho thành công')
      setConfirmOpen(false)
      refresh()
      navigate(`/purchase-orders/${res.data.order.id}`, { replace: true, state: { warnings: res.data.warnings } })
    },
    onError: (e) => {
      setConfirmOpen(false)
      toast.error(getErrorMessage(e))
    },
  })
  const cancel = useMutation({
    mutationFn: () => purchaseOrdersService.cancel(Number(purchaseOrderId)),
    onSuccess: () => {
      toast.success('Đã hủy phiếu nháp')
      setCancelOpen(false)
      refresh()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (isLoading) return <LoadingState />
  if (error || !order) return <ErrorState message={getErrorMessage(error, 'Không tìm thấy phiếu nhập')} onRetry={() => void refetch()} />

  const warnings = order.status === 'DRAFT' ? (previewWarnings ?? []) : confirmWarnings

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.poCode}
        description={`Tạo lúc ${formatDateTime(order.createdAt)} bởi ${order.createdByName}`}
        breadcrumbs={[{ label: 'Phiếu nhập kho', to: '/purchase-orders' }, { label: order.poCode }]}
        actions={
          <>
            <PurchaseOrderStatusBadge status={order.status} />
            {order.status === 'COMPLETED' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-medium text-neutral">
                <Lock className="size-3" aria-hidden="true" />
                Chứng từ khóa sổ
              </span>
            )}
            {order.status === 'DRAFT' && canCreate && (
              <>
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => navigate(`/purchase-orders/${order.id}/edit`)}>
                  Sửa phiếu
                </Button>
                <Button variant="danger" icon={<Ban className="size-4" aria-hidden="true" />} onClick={() => setCancelOpen(true)}>
                  Hủy phiếu
                </Button>
                <Button
                  icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
                  loading={confirm.isPending}
                  disabled={confirm.isPending}
                  onClick={() => setConfirmOpen(true)}
                >
                  Xác nhận nhập kho
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold text-ink">Nhà cung cấp & chứng từ</h2>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Nhà cung cấp</dt>
              <dd className="mt-1">
                <Link to={`/suppliers/${order.supplierId}`} className="font-medium text-accent hover:underline">
                  {order.supplierName}
                </Link>
                <span className="ml-2 font-mono text-xs text-muted">{order.supplierCode}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Số hóa đơn NCC</dt>
              <dd className="mt-1">{order.supplierInvoiceNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Xác nhận nhập kho lúc</dt>
              <dd className="mt-1">{formatDateTime(order.confirmedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted">Ghi chú</dt>
              <dd className="mt-1">{order.note ?? '—'}</dd>
            </div>
          </dl>
        </section>
        <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-bold text-ink">Giá trị phiếu</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Tổng số sản phẩm</span>
            <span className="font-semibold">{formatNumber(distinctProductCount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Tổng số lượng</span>
            <span className="font-semibold">{formatNumber(order.totalQuantity)}</span>
          </div>
          <div className="rounded-xl bg-accent-soft p-3">
            <p className="text-xs text-muted">Tổng tiền nhập</p>
            <p className="text-xl font-bold text-accent">{formatCurrency(order.totalAmount)}</p>
          </div>
        </section>
      </div>

      {warnings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-ink">{order.status === 'DRAFT' ? 'Cảnh báo trước khi nhập kho' : 'Cảnh báo khi nhập kho'}</h2>
          <PurchaseWarningList warnings={warnings} />
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Các dòng lô của phiếu nhập</caption>
          <thead>
            <tr className="border-b border-line bg-card text-left text-xs font-semibold uppercase text-muted">
              <th className="px-4 py-3">Sản phẩm & SKU</th>
              <th className="px-4 py-3">Mã lô</th>
              <th className="px-4 py-3">NSX</th>
              <th className="px-4 py-3">HSD</th>
              <th className="px-4 py-3 text-right">SL</th>
              <th className="px-4 py-3 text-right">Giá nhập</th>
              <th className="px-4 py-3 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {productGroups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Chưa có dòng sản phẩm nào.
                </td>
              </tr>
            ) : (
              productGroups.map((group) => (
                <Fragment key={group.productId}>
                  {group.lines.map((l, idx) => (
                    <tr key={l.id} className="border-t border-line hover:bg-card/40">
                      {idx === 0 && (
                        <td
                          rowSpan={group.lines.length}
                          className="border-r border-line/60 px-4 py-3 align-top"
                        >
                          <p className="font-semibold text-ink">{group.productName}</p>
                          <p className="font-mono text-xs text-muted">{group.sku}</p>
                          {group.lines.length > 1 && (
                            <span className="mt-1 inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                              {group.lines.length} lô
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono">{l.lotCode}</td>
                      <td className="px-4 py-3">{formatDate(l.mfgDate)}</td>
                      <td className="px-4 py-3">{formatDate(l.expDate)}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(l.quantity)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(l.unitCost)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(l.lineTotal)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận nhập kho?"
        message="Hệ thống cộng tồn theo từng lô và ghi thẻ kho. Phiếu hoàn tất không thể sửa hay xóa."
        confirmLabel="Xác nhận nhập kho"
        loading={confirm.isPending}
        onConfirm={() => confirm.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={cancelOpen}
        tone="danger"
        title="Hủy phiếu nhập nháp?"
        message="Phiếu bị hủy sẽ không nhập kho và không khôi phục lại được."
        confirmLabel="Hủy phiếu"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  )
}
