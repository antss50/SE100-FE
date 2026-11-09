import { buildRevenueSeries, computeRevenueFigures, withoutProfit } from '../../domain/reports/revenue'
import { buildSalesReport } from '../../domain/reports/sales'
import { addDaysTo, previousRange, validateRange } from '../../domain/reports/period'
import type { ReportGranularity, ReportRange, RevenueReport } from '../../types/reports'
import { MockHttpError, ok } from '../http'
import type { MockRoute } from '../router'
import { toDateOnly } from '../time'

/** Đọc `fromDate`/`toDate` từ query (mặc định 30 ngày gần nhất) và kiểm `fromDate ≤ toDate`. */
export function rangeFromQuery(query: URLSearchParams, now: Date): ReportRange {
  const today = toDateOnly(now)
  const range: ReportRange = {
    fromDate: query.get('fromDate') || addDaysTo(today, -29),
    toDate: query.get('toDate') || today,
  }
  const error = validateRange(range)
  if (error) throw new MockHttpError(422, 'REP_INVALID_RANGE', error)
  return range
}

export function granularityFromQuery(query: URLSearchParams): ReportGranularity {
  const value = query.get('granularity')
  return value === 'WEEK' || value === 'MONTH' ? value : 'DAY'
}

export const reportRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/reports/revenue',
    permission: 'REPORT_REVENUE',
    handler: ({ db, query, now, permissions }) => {
      const range = rangeFromQuery(query, now)
      const granularity = granularityFromQuery(query)
      const src = { orders: db.read('orders'), returns: db.read('returns') }
      const showProfit = permissions.includes('REPORT_PROFIT')
      const view = <T extends ReturnType<typeof computeRevenueFigures>>(f: T): T => (showProfit ? f : withoutProfit(f))
      const compare = query.get('compare') === 'true'
      const previousRangeValue = compare ? previousRange(range) : null
      const data: RevenueReport = {
        range,
        granularity,
        showProfit,
        totals: view(computeRevenueFigures(src, range)),
        previousRange: previousRangeValue,
        previous: previousRangeValue ? view(computeRevenueFigures(src, previousRangeValue)) : null,
        series: buildRevenueSeries(src, range, granularity).map(view),
      }
      return ok(data)
    },
  },
  {
    method: 'GET',
    path: '/reports/sales',
    permission: ['REPORT_SALES', 'REPORT_SALES_OWN_SHIFT'],
    handler: ({ db, query, now, permissions, user }) => {
      const range = rangeFromQuery(query, now)
      const sellable = db.read('products').filter((p) => p.id !== undefined && p.status === 'ACTIVE' && p.isSellable !== false)
      const report = buildSalesReport(
        {
          orders: db.read('orders'),
          returns: db.read('returns'),
          shifts: db.read('shifts'),
          products: sellable.map((p) => ({ id: p.id as number, sku: p.sku, productName: p.productName })),
        },
        range,
        { onlyCashierId: permissions.includes('REPORT_SALES') ? undefined : (user?.id ?? -1) }
      )
      return ok(report)
    },
  },
]
