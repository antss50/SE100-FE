import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pause, Pencil, Play, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useCan } from '../../app/usePermission'
import {
  Button,
  ConfirmDialog,
  DataTable,
  PageHeader,
  Pagination,
  StatusBadge,
  toast,
  type Column,
  type StatusTone,
} from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { promotionsService } from '../../services/promotions.service'
import {
  PROMOTION_TIER_OF,
  PROMOTION_TYPE_LABELS,
  summarizePromotion,
  type PromotionPhase,
  type PromotionStatus,
  type PromotionType,
  type PromotionView,
} from '../../types/promotions'
import { getErrorMessage } from '../../utils/error'
import { formatDateTime, formatNumber } from '../../utils/format'
import { PromotionFormModal } from './PromotionFormModal'

const PAGE_SIZE = 12

function statusOf(p: PromotionView): { tone: StatusTone; label: string } {
  if (p.status === 'DRAFT') return { tone: 'neutral', label: 'Bản nháp' }
  if (p.status === 'PAUSED') return { tone: 'warning', label: 'Tạm dừng' }
  if (p.phase === 'UPCOMING') return { tone: 'info', label: 'Sắp diễn ra' }
  if (p.phase === 'ENDED') return { tone: 'neutral', label: 'Đã kết thúc' }
  return { tone: 'success', label: 'Đang chạy' }
}

/** PROM-01, PROM-02: danh sách và quản lý khuyến mãi 7 loại. */
export function PromotionsPage() {
  const queryClient = useQueryClient()
  const canManage = useCan('PROMOTION_MANAGE')
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<PromotionType | 'ALL'>('ALL')
  const [status, setStatus] = useState<PromotionStatus | 'ALL'>('ALL')
  const [phase, setPhase] = useState<PromotionPhase | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PromotionView | null>(null)
  const [toggling, setToggling] = useState<PromotionView | null>(null)

  const params = { keyword, type, status, phase, page, pageSize: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.promotions.list(params),
    queryFn: () => promotionsService.list(params),
    placeholderData: (prev) => prev,
  })

  const toggleMutation = useMutation({
    mutationFn: (p: PromotionView) => promotionsService.setStatus(p.id, p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã cập nhật trạng thái')
      void queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all })
      setToggling(null)
    },
    onError: (e) => {
      toast.error(getErrorMessage(e))
      setToggling(null)
    },
  })

  const filter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const columns: Column<PromotionView>[] = [
    {
      key: 'name',
      header: 'Chương trình',
      render: (p) => (
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            {p.promotionName}
            {p.locked && <Lock className="size-3.5 text-muted" aria-label="Đã có đơn dùng, khóa sửa" />}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {p.voucherCode ? <span className="font-mono">{p.voucherCode} · </span> : null}
            {PROMOTION_TIER_OF[p.promotionType]}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Loại',
      render: (p) => <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent">{PROMOTION_TYPE_LABELS[p.promotionType as PromotionType]}</span>,
    },
    { key: 'value', header: 'Ưu đãi', render: (p) => <span className="text-sm">{summarizePromotion(p)}</span> },
    {
      key: 'time',
      header: 'Thời gian',
      render: (p) => (
        <div className="text-xs">
          <p>{formatDateTime(p.startAt)}</p>
          <p className="text-muted">đến {formatDateTime(p.endAt)}</p>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Lượt dùng',
      align: 'right',
      render: (p) => `${formatNumber(p.usedCount)}${p.usageLimit ? ` / ${formatNumber(p.usageLimit)}` : ''}`,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (p) => {
        const s = statusOf(p)
        return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      },
    },
  ]
  if (canManage) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<Pencil className="size-3.5" aria-hidden="true" />}
            onClick={() => {
              setEditing(p)
              setFormOpen(true)
            }}
          >
            Sửa
          </Button>
          {p.status !== 'DRAFT' && p.phase !== 'ENDED' && (
            <Button
              size="sm"
              variant="ghost"
              icon={p.status === 'ACTIVE' ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
              onClick={() => setToggling(p)}
            >
              {p.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
            </Button>
          )}
          {p.status === 'DRAFT' && (
            <Button size="sm" variant="ghost" icon={<Play className="size-3.5" aria-hidden="true" />} onClick={() => setToggling(p)}>
              Kích hoạt
            </Button>
          )}
        </div>
      ),
    })
  }

  const selectClass = 'rounded-xl border border-line bg-white px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khuyến mãi 4 tầng"
        description="Tầng 1 dòng hàng, tầng 2 hạng thẻ, tầng 3 đơn hàng, tầng 4 điểm thưởng. Khuyến mãi đã có đơn dùng thì khóa sửa mức giảm và điều kiện."
        breadcrumbs={[{ label: 'Chăm sóc & CS bán hàng' }, { label: 'Khuyến mãi' }]}
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              Tạo khuyến mãi
            </Button>
          )
        }
      />

      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Tìm khuyến mãi</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(e) => filter(setKeyword)(e.target.value)}
              placeholder="Tìm theo tên chương trình hoặc mã voucher..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc loại</span>
            <select value={type} onChange={(e) => filter(setType)(e.target.value as PromotionType | 'ALL')} className={selectClass}>
              <option value="ALL">Tất cả loại</option>
              {(Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]).map((t) => (
                <option key={t} value={t}>
                  {PROMOTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Lọc thời gian</span>
            <select value={phase} onChange={(e) => filter(setPhase)(e.target.value as PromotionPhase | 'ALL')} className={selectClass}>
              <option value="ALL">Mọi thời điểm</option>
              <option value="UPCOMING">Sắp diễn ra</option>
              <option value="RUNNING">Đang chạy</option>
              <option value="ENDED">Đã kết thúc</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Lọc trạng thái</span>
            <select value={status} onChange={(e) => filter(setStatus)(e.target.value as PromotionStatus | 'ALL')} className={selectClass}>
              <option value="ALL">Mọi trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="ACTIVE">Kích hoạt</option>
              <option value="PAUSED">Tạm dừng</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Danh sách khuyến mãi"
          columns={columns}
          rows={data?.data.items}
          rowKey={(p) => p.id}
          loading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="Không có chương trình khuyến mãi phù hợp"
        />
        {data && (
          <div className="border-t border-line p-4">
            <Pagination
              page={data.data.page}
              pageSize={data.data.pageSize}
              totalItems={data.data.totalItems}
              onPageChange={setPage}
              unit="chương trình"
            />
          </div>
        )}
      </div>

      <PromotionFormModal open={formOpen} promotion={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.status === 'ACTIVE' ? 'Tạm dừng chương trình?' : 'Kích hoạt chương trình?'}
        message={
          toggling?.status === 'ACTIVE'
            ? `"${toggling?.promotionName}" sẽ không còn được áp dụng tại quầy cho tới khi kích hoạt lại.`
            : `"${toggling?.promotionName}" sẽ được áp dụng tại quầy khi đang trong thời gian chạy.`
        }
        confirmLabel={toggling?.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
        loading={toggleMutation.isPending}
        onConfirm={() => toggling && toggleMutation.mutate(toggling)}
        onCancel={() => setToggling(null)}
      />
    </div>
  )
}
