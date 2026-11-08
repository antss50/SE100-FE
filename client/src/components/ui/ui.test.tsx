import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Button, ConfirmDialog, DataTable, Input, Modal, PageHeader, Pagination, pageWindow } from './index'

describe('Button', () => {
  it('loading thì khóa nút', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Lưu
      </Button>
    )
    const btn = screen.getByRole('button', { name: 'Lưu' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('type', 'button')
  })
})

describe('Input', () => {
  it('có label gắn với ô và hiện lỗi', () => {
    render(<Input label="Họ tên" error="Bắt buộc" />)
    const input = screen.getByLabelText('Họ tên')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Bắt buộc')
  })
})

describe('Modal', () => {
  it('đóng bằng Esc', () => {
    const onClose = vi.fn()
    render(
      <Modal open title="Tiêu đề" onClose={onClose}>
        <button type="button">Bên trong</button>
      </Modal>
    )
    expect(screen.getByRole('dialog', { name: 'Tiêu đề' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('đang gửi thì Esc không đóng', () => {
    const onClose = vi.fn()
    render(
      <Modal open busy title="Tiêu đề" onClose={onClose}>
        nội dung
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('focus vào phần tử đầu tiên trong hộp', () => {
    render(
      <Modal open title="Tiêu đề" onClose={() => {}}>
        <input aria-label="ô" />
      </Modal>
    )
    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus()
  })
})

describe('ConfirmDialog', () => {
  it('gọi onConfirm / onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open title="Duyệt phiếu?" message="Không hoàn tác được" onConfirm={onConfirm} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('DataTable', () => {
  const columns = [{ key: 'name', header: 'Tên', render: (r: { id: number; name: string }) => r.name }]

  it('hiện trạng thái đang tải, lỗi, rỗng', () => {
    const { rerender } = render(<DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} loading />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
    rerender(<DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} error="Mất kết nối" />)
    expect(screen.getByText('Mất kết nối')).toBeInTheDocument()
    rerender(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="Không có phiếu" />)
    expect(screen.getByText('Không có phiếu')).toBeInTheDocument()
  })

  it('hiện dòng dữ liệu', () => {
    render(<DataTable columns={columns} rows={[{ id: 1, name: 'Serum A' }]} rowKey={(r) => r.id} />)
    expect(screen.getByRole('cell', { name: 'Serum A' })).toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it('pageWindow có dấu … khi xa', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
  })

  it('khóa nút trước ở trang đầu và báo khoảng hiển thị', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} pageSize={10} totalItems={25} onPageChange={onPageChange} unit="phiếu" />)
    expect(screen.getByText('Hiển thị 1–10 trong 25 phiếu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})

describe('PageHeader', () => {
  it('hiện breadcrumb và tiêu đề', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Kiểm kê kho" breadcrumbs={[{ label: 'Kho & Hàng hóa' }, { label: 'Kiểm kê kho' }]} />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Kiểm kê kho' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Đường dẫn' })).toHaveTextContent('Kho & Hàng hóa')
  })
})
