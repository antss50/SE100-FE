import { resetMockDb } from './db'
import { authRoutes } from './handlers/auth'
import { customerRoutes } from './handlers/customers'
import { catalogRoutes } from './handlers/products'
import { promotionRoutes } from './handlers/promotions'
import { rbacRoutes } from './handlers/rbac'
import { shiftRoutes } from './handlers/shifts'
import { userRoutes } from './handlers/users'
import type { HttpMethod } from './http'
import { dispatch, type MockRoute } from './router'

export { resetMockDb }

export const mockRoutes: MockRoute[] = [
  ...authRoutes,
  ...userRoutes,
  ...rbacRoutes,
  ...customerRoutes,
  ...catalogRoutes,
  ...promotionRoutes,
  ...shiftRoutes,
]

/**
 * Độ trễ giả lập mạng. `VITE_MOCK_DELAY_MS=0` tắt hẳn (dùng cho test);
 * bỏ trống thì ngẫu nhiên 150–300 ms (CLAUDE.md mục 5.2).
 */
let delayOverride: number | null = null

function currentDelay(): number {
  if (delayOverride !== null) return delayOverride
  const env = import.meta.env.VITE_MOCK_DELAY_MS
  if (env !== undefined && env !== '') return Math.max(0, Number(env) || 0)
  return 150 + Math.floor(Math.random() * 150)
}

export function setMockDelay(ms: number | null): void {
  delayOverride = ms
}

/** Xử lý một request như server thật và trả `Response` (không gọi fetch). */
export async function handleMockRequest(endpoint: string, init: RequestInit = {}): Promise<Response> {
  const delay = currentDelay()
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  const method = (init.method ?? 'GET').toUpperCase() as HttpMethod
  const result = await dispatch(mockRoutes, method, endpoint, init)
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

declare global {
  interface Window {
    __SE100_MOCK__?: { reset: () => void; setDelay: (ms: number | null) => void }
  }
}

/** Gắn `window.__SE100_MOCK__` cho Playwright. */
export function installMockGlobals(): void {
  window.__SE100_MOCK__ = { reset: resetMockDb, setDelay: setMockDelay }
}
