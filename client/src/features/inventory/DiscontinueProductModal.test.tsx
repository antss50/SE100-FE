import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../app/store'
import { defaultPermissionsForRoles } from '../../domain/permissions'
import { productsService } from '../../services/products.service'
import {
  expectFail,
  freshDb,
  get,
  loginAs,
  patch,
  post,
  send,
  type Page,
} from '../../test/api-helpers'
import type { DeactivateProductResult, ProductItem } from '../../types/api'
import type { DisposalDetail } from '../../types/inventory'
import { DiscontinueProductModal } from './DiscontinueProductModal'
import { InventoryPage } from './InventoryPage'

interface BatchInfo {
  id: number
  productId: number
  lotCode: string
  onHandQty: number
  blockedQty: number
  availableQty: number
}

interface BatchDetailInfo extends BatchInfo {
  movements: { quantityChange: number; balanceAfter: number; referenceType: string }[]
}

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Nghiệp vụ xuất hủy khi ngừng kinh doanh sản phẩm còn tồn (API + Sổ kho)', () => {
  beforeEach(freshDb)

  it('Quản lý (STORE_MANAGER) ngừng kinh doanh SP còn tồn -> tự động lập & duyệt phiếu xuất hủy, tồn = 0, ghi thẻ kho DISPOSAL', async () => {
    await loginAs('manager01')
    // Không truyền thông tin xuất hủy vẫn chặn 409 PROD_HAS_STOCK
    await expectFail('/products/SKU-EL-ANR50/deactivate', patch({}), 409, 'PROD_HAS_STOCK')

    const res = await send<DeactivateProductResult>(
      '/products/SKU-EL-ANR50/deactivate',
      patch({
        disposal: {
          reasonCode: 'DAMAGED',
          reason: 'Xuất hủy toàn bộ hàng lỗi và hàng trưng bày để ngừng kinh doanh',
        },
      })
    )

    expect(res).toMatchObject({
      sku: 'SKU-EL-ANR50',
      status: 'DISCONTINUED',
      disposalStatus: 'APPROVED',
    })
    expect(res.disposalId).toBeDefined()

    const product = await get<ProductItem>('/products/SKU-EL-ANR50')
    expect(product.status).toBe('DISCONTINUED')
    expect(product.currentStock).toBe(0)

    const disposal = await get<DisposalDetail>(`/disposals/${res.disposalId}`)
    expect(disposal.status).toBe('APPROVED')
    expect(disposal.issueType).toBe('DESTROY')
    expect(disposal.reasonCode).toBe('DAMAGED')
    expect(disposal.totalCost).toBeGreaterThan(0)

    // Bất biến sổ kho: onHand = 0, blocked = 0, tổng biến động khớp onHand
    const allBatches = (await get<Page<BatchInfo>>('/stock/batches?pageSize=200')).items.filter(
      (b) => b.productId === product.id
    )
    expect(allBatches.length).toBeGreaterThan(0)
    for (const b of allBatches) {
      expect(b.onHandQty).toBe(0)
      expect(b.blockedQty).toBe(0)
      const detail = await get<BatchDetailInfo>(`/stock/batches/${b.id}`)
      const sum = detail.movements.reduce((acc, m) => acc + m.quantityChange, 0)
      expect(sum).toBe(0)
      expect(detail.movements[0]?.referenceType).toBe('DISPOSAL')
    }
  })

  it('Quản lý ngừng kinh doanh SP đang có sẵn phiếu xuất hủy chờ duyệt (SKU-LRP-ANT50) -> duyệt luôn phiếu chờ và hủy nốt tồn còn lại', async () => {
    await loginAs('manager01')
    const res = await send<DeactivateProductResult>(
      '/products/SKU-LRP-ANT50/deactivate',
      patch({
        disposal: {
          reasonCode: 'NEAR_EXPIRY',
          reason: 'Dừng phân phối dòng kem chống nắng cũ',
        },
      })
    )
    expect(res.status).toBe('DISCONTINUED')
    expect(res.disposalStatus).toBe('APPROVED')

    const product = await get<ProductItem>('/products/SKU-LRP-ANT50')
    expect(product.currentStock).toBe(0)
    expect(product.status).toBe('DISCONTINUED')
  })

  it('Nhân viên kho (INVENTORY_STAFF) ngừng kinh doanh SP còn tồn -> lập phiếu WAITING_APPROVAL cách ly hàng; Quản lý từ chối hoàn cách ly, Quản lý duyệt tự động DISCONTINUED', async () => {
    await loginAs('inventory01')
    const beforeProduct = await get<ProductItem>('/products/SKU-EL-ANR50')
    expect(beforeProduct.currentStock).toBeGreaterThan(0)

    // Lần 1: NV kho lập yêu cầu xuất hủy ngừng kinh doanh
    const firstReq = await send<DeactivateProductResult>(
      '/products/SKU-EL-ANR50/deactivate',
      patch({
        disposal: {
          reasonCode: 'RECALL',
          reason: 'Thu hồi theo thông báo hãng để ngừng kinh doanh',
        },
      })
    )
    expect(firstReq).toMatchObject({
      sku: 'SKU-EL-ANR50',
      status: 'ACTIVE',
      disposalStatus: 'WAITING_APPROVAL',
    })

    // Toàn bộ lô của SP bị cách ly (availableQty = 0) để POS không bán thêm được
    const isolatedBatches = (await get<Page<BatchInfo>>('/stock/batches?pageSize=200')).items.filter(
      (b) => b.productId === beforeProduct.id && b.onHandQty > 0
    )
    for (const b of isolatedBatches) {
      expect(b.blockedQty).toBe(b.onHandQty)
      expect(b.availableQty).toBe(0)
    }

    // Quản lý từ chối -> trả lại phần cách ly ban đầu, SP vẫn ACTIVE
    await loginAs('manager01')
    await send(`/disposals/${firstReq.disposalId}/reject`, post({ reason: 'Kiểm tra lại thông báo hãng' }))
    const lot2311AfterReject = (await get<Page<BatchInfo>>('/stock/batches?pageSize=200')).items.find(
      (b) => b.lotCode === 'LOT-EL-2311'
    )
    expect(lot2311AfterReject?.blockedQty).toBe(5) // Giữ nguyên 5 đơn vị cách ly gốc trước khi lập phiếu

    // Lần 2: NV kho gửi lại, Quản lý duyệt -> tồn = 0 và SP tự động chuyển DISCONTINUED
    await loginAs('inventory01')
    const secondReq = await send<DeactivateProductResult>(
      '/products/SKU-EL-ANR50/deactivate',
      patch({
        disposal: {
          reasonCode: 'RECALL',
          reason: 'Đã xác nhận thông báo thu hồi chính thức từ hãng',
        },
      })
    )
    expect(secondReq.disposalStatus).toBe('WAITING_APPROVAL')

    await loginAs('manager01')
    await send(`/disposals/${secondReq.disposalId}/approve`, post({}))

    const afterApprove = await get<ProductItem>('/products/SKU-EL-ANR50')
    expect(afterApprove.currentStock).toBe(0)
    expect(afterApprove.status).toBe('DISCONTINUED')
  })
})

