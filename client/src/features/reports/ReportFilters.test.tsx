import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportFilters } from './ReportFilters'
import { PRESET_LABELS, presetRange, useReportRange, type RangePreset } from './report-range'

function TestHarness() {
  const controller = useReportRange('THIS_MONTH')
  return <ReportFilters controller={controller} />
}

describe('ReportFilters preset auto-fill', () => {
  it('tự động fill giá trị Từ ngày và Đến ngày vào input khi chọn từng nút filter nhanh', () => {
    render(<TestHarness />)

    const fromInput = screen.getByLabelText('Từ ngày') as HTMLInputElement
    const toInput = screen.getByLabelText('Đến ngày') as HTMLInputElement

    // Kiểm tra giá trị khởi tạo mặc định (Tháng này: đầu tháng -> hôm nay)
    const initialRange = presetRange('THIS_MONTH')
    expect(fromInput.value).toBe(initialRange.fromDate)
    expect(toInput.value).toBe(initialRange.toDate)

    // Lần lượt bấm từng nút filter nhanh và xác nhận input DOM cập nhật đúng
    for (const preset of ['TODAY', 'LAST7', 'THIS_MONTH', 'LAST_MONTH', 'THIS_QUARTER'] as RangePreset[]) {
      fireEvent.click(screen.getByRole('button', { name: PRESET_LABELS[preset] }))
      const expected = presetRange(preset)
      expect(fromInput.value).toBe(expected.fromDate)
      expect(toInput.value).toBe(expected.toDate)
    }
  })
})

