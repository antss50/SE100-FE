import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BrandItem, CategoryItem } from '../../types/api'
import { ProductFilterBar } from './components/ProductFilterBar'

const mockCategories: CategoryItem[] = [
  { id: 1, categoryCode: 'CAT_SKINCARE', categoryName: 'Chăm sóc da (Serum)', status: 'ACTIVE' },
  { id: 2, categoryCode: 'CAT_MAKEUP', categoryName: 'Trang điểm (Son môi)', status: 'ACTIVE' },
]

const mockBrands: BrandItem[] = [
  { id: 1, brandCode: 'EL', brandName: 'Estée Lauder', status: 'ACTIVE' },
  { id: 2, brandCode: 'YSL', brandName: 'YSL Beauty', status: 'ACTIVE' },
]

describe('ProductFilterBar component', () => {
  it('hiển thị đầy đủ các bộ lọc: Danh mục, Thương hiệu, Giá, HSD cận hạn', () => {
    render(
      <ProductFilterBar
        categoryCode="ALL"
        onCategoryChange={vi.fn()}
        brandCode="ALL"
        onBrandChange={vi.fn()}
        priceSort=""
        onPriceSortChange={vi.fn()}
        nearExpiryOnly={false}
        onNearExpiryToggle={vi.fn()}
        categories={mockCategories}
        brands={mockBrands}
        hasActiveFilters={false}
        onReset={vi.fn()}
      />
    )

    // Kiểm tra dropdown danh mục và options
    expect(screen.getByLabelText(/Lọc theo danh mục/i)).toBeDefined()
    expect(screen.getByText(/Tất cả danh mục/i)).toBeDefined()
    expect(screen.getByText('Chăm sóc da (Serum)')).toBeDefined()

    // Kiểm tra dropdown thương hiệu và options
    expect(screen.getByLabelText(/Lọc theo thương hiệu/i)).toBeDefined()
    expect(screen.getByText(/Tất cả thương hiệu/i)).toBeDefined()
    expect(screen.getByText('Estée Lauder')).toBeDefined()

    // Kiểm tra dropdown sắp xếp theo giá
    expect(screen.getByLabelText(/Sắp xếp theo giá/i)).toBeDefined()
    expect(screen.getByText(/Giá: Mặc định/i)).toBeDefined()

    // Kiểm tra nút toggle HSD cận hạn
    const nearExpiryBtn = screen.getByRole('button', { name: /HSD: Cận hạn/i })
    expect(nearExpiryBtn).toBeDefined()
    expect(nearExpiryBtn.getAttribute('aria-pressed')).toBe('false')

    // Chưa có filter active thì không hiện nút Đặt lại
    expect(screen.queryByRole('button', { name: /Đặt lại/i })).toBeNull()
  })

  it('gọi đúng callback khi người dùng thay đổi bộ lọc', () => {
    const onCategoryChange = vi.fn()
    const onBrandChange = vi.fn()
    const onPriceSortChange = vi.fn()
    const onNearExpiryToggle = vi.fn()
    const onReset = vi.fn()

    render(
      <ProductFilterBar
        categoryCode="ALL"
        onCategoryChange={onCategoryChange}
        brandCode="ALL"
        onBrandChange={onBrandChange}
        priceSort=""
        onPriceSortChange={onPriceSortChange}
        nearExpiryOnly={false}
        onNearExpiryToggle={onNearExpiryToggle}
        categories={mockCategories}
        brands={mockBrands}
        hasActiveFilters={true}
        onReset={onReset}
      />
    )

    // Chọn danh mục
    fireEvent.change(screen.getByLabelText(/Lọc theo danh mục/i), { target: { value: 'CAT_SKINCARE' } })
    expect(onCategoryChange).toHaveBeenCalledWith('CAT_SKINCARE')

    // Chọn thương hiệu
    fireEvent.change(screen.getByLabelText(/Lọc theo thương hiệu/i), { target: { value: 'EL' } })
    expect(onBrandChange).toHaveBeenCalledWith('EL')

    // Chọn sắp xếp giá tăng dần
    fireEvent.change(screen.getByLabelText(/Sắp xếp theo giá/i), { target: { value: 'asc' } })
    expect(onPriceSortChange).toHaveBeenCalledWith('asc')

    // Bấm nút HSD cận hạn
    fireEvent.click(screen.getByRole('button', { name: /HSD: Cận hạn/i }))
    expect(onNearExpiryToggle).toHaveBeenCalledOnce()

    // Bấm nút Đặt lại khi hasActiveFilters = true
    const resetBtn = screen.getByRole('button', { name: /Đặt lại/i })
    expect(resetBtn).toBeDefined()
    fireEvent.click(resetBtn)
    expect(onReset).toHaveBeenCalledOnce()
  })
})
