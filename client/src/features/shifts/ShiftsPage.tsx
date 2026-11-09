import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUiStore } from '../../app/store'
import { useCan } from '../../app/usePermission'
import { Button, DataTable, PageHeader, Pagination, StatusBadge, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { shiftsService, type ShiftListItem } from '../../services/shifts.service'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { CloseShiftModal } from './CloseShiftModal'
import { CashFormula, DifferenceBadge, PaymentBreakdown } from './shift-ui'

const PAGE_SIZE = 10

/** POS-01, POS-05: ca đang mở của tôi và lịch sử ca. */
export function ShiftsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const openShiftModal = useUiStore((s) => s.openShiftModal)
  const canClose = useCan('POS_SHIFT_CLOSE')
  const canOpen = useCan('POS_SHIFT_OPEN')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')
  const [page, setPage] = useState(1)
  const [closing, setClosing] = useState(false)

  const current = useQuery({ queryKey: queryKeys.shifts.current, queryFn: () => shiftsService.getCurrentShift() })
  const currentId = current.data?.data.shift?.shiftId
  const currentDetail = useQuery({
    queryKey: queryKeys.shifts.detail(currentId ?? 0),
    queryFn: () => shiftsService.detail(currentId as number),
    enabled: currentId !== undefined,
  })

  const params = { keyword, status, page, pageSize: PAGE_SIZE }
  const list = useQuery({
    queryKey: queryKeys.shifts.list(params),
    queryFn: () => shiftsService.list(params),
    placeholderData: (prev) => prev,
  })

  const wantsClose = (location.state as { closeShift?: boolean } | null)?.closeShift === true
  const autoOpened = useRef(false)
  useEffect(() => {
    if (wantsClose && currentDetail.data && !autoOpened.current) {
      autoOpened.current = true
      setClosing(true)
    }
  }, [wantsClose, currentDetail.data])

  const detail = currentDetail.data?.data
  const columns: Column<ShiftListItem>[] = [
    { key: 'code', header: 'Mã ca', render: (s) => <span className="font-mono text-sm font-semibold text-accent">{s.shiftCode}</span> },
    {
      key: 'time',
      header: 'Thời gian',
      render: (s) => (
        <div className="text-xs">
          <p>{formatDateTime(s.openedAt)}</p>
          <p className="text-muted">{s.closedAt ? `đến ${formatDateTime(s.closedAt)}` : 'đang mở'}</p>
        </div>
      ),
    },
    { key: 'cashier', header: 'Thu ngân', render: (s) => s.cashierName },
    { key: 'orders', header: 'Số đơn', align: 'right', render: (s) => s.summary.orderCount },
    { key: 'sales', header: 'Doanh thu', align: 'right', render: (s) => formatCurrency(s.summary.totalSales) },
    { key: 'expected', header: 'Tiền dự kiến', align: 'right', render: (s) => formatCurrency(s.expectedCash ?? s.summary.expectedCash) },
    { key: 'actual', header: 'Tiền thực tế', align: 'right', render: (s) => (s.actualCash === null ? '—' : formatCurrency(s.actualCash)) },
    {
      key: 'diff',
      header: 'Đối soát',
      render: (s) =>
        s.status === 'OPEN' ? <StatusBadge tone="info">Đang mở</StatusBadge> : <DifferenceBadge amount={s.differenceAmount} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý ca"
        description="Mỗi thu ngân tối đa một ca đang mở. Chốt ca bằng kiểm đếm tiền; lệch tiền phải giải trình."
        breadcrumbs={[{ label: 'Bán hàng & POS' }, { label: 'Quản lý ca' }]}
        actions={
          !currentId &&
          canOpen && (
            <Button icon={<Clock className="size-4" aria-hidden="true" />} onClick={openShiftModal}>
              Mở ca mới
            </Button>
          )
        }
      />

      {currentId !== undefined && detail && (
        <section className="space-y-4 rounded-2xl border border-line bg-white p-5" aria-label="Ca đang mở">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-lg font-bold text-accent">{detail.shift.shiftCode}</h2>
                <StatusBadge tone="success">Đang mở</StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted">
                Mở lúc {formatDateTime(detail.shift.openedAt)} · {detail.summary.orderCount} đơn đã hoàn tất
              </p>
            </div>
            {canClose && (
              <Button onClick={() => setClosing(true)} disabled={detail.summary.draftCount > 0}>
                Chốt ca và kiểm đếm
              </Button>
            )}
          </div>
          <CashFormula openingCash={detail.shift.openingCash} summary={detail.summary} />
          <PaymentBreakdown summary={detail.summary} />
          {detail.summary.draftCount > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Còn {detail.summary.draftCount} đơn nháp chưa thanh toán. Hoàn tất hoặc hủy trước khi chốt ca.
              <button type="button" className="font-semibold underline" onClick={() => navigate('/pos')}>
                Mở màn POS
              </button>
            </p>
          )}
        </section>
      )}
      {current.data && !current.data.data.shift && (
        <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
          Bạn chưa mở ca. Mở ca để bắt đầu lập đơn tại quầy.
        </p>
      )}

      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Tìm ca</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo mã ca hoặc thu ngân..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc trạng thái ca</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as 'ALL' | 'OPEN' | 'CLOSED')
                setPage(1)
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả ca</option>
              <option value="OPEN">Đang mở</option>
              <option value="CLOSED">Đã chốt</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Lịch sử ca"
          columns={columns}
          rows={list.data?.data.items}
          rowKey={(s) => s.shiftId}
          loading={list.isLoading}
          error={list.error ? getErrorMessage(list.error) : null}
          onRetry={() => void list.refetch()}
          emptyTitle="Chưa có ca nào"
          onRowClick={(s) => navigate(`/shifts/${s.shiftId}`)}
        />
        {list.data && (
          <div className="border-t border-line p-4">
            <Pagination
              page={list.data.data.page}
              pageSize={list.data.data.pageSize}
              totalItems={list.data.data.totalItems}
              onPageChange={setPage}
              unit="ca"
            />
          </div>
        )}
      </div>

      {detail && closing && (
        <CloseShiftModal open shift={detail.shift} summary={detail.summary} onClose={() => setClosing(false)} />
      )}
    </div>
  )
}
