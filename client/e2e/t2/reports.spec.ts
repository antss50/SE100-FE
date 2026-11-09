// Đợt test 2 (GĐ3): báo cáo REP-01..06, nhật ký AUTH-06, hiệu quả khuyến mãi PROM-04 + luồng xuyên suốt.
// Mỗi test reset mock trước; tài khoản seed mật khẩu Password@123.
import { expect, test, type Page } from '@playwright/test'
import { login, resetApp } from '../helpers'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

const logout = async (page: Page) => {
  await page.evaluate(() => localStorage.removeItem('se100_auth_session_v1'))
  await page.goto('/login')
}

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Điều hướng chính' })

test('(a) mỗi vai trò thấy đúng mục báo cáo, dashboard, nhật ký trên menu; vào URL trực tiếp bị chặn', async ({ page }) => {
  const matrix: { user: string; dashboard: boolean; reports: boolean; audit: boolean }[] = [
    { user: 'admin', dashboard: true, reports: true, audit: true },
    { user: 'manager01', dashboard: true, reports: true, audit: false },
    { user: 'inventory01', dashboard: true, reports: true, audit: false },
    { user: 'cashier01', dashboard: false, reports: true, audit: false },
  ]
  for (const row of matrix) {
    await login(page, row.user)
    const n = nav(page)
    await expect(n.getByRole('link', { name: 'Dashboard & Cảnh báo' })).toHaveCount(row.dashboard ? 1 : 0)
    await expect(n.getByRole('link', { name: /Báo cáo tài chính/ })).toHaveCount(row.reports ? 1 : 0)
    await expect(n.getByRole('link', { name: 'Nhật ký hệ thống' })).toHaveCount(row.audit ? 1 : 0)
    if (!row.audit) {
      await page.goto('/audit-logs')
      await expect(page.getByRole('heading', { level: 1, name: 'Nhật ký hệ thống' })).toHaveCount(0)
    }
    await logout(page)
  }
  // báo cáo hiển thị đúng tab theo quyền
  await login(page, 'cashier01')
  await page.goto('/reports')
  const tabs = page.getByRole('tablist', { name: 'Loại báo cáo' }).getByRole('tab')
  await expect(tabs).toHaveCount(1)
  await expect(tabs.first()).toHaveText('Bán hàng')
  await logout(page)
  await login(page, 'inventory01')
  await page.goto('/reports')
  await expect(page.getByRole('tablist', { name: 'Loại báo cáo' }).getByRole('tab')).toHaveText(['Tồn kho & hạn dùng'])
})

