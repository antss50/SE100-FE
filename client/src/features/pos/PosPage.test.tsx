import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { roundVnd1000 } from '../../utils/format'
import { PaymentPanel } from './components/PaymentPanel'
import { usePosStore } from './pos-store'

describe('Quy tắc làm tròn tiền khi áp mã giảm giá (roundVnd1000)', () => {
  it('làm tròn xuống 0đ khi phần dư < 500đ', () => {
    expect(roundVnd1000(0)).toBe(0)
    expect(roundVnd1000(200)).toBe(0)
    expect(roundVnd1000(499)).toBe(0)
    expect(roundVnd1000(12_400)).toBe(12_000)
    expect(roundVnd1000(12_499)).toBe(12_000)
    expect(roundVnd1000(250_100)).toBe(250_000)
  })

  it('làm tròn lên 1.000đ khi phần dư >= 500đ', () => {
    expect(roundVnd1000(500)).toBe(1_000)
    expect(roundVnd1000(501)).toBe(1_000)
    expect(roundVnd1000(999)).toBe(1_000)
    expect(roundVnd1000(12_500)).toBe(13_000)
    expect(roundVnd1000(12_750)).toBe(13_000)
    expect(roundVnd1000(250_500)).toBe(251_000)
    expect(roundVnd1000(250_850)).toBe(251_000)
  })
})

describe('Focus sản phẩm khi chọn (pos-store selectedProductId)', () => {
  beforeEach(() => {
    usePosStore.getState().reset()
  })

  it('tự động set selectedProductId khi thêm sản phẩm vào giỏ', () => {
    expect(usePosStore.getState().selectedProductId).toBeNull()
    usePosStore.getState().addProduct(101, 'Serum ANR 50ml')
    expect(usePosStore.getState().selectedProductId).toBe(101)
  })

  it('đẩy sản phẩm chọn sau lên đầu danh sách trong giỏ hàng', () => {
    usePosStore.getState().addProduct(101, 'Serum ANR 50ml')
    usePosStore.getState().addProduct(102, 'Kem chống nắng')
    usePosStore.getState().addProduct(103, 'Son môi YSL')

    // Sản phẩm chọn sau cùng (103) phải ở đầu danh sách
    let items = usePosStore.getState().items
    expect(items.map((i) => i.productId)).toEqual([103, 102, 101])

    // Chọn lại sản phẩm 101 (đã có trong giỏ) -> được tăng số lượng và đẩy lên đầu danh sách
    usePosStore.getState().addProduct(101, 'Serum ANR 50ml')
    items = usePosStore.getState().items
    expect(items.map((i) => i.productId)).toEqual([101, 103, 102])
    expect(items[0].quantity).toBe(2)
  })

  it('cho phép set và reset selectedProductId khi chọn hoặc xóa sản phẩm', () => {
    usePosStore.getState().addProduct(101, 'Serum ANR 50ml')
    usePosStore.getState().addProduct(102, 'Kem chống nắng')
    expect(usePosStore.getState().selectedProductId).toBe(102)

    usePosStore.getState().setSelectedProductId(101)
    expect(usePosStore.getState().selectedProductId).toBe(101)

    usePosStore.getState().removeProduct(101)
    expect(usePosStore.getState().selectedProductId).toBeNull()
  })
})

describe('PaymentPanel: Sticky thanh toán và làm tròn', () => {
  beforeEach(() => {
    usePosStore.getState().reset()
  })

  const mockQuote = {
    lines: [],
    subtotalAmount: 500_000,
    lineDiscountAmount: 0,
    tierDiscountAmount: 0,
    orderPromotionId: 10,
    orderPromotionName: 'Voucher GIAM15',
    orderDiscountAmount: 74_550, // Lẻ 550đ -> phải làm tròn lên 75.000đ
    pointsUsed: 0,
    pointsDiscountAmount: 0,
    discountAmount: 74_550,
    taxAmount: 0,
    totalAmount: 425_450,
    exchangeCreditAmount: 0,
    amountDue: 425_450, // Lẻ 450đ -> làm tròn xuống 425.000đ
    messages: [],
    issues: [],
    pointsToEarn: 42,
    maxRedeemablePoints: 0,
  }

  it('hiển thị số tiền đã làm tròn khi áp mã giảm giá và stick khu vực chốt thanh toán', () => {
    usePosStore.getState().setVoucher('GIAM15')
    usePosStore.getState().setPayment('CASH')
    usePosStore.getState().setReceived('500000')

    render(
      <PaymentPanel
        quote={mockQuote}
        quoting={false}
        disabled={false}
        completing={false}
        savingDraft={false}
        onComplete={vi.fn()}
        onSaveDraft={vi.fn()}
        onReturn={vi.fn()}
      />
    )

    // Kiểm tra khu vực chốt thanh toán có class sticky bottom-0
    const stickySection = screen.getByLabelText(/Khu vực chốt thanh toán cố định/i)
    expect(stickySection).toBeDefined()
    expect(stickySection.className).toContain('sticky')
    expect(stickySection.className).toContain('bottom-0')

    // Số tiền phải trả sau làm tròn (425.450đ dư 450 < 500 => 425.000đ)
    expect(screen.getByText('425.000 đ')).toBeDefined()

    // Tiền khách đưa 500.000đ -> Tiền thừa trả khách: 75.000đ
    expect(screen.getByText(/Tiền thừa trả khách: 75.000 đ/i)).toBeDefined()
  })
})
