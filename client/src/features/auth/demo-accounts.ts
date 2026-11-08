/** Tài khoản seed của mock (CLAUDE.md mục 5.3). Chỉ dùng khi `VITE_USE_MOCK=true`. */
export const DEMO_PASSWORD = 'Password@123'

export const DEMO_ACCOUNTS = [
  { username: 'admin', role: 'ADMIN', label: 'Chủ cửa hàng (ADMIN)' },
  { username: 'manager01', role: 'STORE_MANAGER', label: 'Quản lý (STORE_MANAGER)' },
  { username: 'cashier01', role: 'CASHIER', label: 'Thu ngân (CASHIER)' },
  { username: 'inventory01', role: 'INVENTORY_STAFF', label: 'Nhân viên kho (INVENTORY_STAFF)' },
  { username: 'newstaff', role: 'CASHIER', label: 'Nhân viên mới (bắt đổi mật khẩu)' },
] as const
