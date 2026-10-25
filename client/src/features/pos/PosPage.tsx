import { ShoppingCart } from 'lucide-react'
import { FeaturePage } from '../../components/FeaturePage'

export function PosPage() {
  return (
    <FeaturePage
      description="Quản lý đơn hàng và quy trình thanh toán tại điểm bán."
      icon={ShoppingCart}
      title="Bán hàng (POS)"
    />
  )
}