describe('Giao diện DiscontinueProductModal & InventoryPage', () => {
  const sampleProduct: ProductItem = {
    id: 1,
    sku: 'SKU-EL-ANR50',
    productName: 'Tinh Chất Phục Hồi ANR 50ml',
    categoryCode: 'CAT_SKINCARE',
    brandCode: 'EL',
    unit: 'Chai',
    retailPrice: 3_550_000,
    taxRate: 0.1,
    currentStock: 105,
    status: 'ACTIVE',
  }

  it('hiển thị nút theo quyền Quản lý và gửi payload disposal khi xác nhận', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'token-mgr',
      refreshToken: 'refresh-mgr',
      user: {
        id: 2,
        employeeCode: 'NV0002',
        username: 'manager01',
        fullName: 'Quản lý Cửa hàng',
        email: 'mgr@lumina.vn',
        roles: ['STORE_MANAGER'],
        permissions: defaultPermissionsForRoles(['STORE_MANAGER']),
      },
    })

    const spy = vi.spyOn(productsService, 'deactivateProduct').mockResolvedValueOnce({
      success: true,
      message: 'Đã xuất hủy tồn kho và ngừng kinh doanh sản phẩm',
      data: {
        sku: 'SKU-EL-ANR50',
        status: 'DISCONTINUED',
        disposalId: 10,
        disposalCode: 'DISP20261124-01',
        disposalStatus: 'APPROVED',
      },
    })
    const onSuccess = vi.fn()

    wrap(
      <DiscontinueProductModal
        product={sampleProduct}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    )

    expect(screen.getByRole('button', { name: /Xuất hủy & Ngừng kinh doanh/i })).toBeDefined()

    fireEvent.change(screen.getByLabelText(/Mã lý do xuất hủy/i), {
      target: { value: 'EXPIRED' },
    })
    fireEvent.change(screen.getByLabelText(/Diễn giải lý do xuất hủy/i), {
      target: { value: 'Hàng hết hạn trên kệ và trong kho' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Xuất hủy & Ngừng kinh doanh/i }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('SKU-EL-ANR50', {
        disposal: {
          reasonCode: 'EXPIRED',
          reason: 'Hàng hết hạn trên kệ và trong kho',
        },
      })
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    spy.mockRestore()
  })

  it('trên InventoryPage: bấm Ngừng kinh doanh vào SP còn tồn sẽ mở Modal xuất hủy; SP tồn = 0 ngừng ngay', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'token-inv',
      refreshToken: 'refresh-inv',
      user: {
        id: 4,
        employeeCode: 'NV0004',
        username: 'inventory01',
        fullName: 'Nhân viên Kho',
        email: 'kho@lumina.vn',
        roles: ['INVENTORY_STAFF'],
        permissions: defaultPermissionsForRoles(['INVENTORY_STAFF']),
      },
    })

    const getProductsSpy = vi.spyOn(productsService, 'getProducts').mockResolvedValue({
      success: true,
      data: {
        items: [
          sampleProduct,
          {
            ...sampleProduct,
            id: 2,
            sku: 'SKU-ZERO-01',
            productName: 'Sữa Rửa Mặt Hết Tồn',
            currentStock: 0,
          },
        ],
        page: 1,
        pageSize: 20,
        totalItems: 2,
      },
    })
    const getCatsSpy = vi.spyOn(productsService, 'getCategories').mockResolvedValue({
      success: true,
      data: { items: [], page: 1, pageSize: 100, totalItems: 0 },
    })
    const getBrandsSpy = vi.spyOn(productsService, 'getBrands').mockResolvedValue({
      success: true,
      data: { items: [], page: 1, pageSize: 100, totalItems: 0 },
    })
    const deactivateSpy = vi.spyOn(productsService, 'deactivateProduct').mockResolvedValue({
      success: true,
      message: 'Ngừng kinh doanh sản phẩm thành công',
      data: { sku: 'SKU-ZERO-01', status: 'DISCONTINUED' },
    })

    wrap(<InventoryPage />)

    await screen.findByText('Tinh Chất Phục Hồi ANR 50ml')
    const stopButtons = screen.getAllByTitle('Ngừng kinh doanh sản phẩm')
    expect(stopButtons).toHaveLength(2)

    // SP 2 (tồn = 0): gọi API ngừng kinh doanh trực tiếp, không mở modal
    fireEvent.click(stopButtons[1])
    await waitFor(() => {
      expect(deactivateSpy).toHaveBeenCalledWith('SKU-ZERO-01')
    })
    expect(screen.queryByRole('dialog')).toBeNull()

    // SP 1 (tồn = 105): mở modal xuất hủy với nhãn dành cho Nhân viên Kho
    fireEvent.click(stopButtons[0])
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(screen.getByRole('button', { name: /Lập phiếu xuất hủy & Chờ duyệt/i })).toBeDefined()

    getProductsSpy.mockRestore()
    getCatsSpy.mockRestore()
    getBrandsSpy.mockRestore()
    deactivateSpy.mockRestore()
  })
})