test('(b) admin mở từng trang báo cáo, nhật ký, hiệu quả KM không lỗi console; đổi bộ lọc ngày được', async ({ page }) => {
  const errors = trackErrors(page)
  await login(page, 'admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard tổng quan' })).toBeVisible()
  await expect(page.getByText('Doanh thu thuần 7 ngày gần nhất')).toBeVisible()

  await page.goto('/reports')
  const tablist = page.getByRole('tablist', { name: 'Loại báo cáo' })
  for (const name of ['Doanh thu & lợi nhuận', 'Bán hàng', 'Tồn kho & hạn dùng', 'Nhập hàng', 'Khách hàng']) {
    await tablist.getByRole('tab', { name }).click()
    await expect(page.getByRole('tabpanel', { name })).toBeVisible()
    await expect(page.getByRole('tabpanel', { name }).getByText(/Không tải được|Đã có lỗi/)).toHaveCount(0)
  }
  await tablist.getByRole('tab', { name: 'Doanh thu & lợi nhuận' }).click()
  await page.getByRole('button', { name: '7 ngày qua' }).click()
  await expect(page.getByRole('button', { name: '7 ngày qua' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Từ ngày').fill('2026-10-01')
  await expect(page.getByRole('button', { name: '7 ngày qua' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Doanh thu thuần').first()).toBeVisible()
  // kỳ sai: từ ngày > đến ngày báo lỗi
  await page.getByLabel('Đến ngày').fill('2026-09-01')
  await expect(page.getByRole('alert').filter({ hasText: /ngày/ }).first()).toBeVisible()

  await page.goto('/audit-logs')
  await expect(page.getByRole('heading', { level: 1, name: 'Nhật ký hệ thống' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Nhật ký hệ thống' })).toBeVisible()

  await page.goto('/promotions/1/report')
  await expect(page.getByRole('heading', { level: 1, name: /^Hiệu quả: / })).toBeVisible()
  await expect(page.getByText('Lượt dùng', { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('(c) Manager xem doanh thu nhưng không thấy lợi nhuận, giá vốn (REP-02)', async ({ page }) => {
  await login(page, 'manager01')
  await page.goto('/reports')
  await expect(page.getByText('Doanh thu thuần').first()).toBeVisible()
  await expect(page.getByText('Hàng bán bị trả').first()).toBeVisible()
  await expect(page.getByText('Lợi nhuận gộp', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Giá vốn (COGS)', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: /Lợi nhuận gộp|Giá vốn/ })).toHaveCount(0)
  // Manager xem được hiệu quả khuyến mãi
  await page.goto('/promotions/1/report')
  await expect(page.getByRole('heading', { level: 1, name: /^Hiệu quả: / })).toBeVisible()
  // Admin thì có
  await logout(page)
  await login(page, 'admin')
  await page.goto('/reports')
  await expect(page.getByText('Lợi nhuận gộp', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Giá vốn (COGS)', { exact: true })).toBeVisible()
})

test('(d) nhật ký lọc theo hành động chỉ còn đúng hành động đó (AUTH-06)', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/audit-logs')
  const table = page.getByRole('table', { name: 'Nhật ký hệ thống' })
  await expect(table.getByRole('row').nth(1)).toBeVisible()
  await page.getByLabel('Hành động').selectOption('LOGIN')
  await expect(table.getByText('LOGIN').first()).toBeVisible()
  await expect(table.getByText('CREATE_SUPPLIER')).toHaveCount(0)
  // tạo NCC rồi lọc theo CREATE_SUPPLIER
  await page.goto('/suppliers')
  await page.getByRole('button', { name: 'Thêm nhà cung cấp' }).click()
  const dlg = page.getByRole('dialog', { name: 'Thêm nhà cung cấp' })
  await dlg.getByLabel(/Tên công ty/).fill('Công ty Nhật Ký Test')
  await dlg.getByLabel(/Số điện thoại/).fill('0901234555')
  await dlg.getByLabel(/Địa chỉ/).fill('2 Lê Lợi, Quận 1')
  await dlg.getByRole('button', { name: 'Thêm nhà cung cấp' }).click()
  await expect(page.getByText('Công ty Nhật Ký Test').first()).toBeVisible()
  await page.goto('/audit-logs')
  await page.getByLabel('Hành động').selectOption('CREATE_SUPPLIER')
  await expect(table.getByText('CREATE_SUPPLIER').first()).toBeVisible()
  await expect(table.getByText('LOGIN')).toHaveCount(0)
})

test('(e) luồng xuyên suốt: NCC, nhập kho, mở ca, bán, trả hàng lỗi, chốt ca, báo cáo và nhật ký', async ({ page }) => {
  const errors = trackErrors(page)
  // số liệu hôm nay trước khi có giao dịch
  await login(page, 'admin')
  await page.goto('/reports')
  await page.getByRole('button', { name: 'Hôm nay' }).click()
  const orderHint = page.getByText(/đơn hoàn tất/).first()
  const returnHint = page.getByText(/phiếu trả trong kỳ/).first()
  await expect(orderHint).toBeVisible()
  const num = async (loc: ReturnType<Page['getByText']>) => Number(((await loc.innerText()).match(/(\d+)/) ?? [])[1])
  const orders0 = await num(orderHint)
  const returns0 = await num(returnHint)

  // 1. admin tạo NCC, nhập kho xác nhận
  await page.goto('/suppliers')
  await page.getByRole('button', { name: 'Thêm nhà cung cấp' }).click()
  const dlg = page.getByRole('dialog', { name: 'Thêm nhà cung cấp' })
  await dlg.getByLabel(/Tên công ty/).fill('Công ty Xuyên Suốt')
  await dlg.getByLabel(/Số điện thoại/).fill('0901234777')
  await dlg.getByLabel(/Địa chỉ/).fill('3 Lê Lợi, Quận 1')
  await dlg.getByRole('button', { name: 'Thêm nhà cung cấp' }).click()
  await expect(page.getByText('Công ty Xuyên Suốt').first()).toBeVisible()
  await page.goto('/purchase-orders/new')
  const optionText = (await page.locator('option', { hasText: 'Công ty Xuyên Suốt' }).first().textContent()) ?? ''
  await page.getByLabel(/Nhà cung cấp/).selectOption({ label: optionText })
  await page.getByLabel('Sản phẩm dòng 1').selectOption('5')
  await page.getByLabel('Mã lô dòng 1').fill('LOT-XS-001')
  await page.getByLabel('Hạn dùng dòng 1').fill('2029-06-30')
  await page.getByLabel('Số lượng dòng 1').fill('25')
  await page.getByLabel('Giá nhập dòng 1').fill('90000')
  await page.getByRole('button', { name: 'Xác nhận nhập kho' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận nhập kho' }).click()
  await expect(page).toHaveURL(/\/purchase-orders\/\d+$/)

  // 2. thu ngân mở ca, bán, trả hàng lỗi, chốt ca
  await logout(page)
  await login(page, 'cashier01')
  await page.goto('/pos')
  await page.getByRole('button', { name: 'Mở ca', exact: true }).click()
  const shiftDlg = page.getByRole('dialog', { name: 'Mở ca làm việc' })
  await shiftDlg.getByLabel('Tiền mặt đầu ca (đ)').fill('1000000')
  await shiftDlg.getByRole('button', { name: 'Mở ca', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mở ca', exact: true })).toHaveCount(0)
  const product = 'Son Tint Bóng Rom&nd Juicy #06 Figfig'
  await page.getByPlaceholder(/Tìm theo tên, SKU, barcode/).fill(product)
  await page.getByRole('region', { name: 'Chọn sản phẩm' }).getByRole('button', { name: product }).first().click()
  await expect(page.getByRole('region', { name: 'Giỏ hàng' }).getByText(product).first()).toBeVisible()
  await page.getByRole('radio', { name: 'Tiền mặt' }).click()
  await page.getByLabel('Tiền khách đưa (đ)').fill('10000000')
  await page.getByRole('button', { name: /In hóa đơn và hoàn tất/ }).click()
  const ok = page.getByRole('dialog', { name: 'Thanh toán thành công' })
  await expect(ok).toBeVisible()
  const code = await ok.locator('span.font-mono').first().innerText()
  await page.getByRole('button', { name: 'Đơn mới' }).click()
  await page.goto('/returns/new')
  await page.getByPlaceholder(/Nhập mã hóa đơn/).fill(code)
  await page.getByRole('button', { name: new RegExp(code) }).first().click()
  await page.getByLabel(`Chọn ${product}`).check()
  await page.getByLabel('Lý do trả hàng').selectOption('DEFECTIVE')
  await page.getByLabel(`Tình trạng ${product}`).selectOption('DAMAGED_OR_OPENED')
  await page.getByRole('button', { name: 'Xác nhận trả hàng' }).click()
  await expect(page).toHaveURL(/\/returns\/\d+$/)
  await page.goto('/shifts')
  await page.getByRole('button', { name: /Chốt ca và kiểm đếm/ }).first().click()
  const closeDlg = page.getByRole('dialog')
  await closeDlg.getByLabel('Tiền mặt thực đếm (đ)').fill('1000000')
  await closeDlg.getByRole('button', { name: 'Xác nhận chốt ca' }).click()
  await expect(page.getByText('Đã chốt', { exact: false }).first()).toBeVisible()

  // 3. admin: báo cáo hôm nay tăng 1 đơn, 1 phiếu trả; nhật ký có các hành động
  await logout(page)
  await login(page, 'admin')
  await page.goto('/reports')
  await page.getByRole('button', { name: 'Hôm nay' }).click()
  await expect(page.getByText(new RegExp(`^${orders0 + 1} đơn hoàn tất`)).first()).toBeVisible()
  await expect(page.getByText(new RegExp(`^${returns0 + 1} phiếu trả trong kỳ`)).first()).toBeVisible()
  await page.goto('/audit-logs')
  const table = page.getByRole('table', { name: 'Nhật ký hệ thống' })
  for (const action of ['CREATE_SUPPLIER', 'CONFIRM_PURCHASE_ORDER', 'OPEN_SHIFT', 'CREATE_ORDER', 'CREATE_RETURN', 'CLOSE_SHIFT']) {
    await page.getByLabel('Hành động').selectOption(action)
    await expect(table.getByText(action).first(), action).toBeVisible()
  }
  expect(errors).toEqual([])
})
