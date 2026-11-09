import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Printer } from 'lucide-react'
import { Button, Modal, toast } from '../../../components/ui'
import { queryKeys } from '../../../lib/query-keys'
import { settingsService } from '../../../services/settings.service'
import { PAYMENT_METHOD_LABELS, type OrderRecord } from '../../../types/pos'
import { formatCurrency } from '../../../utils/format'
import { buildReceiptHtml, printReceipt } from '../receipt'

/** Hóa đơn sau khi hoàn tất. Lỗi in chỉ báo, không ảnh hưởng đơn đã hoàn tất (luật 39). */
export function ReceiptModal({ order, onClose }: { order: OrderRecord; onClose: () => void }) {
  const store = useQuery({ queryKey: queryKeys.settings.store, queryFn: () => settingsService.store() }).data?.data
  const print = () => {
    if (!printReceipt(buildReceiptHtml(order, store))) {
      toast.error('Không in được hóa đơn. Đơn hàng vẫn đã hoàn tất, bạn có thể in lại từ lịch sử đơn.')
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Thanh toán thành công"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đơn mới
          </Button>
          <Button icon={<Printer className="size-4" aria-hidden="true" />} onClick={print}>
            In hóa đơn
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Đã hoàn tất đơn <span className="font-mono">{order.orderCode}</span>
        </p>
        <dl className="space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-muted">Khách phải trả</dt>
            <dd className="font-bold">{formatCurrency(order.totalAmount - order.exchangeCreditAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Phương thức</dt>
            <dd>{order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] : '—'}</dd>
          </div>
          {order.changeDue !== null && (
            <div className="flex justify-between">
              <dt className="text-muted">Tiền thừa trả khách</dt>
              <dd className="font-semibold">{formatCurrency(order.changeDue)}</dd>
            </div>
          )}
          {order.pointsEarned > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Điểm tích được</dt>
              <dd className="font-semibold">{order.pointsEarned}</dd>
            </div>
          )}
        </dl>
      </div>
    </Modal>
  )
}
