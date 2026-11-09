/**
 * Ghi nhật ký hệ thống (AUDIT_LOGS, DATABASE.md mục 6).
 * - `writeAudit`: helper dùng chung, handler gọi trực tiếp khi cần ghi trước/sau (UPDATE_SETTING, TIER_UPGRADE, OVERRIDE_FEFO...).
 * - `auditAfterRequest`: router gọi sau mỗi request ghi thành công, theo bảng `AUDIT_RULES`, để mọi thao tác chính đều có dấu vết.
 */
import type { AuditDetails, AuditLogRecord, AuditModule } from '../types/reports'
import type { MockTransaction } from './db'
import type { HttpMethod, MockResponse } from './http'
import type { MockUser } from './seed/users'
import { toIsoLocal } from './time'

export interface AuditEntry {
  action: string
  module: AuditModule
  entityType?: string | null
  entityId?: string | number | null
  details?: AuditDetails | null
}

/** Ghi một dòng audit trong giao dịch hiện tại. `actor = null` là thao tác của hệ thống. */
export function writeAudit(db: MockTransaction, actor: MockUser | null, now: Date, entry: AuditEntry): AuditLogRecord {
  const logs = db.read('auditLogs')
  const maxId = logs.reduce((m, l) => Math.max(m, l.id), 0)
  const record: AuditLogRecord = {
    id: maxId + 1,
    userId: actor?.id ?? null,
    userName: actor?.fullName ?? 'Hệ thống',
    roleCode: actor?.roles[0] ?? 'SYSTEM',
    action: entry.action,
    module: entry.module,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
    details: entry.details ?? null,
    ipAddress: '127.0.0.1',
    createdAt: toIsoLocal(now),
  }
  db.write('auditLogs', [...logs, record])
  return record
}

interface AuditRule {
  method: HttpMethod
  path: string
  action: string
  module: AuditModule
  entityType: string
}

/** Các thao tác ghi cần có dấu vết. Thao tác đã tự ghi trong handler (cấu hình, phân quyền, chốt ca, bàn giao) không đưa vào đây. */
export const AUDIT_RULES: AuditRule[] = [
  { method: 'POST', path: '/auth/login', action: 'LOGIN', module: 'AUTH', entityType: 'USER' },
  { method: 'POST', path: '/auth/logout', action: 'LOGOUT', module: 'AUTH', entityType: 'USER' },
  { method: 'POST', path: '/auth/change-password', action: 'CHANGE_PASSWORD', module: 'AUTH', entityType: 'USER' },
  { method: 'POST', path: '/users', action: 'CREATE_USER', module: 'USER', entityType: 'USER' },
  { method: 'PATCH', path: '/users/:id', action: 'UPDATE_USER', module: 'USER', entityType: 'USER' },
  { method: 'POST', path: '/users/:id/lock', action: 'LOCK_USER', module: 'USER', entityType: 'USER' },
  { method: 'POST', path: '/users/:id/unlock', action: 'UNLOCK_USER', module: 'USER', entityType: 'USER' },
  { method: 'POST', path: '/products', action: 'CREATE_PRODUCT', module: 'PRODUCT', entityType: 'PRODUCT' },
  { method: 'PUT', path: '/products/:sku', action: 'UPDATE_PRODUCT', module: 'PRODUCT', entityType: 'PRODUCT' },
  { method: 'PATCH', path: '/products/:sku/deactivate', action: 'DEACTIVATE_PRODUCT', module: 'PRODUCT', entityType: 'PRODUCT' },
  { method: 'PATCH', path: '/products/:sku/restore', action: 'RESTORE_PRODUCT', module: 'PRODUCT', entityType: 'PRODUCT' },
  { method: 'POST', path: '/categories', action: 'CREATE_CATEGORY', module: 'PRODUCT', entityType: 'CATEGORY' },
  { method: 'PUT', path: '/categories/:code', action: 'UPDATE_CATEGORY', module: 'PRODUCT', entityType: 'CATEGORY' },
  { method: 'POST', path: '/brands', action: 'CREATE_BRAND', module: 'PRODUCT', entityType: 'BRAND' },
  { method: 'PUT', path: '/brands/:code', action: 'UPDATE_BRAND', module: 'PRODUCT', entityType: 'BRAND' },
  { method: 'POST', path: '/suppliers', action: 'CREATE_SUPPLIER', module: 'SUPPLIER', entityType: 'SUPPLIER' },
  { method: 'PUT', path: '/suppliers/:id', action: 'UPDATE_SUPPLIER', module: 'SUPPLIER', entityType: 'SUPPLIER' },
  { method: 'POST', path: '/suppliers/:id/deactivate', action: 'DEACTIVATE_SUPPLIER', module: 'SUPPLIER', entityType: 'SUPPLIER' },
  { method: 'POST', path: '/suppliers/:id/activate', action: 'ACTIVATE_SUPPLIER', module: 'SUPPLIER', entityType: 'SUPPLIER' },
  { method: 'POST', path: '/purchase-orders', action: 'CREATE_PURCHASE_ORDER', module: 'STOCK', entityType: 'PURCHASE_ORDER' },
  { method: 'PUT', path: '/purchase-orders/:id', action: 'UPDATE_PURCHASE_ORDER', module: 'STOCK', entityType: 'PURCHASE_ORDER' },
  { method: 'POST', path: '/purchase-orders/:id/confirm', action: 'CONFIRM_PURCHASE_ORDER', module: 'STOCK', entityType: 'PURCHASE_ORDER' },
  { method: 'POST', path: '/purchase-orders/:id/cancel', action: 'CANCEL_PURCHASE_ORDER', module: 'STOCK', entityType: 'PURCHASE_ORDER' },
  { method: 'POST', path: '/inventory-checks', action: 'CREATE_CHECK', module: 'STOCK', entityType: 'INVENTORY_CHECK' },
  { method: 'POST', path: '/inventory-checks/:id/submit', action: 'SUBMIT_CHECK', module: 'STOCK', entityType: 'INVENTORY_CHECK' },
  { method: 'POST', path: '/inventory-checks/:id/cancel', action: 'CANCEL_CHECK', module: 'STOCK', entityType: 'INVENTORY_CHECK' },
  { method: 'POST', path: '/inventory-checks/:id/approve', action: 'APPROVE_CHECK', module: 'STOCK', entityType: 'INVENTORY_CHECK' },
  { method: 'POST', path: '/inventory-checks/:id/reject', action: 'REJECT_CHECK', module: 'STOCK', entityType: 'INVENTORY_CHECK' },
  { method: 'POST', path: '/disposals', action: 'CREATE_DISPOSAL', module: 'STOCK', entityType: 'DISPOSAL' },
  { method: 'POST', path: '/disposals/:id/approve', action: 'APPROVE_DISPOSAL', module: 'STOCK', entityType: 'DISPOSAL' },
  { method: 'POST', path: '/disposals/:id/reject', action: 'REJECT_DISPOSAL', module: 'STOCK', entityType: 'DISPOSAL' },
  { method: 'POST', path: '/shifts/open', action: 'OPEN_SHIFT', module: 'POS', entityType: 'SHIFT' },
  { method: 'POST', path: '/orders/complete', action: 'CREATE_ORDER', module: 'POS', entityType: 'ORDER' },
  { method: 'POST', path: '/orders/:id/cancel', action: 'CANCEL_ORDER', module: 'POS', entityType: 'ORDER' },
  { method: 'POST', path: '/returns', action: 'CREATE_RETURN', module: 'POS', entityType: 'RETURN' },
  { method: 'POST', path: '/customers', action: 'CREATE_CUSTOMER', module: 'CUSTOMER', entityType: 'CUSTOMER' },
  { method: 'PUT', path: '/customers/:code', action: 'UPDATE_CUSTOMER', module: 'CUSTOMER', entityType: 'CUSTOMER' },
  { method: 'POST', path: '/customers/:code/deactivate', action: 'LOCK_CUSTOMER', module: 'CUSTOMER', entityType: 'CUSTOMER' },
  { method: 'POST', path: '/customers/:code/activate', action: 'UNLOCK_CUSTOMER', module: 'CUSTOMER', entityType: 'CUSTOMER' },
  { method: 'PUT', path: '/loyalty-config', action: 'UPDATE_LOYALTY_CONFIG', module: 'CUSTOMER', entityType: 'LOYALTY_CONFIG' },
  { method: 'POST', path: '/promotions', action: 'CREATE_PROMOTION', module: 'PROMOTION', entityType: 'PROMOTION' },
  { method: 'PUT', path: '/promotions/:id', action: 'UPDATE_PROMOTION', module: 'PROMOTION', entityType: 'PROMOTION' },
  { method: 'PATCH', path: '/promotions/:id/status', action: 'CHANGE_PROMOTION_STATUS', module: 'PROMOTION', entityType: 'PROMOTION' },
]

