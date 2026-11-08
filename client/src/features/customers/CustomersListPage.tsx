import {
  Award,
  ChevronLeft,
  ChevronRight,
  Download,
  Gift,
  Plus,
  RefreshCw,
  Search,
  UserMinus,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { customersService } from '../../services/customers.service'
import type { CustomerItem } from '../../types/api'
import {
  formatCurrency,
  formatNumber,
  getInitials,
  getSkinTypeLabel,
  getTierBadgeStyle,
} from '../../utils/format'

export function CustomersListPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [tierId, setTierId] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('SPENT_DESC')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await customersService.getCustomers({
        keyword,
        tierId,
        status: statusFilter,
        sortBy,
        page,
        pageSize: 20,
      })
      setCustomers(res.data.items)
      setTotalItems(res.data.totalItems)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [keyword, tierId, statusFilter, sortBy, page])

  useEffect(() => {
    let active = true
    customersService
      .getCustomers({
        keyword,
        tierId,
        status: statusFilter,
        sortBy,
        page,
        pageSize: 20,
      })
      .then((res) => {
        if (active) {
          setCustomers(res.data.items)
          setTotalItems(res.data.totalItems)
        }
      })
      .catch(() => {
        // ignore
      })
    return () => {
      active = false
    }
  }, [keyword, tierId, statusFilter, sortBy, page])

  // Keyboard shortcut `/` to focus search input (as shown in UI tip banner)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleExportCsv = () => {
    const headers = [
      'Mã KH,Họ tên,Số điện thoại,Email,Loại da,Hạng thẻ,Điểm thưởng,Tổng chi tiêu,Trạng thái',
    ]
    const rows = customers.map(
      (c) =>
        `${c.customerCode},"${c.fullName}",${c.phoneNumber},${c.email || ''},${c.skinType || ''},${c.tier?.tierName || ''},${c.rewardPoints},${c.totalSpent},${c.status}`
    )
    const blob = new Blob(['\uFEFF' + [...headers, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'danh-sach-khach-hang-lumina.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-[#221712] tracking-tight">
            Quản lý khách hàng
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#7e6659]">
            Quản lý hồ sơ hội viên, theo dõi hạng tích lũy, điểm thưởng khả dụng
            và lịch sử chi tiêu khách hàng tại cửa hàng.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl bg-[#f7ede6] hover:bg-[#efe0d5] border border-[#e5d2c6] px-4 py-2.5 text-xs font-semibold text-[#4c372d] transition cursor-pointer"
          >
            <Download className="size-4 text-[#8c6b5b]" />
            <span>Xuất dữ liệu</span>
          </button>
          <Link
            to="/customers/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#9a462d] hover:bg-[#823821] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition"
          >
            <Plus className="size-4" />
            <span>Thêm khách hàng</span>
          </Link>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">
                TỔNG KHÁCH HÀNG
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-[#9a462d]">
                3,842
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-[#fbeae2] text-[#9a462d] grid place-items-center">
              <Users className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-[#fde8e0] text-[#b4482a] font-mono text-[11px] font-bold">
              ↗ +12.4%
            </span>
            <span className="text-[#8a7062]">so với tháng trước</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">
                HỘI VIÊN VIP (VÀNG & KIM CƯƠNG)
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-[#221712]">
                685
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-[#faf0e4] text-[#9c6b36] grid place-items-center">
              <Award className="size-5" />
            </div>
          </div>
          <p className="mt-4 text-xs text-[#7c6255] flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#9c6b36]" />
            <span>Chiếm 17.8% tổng doanh thu</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">
                ĐIỂM THƯỞNG KHẢ DỤNG
              </p>
              <p className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold text-[#221712]">
                142,500{' '}
                <span className="text-xs font-normal text-[#8a7062]">pts</span>
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-[#f7ede4] text-[#8d5c3b] grid place-items-center">
              <Gift className="size-5" />
            </div>
          </div>
          <p className="mt-4 text-xs text-[#7c6255]">
            Giá trị quy đổi ~ 14.250.000 đ
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">
                NGỪNG HOẠT ĐỘNG
              </p>
              <p className="mt-2 font-mono text-3xl font-extrabold text-red-700">
                24{' '}
                <span className="text-xs font-normal text-red-600">khách</span>
              </p>
            </div>
            <div className="size-11 rounded-2xl bg-red-50 text-red-600 grid place-items-center">
              <UserMinus className="size-5" />
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setStatusFilter((prev) =>
                prev === 'INACTIVE' ? 'ALL' : 'INACTIVE'
              )
            }
            className="mt-4 text-left text-xs font-bold text-red-700 hover:underline cursor-pointer"
          >
            {statusFilter === 'INACTIVE'
              ? '← Xem lại tất cả khách hàng'
              : 'Xem danh sách cần liên hệ →'}
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl bg-white border border-[#ead9ce] p-3 flex flex-col lg:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="size-4 text-[#9a7e70] absolute left-3.5 top-3" />
          <input
            ref={searchInputRef}
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo tên, SĐT hoặc mã khách hàng (KH0001)..."
            className="w-full rounded-xl bg-[#faf3ee] border border-transparent focus:border-[#b4533c] focus:bg-white pl-10 pr-4 py-2 text-xs text-[#221712] outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tierId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setTierId(v ? Number(v) : undefined)
              setPage(1)
            }}
            className="rounded-xl bg-[#faf3ee] border border-[#ebd9ce] px-3.5 py-2 text-xs font-medium text-[#3b2920] outline-none"
          >
            <option value="">Tất cả hạng (Đồng, Bạc, Vàng, Kim Cương)</option>
            <option value="1">Hạng Đồng (BRONZE)</option>
            <option value="2">Hạng Bạc (SILVER)</option>
            <option value="3">Hạng Vàng (GOLD)</option>
            <option value="4">Hạng Kim Cương (DIAMOND)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-xl bg-[#faf3ee] border border-[#ebd9ce] px-3.5 py-2 text-xs font-medium text-[#3b2920] outline-none"
          >
            <option value="ALL">Trạng thái (Tất cả)</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="INACTIVE">Ngừng hoạt động (INACTIVE)</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl bg-[#faf3ee] border border-[#ebd9ce] px-3.5 py-2 text-xs font-medium text-[#3b2920] outline-none"
          >
            <option value="SPENT_DESC">Chi tiêu / Điểm (Cao đến thấp)</option>
            <option value="SPENT_ASC">Chi tiêu (Thấp đến cao)</option>
            <option value="POINTS_DESC">Điểm khả dụng (Cao đến thấp)</option>
          </select>

          <button
            type="button"
            onClick={fetchCustomers}
            title="Làm mới"
            className="rounded-xl bg-[#faf3ee] border border-[#ebd9ce] p-2 text-[#6e5549] hover:bg-[#f2e4da] cursor-pointer"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-3xl bg-white border border-[#ead9ce] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#faf3ee] border-b border-[#eedfd6] text-[10px] font-extrabold uppercase tracking-wider text-[#876d60]">
                <th className="py-3.5 px-6">MÃ KHÁCH HÀNG</th>
                <th className="py-3.5 px-4">KHÁCH HÀNG</th>
                <th className="py-3.5 px-4">SỐ ĐIỆN THOẠI</th>
                <th className="py-3.5 px-4">HẠNG THÀNH VIÊN</th>
                <th className="py-3.5 px-4 text-right">ĐIỂM KHẢ DỤNG</th>
                <th className="py-3.5 px-4 text-right">TỔNG CHI TIÊU</th>
                <th className="py-3.5 px-6 text-right">TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3e7df] text-xs">
              {customers.map((cus) => {
                const tierStyle = getTierBadgeStyle(cus.tier?.tierCode)
                const isInactive = cus.status === 'INACTIVE'
                const cityShort = cus.address?.includes('Hà Nội')
                  ? 'Hà Nội'
                  : cus.address?.includes('Đà Nẵng')
                    ? 'Đà Nẵng'
                    : 'TP.HCM'

                return (
                  <tr
                    key={cus.id}
                    className="hover:bg-[#fdfaf8] transition group"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-[#9a462d]">
                      <Link
                        to={`/customers/${cus.customerCode}`}
                        className="hover:underline"
                      >
                        {cus.customerCode}
                      </Link>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-[#f4e5dc] text-[#7c432b] border border-[#e6cfc1] grid place-items-center font-bold text-xs shrink-0">
                          {getInitials(cus.fullName)}
                        </div>
                        <div>
                          <Link
                            to={`/customers/${cus.customerCode}`}
                            className="font-bold text-[#221712] hover:text-[#9a462d] transition block"
                          >
                            {cus.fullName}
                          </Link>
                          <p className="text-[11px] text-[#8a7062] mt-0.5">
                            {getSkinTypeLabel(cus.skinType)} • {cityShort}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono font-semibold text-[#221712]">
                      {cus.phoneNumber}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${tierStyle.bgClass} ${tierStyle.textClass} ${tierStyle.borderClass}`}
                      >
                        <span>{tierStyle.icon}</span>
                        <span>{tierStyle.label}</span>
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-[#221712]">
                      {formatNumber(cus.rewardPoints)}{' '}
                      <span className="text-[11px] font-normal text-[#8a7062]">
                        pts
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-extrabold text-[#9a462d]">
                      {formatCurrency(cus.totalSpent)}
                    </td>

                    <td className="py-4 px-6 text-right">
                      {isInactive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-bold">
                          <span className="size-1.5 rounded-full bg-red-600" />
                          Ngừng HĐ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ebe4] text-[#6d4c3b] text-[11px] font-bold">
                          <span className="size-1.5 rounded-full bg-[#8c5233]" />
                          Đang HĐ
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {customers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-xs text-[#8a7062]"
                  >
                    Không tìm thấy khách hàng nào khớp với tiêu chí tra cứu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-[#fdfaf8] border-t border-[#f1e4dc] flex flex-wrap items-center justify-between gap-3 text-xs text-[#7e6659]">
          <p>
            Hiển thị <strong>1 – {customers.length}</strong> trên tổng số{' '}
            <strong>{Math.max(customers.length, totalItems)}</strong> khách hàng
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="size-8 rounded-lg border border-[#e5d5cb] grid place-items-center text-[#6d5549] disabled:opacity-40 hover:bg-white cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`size-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                  page === p
                    ? 'bg-[#9a462d] text-white'
                    : 'border border-[#e5d5cb] bg-white text-[#5d463b] hover:bg-[#faf3ee]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="size-8 rounded-lg border border-[#e5d5cb] grid place-items-center text-[#6d5549] hover:bg-white cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Tip Banner */}
      <div className="rounded-2xl bg-[#f7ede6] border border-[#e8d5c8] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-white text-[#9a462d] grid place-items-center font-bold shadow-2xs">
            ▽
          </div>
          <div>
            <p className="font-bold text-[#221712]">Mẹo tìm kiếm nhanh</p>
            <p className="text-[#785f52]">
              Sử dụng phím tắt{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#dcc6b8] font-mono text-[11px] font-bold">
                /
              </kbd>{' '}
              để kích hoạt thanh tìm kiếm khách hàng mọi lúc khi đứng quầy POS.
            </p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-[#8d7467]">
          Dữ liệu cập nhật: 1 phút trước
        </span>
      </div>
    </div>
  )
}
