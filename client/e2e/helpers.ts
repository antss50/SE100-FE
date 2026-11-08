import { expect, type Page } from '@playwright/test'

export const SEED_PASSWORD = 'Password@123'

/** Xóa dữ liệu mock và phiên đăng nhập, mở lại trang đăng nhập. */
export async function resetApp(page: Page): Promise<void> {
  await page.goto('/login')
  await page.waitForFunction(() => Boolean(window.__SE100_MOCK__))
  await page.evaluate(() => {
    localStorage.clear()
    window.__SE100_MOCK__?.reset()
  })
  await page.goto('/login')
}

export async function login(page: Page, username: string, password = SEED_PASSWORD): Promise<void> {
  await page.getByLabel('USERNAME').fill(username)
  await page.getByLabel('PASSWORD').fill(password)
  await page.getByRole('button', { name: /Xác Thực/ }).click()
  await expect(page).not.toHaveURL(/\/login/)
}
