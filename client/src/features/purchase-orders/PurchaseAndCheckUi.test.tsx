import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../app/store'
import { defaultPermissionsForRoles } from '../../domain/permissions'
import { CheckCountingForm } from '../inventory-checks/CheckCountingForm'
import { PurchaseOrderDetailPage } from './PurchaseOrderDetailPage'
import { purchaseOrdersService } from '../../services/purchase-orders.service'

const wrap = (ui: React.ReactNode, initialEntry = '/') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PurchaseOrderDetailPage gộp cột Sản phẩm & SKU và đếm tổng sản phẩm khác nhau', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      accessToken: 't',
      refreshToken: 'r',
      user: {
        id: 4,
        employeeCode: 'NV0004',
        username: 'inventory01',
        fullName: 'NV Kho',
        email: 'kho@lumina.vn',
        roles: ['INVENTORY_STAFF'],
        permissions: defaultPermissionsForRoles(['INVENTORY_STAFF']),
      },
    })
  })

  it('hiển thị Tổng số sản phẩm khác nhau và gộp rowSpan cột Sản phẩm & SKU khi nhiều lô cùng SP', async () => {
    vi.spyOn(purchaseOrdersService, 'get').mockResolvedValueOnce({
      success: true,
      message: 'OK',
      data: {
        id: 99,
        poCode: 'PN20261124-01',
        supplierId: 1,
        supplierCode: 'NCC001',
        supplierName: 'Loreal VN',
        totalAmount: 1_000_000,
        status: 'COMPLETED',
        createdBy: 4,
        createdByName: 'NV Kho',
        createdAt: '2026-11-24T10:00:00+07:00',
        confirmedAt: '2026-11-24T10:05:00+07:00',
        lineCount: 2,
        productCount: 1,
        totalQuantity: 10,
        lines: [
          {
            id: 1,
            productId: 5,
            sku: 'SKU-ROM-JLT06',
            productName: 'Son Tint Romand',
            lotCode: 'LOT-A',
            expDate: '2028-01-01',
            quantity: 4,
            unitCost: 100_000,
            lineTotal: 400_000,
          },
          {
            id: 2,
            productId: 5,
            sku: 'SKU-ROM-JLT06',
            productName: 'Son Tint Romand',
            lotCode: 'LOT-B',
            expDate: '2028-06-01',
            quantity: 6,
            unitCost: 100_000,
            lineTotal: 600_000,
          },
        ],
      },
    })

    wrap(
      <Routes>
        <Route path="/purchase-orders/:purchaseOrderId" element={<PurchaseOrderDetailPage />} />
      </Routes>,
      '/purchase-orders/99'
    )

    expect(await screen.findByText('Son Tint Romand')).toBeDefined()
    expect(screen.getByText('Tổng số sản phẩm')).toBeDefined()
    expect(screen.getByText('2 lô')).toBeDefined()
    const mergedCell = screen.getByText('Son Tint Romand').closest('td')
    expect(mergedCell?.getAttribute('rowspan')).toBe('2')
  })
})

describe('CheckCountingForm', () => {
  it('đổi cột Giải trình thành Ghi chú tùy chọn và nút Gửi duyệt thành Hoàn tất kiểm kê', () => {
    wrap(
      <CheckCountingForm
        check={{
          id: 1,
          checkCode: 'CHK20261124-01',
          checkType: 'WAREHOUSE',
          scheduledAt: '2026-11-24T15:00:00+07:00',
          assignedTo: 4,
          assignedToName: 'Lê Vũ Hoàng An',
          status: 'IN_PROGRESS',
          snapshotAt: '2026-11-24T15:00:00+07:00',
          createdBy: 2,
          createdByName: 'Trần Lê Ngọc Mai',
          lineCount: 1,
          differenceLineCount: 0,
          totalDifference: 0,
          lines: [
            {
              id: 10,
              batchId: 15,
              productId: 3,
              sku: 'SKU-ANE-UV60',
              productName: 'Sữa Chống Nắng Anessa',
              lotCode: 'LOT-ANE-2501',
              expDate: '2027-06-01',
              snapshotQty: 30,
              countedQty: null,
              differenceQty: null,
              note: null,
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Ghi chú')).toBeDefined()
    expect(screen.getByPlaceholderText('Ghi chú (tùy chọn)')).toBeDefined()
    expect(screen.getByRole('button', { name: /Hoàn tất kiểm kê/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Gửi duyệt/i })).toBeNull()
  })
})
