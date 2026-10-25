import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, ClipboardList, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const noteSchema = z.object({
  note: z.string().trim().min(3, 'Ghi chú cần có ít nhất 3 ký tự.').max(120),
})

type NoteFormValues = z.infer<typeof noteSchema>

const metrics = [
  { label: 'Doanh thu hôm nay', value: '0 ₫', icon: Wallet, detail: 'Chưa có dữ liệu' },
  { label: 'Đơn hàng', value: '0', icon: ClipboardList, detail: 'Trong hôm nay' },
  { label: 'Khách hàng', value: '0', icon: Users, detail: 'Tổng khách hàng' },
]

export function DashboardPage() {
  const [savedNote, setSavedNote] = useState('')
  const [today] = useState(() =>
    new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date()),
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
  })

  const saveNote = handleSubmit(({ note }) => {
    setSavedNote(note)
    reset()
  })

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-indigo-600">Tổng quan</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Chào mừng đến với SE100
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Không gian khởi đầu cho hệ thống quản lý bán hàng của bạn.
          </p>
        </div>
        <span className="text-sm text-slate-500">{today}</span>
      </section>

      <section aria-label="Chỉ số tổng quan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, detail }) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            key={label}
          >
            <div className="flex items-start justify-between">
              <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon size={20} />
              </div>
              <ArrowUpRight aria-hidden="true" className="text-slate-300" size={18} />
            </div>
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Bắt đầu xây dựng
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Các khu vực Bán hàng, Kho hàng và Khách hàng đã được tạo sẵn trong
            điều hướng. Mở từng khu vực để tiếp tục phát triển nghiệp vụ.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['POS', 'Inventory', 'CRM', 'Dashboard'].map((feature) => (
              <span
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                key={feature}
              >
                {feature}
              </span>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Ghi chú nhanh
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ví dụ biểu mẫu được xác thực bằng React Hook Form và Zod.
          </p>
          <form className="mt-4 space-y-3" onSubmit={saveNote}>
            <label className="sr-only" htmlFor="dashboard-note">
              Nội dung ghi chú
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              id="dashboard-note"
              placeholder="Nhập ghi chú..."
              {...register('note')}
            />
            {errors.note && (
              <p className="text-xs text-red-600">{errors.note.message}</p>
            )}
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              type="submit"
            >
              Lưu ghi chú
            </button>
          </form>
          {savedNote && (
            <p aria-live="polite" className="mt-3 text-sm text-emerald-700">
              Đã lưu: {savedNote}
            </p>
          )}
        </article>
      </section>
    </div>
  )
}
