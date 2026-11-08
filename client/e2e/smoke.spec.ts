import { expect, test } from '@playwright/test'
import { login, resetApp } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('chưa đăng nhập thì vào trang nào cũng về /login', async ({ page }) => {
  await page.goto('/products')
  await expect(page).toHaveURL(/\/login$/)
})

test('đăng nhập admin thấy dashboard, đăng xuất về /login', async ({ page }) => {
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard tổng quan' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toContainText('Phân quyền vai trò')

  await page.getByRole('button', { name: /Đặng Quốc Khang/ }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})
