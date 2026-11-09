// AUTH-06: nhật ký hệ thống ghi tự động ở thao tác chính và lọc/phân trang qua GET /audit-logs.
import { beforeEach, describe, expect, it } from 'vitest'
import { expectFail, freshDb, get, loginAs, post, send, type Page } from '../test/api-helpers'
import type { AuditLogRecord, AuditLogsData } from '../types/reports'
import { summarizeBody } from './audit'

const logs = (qs = '') => get<AuditLogsData & Page<AuditLogRecord>>(`/audit-logs?pageSize=200${qs}`)

describe('nhật ký hệ thống', () => {
  beforeEach(freshDb)

  it('chỉ vai trò có AUDIT_LOG_VIEW xem được', async () => {
    await loginAs('cashier01')
    await expectFail('/audit-logs', undefined, 403, 'AUTH_FORBIDDEN')
  })

  it('ghi LOGIN, CREATE_USER và không lưu mật khẩu', async () => {
    await loginAs('admin')
    await send('/users', post({ username: 'nv.moi', password: 'Matkhau@123', fullName: 'Nhân Viên Mới', email: 'moi@shop.vn', phoneNumber: '0900000001', roleIds: [4] }))
    const data = await logs('&action=CREATE_USER')
    const row = data.items[0]
    expect(row.module).toBe('USER')
    expect(row.userName).toBeTruthy()
    expect(JSON.stringify(row.details)).not.toContain('Matkhau')
    expect((await logs('&action=LOGIN')).items.length).toBeGreaterThan(0)
  })

  it('lọc theo module, khoảng ngày sai trả 422, sắp mới nhất trước', async () => {
    await loginAs('admin')
    const all = await logs()
    const times = all.items.map((l) => l.createdAt)
    expect([...times].sort().reverse()).toEqual(times)
    const stock = await logs('&module=STOCK')
    expect(stock.items.every((l) => l.module === 'STOCK')).toBe(true)
    await expectFail('/audit-logs?fromDate=2026-05-10&toDate=2026-05-01', undefined, 422, 'REP_INVALID_RANGE')
  })

  it('summarizeBody bỏ mật khẩu và rút gọn mảng', () => {
    expect(summarizeBody({ password: 'x', name: 'A', lines: [1, 2] })).toEqual({ name: 'A', lines: '2 mục' })
    expect(summarizeBody(null)).toBeNull()
  })
})
