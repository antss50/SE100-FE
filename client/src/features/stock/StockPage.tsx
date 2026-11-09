import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Clock, Layers, ShieldAlert, Plus, PackageMinus, ClipboardCheck, Beaker, TriangleAlert, Lightbulb, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import {
  Button,
  DataTable,
  PageHeader,
  Pagination,
  StatCard,
  cn,
  toast,
  type Column,
} from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { productsService } from '../../services/products.service'
import { stockService } from '../../services/stock.service'
import { inventoryChecksService } from '../../services/inventory-checks.service'
import type { StockBatchItem, StockExpiryFilter } from '../../types/stock'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatNumber } from '../../utils/format'
import { ExpiryBadge } from './ExpiryBadge'
import { FefoScanPanel } from './FefoScanPanel'

type Tab = 'ALL' | 'EXPIRY' | 'QUARANTINE'
const PAGE_SIZE = 10

/** STK-02 (tồn theo lô) và STK-03 (cận hạn / hết hạn). Thu ngân chỉ thấy tồn khả dụng. */
export function StockPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const canFull = useCan(['STOCK_VIEW', 'STOCK_EXPIRY_VIEW'])
  const canExpiry = useCan('STOCK_EXPIRY_VIEW')
  const canCheck = useCan('STOCK_CHECK_CREATE')
  const canDispose = useCan('STOCK_DISPOSAL_CREATE')
  const canImport = useCan('STOCK_IMPORT_CREATE')

  const [tab, setTab] = useState<Tab>('ALL')
  const [keyword, setKeyword] = useState('')
  const [expiry, setExpiry] = useState<StockExpiryFilter>('ALL')
  const [categoryCode, setCategoryCode] = useState('')
  const [inStockOnly, setInStockOnly] = useState(true)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  const params = {
    keyword,
    categoryCode,
    expiry: tab === 'EXPIRY' ? (expiry === 'ALL' ? 'WARNING' : expiry) : canFull ? expiry : undefined,
    quarantined: tab === 'QUARANTINE' ? true : undefined,
    inStockOnly: canFull && inStockOnly ? true : undefined,
    page,
    pageSize: PAGE_SIZE,
  }
  const batches = useQuery({
    queryKey: queryKeys.stock.batches(params),
    queryFn: () => stockService.batches(params),
    placeholderData: (prev) => prev,
  })
  const summary = useQuery({
    queryKey: queryKeys.stock.summary,
    queryFn: () => stockService.summary(),
    enabled: canFull,
  })
  const categories = useQuery({
    queryKey: ['categories', 'for-stock'],
    queryFn: () => productsService.getCategories({ pageSize: 100 }),
    enabled: canFull,
  })
  const s = summary.data?.data

  const changeTab = (next: Tab) => {
    setTab(next)
    setExpiry('ALL')
    setPage(1)
    setSelected([])
  }
  const toggle = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const startCheck = useMutation({
    mutationFn: (batchIds: number[]) => inventoryChecksService.create({ batchIds }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryChecks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      navigate(`/inventory-checks/${res.data.id}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns: Column<StockBatchItem>[] = [
    ...(canFull && (canCheck || canDispose)
      ? [
          {
            key: 'select',
            header: <span className="sr-only">Chọn lô</span>,
            render: (b: StockBatchItem) => (
              <input
                type="checkbox"
                aria-label={`Chọn lô ${b.lotCode}`}
                checked={selected.includes(b.id)}
                onChange={() => toggle(b.id)}
                onClick={(e) => e.stopPropagation()}
                className="size-6 cursor-pointer accent-accent"
              />
            ),
          },
        ]
      : []),
    {
      key: 'product',
      header: 'Sản phẩm & SKU',
      render: (b) => (
        <div>
          <p className="font-medium">{b.productName}</p>
          <p className="font-mono text-xs text-muted">
            {b.sku}
            {!b.isSellable && <span className="ml-2 rounded bg-neutral-soft px-1.5 py-0.5 font-sans text-neutral">Tester hãng</span>}
          </p>
        </div>
      ),
    },
    {
      key: 'lot',
      header: 'Mã lô & FEFO',
      render: (b) => (
        <div>
          <p className="font-mono font-semibold">{b.lotCode}</p>
          <p className="text-xs text-muted">{b.fefoRank ? `FEFO #${b.fefoRank}` : 'Không xuất bán'}</p>
        </div>
      ),
    },
    { key: 'mfg', header: 'NSX', render: (b) => formatDate(b.mfgDate) },
    {
      key: 'exp',
      header: 'HSD & cảnh báo',
      render: (b) => (
        <div className="space-y-1">
          <p>{formatDate(b.expDate)}</p>
          <ExpiryBadge status={b.expiryStatus} days={b.daysToExpiry} />
        </div>
      ),
    },
    ...(canFull
      ? ([
          { key: 'onhand', header: 'Tồn thực', align: 'right', render: (b) => formatNumber(b.onHandQty) },
          {
            key: 'blocked',
            header: 'Cách ly',
            align: 'right',
            render: (b) =>
              (b.blockedQty ?? 0) > 0 ? (
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{b.blockedQty}</span>
              ) : (
                <span className="text-muted">0</span>
              ),
          },
        ] as Column<StockBatchItem>[])
      : []),
    {
      key: 'available',
      header: 'Bán được',
      align: 'right',
      render: (b) => (
        <span className={cn('font-semibold', b.availableQty === 0 && 'text-muted')}>
          {formatNumber(b.availableQty)}
          {b.lockedByCheckId ? <span className="block text-xs font-normal text-warning">Đang kiểm kho</span> : null}
        </span>
      ),
    },
    ...(canFull
      ? ([
          { key: 'cost', header: 'Giá vốn', align: 'right', render: (b) => formatCurrency(b.costPrice) },
          {
            key: 'actions',
            header: 'Thao tác',
            align: 'right',
            render: (b) => (
              <div className="flex items-center justify-end gap-2">
                {canCheck && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={startCheck.isPending}
                    onClick={(e) => {
                      e.stopPropagation()
                      startCheck.mutate([b.id])
                    }}
                  >
                    Kiểm kê
                  </Button>
                )}
                <Link to={`/stock/${b.id}`} className="text-xs font-semibold text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                  Chi tiết
                </Link>
              </div>
            ),
          },
        ] as Column<StockBatchItem>[])
      : []),
  ]

  const tabClass = (t: Tab) =>
    cn(
      'rounded-lg px-4 py-2 text-sm font-semibold transition',
      tab === t ? 'bg-accent text-white' : 'text-ink-soft hover:bg-accent-soft'
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tồn kho theo lô"
        description="Theo dõi hạn dùng, hàng cách ly và thứ tự xuất theo FEFO của từng lô."
        breadcrumbs={[{ label: 'Kho & hàng hóa' }, { label: 'Tồn kho theo lô FEFO' }]}
        actions={
          <>
            {canDispose && (
              <Button variant="secondary" icon={<PackageMinus className="size-4" aria-hidden="true" />} onClick={() => navigate('/disposals/new')}>
                Tạo phiếu xuất khác
              </Button>
            )}
            {canImport && (
              <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => navigate('/purchase-orders/new')}>
                Tạo phiếu nhập kho
              </Button>
            )}
          </>
        }
      />

      {canFull && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tổng SKU có tồn" value={formatNumber(s?.skuCount)} icon={Boxes} />
          <StatCard label="Lô đang tồn kho" value={formatNumber(s?.lotCount)} icon={Layers} />
          <StatCard
            label={`Cận hạn (≤ ${s?.expiryWarningDays ?? 60} ngày)`}
            value={formatNumber(s?.nearExpiryLots)}
            hint={`${formatNumber(s?.expiredLots)} lô đã hết hạn`}
            icon={Clock}
          />
          <StatCard
            label="Đang cách ly (Sản phẩm)"
            value={`${formatNumber(s?.quarantinedUnits)}`}
            hint={`Vốn: ${formatCurrency(s?.quarantinedValue)}`}
            icon={ShieldAlert}
          />
        </div>
      )}

      <FefoScanPanel autoFocus={searchParams.get('scan') === '1'} showDetailLink={canFull} />

      <div className="rounded-2xl border border-line bg-white">
        {canFull && (
          <div className="flex flex-wrap gap-2 border-b border-line p-3" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'ALL'} className={tabClass('ALL')} onClick={() => changeTab('ALL')}>
              Tất cả lô
            </button>
            {canExpiry && (
              <button type="button" role="tab" aria-selected={tab === 'EXPIRY'} className={tabClass('EXPIRY')} onClick={() => changeTab('EXPIRY')}>
                Cận hạn / hết hạn
              </button>
            )}
            <button type="button" role="tab" aria-selected={tab === 'QUARANTINE'} className={tabClass('QUARANTINE')} onClick={() => changeTab('QUARANTINE')}>
              Có hàng cách ly
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="min-w-64 flex-1">
            <span className="sr-only">Tìm lô hàng</span>
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm SKU, tên sản phẩm, mã lô, mã vạch..."
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          {canFull && tab !== 'QUARANTINE' && (
            <label>
              <span className="sr-only">Lọc hạn dùng</span>
              <select
                value={expiry}
                onChange={(e) => {
                  setExpiry(e.target.value as StockExpiryFilter)
                  setPage(1)
                }}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">{tab === 'EXPIRY' ? 'Cận hạn và hết hạn' : 'Mọi hạn dùng'}</option>
                <option value="NEAR_EXPIRY">Cận hạn</option>
                <option value="EXPIRED">Đã hết hạn</option>
                {tab !== 'EXPIRY' && <option value="OK">Còn hạn dài</option>}
              </select>
            </label>
          )}
          {canFull && (
            <label>
              <span className="sr-only">Lọc danh mục</span>
              <select
                value={categoryCode}
                onChange={(e) => {
                  setCategoryCode(e.target.value)
                  setPage(1)
                }}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
              >
                <option value="">Mọi danh mục</option>
                {(categories.data?.data.items ?? []).map((c) => (
                  <option key={c.categoryCode} value={c.categoryCode}>
                    {c.categoryName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canFull && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm font-medium text-ink-soft transition hover:bg-card">
              <input
                type="checkbox"
                className="size-6 accent-accent"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked)
                  setPage(1)
                }}
                className="size-6 cursor-pointer accent-accent"
              />
              Chỉ lô còn hàng
            </label>
          )}
        </div>
        <DataTable
          caption="Tồn kho theo lô, sắp theo FEFO"
          columns={columns}
          rows={batches.data?.data.items}
          rowKey={(b) => b.id}
          loading={batches.isLoading}
          error={batches.error ? getErrorMessage(batches.error) : null}
          onRetry={() => void batches.refetch()}
          emptyTitle="Không có lô phù hợp"
          onRowClick={canFull ? (b) => navigate(`/stock/${b.id}`) : undefined}
        />
        {batches.data && (
          <div className="overflow-x-auto border-t border-line p-4">
            <div className="flex w-max min-w-full flex-nowrap items-center justify-between gap-3">
              <div className="flex w-max shrink-0 flex-nowrap items-center gap-2">
              {selected.length > 0 ? (
                <span aria-live="polite" className="mr-1 rounded-full bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">
                  Đã chọn {selected.length} lô
                </span>
              ) : (
                <span className="mr-1 flex items-center gap-2 text-sm text-muted">
                  <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
                  Tích chọn lô phía trên để thực hiện thao tác hàng loạt.
                </span>
              )}
              {canCheck && (
                <Button size="md" variant="secondary" icon={<ClipboardCheck className="size-4" aria-hidden="true" />} disabled={selected.length === 0 || startCheck.isPending} loading={startCheck.isPending} onClick={() => startCheck.mutate(selected)}>
                  Kiểm kê các lô đã chọn
                </Button>
              )}
              {canDispose && (
                <>
                  <Button size="md" variant="secondary" icon={<Beaker className="size-4" aria-hidden="true" />} disabled={selected.length === 0} onClick={() => navigate('/disposals/new', { state: { batchIds: selected, issueType: 'TESTER' } })}>
                    Xuất tester
                  </Button>
                  <Button size="md" variant="secondary" icon={<TriangleAlert className="size-4" aria-hidden="true" />} className="border-danger/25 bg-danger-soft text-danger hover:bg-danger/10" disabled={selected.length === 0} onClick={() => navigate('/disposals/new', { state: { batchIds: selected, issueType: 'DESTROY' } })}>
                    Đề xuất hủy
                  </Button>
                  <Button size="md" variant="secondary" icon={<RotateCcw className="size-4" aria-hidden="true" />} disabled={selected.length === 0} onClick={() => navigate('/disposals/new', { state: { batchIds: selected, issueType: 'RETURN_TO_SUPPLIER' } })}>
                    Trả NCC
                  </Button>
                </>
              )}
              </div>
              <div className="shrink-0">
                <Pagination page={batches.data.data.page} pageSize={batches.data.data.pageSize} totalItems={batches.data.data.totalItems} onPageChange={setPage} unit="lô" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
