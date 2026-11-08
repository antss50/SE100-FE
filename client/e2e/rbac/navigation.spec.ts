// GĐ0 — phân quyền giao diện theo DANH_GIA_USECASE.md mục 4: sidebar, chặn URL, trang chủ, nút đổi vai trò mock.
import { expect, test, type Page } from '@playwright/test'
import { login, resetApp } from '../helpers'

const ALL_ITEMS = [
  'Dashboard & Cảnh báo',
  'Sản phẩm & Danh mục',
  'Nhập hàng theo lô FEFO',
  'Tồn kho & Cận hạn',
  'Kiểm kê kho',
  'Xuất hủy & Xuất đặc biệt',
  'Nhà cung cấp',
  'Màn hình Thu ngân POS',
  'Lịch sử đơn hàng',
  'Đổi trả hàng',
  'Quản lý ca',
  'Khuyến mãi 4 tầng',
  'Khách hàng & Hạng thẻ',
  'Cấu hình điểm & hạng',
  'Báo cáo tài chính & Excel',
  'Tài khoản nhân viên',
  'Phân quyền vai trò',
  'Nhật ký hệ thống',
  'Cấu hình hệ thống',
]

/** Mục menu mỗi vai trò được thấy, suy ra từ ma trận mục 4. */
const EXPECTED: Record<string, { name: string; items: string[]; blocked: string[]; home: RegExp }> = {
  admin: { name: 'Đặng Quốc Khang', items: ALL_ITEMS, blocked: [], home: /\/$/ },
  manager01: {
    name: 'Trần Lê Ngọc Mai',
    // POS 👁 + bàn giao: không có màn bán hàng; AUTH-04..06 không có.
    items: ALL_ITEMS.filter(
      (i) => !['Màn hình Thu ngân POS', 'Tài khoản nhân viên', 'Phân quyền vai trò', 'Nhật ký hệ thống'].includes(i)
    ),
    blocked: ['/pos', '/users', '/users/1', '/rbac', '/audit-logs'],
    home: /\/$/,
  },
  inventory01: {
    name: 'Lê Vũ Hoàng An',
    // REP-01 widget kho, PROD, STK-01..07 (xem/lập), SUPP 👁, REP-04.
    items: [
      'Dashboard & Cảnh báo',
      'Sản phẩm & Danh mục',
      'Nhập hàng theo lô FEFO',
      'Tồn kho & Cận hạn',
      'Kiểm kê kho',
      'Xuất hủy & Xuất đặc biệt',
      'Nhà cung cấp',
      'Báo cáo tài chính & Excel',
    ],
    blocked: ['/pos', '/orders', '/returns', '/shifts', '/promotions', '/customers', '/customers/new', '/loyalty', '/users', '/rbac', '/audit-logs', '/settings'],
    home: /\/$/,
  },
  cashier01: {
    name: 'Nguyễn Thu Hà',
    // PROD 👁, STK-02 tồn khả dụng, POS, PROM-01 👁, CUS-01/02, REP-03 ca của mình.
    items: [
      'Sản phẩm & Danh mục',
      'Tồn kho & Cận hạn',
      'Màn hình Thu ngân POS',
      'Lịch sử đơn hàng',
      'Đổi trả hàng',
      'Quản lý ca',
      'Khuyến mãi 4 tầng',
      'Khách hàng & Hạng thẻ',
      'Báo cáo tài chính & Excel',
    ],
    blocked: ['/purchase-orders', '/inventory-checks', '/disposals', '/suppliers', '/loyalty', '/users', '/rbac', '/audit-logs', '/settings'],
    home: /\/pos$/,
  },
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Điều hướng chính' })
const FORBIDDEN = 'Bạn không có quyền truy cập chức năng này'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

for (const [username, exp] of Object.entries(EXPECTED)) {
  test(`${username}: sidebar chỉ hiện đúng mục có quyền`, async ({ page }) => {
    await login(page, username)
    await expect(nav(page).getByRole('link')).toHaveText(exp.items)
  })

  test(`${username}: trang chủ sau đăng nhập`, async ({ page }) => {
    await login(page, username)
    await expect(page).toHaveURL(exp.home)
  })

  if (exp.blocked.length > 0) {
    test(`${username}: vào URL không có quyền bị chặn`, async ({ page }) => {
      await login(page, username)
      for (const path of exp.blocked) {
        await page.goto(path)
        await expect(page.getByText(FORBIDDEN), path).toBeVisible()
      }
    })
  }

  test(`${username}: mọi mục trên sidebar mở được, không bị chặn`, async ({ page }) => {
    await login(page, username)
    for (const label of exp.items) {
      await nav(page).getByRole('link', { name: label }).click()
      await expect(page.getByRole('heading', { level: 1 }).first(), label).toBeVisible()
      await expect(page.getByText(FORBIDDEN), label).toHaveCount(0)
    }
  })
}

test('thu ngân mở / thì vào POS, không thấy dashboard', async ({ page }) => {
  await login(page, 'cashier01')
  await page.goto('/')
  await expect(page).toHaveURL(/\/pos$/)
  await expect(page.getByRole('heading', { name: 'Dashboard tổng quan' })).toHaveCount(0)
})

test('nút chuyển vai trò (mock) đổi phiên sang tài khoản seed khác và cập nhật menu', async ({ page }) => {
  await login(page, 'admin')
  const switcher = page.getByRole('combobox', { name: /Chuyển nhanh vai trò/ })
  await expect(switcher).toBeVisible()
  await switcher.selectOption('cashier01')
  await expect(page).toHaveURL(/\/pos$/)
  await expect(page.getByRole('button', { name: /Nguyễn Thu Hà/ })).toBeVisible()
  await expect(nav(page).getByRole('link')).toHaveText(EXPECTED.cashier01.items)
  // Đổi vai trò = đăng nhập lại thật (D18): API phía mock cũng theo quyền mới.
  await page.goto('/users')
  await expect(page.getByText(FORBIDDEN)).toBeVisible()
})
