import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReturnableLine } from '../../types/pos'
import { ReturnLinesTable, type ReturnSelection } from './ReturnLinesTable'

const mockLines: ReturnableLine[] = [
  {
    id: 1,
    productId: 101,
    sku: 'SKU-BIO-H2O500',
    productName: 'Nước Tẩy Trang Bioderma Pink 500ml',
    batchId: 1,
    lotCode: 'LOT-BIO-2482',
    expDate: '2027-06-01',
    quantity: 1,
    unitPrice: 331_186,
    costPrice: 250_000,
    taxRate: 0.1,
    taxAmount: 30_108,
    lineType: 'NORMAL',
    linePromotionId: null,
    promoGroupNo: null,
    lineDiscount: 0,
    tierDiscount: 0,
    orderDiscount: 0,
    pointsDiscount: 0,
    lineTotal: 331_186,
    returnedQuantity: 0,
    returnableQuantity: 1,
  },
  {
    id: 2,
    productId: 102,
    sku: 'SKU-ANE-UV60',
    productName: 'Sữa Chống Nắng Anessa Perfect UV 60ml',
    batchId: 2,
    lotCode: 'LOT-ANE-2501',
    expDate: '2027-09-01',
    quantity: 1,
    unitPrice: 458_309,
    costPrice: 350_000,
    taxRate: 0.1,
    taxAmount: 41_664,
    lineType: 'NORMAL',
    linePromotionId: null,
    promoGroupNo: null,
    lineDiscount: 0,
    tierDiscount: 0,
    orderDiscount: 0,
    pointsDiscount: 0,
    lineTotal: 458_309,
    returnedQuantity: 0,
    returnableQuantity: 1,
  },
]

describe('ReturnLinesTable', () => {
  it('cho phép chọn lý do trả hàng riêng cho từng sản phẩm và chỉ cập nhật tình trạng của sản phẩm đó', () => {
    const onChange = vi.fn()
    const selection: Record<number, ReturnSelection> = {
      1: { selected: true, quantity: 1, reason: 'DEFECTIVE', condition: 'DAMAGED_OR_OPENED' },
      2: { selected: true, quantity: 1, reason: 'CHANGE_OF_MIND', condition: 'INTACT' },
    }

    render(<ReturnLinesTable lines={mockLines} selection={selection} onChange={onChange} />)

    const reason1 = screen.getByLabelText('Lý do trả hàng Nước Tẩy Trang Bioderma Pink 500ml') as HTMLSelectElement
    const reason2 = screen.getByLabelText('Lý do trả hàng Sữa Chống Nắng Anessa Perfect UV 60ml') as HTMLSelectElement
    const condition1 = screen.getByLabelText('Tình trạng Nước Tẩy Trang Bioderma Pink 500ml') as HTMLSelectElement
    const condition2 = screen.getByLabelText('Tình trạng Sữa Chống Nắng Anessa Perfect UV 60ml') as HTMLSelectElement

    // Hai sản phẩm có lý do và tình trạng độc lập nhau
    expect(reason1.value).toBe('DEFECTIVE')
    expect(condition1.value).toBe('DAMAGED_OR_OPENED')
    expect(reason2.value).toBe('CHANGE_OF_MIND')
    expect(condition2.value).toBe('INTACT')

    // Đổi lý do của sản phẩm 1 sang CHANGE_OF_MIND -> chỉ cập nhật sản phẩm 1 với condition = INTACT
    fireEvent.change(reason1, { target: { value: 'CHANGE_OF_MIND' } })
    expect(onChange).toHaveBeenCalledWith(1, {
      selected: true,
      quantity: 1,
      reason: 'CHANGE_OF_MIND',
      condition: 'INTACT',
    })
  })

  it('sản phẩm chưa tick chọn thì Lý do trả hàng và Tình trạng mặc định là ""', () => {
    const onChange = vi.fn()
    const selection: Record<number, ReturnSelection> = {
      1: { selected: true, quantity: 1, reason: 'DEFECTIVE', condition: 'DAMAGED_OR_OPENED' },
    }

    render(<ReturnLinesTable lines={mockLines} selection={selection} onChange={onChange} />)

    const reason2 = screen.getByLabelText('Lý do trả hàng Sữa Chống Nắng Anessa Perfect UV 60ml') as HTMLSelectElement
    const condition2 = screen.getByLabelText('Tình trạng Sữa Chống Nắng Anessa Perfect UV 60ml') as HTMLSelectElement
    expect(reason2.disabled).toBe(true)
    expect(reason2.value).toBe('')
    expect(condition2.value).toBe('')

    // Tick chọn sản phẩm 2 -> mặc định DEFECTIVE & DAMAGED_OR_OPENED
    fireEvent.click(screen.getByLabelText('Chọn Sữa Chống Nắng Anessa Perfect UV 60ml'))
    expect(onChange).toHaveBeenCalledWith(2, {
      selected: true,
      quantity: 1,
      reason: 'DEFECTIVE',
      condition: 'DAMAGED_OR_OPENED',
    })
  })
})
