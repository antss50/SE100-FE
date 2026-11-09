// Đợt test 1: luồng chính E2E cho kho, bán hàng, khuyến mãi, buộc đổi mật khẩu (luật 47).
// Mỗi test reset mock trước; tài khoản seed mật khẩu Password@123.
import { expect, test, type Page } from '@playwright/test'
import { login, resetApp } from '../helpers'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

/** Xóa phiên đăng nhập (giữ dữ liệu mock) rồi tải lại trang đăng nhập. */
const logout = async (page: Page) => {
  await page.evaluate(() => localStorage.removeItem('se100_auth_session_v1'))
  await page.goto('/login')
}

/** Thu ngân mở ca ở màn POS. */
async function openShiftOnPos(page: Page, openingCash: string) {
  await page.goto('/pos')
  await page.getByRole('button', { name: 'Mở ca', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Mở ca làm việc' })
  await dialog.getByLabel('Tiền mặt đầu ca (đ)').fill(openingCash)
  await dialog.getByRole('button', { name: 'Mở ca', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mở ca', exact: true })).toHaveCount(0)
}

/** Chọn sản phẩm theo tên trong bảng chọn sản phẩm của POS, bỏ vào giỏ. */
async function addToCart(page: Page, productName: string) {
  await page.getByPlaceholder(/Tìm theo tên, SKU, barcode/).fill(productName)
  await page.getByRole('region', { name: 'Chọn sản phẩm' }).getByRole('button', { name: productName }).first().click()
  await expect(page.getByRole('region', { name: 'Giỏ hàng' }).getByText(productName).first()).toBeVisible()
}

async function payCash(page: Page) {
  await page.getByRole('radio', { name: 'Tiền mặt' }).click()
  await page.getByLabel('Tiền khách đưa (đ)').fill('10000000')
  await page.getByRole('button', { name: /In hóa đơn và hoàn tất/ }).click()
  await expect(page.getByRole('dialog', { name: 'Thanh toán thành công' })).toBeVisible()
}

test('(a) admin tạo NCC, lập phiếu nhập, xác nhận, lô xuất hiện ở tồn kho (STK-01, SUPP-01)', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/suppliers')
  await page.getByRole('button', { name: 'Thêm nhà cung cấp' }).click()
  const dlg = page.getByRole('dialog', { name: 'Thêm nhà cung cấp' })
  await dlg.getByLabel(/Tên công ty/).fill('Công ty Test Nhập Khẩu')
  await dlg.getByLabel(/Số điện thoại/).fill('0901234999')
  await dlg.getByLabel(/Địa chỉ/).fill('1 Lê Lợi, Quận 1')
  await dlg.getByRole('button', { name: 'Thêm nhà cung cấp' }).click()
  await expect(page.getByText('Công ty Test Nhập Khẩu').first()).toBeVisible()

  await page.goto('/purchase-orders/new')
  const optionText = (await page.locator('option', { hasText: 'Công ty Test Nhập Khẩu' }).first().textContent()) ?? ''
  await page.getByLabel(/Nhà cung cấp/).selectOption({ label: optionText })
  await page.getByLabel('Sản phẩm dòng 1').selectOption('5')
  await page.getByLabel('Mã lô dòng 1').fill('LOT-E2E-001')
  await page.getByLabel('Hạn dùng dòng 1').fill('2029-06-30')
  await page.getByLabel('Số lượng dòng 1').fill('25')
  await page.getByLabel('Giá nhập dòng 1').fill('90000')
  await page.getByRole('button', { name: 'Xác nhận nhập kho' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận nhập kho' }).click()
  await expect(page).toHaveURL(/\/purchase-orders\/\d+$/)
  await expect(page.getByRole('heading', { level: 1, name: /^PN\d{8}-\d{2}$/ })).toBeVisible()
  await expect(page.getByText('LOT-E2E-001').first()).toBeVisible()

  await page.goto('/stock')
  await page.getByPlaceholder(/Tìm SKU, tên sản phẩm, mã lô/).fill('LOT-E2E-001')
  await expect(page.getByRole('cell', { name: /LOT-E2E-001/ }).first()).toBeVisible()
})

test('(b) kho lập phiếu xuất khác, Manager duyệt (STK-06, STK-07)', async ({ page }) => {
  await login(page, 'inventory01')
  await page.goto('/disposals/new')
  await page.getByLabel('Mã lý do').selectOption({ index: 1 })
  await page.getByLabel(/Diễn giải lý do/).fill('Hàng hỏng bao bì khi kiểm')
  await page.getByPlaceholder(/Tìm mã lô, SKU/).fill('LOT-EL-2408')
  await page.getByLabel('Chọn lô LOT-EL-2408').check()
  await page.getByLabel('Số lượng xuất lô LOT-EL-2408').fill('2')
  await page.getByRole('button', { name: 'Gửi duyệt', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi duyệt' }).click()
  await expect(page).toHaveURL(/\/disposals\/\d+$/)
  await expect(page.getByText('Chờ duyệt').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Duyệt phiếu' })).toHaveCount(0) // kho không duyệt được
  const url = page.url()

  await logout(page)
  await login(page, 'manager01')
  await page.goto(url.replace(/^https?:\/\/[^/]+/, ''))
  await page.getByRole('button', { name: 'Duyệt phiếu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Duyệt phiếu' }).click()
  await expect(page.getByText('Đã duyệt').first()).toBeVisible()
})

test('(c)(d)(e) thu ngân mở ca, bán tiền mặt, trả hàng lỗi, chốt ca (POS-01..05)', async ({ page }) => {
  await login(page, 'cashier01')
  await openShiftOnPos(page, '1000000')

  await addToCart(page, 'Son Tint Bóng Rom&nd Juicy #06 Figfig')
  await payCash(page)
  const code = await page.getByRole('dialog', { name: 'Thanh toán thành công' }).locator('span.font-mono').first().innerText()
  await page.getByRole('button', { name: 'Đơn mới' }).click()

  // đơn có trong lịch sử
  await page.goto('/orders')
  await expect(page.getByText(code).first()).toBeVisible()

  // trả hàng lỗi
  await page.goto('/returns/new')
  await page.getByPlaceholder(/Nhập mã hóa đơn/).fill(code)
  await page.getByRole('button', { name: new RegExp(code) }).first().click()
  await page.getByLabel('Chọn Son Tint Bóng Rom&nd Juicy #06 Figfig').check()
  await page.getByLabel('Lý do trả hàng').selectOption('DEFECTIVE')
  await page.getByLabel('Tình trạng Son Tint Bóng Rom&nd Juicy #06 Figfig').selectOption('DAMAGED_OR_OPENED')
  await page.getByRole('button', { name: 'Xác nhận trả hàng' }).click()
  await expect(page).toHaveURL(/\/returns\/\d+$/)
  await expect(page.getByText(/RET\d{8}-\d{4}/).first()).toBeVisible()

  // chốt ca: bán 195.000*(1-khuyến mãi) rồi hoàn lại hết bằng tiền mặt, két về đúng đầu ca
  await page.goto('/shifts')
  await page.getByRole('button', { name: /Chốt ca và kiểm đếm/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tiền mặt thực đếm (đ)').fill('1000000')
  await dialog.getByRole('button', { name: 'Xác nhận chốt ca' }).click()
  await expect(page.getByText('Đã chốt', { exact: false }).first()).toBeVisible()
})

test('(f) newstaff bị buộc đổi mật khẩu, không đóng được hộp (AUTH-03, luật 47)', async ({ page }) => {
  await page.getByLabel('USERNAME').fill('newstaff')
  await page.getByLabel('PASSWORD').fill('Password@123')
  await page.getByRole('button', { name: /Xác Thực/ }).click()
  // B3 (Low): hộp này chưa có role="dialog" nên dùng text thay vì getByRole('dialog')
  await expect(page.getByText('Đổi mật khẩu bảo mật')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đóng' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByText('Đổi mật khẩu bảo mật')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0)
})

test('(h) Manager tạo voucher, thu ngân áp ở POS (PROM-02, PROM-03)', async ({ page }) => {
  await login(page, 'manager01')
  await page.goto('/promotions')
  await page.getByRole('button', { name: 'Tạo khuyến mãi' }).click()
  const dlg = page.getByRole('dialog', { name: 'Tạo chương trình khuyến mãi' })
  await dlg.getByLabel(/Tên chương trình/).fill('Voucher E2E 1 triệu')
  await dlg.getByLabel('Loại khuyến mãi').selectOption('VOUCHER')
  await dlg.getByLabel(/Mã voucher/).fill('E2E100')
  await dlg.getByLabel('Kiểu giảm').selectOption('FIXED_AMOUNT')
  await dlg.getByLabel('Mức giảm').fill('1000000')
  await dlg.getByLabel(/Bắt đầu/).fill('2026-01-01T00:00')
  await dlg.getByLabel(/Kết thúc/).fill('2030-12-31T23:59')
  await dlg.getByRole('button', { name: 'Tạo và kích hoạt' }).click()
  await expect(page.getByText('E2E100').first()).toBeVisible()

  await logout(page)
  await login(page, 'cashier01')
  await openShiftOnPos(page, '500000')
  await addToCart(page, 'Serum Phục Hồi Ban Đêm ANR 50ml')
  const pay = page.getByRole('region', { name: 'Thanh toán' })
  const totalBefore = await pay.locator('p[aria-live="polite"]').first().innerText()
  await pay.getByPlaceholder('Mã voucher').fill('E2E100')
  await pay.getByRole('button', { name: 'Áp mã' }).click()
  await expect(pay.locator('p[aria-live="polite"]').first()).not.toHaveText(totalBefore)
})
