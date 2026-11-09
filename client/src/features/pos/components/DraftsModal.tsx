import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, EmptyState, ErrorState, LoadingState, Modal, toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/query-keys'
import { ordersService } from '../../../services/orders.service'
import { getErrorMessage } from '../../../utils/error'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import { usePosStore } from '../pos-store'

/** Danh sách đơn nháp của thu ngân: mở lại để tiếp tục hoặc hủy (luật 36: còn nháp thì không chốt ca được). */
export function DraftsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const loadDraft = usePosStore((s) => s.loadDraft)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: queryKeys.pos.drafts, queryFn: () => ordersService.drafts() })

  const open = useMutation({
    mutationFn: (id: number) => ordersService.detail(id),
    onSuccess: (res) => {
      const order = res.data.order
      if (order.draftCart) loadDraft(order.draftCart, order.id, {})
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const cancel = useMutation({
    mutationFn: (id: number) => ordersService.cancelDraft(id),
    onSuccess: () => {
      toast.success('Đã hủy đơn nháp')
      void queryClient.invalidateQueries({ queryKey: queryKeys.pos.drafts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Modal open onClose={onClose} title="Đơn nháp" description="Mở lại để tiếp tục thanh toán hoặc hủy. Còn đơn nháp thì không chốt ca được." footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}>
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : data?.data.length === 0 ? (
        <EmptyState title="Không có đơn nháp" />
      ) : (
        <ul className="divide-y divide-line">
          {data?.data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-mono text-sm font-semibold">{d.orderCode}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(d.createdAt)} · {d.customerName ?? 'Khách vãng lai'} · {formatCurrency(d.totalAmount)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => open.mutate(d.id)} loading={open.isPending && open.variables === d.id}>
                  Mở lại
                </Button>
                <Button size="sm" variant="danger" onClick={() => cancel.mutate(d.id)} loading={cancel.isPending && cancel.variables === d.id}>
                  Hủy
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
