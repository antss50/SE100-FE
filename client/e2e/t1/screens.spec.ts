// Đợt test 1, đối chiếu thiết kế mức nhanh: mỗi màn mới mở được, không lỗi console, có cột/nút chính.
import { expect, test, type Page } from '@playwright/test'
import { login, resetApp } from '../helpers'

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  return errors
}

const SCREENS: { path: string; user: string; buttons?: (string | RegExp)[]; columns?: (string | RegExp)[] }[] = [
  { path: '/suppliers', user: 'admin', buttons: ['Thêm nhà cung cấp'] },
  { path: '/suppliers/1', user: 'admin' },
  { path: '/purchase-orders', user: 'admin', buttons: [/Tạo phiếu nhập/] },
  { path: '/purchase-orders/new', user: 'admin', buttons: ['Xác nhận nhập kho', 'Lưu bản nháp', 'Thêm dòng lô'] },
  { path: '/purchase-orders/1', user: 'admin' },
  { path: '/stock', user: 'inventory01' },
  { path: '/stock/batches/10', user: 'inventory01' },
  { path: '/inventory-checks', user: 'inventory01' },
  { path: '/inventory-checks/new', user: 'inventory01' },
  { path: '/inventory-checks/2', user: 'manager01' },
  { path: '/disposals', user: 'inventory01' },
  { path: '/disposals/new', user: 'inventory01', buttons: ['Gửi duyệt'] },
  { path: '/disposals/2', user: 'manager01' },
  { path: '/orders', user: 'cashier01' },
  { path: '/orders/8', user: 'cashier01' },
  { path: '/returns', user: 'cashier01' },
  { path: '/returns/1', user: 'cashier01' },
  { path: '/returns/new', user: 'cashier01' },
  { path: '/shifts', user: 'cashier01' },
  { path: '/shifts/1', user: 'manager01' },
  { path: '/settings', user: 'manager01' },
  { path: '/promotions', user: 'manager01', buttons: ['Tạo khuyến mãi'] },
  { path: '/loyalty', user: 'manager01' },
]

for (const s of SCREENS) {
  test(`màn ${s.path} mở được với ${s.user}, không lỗi console`, async ({ page }) => {
    await resetApp(page)
    const errors = trackErrors(page)
    await login(page, s.user)
    await page.goto(s.path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByText('Đang tải màn hình...')).toHaveCount(0)
    await expect(page.getByText('Bạn không có quyền truy cập chức năng này')).toHaveCount(0)
    await expect(page.getByText(/AUTH_FORBIDDEN|AUTH_UNAUTHORIZED|COMMON_INTERNAL_ERROR|COMMON_NOT_FOUND/)).toHaveCount(0)
    for (const b of s.buttons ?? []) await expect(page.getByRole('button', { name: b }).first()).toBeVisible()
    expect(errors).toEqual([])
  })
}
