import { Boxes } from 'lucide-react'
import { FeaturePage } from '../../components/FeaturePage'

export function InventoryPage() {
  return (
    <FeaturePage
      description="Theo dõi sản phẩm, số lượng tồn kho và hoạt động nhập xuất."
      icon={Boxes}
      title="Kho hàng"
    />
  )
}
