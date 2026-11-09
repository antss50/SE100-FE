// GĐ0 — phần nền của AUTH-01..03: đăng nhập seed, khóa tạm (luật 46), LOCKED, đăng xuất, URL bảo vệ.
import { expect, test } from '@playwright/test'
import { SEED_PASSWORD, login, resetApp } from '../helpers'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

async function submitLogin(page: import('@playwright/test').Page, username: string, password: string) {
  await page.getByLabel('USERNAME').fill(username)
  await page.getByLabel('PASSWORD').fill(password)
  await page.getByRole('button', { name: /Xác Thực/ }).click()
}

test('không tự đăng nhập: mở app chưa có phiên thì về /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Đăng Nhập POS' })).toBeVisible()
})

for (const [username, fullName] of [
  ['admin', 'Đặng Quốc Khang'],
  ['manager01', 'Trần Lê Ngọc Mai'],
  ['cashier01', 'Nguyễn Thu Hà'],
  ['inventory01', 'Lê Vũ Hoàng An'],
  ['newstaff', 'Phạm Bảo Ngọc'],
] as const) {
  test(`tài khoản seed ${username} đăng nhập được với ${SEED_PASSWORD}`, async ({ page }) => {
    await login(page, username)
    await expect(page.getByRole('button', { name: new RegExp(fullName) })).toBeVisible()
  })
}

test('newstaff (mustChangePassword): ghi nhận hiện trạng — hộp đổi mật khẩu mở sau đăng nhập', async ({ page }) => {
  // Phần chặn dùng app trước khi đổi mật khẩu (luật 47) thuộc GĐ3; ở đây chỉ ghi nhận.
  await login(page, 'newstaff')
  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu bảo mật' })).toBeVisible()
  await expect(page.getByText(/yêu cầu đổi mật khẩu lần đầu/)).toBeVisible()
})

test('sai mật khẩu báo lỗi, ở lại /login', async ({ page }) => {
  await submitLogin(page, 'admin', 'SaiMatKhau1')
  await expect(page.getByRole('alert')).toContainText('AUTH_INVALID_CREDENTIALS')
  await expect(page).toHaveURL(/\/login$/)
})

test('luật 46: sai 5 lần thì khóa tạm, nhập đúng cũng không vào được', async ({ page }) => {
  for (let i = 1; i <= 4; i++) {
    await submitLogin(page, 'manager01', `Sai${i}`)
    await expect(page.getByRole('alert')).toContainText(`sai ${i}/5`)
  }
  await submitLogin(page, 'manager01', 'Sai5')
  await expect(page.getByRole('alert')).toContainText('AUTH_ACCOUNT_TEMP_LOCKED')
  await expect(page.getByRole('alert')).toContainText('15 phút')

  await submitLogin(page, 'manager01', SEED_PASSWORD)
  await expect(page.getByRole('alert')).toContainText('AUTH_ACCOUNT_TEMP_LOCKED')
  await expect(page).toHaveURL(/\/login$/)
})

test('tài khoản LOCKED (trang.bui) không đăng nhập được', async ({ page }) => {
  await submitLogin(page, 'trang.bui', SEED_PASSWORD)
  await expect(page.getByRole('alert')).toContainText('AUTH_ACCOUNT_LOCKED')
  await expect(page).toHaveURL(/\/login$/)
})

test('đăng xuất về /login; vào URL bảo vệ thì về /login; Back không vào lại được', async ({ page }) => {
  await login(page, 'cashier01')
  await page.goto('/customers')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.getByRole('button', { name: /Nguyễn Thu Hà/ }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/login$/)

  for (const path of ['/pos', '/customers', '/products', '/users', '/stock']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
  }
  await page.goBack()
  await expect(page).toHaveURL(/\/login$/)
})

test('phiên giữ khi tải lại trang', async ({ page }) => {
  await login(page, 'manager01')
  await page.goto('/customers')
  await page.reload()
  await expect(page).toHaveURL(/\/customers$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

// B1 (đã sửa): LoginPage dùng chung `from` cho cả nhánh đã đăng nhập.
test('B1: vào URL bảo vệ khi chưa đăng nhập, đăng nhập xong quay lại đúng trang', async ({ page }) => {
  await page.goto('/customers')
  await expect(page).toHaveURL(/\/login$/)
  await login(page, 'manager01')
  await expect(page).toHaveURL(/\/customers$/)
})
