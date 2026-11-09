import { describe, expect, it } from 'vitest'
import { expiryStatus, expiryStatusForProduct, maxExpiryDate, maxExpiryDateForProduct } from './batch'

describe('cảnh báo hạn dùng theo sản phẩm', () => {
  it('chỉ đánh dấu cận hạn khi còn từ 1 ngày đến ngưỡng', () => {
    expect(expiryStatus('2026-11-11', '2026-11-10', 1)).toBe('NEAR_EXPIRY')
    expect(expiryStatus('2026-11-10', '2026-11-10', 60)).toBe('OK')
    expect(expiryStatus('2026-11-09', '2026-11-10', 60)).toBe('EXPIRED')
    expect(expiryStatus('2026-12-10', '2026-11-10', 29)).toBe('OK')
  })

  it('tính giới hạn HSD theo tháng lịch, kể cả cuối tháng', () => {
    expect(maxExpiryDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(maxExpiryDate('2024-01-31', 1)).toBe('2024-02-29')
  })

  it('tính ngưỡng cận hạn theo đơn vị đã lưu và giữ fallback dữ liệu cũ', () => {
    expect(expiryStatusForProduct('2026-12-09', '2026-10-10', { expiryWarningValue: 2, expiryWarningUnit: 'months' })).toBe('NEAR_EXPIRY')
    expect(expiryStatusForProduct('2026-12-11', '2026-10-10', { expiryWarningValue: 2, expiryWarningUnit: 'months' })).toBe('OK')
    expect(expiryStatusForProduct('2027-10-10', '2026-10-10', { expiryWarningValue: 1, expiryWarningUnit: 'years' })).toBe('NEAR_EXPIRY')
    expect(expiryStatusForProduct('2026-12-09', '2026-10-10', { expiryWarningDays: 60 })).toBe('NEAR_EXPIRY')
  })

  it('kiểm tra HSD tối đa chính xác theo ngày, tháng, năm và dữ liệu tháng cũ', () => {
    expect(maxExpiryDateForProduct('2026-01-31', { shelfLifeValue: 30, shelfLifeUnit: 'days' })).toBe('2026-03-02')
    expect(maxExpiryDateForProduct('2026-01-31', { shelfLifeValue: 1, shelfLifeUnit: 'months' })).toBe('2026-02-28')
    expect(maxExpiryDateForProduct('2024-02-29', { shelfLifeValue: 1, shelfLifeUnit: 'years' })).toBe('2025-02-28')
    expect(maxExpiryDateForProduct('2026-01-31', { shelfLifeMonths: 1 })).toBe('2026-02-28')
  })
})
