import { Construction } from 'lucide-react'
import { PageHeader } from '../../components/ui/Display'
import { EmptyState } from '../../components/ui/Feedback'
import type { NavItem } from '../../routes/nav-config'

/** Trang dùng chung cho mục menu chưa có màn hình. */
export function ComingSoonPage({ item, section }: { item: NavItem; section: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={item.label}
        breadcrumbs={[{ label: section.replace(/^\d+\.\s*/, '') }, { label: item.label }]}
      />
      <section className="rounded-2xl border border-line bg-white">
        <EmptyState
          icon={Construction}
          title="Đang phát triển"
          description={`Chức năng ${item.uc} sẽ được làm ở giai đoạn ${item.plannedPhase ?? '?'} theo kế hoạch.`}
        />
      </section>
    </div>
  )
}
