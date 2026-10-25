import { ContactRound } from 'lucide-react'
import { FeaturePage } from '../../components/FeaturePage'

export function CrmPage() {
  return (
    <FeaturePage
      description="Lưu trữ hồ sơ khách hàng và quản lý các tương tác bán hàng."
      icon={ContactRound}
      title="Khách hàng (CRM)"
    />
  )
}
