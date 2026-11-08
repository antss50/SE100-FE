// GĐ0 — layout theo `UI/Kiểm kê kho/Kiểm kê kho · Danh sách phiếu.pdf` (bản LUMINA POS, D9)
// và các màn cũ mở được không lỗi console với vai trò phù hợp.
import { expect, test, type Page } from '@playwright/test'
import { login, resetApp } from '../helpers'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Điều hướng chính' })

/** Ghi lại lỗi console và lỗi JS chưa bắt trong lúc test. */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  return errors
}

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('sidebar: logo LUMINA POS, 5 nhóm theo thiết kế, khối FEFO Active Guard; bỏ dòng chi nhánh (D9)', async ({ page }) => {
  await login(page, 'admin')
  const aside = page.locator('aside')
  await expect(aside.getByText('LUMINA POS', { exact: true })).toBeVisible()
  for (const section of ['1. TỔNG QUAN', '2. KHO & HÀNG HÓA', '3. BÁN HÀNG & POS', '4. CHĂM SÓC & CS BÁN HÀNG', '5. HỆ THỐNG']) {
    await expect(nav(page).getByText(section, { exact: true })).toBeVisible()
  }
  await expect(aside.getByText('FEFO Active Guard')).toBeVisible()
  await expect(aside.getByText(/Chi nhánh/)).toHaveCount(0)
})

test('sidebar: mục đang mở được đánh dấu', async ({ page }) => {
  await login(page, 'admin')
  await nav(page).getByRole('link', { name: 'Khách hàng & Hạng thẻ' }).click()
  await expect(nav(page).getByRole('link', { name: 'Khách hàng & Hạng thẻ' })).toHaveAttribute('aria-current', 'page')
})

test('header thu ngân: Role, trạng thái ca, Quét FEFO, Mở / Chốt ca, tên + chức danh', async ({ page }) => {
  await login(page, 'cashier01')
  const header = page.locator('header')
  await expect(header.getByText('Role:')).toBeVisible()
  await expect(header.getByText('CASHIER', { exact: true })).toBeVisible()
  await expect(header.getByText('Chưa mở ca')).toBeVisible()
  await expect(header.getByRole('button', { name: 'Quét FEFO' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Mở / Chốt ca' })).toBeVisible()
  await expect(header.getByRole('button', { name: /Nguyễn Thu Hà/ })).toBeVisible()
})

test('header Manager: không có nút Mở / Chốt ca (POS chỉ xem theo ma trận, khác thiết kế có lý do)', async ({ page }) => {
  await login(page, 'manager01')
  const header = page.locator('header')
  await expect(header.getByText('STORE_MANAGER', { exact: true })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Quét FEFO' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Mở / Chốt ca' })).toHaveCount(0)
  await expect(header.getByRole('button', { name: /Trần Lê Ngọc Mai/ })).toBeVisible()
})

test('header NV kho: không có trạng thái ca, không có Mở / Chốt ca', async ({ page }) => {
  await login(page, 'inventory01')
  const header = page.locator('header')
  await expect(header.getByText('INVENTORY_STAFF', { exact: true })).toBeVisible()
  await expect(header.getByText('Chưa mở ca')).toHaveCount(0)
  await expect(header.getByRole('button', { name: 'Mở / Chốt ca' })).toHaveCount(0)
})

const OLD_PAGES: { path: string; user: string }[] = [
  { path: '/', user: 'admin' },
  { path: '/', user: 'manager01' },
  { path: '/', user: 'inventory01' },
  { path: '/products', user: 'admin' },
  { path: '/products', user: 'inventory01' },
  { path: '/products', user: 'cashier01' },
  { path: '/pos', user: 'cashier01' },
  { path: '/pos', user: 'admin' },
  { path: '/promotions', user: 'manager01' },
  { path: '/promotions', user: 'cashier01' },
  { path: '/customers', user: 'manager01' },
  { path: '/customers', user: 'cashier01' },
  { path: '/customers/new', user: 'cashier01' },
  { path: '/customers/KH-2024-001', user: 'cashier01' },
  { path: '/loyalty', user: 'manager01' },
  { path: '/users', user: 'admin' },
  { path: '/users/2', user: 'admin' },
  { path: '/rbac', user: 'admin' },
]

for (const { path, user } of OLD_PAGES) {
  test(`màn cũ ${path} mở được với ${user}, không lỗi console`, async ({ page }) => {
    const errors = trackErrors(page)
    await login(page, user)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByText('Đang tải màn hình...')).toHaveCount(0)
    await expect(page.getByText('Bạn không có quyền truy cập chức năng này')).toHaveCount(0)
    await expect(page.getByText(/AUTH_FORBIDDEN|AUTH_UNAUTHORIZED|COMMON_INTERNAL_ERROR/)).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
