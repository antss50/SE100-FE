import { StatusBadge } from '../../components/ui'
import type { OrderListItem, OrderStatus, PaymentMethod } from '../../types/pos'
import { PAYMENT_METHOD_LABELS } from '../../types/pos'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === 'COMPLETED') return <StatusBadge tone="success">Hoàn tất</StatusBadge>
  if (status === 'DRAFT') return <StatusBadge tone="warning">Đơn nháp</StatusBadge>
  return <StatusBadge tone="neutral">Đã hủy</StatusBadge>
}

export function PaymentMethodLabel({ method }: { method: PaymentMethod | null }) {
  return <span>{method ? PAYMENT_METHOD_LABELS[method] : '—'}</span>
}

/** Khách hàng dạng một dòng: tên + SĐT, hoặc "Khách vãng lai". */
export function customerLabel(order: Pick<OrderListItem, 'customerName' | 'customerPhone'>): string {
  return order.customerName ? `${order.customerName}${order.customerPhone ? ` · ${order.customerPhone}` : ''}` : 'Khách vãng lai'
}
