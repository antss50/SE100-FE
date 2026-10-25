import type { LucideIcon } from 'lucide-react'

type FeaturePageProps = {
  title: string
  description: string
  icon: LucideIcon
}

export function FeaturePage({
  title,
  description,
  icon: Icon,
}: FeaturePageProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid size-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon size={24} />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
        {description}
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">
          Khu vực sẵn sàng để phát triển
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Bắt đầu thêm giao diện và nghiệp vụ cho tính năng này tại đây.
        </p>
      </div>
    </section>
  )
}
