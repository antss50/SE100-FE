// VITE_USE_MOCK=false: chỉ gọi API thật, lỗi mạng hiện ra, không rơi về mock (D5, CLAUDE.md 5.2);
// nút chuyển nhanh vai trò và tài khoản mẫu chỉ có khi mock (CLAUDE.md 5.3).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadWithMock(flag: 'true' | 'false') {
  vi.resetModules()
  vi.stubEnv('VITE_USE_MOCK', flag)
  const api = await import('./api-client')
  const switcher = await import('../features/auth/MockRoleSwitcher')
  const login = await import('../features/auth/LoginPage')
  return { api, MockRoleSwitcher: switcher.MockRoleSwitcher, LoginPage: login.LoginPage }
}

function renderWithProviders(Component: ComponentType) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('VITE_USE_MOCK=false', () => {
  it('apiRequest gọi fetch tới /api/v1, không dùng mock', async () => {
    const { api } = await loadWithMock('false')
    expect(api.USE_MOCK).toBe(false)
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { ok: 1 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await api.apiRequest('/products')
    expect(res.data).toEqual({ ok: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/api/v1/products')
  })

  it('lỗi mạng thì báo NETWORK_ERROR, không rơi về dữ liệu mock', async () => {
    const { api } = await loadWithMock('false')
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(api.apiRequest('/auth/login', { method: 'POST', body: '{"username":"admin","password":"Password@123"}' }))
      .rejects.toMatchObject({ errorCode: 'NETWORK_ERROR' })
  })

  it('không hiện nút chuyển nhanh vai trò và tài khoản mẫu', async () => {
    const { MockRoleSwitcher, LoginPage } = await loadWithMock('false')
    renderWithProviders(MockRoleSwitcher)
    expect(screen.queryByRole('combobox', { name: /Chuyển nhanh vai trò/ })).toBeNull()
    renderWithProviders(LoginPage)
    expect(screen.queryByText(/Tài khoản thử nghiệm nhanh/)).toBeNull()
  })
})

describe('VITE_USE_MOCK=true', () => {
  it('hiện nút chuyển nhanh vai trò và tài khoản mẫu', async () => {
    const { MockRoleSwitcher, LoginPage } = await loadWithMock('true')
    renderWithProviders(MockRoleSwitcher)
    expect(screen.getByRole('combobox', { name: /Chuyển nhanh vai trò/ })).toBeInTheDocument()
    renderWithProviders(LoginPage)
    expect(screen.getByText(/Tài khoản thử nghiệm nhanh/)).toBeInTheDocument()
  })
})
