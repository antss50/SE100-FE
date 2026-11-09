import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, DataTable, Input, Modal, PageHeader, Pagination, Select, StatusBadge, type Column } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { auditService } from '../../services/audit.service'
import type { AuditLogRecord, AuditModule } from '../../types/reports'
import { getErrorMessage } from '../../utils/error'
import { formatDateTime } from '../../utils/format'

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  AUTH: 'Đăng nhập',
  USER: 'Tài khoản',
  ROLE: 'Phân quyền',
  SETTING: 'Cấu hình',
  PRODUCT: 'Sản phẩm',
  SUPPLIER: 'Nhà cung cấp',
  STOCK: 'Kho',
  POS: 'Bán hàng',
  CUSTOMER: 'Khách hàng',
  PROMOTION: 'Khuyến mãi',
}

const MODULE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả module' },
  ...Object.entries(AUDIT_MODULE_LABELS).map(([value, label]) => ({ value, label })),
]

const show = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value))

/** Tóm tắt một dòng cho cột "Chi tiết". */
export function summarizeDetails(log: AuditLogRecord): string {
  const d = log.details
  if (!d) return '—'
  if (d.note) return d.note
  const keys = Object.keys({ ...d.before, ...d.after })
  if (keys.length === 0) return '—'
  return keys.map((k) => `${k}: ${d.before ? `${show(d.before[k])} → ` : ''}${show(d.after?.[k])}`).join('; ')
}

function KeyValues({ title, data }: { title: string; data: Record<string, unknown> | null | undefined }) {
  if (!data || Object.keys(data).length === 0) return null
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold uppercase text-muted">{title}</h3>
      <dl className="space-y-1 rounded-xl bg-card p-3 text-sm">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{show(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** AUTH-06: nhật ký hệ thống (AUDIT_LOGS), chỉ xem, có lọc và phân trang. */
export function AuditLogsPage() {
  const [filters, setFilters] = useState({ userId: '', action: 'ALL', module: 'ALL', fromDate: '', toDate: '', keyword: '' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditLogRecord | null>(null)
  const rangeError = filters.fromDate && filters.toDate && filters.fromDate > filters.toDate ? 'Từ ngày không được sau đến ngày' : null
  const params = { ...filters, userId: filters.userId ? Number(filters.userId) : undefined, page, pageSize: 20 }
  const query = useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => auditService.list(params),
    enabled: rangeError === null,
    placeholderData: (prev) => prev,
  })
  const data = query.data?.data

  const change = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }

  const columns: Column<AuditLogRecord>[] = [
    { key: 'time', header: 'Thời gian', render: (l) => <span className="whitespace-nowrap">{formatDateTime(l.createdAt)}</span> },
    {
      key: 'user',
      header: 'Người thực hiện',
      render: (l) => (
        <div>
          <div className="font-medium">{l.userName}</div>
          <div className="text-xs text-muted">{l.roleCode}</div>
        </div>
      ),
    },
    { key: 'action', header: 'Hành động', render: (l) => <span className="font-mono text-xs">{l.action}</span> },
    { key: 'module', header: 'Module', render: (l) => <StatusBadge tone="neutral">{AUDIT_MODULE_LABELS[l.module]}</StatusBadge> },
    { key: 'entity', header: 'Đối tượng', render: (l) => (l.entityType ? `${l.entityType}${l.entityId ? ` #${l.entityId}` : ''}` : '—') },
    { key: 'details', header: 'Chi tiết', render: (l) => <span className="line-clamp-2 max-w-xs text-xs text-muted">{summarizeDetails(l)}</span> },
    {
      key: 'view',
      header: '',
      align: 'right',
      render: (l) => (
        <Button size="sm" variant="ghost" onClick={() => setSelected(l)}>
          Xem
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Dấu vết các thao tác quan trọng: đăng nhập, thay đổi dữ liệu, duyệt phiếu, đổi cấu hình và phân quyền. Chỉ xem, không sửa hay xóa."
        breadcrumbs={[{ label: 'Hệ thống' }, { label: 'Nhật ký hệ thống' }]}
      />
      <section aria-label="Bộ lọc nhật ký" className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <Select
          label="Người thực hiện"
          value={filters.userId}
          onChange={(e) => change({ userId: e.target.value })}
          options={[{ value: '', label: 'Tất cả' }, ...(data?.facets.users ?? []).map((u) => ({ value: String(u.id), label: u.name }))]}
        />
        <Select
          label="Hành động"
          value={filters.action}
          onChange={(e) => change({ action: e.target.value })}
          options={[{ value: 'ALL', label: 'Tất cả' }, ...(data?.facets.actions ?? []).map((a) => ({ value: a, label: a }))]}
        />
        <Select label="Module" value={filters.module} onChange={(e) => change({ module: e.target.value })} options={MODULE_OPTIONS} />
        <Input label="Từ ngày" type="date" value={filters.fromDate} onChange={(e) => change({ fromDate: e.target.value })} />
        <Input
          label="Đến ngày"
          type="date"
          value={filters.toDate}
          onChange={(e) => change({ toDate: e.target.value })}
          error={rangeError ?? undefined}
        />
        <Input label="Tìm đối tượng" value={filters.keyword} onChange={(e) => change({ keyword: e.target.value })} placeholder="Mã, người..." />
      </section>
      <div className="rounded-2xl border border-line bg-white">
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(l) => l.id}
          loading={query.isLoading}
          error={query.isError ? getErrorMessage(query.error) : null}
          onRetry={() => void query.refetch()}
          caption="Nhật ký hệ thống"
          emptyTitle="Không có nhật ký phù hợp bộ lọc"
        />
        {data && (
          <div className="border-t border-line p-4">
            <Pagination page={data.page} pageSize={data.pageSize} totalItems={data.totalItems} onPageChange={setPage} unit="dòng nhật ký" />
          </div>
        )}
      </div>
      <Modal open={selected !== null} title="Chi tiết nhật ký" onClose={() => setSelected(null)} size="md">
        {selected && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-muted">Thời gian</dt>
              <dd>{formatDateTime(selected.createdAt)}</dd>
              <dt className="text-muted">Người thực hiện</dt>
              <dd>
                {selected.userName} ({selected.roleCode})
              </dd>
              <dt className="text-muted">Hành động</dt>
              <dd className="font-mono text-xs">{selected.action}</dd>
              <dt className="text-muted">Module</dt>
              <dd>{AUDIT_MODULE_LABELS[selected.module]}</dd>
              <dt className="text-muted">Đối tượng</dt>
              <dd>{selected.entityType ? `${selected.entityType} #${selected.entityId ?? ''}` : '—'}</dd>
              <dt className="text-muted">Địa chỉ IP</dt>
              <dd>{selected.ipAddress}</dd>
            </dl>
            {selected.details?.note && <p className="rounded-xl bg-card p-3">{selected.details.note}</p>}
            <KeyValues title="Trước" data={selected.details?.before} />
            <KeyValues title="Sau" data={selected.details?.after} />
          </div>
        )}
      </Modal>
    </div>
  )
}
