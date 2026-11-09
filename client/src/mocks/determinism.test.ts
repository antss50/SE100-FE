// Seed phải tất định: cùng ngày, khác giây vẫn cho dữ liệu y hệt (E2E gọi reset() trước mỗi test).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSeed } from './db'

afterEach(() => vi.useRealTimers())

describe('seed tất định theo thời gian', () => {
  it('B2: hai lần dựng seed cách nhau vài giây trong cùng ngày giống hệt nhau', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T10:00:00+07:00'))
    const a = JSON.stringify(buildSeed(new Date()))
    vi.setSystemTime(new Date('2026-11-09T10:00:07+07:00'))
    const b = JSON.stringify(buildSeed(new Date()))
    expect(b).toBe(a)
  })
})
