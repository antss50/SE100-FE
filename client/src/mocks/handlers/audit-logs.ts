import type { AuditLogsData } from '../../types/reports'
import { MockHttpError, keywordOf, ok, paginate } from '../http'
import type { MockRoute } from '../router'
import { toDateOnly } from '../time'

export const auditLogRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/audit-logs',
    permission: 'AUDIT_LOG_VIEW',
    handler: ({ db, query }) => {
      const all = db.read('auditLogs')
      const userId = Number(query.get('userId')) || null
      const action = query.get('action')
      const module = query.get('module')
      const fromDate = query.get('fromDate')
      const toDate = query.get('toDate')
      const kw = keywordOf(query)
      if (fromDate && toDate && fromDate > toDate) {
        throw new MockHttpError(422, 'REP_INVALID_RANGE', 'Từ ngày không được sau đến ngày')
      }
      const items = all
        .filter(
          (l) =>
            (!userId || l.userId === userId) &&
            (!action || action === 'ALL' || l.action === action) &&
            (!module || module === 'ALL' || l.module === module) &&
            (!fromDate || toDateOnly(new Date(l.createdAt)) >= fromDate) &&
            (!toDate || toDateOnly(new Date(l.createdAt)) <= toDate) &&
            (!kw || `${l.entityType ?? ''} ${l.entityId ?? ''} ${l.userName}`.toLowerCase().includes(kw))
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      const users = new Map<number, string>()
      for (const l of all) if (l.userId !== null) users.set(l.userId, l.userName)
      const data: AuditLogsData = {
        ...paginate(items, query, 20),
        facets: {
          users: [...users].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
          actions: [...new Set(all.map((l) => l.action))].sort(),
        },
      }
      return ok(data)
    },
  },
]
