import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrderTimeFilter } from './OrderTimeFilter'
import { createInitialTimeFilter, resolveTimeRange, type TimeFilterState } from './order-time-filter'

describe('order-time-filter (resolveTimeRange)', () => {
  const base: TimeFilterState = createInitialTimeFilter(new Date('2026-11-17T10:00:00'))

  it('mode ALL trả về khoảng rỗng', () => {
    expect(resolveTimeRange({ ...base, mode: 'ALL' })).toEqual({ fromDate: '', toDate: '' })
  })

  it('mode DAY trả về đúng ngày được chọn', () => {
    expect(resolveTimeRange({ ...base, mode: 'DAY', day: '2026-11-17' })).toEqual({
      fromDate: '2026-11-17',
      toDate: '2026-11-17',
    })
  })

  it('mode MONTH tính đúng ngày đầu tháng và cuối tháng (bao gồm năm nhuận)', () => {
    expect(resolveTimeRange({ ...base, mode: 'MONTH', year: 2026, month: 2 })).toEqual({
      fromDate: '2026-02-01',
      toDate: '2026-02-28',
    })
    expect(resolveTimeRange({ ...base, mode: 'MONTH', year: 2024, month: 2 })).toEqual({
      fromDate: '2024-02-01',
      toDate: '2024-02-29',
    })
    expect(resolveTimeRange({ ...base, mode: 'MONTH', year: 2026, month: 11 })).toEqual({
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
    })
  })

  it('mode QUARTER tính đúng 4 quý trong năm', () => {
    expect(resolveTimeRange({ ...base, mode: 'QUARTER', year: 2026, quarter: 1 })).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-03-31',
    })
    expect(resolveTimeRange({ ...base, mode: 'QUARTER', year: 2026, quarter: 2 })).toEqual({
      fromDate: '2026-04-01',
      toDate: '2026-06-30',
    })
    expect(resolveTimeRange({ ...base, mode: 'QUARTER', year: 2026, quarter: 3 })).toEqual({
      fromDate: '2026-07-01',
      toDate: '2026-09-30',
    })
    expect(resolveTimeRange({ ...base, mode: 'QUARTER', year: 2026, quarter: 4 })).toEqual({
      fromDate: '2026-10-01',
      toDate: '2026-12-31',
    })
  })

  it('mode YEAR tính đúng từ 01/01 đến 31/12', () => {
    expect(resolveTimeRange({ ...base, mode: 'YEAR', year: 2026 })).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    })
  })

  it('mode CUSTOM giữ nguyên khoảng ngày nhập tay', () => {
    expect(
      resolveTimeRange({ ...base, mode: 'CUSTOM', fromDate: '2026-10-05', toDate: '2026-10-20' })
    ).toEqual({
      fromDate: '2026-10-05',
      toDate: '2026-10-20',
    })
  })
})

describe('OrderTimeFilter component', () => {
  it('hiển thị đúng input theo chế độ lọc và gọi callback khi thay đổi', () => {
    const initial = createInitialTimeFilter(new Date('2026-11-17T10:00:00'))
    const onChange = vi.fn()
    const onReset = vi.fn()

    const { rerender } = render(<OrderTimeFilter value={initial} onChange={onChange} onReset={onReset} />)

    // Mặc định mode ALL: chưa có nút Đặt lại
    expect(screen.queryByRole('button', { name: /Đặt lại/i })).toBeNull()

    // Đổi sang Theo quý
    fireEvent.change(screen.getByLabelText(/Kiểu lọc thời gian/i), { target: { value: 'QUARTER' } })
    expect(onChange).toHaveBeenCalledWith({ ...initial, mode: 'QUARTER' })

    // Render lại với mode QUARTER -> hiện select Quý & Năm và nút Đặt lại
    rerender(<OrderTimeFilter value={{ ...initial, mode: 'QUARTER' }} onChange={onChange} onReset={onReset} />)
    expect(screen.getByLabelText(/Chọn quý/i)).toBeDefined()
    expect(screen.getByLabelText(/Chọn năm/i)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /Đặt lại/i }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})