function matchRule(rule: AuditRule, method: HttpMethod, path: string): Record<string, string> | null {
  if (rule.method !== method) return null
  const a = rule.path.split('/').filter(Boolean)
  const b = path.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}

/** Tóm tắt body request: chỉ trường đơn giản, bỏ mật khẩu/token, cắt chuỗi dài. */
export function summarizeBody(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (/password|token|secret/i.test(key)) continue
    if (typeof value === 'string') out[key] = value.length > 120 ? `${value.slice(0, 117)}...` : value
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value
    else if (Array.isArray(value)) out[key] = `${value.length} mục`
  }
  return Object.keys(out).length > 0 ? out : null
}

function entityIdOf(response: MockResponse, params: Record<string, string>): string | null {
  const data = response.body.success ? (response.body.data as unknown) : null
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>
    const nested = typeof record.user === 'object' && record.user !== null ? (record.user as Record<string, unknown>) : null
    const direct = record.id ?? nested?.id
    if (typeof direct === 'number' || typeof direct === 'string') return String(direct)
    const order = typeof record.order === 'object' && record.order !== null ? (record.order as Record<string, unknown>) : null
    if (order && (typeof order.id === 'number' || typeof order.id === 'string')) return String(order.id)
  }
  const first = Object.values(params)[0]
  return first ?? null
}

/** Router gọi trước `commit()` với request ghi thành công. Request không khớp luật nào thì bỏ qua. */
export function auditAfterRequest(
  db: MockTransaction,
  input: { method: HttpMethod; path: string; body: unknown; user: MockUser | null; now: Date },
  response: MockResponse
): void {
  if (!response.body.success || response.status >= 300) return
  for (const rule of AUDIT_RULES) {
    const params = matchRule(rule, input.method, input.path)
    if (!params) continue
    let actor = input.user
    if (rule.action === 'LOGIN') {
      const data = response.body.data as { user?: { id?: number } } | null
      actor = db.read('users').find((u) => u.id === data?.user?.id) ?? null
    }
    const after = summarizeBody(input.body)
    writeAudit(db, actor, input.now, {
      action: rule.action,
      module: rule.module,
      entityType: rule.entityType,
      entityId: entityIdOf(response, params),
      details: after ? { after } : null,
    })
    return
  }
}
