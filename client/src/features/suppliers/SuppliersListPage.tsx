import { useQuery } from '@tanstack/react-query'
import { Banknote, CheckCircle2, Plus, Search, Truck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCan } from '../../app/usePermission'
import {
  Button,
  DataTable,
  Pagination,
  PageHeader,
  StatCard,
  StatusBadge,
  type Column,
} from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { suppliersService } from '../../services/suppliers.service'
import type { SupplierItem, SupplierStatus } from '../../types/suppliers'
import { getErrorMessage } from '../../utils/error'
import { formatCurrency, formatDate, formatNumber } from '../../utils/format'
import { SupplierFormModal } from './SupplierFormModal'

const PAGE_SIZE = 10

export function SuppliersListPage() {
  const navigate = useNavigate()
  const canManage = useCan('SUPPLIER_MANAGE')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<SupplierStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const params = { keyword, status, page, pageSize: PAGE_SIZE }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.suppliers.list(params),
    queryFn: () => suppliersService.list(params),
    placeholderData: (prev) => prev,
  })
  const summary = data?.data.summary

  const columns: Column<SupplierItem>[] = [
    {
      key: 'name',
      header: 'Nhà cung cấp',
      render: (s) => (
        <div>
          <p className="font-semibold text-ink">{s.supplierName}</p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {s.supplierCode}
            {s.taxCode ? ` · MST ${s.taxCode}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'brands',
      header: 'Thương hiệu phân phối',
      render: (s) =>
        s.brands.length === 0 ? (
          <span className="text-muted">Chưa nhập hàng</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {s.brands.map((b) => (
              <span key={b} className="rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent">
                {b}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'contact',
      header: 'Liên hệ',
      render: (s) => (
        <div>
          <p>{s.contactPerson ?? '—'}</p>
          <p className="text-xs text-muted">{s.phoneNumber}</p>
        </div>
      ),
    },
    { key: 'orders', header: 'Số đơn', align: 'right', render: (s) => formatNumber(s.orderCount) },
    {
      key: 'amount',
      header: 'Giá trị nhập',
      align: 'right',
      render: (s) => <span className="font-semibold">{formatCurrency(s.totalPurchaseAmount)}</span>,
    },
    { key: 'last', header: 'Nhập gần nhất', render: (s) => formatDate(s.lastPurchaseDate) },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (s) =>
        s.status === 'ACTIVE' ? (
          <StatusBadge tone="success">Đang hợp tác</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Ngừng hợp tác</StatusBadge>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Nhà cung cấp"
        description="Danh bạ nhà phân phối và đối tác cung ứng mỹ phẩm chính hãng của cửa hàng."
        breadcrumbs={[{ label: 'Kho & hàng hóa' }, { label: 'Nhà cung cấp' }]}
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setFormOpen(true)}>
              Thêm nhà cung cấp
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng nhà phân phối" value={formatNumber(summary?.total)} icon={Truck} />
        <StatCard label="Đang hợp tác" value={formatNumber(summary?.active)} icon={CheckCircle2} />
        <StatCard label="Tổng số đơn nhập" value={formatNumber(summary?.totalOrders)} icon={Truck} />
        <StatCard label="Tổng giá trị đã nhập" value={formatCurrency(summary?.totalPurchaseAmount)} icon={Banknote} />
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Tìm nhà cung cấp</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo tên, mã NCC, MST, số điện thoại, thương hiệu..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
          <label>
            <span className="sr-only">Lọc trạng thái</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as SupplierStatus | 'ALL')
                setPage(1)
              }}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hợp tác</option>
              <option value="INACTIVE">Ngừng hợp tác</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Danh sách nhà cung cấp"
          columns={columns}
          rows={data?.data.items}
          rowKey={(s) => s.id}
          loading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="Không có nhà cung cấp phù hợp"
          onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
        />
        {data && (
          <div className="border-t border-line p-4">
            <Pagination
              page={data.data.page}
              pageSize={data.data.pageSize}
              totalItems={data.data.totalItems}
              onPageChange={setPage}
              unit="nhà cung cấp"
            />
          </div>
        )}
      </div>
      <p className="text-xs text-muted">Nhấp vào một dòng để xem hồ sơ đối tác và lịch sử nhập kho.</p>

      <SupplierFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
