import { useQuery } from '@tanstack/react-query'
import { Button, ErrorState, LoadingState, Modal, StatusBadge } from '../../../components/ui'
import { queryKeys } from '../../../lib/query-keys'
import { ordersService } from '../../../services/orders.service'
import { getErrorMessage } from '../../../utils/error'
import { formatDate, formatNumber } from '../../../utils/format'
import { usePosStore } from '../pos-store'

interface LotPickerModalProps {
  productId: number
  productName: string
  onClose: () => void
}

/** Đổi lô thủ công: chỉ liệt kê lô còn hạn, bán được; đổi lô khác FEFO sẽ ghi nhật ký OVERRIDE_FEFO (luật 27). */
export function LotPickerModal({ productId, productName, onClose }: LotPickerModalProps) {
  const setBatch = usePosStore((s) => s.setBatch)
  const current = usePosStore((s) => s.items.find((i) => i.productId === productId)?.batchId ?? null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.pos.lots(productId),
    queryFn: () => ordersService.posLots(productId),
  })
  const choose = (batchId: number | null) => {
    setBatch(productId, batchId)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Chọn lô cho ${productName}`}
      description="Mặc định hệ thống bán lô hết hạn sớm nhất (FEFO). Đổi sang lô khác là ngoại lệ và sẽ được ghi nhật ký."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button variant="ghost" onClick={() => choose(null)} disabled={current === null}>
            Quay về FEFO tự động
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <ul className="space-y-2">
          {data?.data.map((lot, index) => (
            <li key={lot.batchId}>
              <button
                type="button"
                onClick={() => choose(lot.batchId)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm hover:bg-accent-soft ${current === lot.batchId ? 'border-accent bg-accent-soft' : 'border-line'}`}
              >
                <span>
                  <span className="font-mono font-semibold">{lot.lotCode}</span>
                  <span className="ml-2 text-xs text-muted">HSD {formatDate(lot.expDate)}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {index === 0 && <StatusBadge tone="info">Lô FEFO</StatusBadge>}
                  {lot.nearExpiry && <StatusBadge tone="warning">Cận hạn</StatusBadge>}
                  Tồn bán được {formatNumber(lot.sellableQty)}
                </span>
              </button>
            </li>
          ))}
          {data?.data.length === 0 && <li className="text-sm text-muted">Không còn lô nào bán được.</li>}
        </ul>
      )}
    </Modal>
  )
}
