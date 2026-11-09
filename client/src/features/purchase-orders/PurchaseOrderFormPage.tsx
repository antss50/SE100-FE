import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Plus, ScanLine } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  toast,
} from '../../components/ui'
import { FieldShell, Input } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { productsService } from '../../services/products.service'
import { purchaseOrdersService } from '../../services/purchase-orders.service'
import { suppliersService } from '../../services/suppliers.service'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatNumber } from '../../utils/format'
import { PurchaseOrderLinesEditor } from './PurchaseOrderLinesEditor'
import {
  EMPTY_LINE,
  fromOrder,
  purchaseOrderFormSchema,
  toLineInputs,
  toOrderInput,
  type PurchaseOrderFormValues,
} from './purchase-order-form'
import { PurchaseWarningList, usePurchaseWarnings } from './PurchaseWarnings'

const DEFAULT_VALUES: PurchaseOrderFormValues = { supplierId: '', supplierInvoiceNo: '', note: '', lines: [EMPTY_LINE] }

/** STK-01: tạo hoặc sửa phiếu nhập kho nháp, rồi xác nhận nhập kho. */
export function PurchaseOrderFormPage() {
  const { purchaseOrderId } = useParams()
  const editingId = purchaseOrderId ? Number(purchaseOrderId) : null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scanRef = useRef<HTMLInputElement>(null)
  const [scanValue, setScanValue] = useState('')
  const [confirmValues, setConfirmValues] = useState<PurchaseOrderFormValues | null>(null)
  /** Khóa idempotency cố định cho phiếu này: bấm xác nhận nhiều lần không cộng tồn nhiều lần (luật 30). */
  const idempotencyKey = useRef(crypto.randomUUID())
  /** Phiếu đã lưu trong phiên (để lần lưu sau là sửa, không tạo phiếu mới). */
  const savedId = useRef<number | null>(editingId)

  const orderQuery = useQuery({
    queryKey: queryKeys.purchaseOrders.detail(editingId ?? 'new'),
    queryFn: () => purchaseOrdersService.get(editingId as number),
    enabled: editingId !== null,
  })
  const suppliersQuery = useQuery({
    queryKey: queryKeys.suppliers.list({ status: 'ACTIVE', pageSize: 100, scope: 'form' }),
    queryFn: () => suppliersService.list({ status: 'ACTIVE', pageSize: 100 }),
  })
  const productsQuery = useQuery({
    queryKey: ['products', 'for-purchase'],
    queryFn: () => productsService.getProducts({ status: 'ACTIVE', pageSize: 200 }),
  })
  const products = useMemo(() => (productsQuery.data?.data.items ?? []).filter((p) => p.id), [productsQuery.data])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({ resolver: zodResolver(purchaseOrderFormSchema), defaultValues: DEFAULT_VALUES })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })

  useEffect(() => {
    if (orderQuery.data) reset(fromOrder(orderQuery.data.data))
  }, [orderQuery.data, reset])

  const lineInputs = useMemo(() => toLineInputs(lines ?? []), [lines])
  const warnings = usePurchaseWarnings(lineInputs).data ?? []
  const lineTotals = lineInputs.map((l) => l.quantity * l.unitCost)
  const totalQty = lineInputs.reduce((n, l) => n + l.quantity, 0)
  const totalAmount = lineTotals.reduce((n, v) => n + v, 0)
  const existingLots = (orderQuery.data?.data.lines ?? []).map((l) => Boolean(l.existingBatch))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        scanRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const save = async (values: PurchaseOrderFormValues) => {
    const input = toOrderInput(values)
    const res = savedId.current ? await purchaseOrdersService.update(savedId.current, input) : await purchaseOrdersService.create(input)
    savedId.current = res.data.id
    return res.data
  }

  const draftMutation = useMutation({
    mutationFn: save,
    onSuccess: (order) => {
      toast.success(`Đã lưu phiếu nháp ${order.poCode}`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      navigate(`/purchase-orders/${order.id}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const confirmMutation = useMutation({
    mutationFn: async (values: PurchaseOrderFormValues) => {
      const order = await save(values)
      return purchaseOrdersService.confirm(order.id, idempotencyKey.current)
    },
    onSuccess: (res) => {
      toast.success(`Đã nhập kho phiếu ${res.data.order.poCode}`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      navigate(`/purchase-orders/${res.data.order.id}`, { state: { warnings: res.data.warnings } })
    },
    onError: (e) => {
      setConfirmValues(null)
      toast.error(getErrorMessage(e))
    },
  })
  const busy = draftMutation.isPending || confirmMutation.isPending || confirmMutation.isSuccess

  const scan = () => {
    const code = scanValue.trim().toLowerCase()
    if (!code) return
    const product = products.find((p) => p.barcode?.toLowerCase() === code || p.sku.toLowerCase() === code)
    if (!product) {
      toast.error(`Không tìm thấy sản phẩm với mã "${scanValue.trim()}"`)
      return
    }
    append({ ...EMPTY_LINE, productId: String(product.id) })
    setScanValue('')
  }

  if (editingId !== null && orderQuery.isLoading) return <LoadingState />
  if (editingId !== null && orderQuery.error) {
    return <ErrorState message={getErrorMessage(orderQuery.error)} onRetry={() => void orderQuery.refetch()} />
  }
  if (orderQuery.data && orderQuery.data.data.status !== 'DRAFT') {
    return <ErrorState message="Phiếu đã hoàn tất hoặc đã hủy nên không thể sửa (luật 41)." />
  }

  const supplierOptions = (suppliersQuery.data?.data.items ?? []).map((s) => ({
    value: String(s.id),
    label: `${s.supplierCode} · ${s.supplierName}`,
  }))

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit((values) => draftMutation.mutate(values))}>
      <PageHeader
        title={editingId ? `Sửa phiếu nhập ${orderQuery.data?.data.poCode ?? ''}` : 'Tạo phiếu nhập kho theo lô'}
        breadcrumbs={[{ label: 'Phiếu nhập kho', to: '/purchase-orders' }, { label: editingId ? 'Sửa phiếu nháp' : 'Phiếu mới' }]}
        actions={
          <Button variant="secondary" onClick={() => navigate('/purchase-orders')} disabled={busy}>
            Danh sách phiếu
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-bold text-ink">Thông tin chứng từ & Nhà cung cấp</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Nhà cung cấp"
                required
                placeholder="Chọn nhà cung cấp đang hợp tác"
                options={supplierOptions}
                error={errors.supplierId?.message}
                hint="Chỉ hiện nhà cung cấp đang hợp tác"
                {...register('supplierId')}
              />
              <Input label="Số hóa đơn NCC (tùy chọn)" error={errors.supplierInvoiceNo?.message} {...register('supplierInvoiceNo')} />
              <FieldShell id="po-note" label="Ghi chú nghiệp vụ kho" className="sm:col-span-2">
                <textarea
                  id="po-note"
                  rows={2}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  {...register('note')}
                />
              </FieldShell>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
              <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => append(EMPTY_LINE)}>
                Thêm dòng lô
              </Button>
              <label className="relative min-w-64 flex-1">
                <span className="sr-only">Quét mã vạch hoặc nhập SKU</span>
                <ScanLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  ref={scanRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      scan()
                    }
                  }}
                  placeholder="Quét mã vạch sản phẩm hoặc nhập SKU rồi Enter (F2)"
                  className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </label>
            </div>
            <PurchaseOrderLinesEditor
              fields={fields}
              products={products}
              register={register}
              errors={errors}
              lineTotals={lineTotals}
              existingLots={existingLots}
              onRemove={remove}
            />
            {typeof errors.lines?.message === 'string' && (
              <p role="alert" className="p-3 text-xs text-danger">
                {errors.lines.message}
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-bold text-ink">Tóm tắt phiếu</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Tổng số dòng lô</dt>
              <dd className="font-semibold">{formatNumber(fields.length)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tổng số lượng nhập</dt>
              <dd className="font-semibold">{formatNumber(totalQty)}</dd>
            </div>
          </dl>
          <div className="rounded-xl bg-accent-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tổng tiền nhập</p>
            <p className="mt-1 text-2xl font-bold text-accent">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cảnh báo nghiệp vụ cần duyệt</p>
            {warnings.length === 0 ? (
              <p className="text-xs text-muted">Chưa có cảnh báo.</p>
            ) : (
              <PurchaseWarningList warnings={warnings} />
            )}
          </div>
          <div className="space-y-2 pt-2">
            <Button
              className="w-full"
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              loading={confirmMutation.isPending}
              disabled={busy}
              onClick={handleSubmit((values) => setConfirmValues(values))}
            >
              Xác nhận nhập kho
            </Button>
            <Button className="w-full" variant="secondary" type="submit" loading={draftMutation.isPending} disabled={busy}>
              Lưu bản nháp
            </Button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmValues !== null}
        title="Xác nhận nhập kho?"
        message="Sau khi xác nhận, hệ thống cộng tồn theo từng lô và ghi thẻ kho. Phiếu hoàn tất không thể sửa hay xóa."
        confirmLabel="Xác nhận nhập kho"
        loading={confirmMutation.isPending}
        onConfirm={() => confirmValues && confirmMutation.mutate(confirmValues)}
        onCancel={() => setConfirmValues(null)}
      />
    </form>
  )
}
