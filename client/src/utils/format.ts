import type { CustomerTierCode, RoleCode, SkinType } from '../types/api'

export function formatCurrency(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0)
  if (Number.isNaN(num)) return '0 đ'
  return `${num.toLocaleString('vi-VN')} đ`
}

export function formatNumber(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0)
  if (Number.isNaN(num)) return '0'
  return num.toLocaleString('vi-VN')
}

export function getSkinTypeLabel(skinType?: SkinType | string): string {
  switch (skinType) {
    case 'OILY':
      return 'Da dầu'
    case 'COMBINATION':
      return 'Da hỗn hợp thiên dầu'
    case 'DRY':
      return 'Da khô thiếu nước'
    case 'SENSITIVE':
      return 'Da nhạy cảm, dễ mụn'
    case 'NORMAL':
      return 'Da thường'
    default:
      return 'Chưa lưu loại da'
  }
}

export function getTierBadgeStyle(tierCode?: CustomerTierCode | string): {
  label: string
  bgClass: string
  textClass: string
  borderClass: string
  icon: string
} {
  switch (tierCode) {
    case 'DIAMOND':
      return {
        label: 'Kim Cương',
        bgClass: 'bg-amber-100/90',
        textClass: 'text-amber-900',
        borderClass: 'border-amber-300',
        icon: '💎',
      }
    case 'GOLD':
      return {
        label: 'Vàng',
        bgClass: 'bg-orange-100/90',
        textClass: 'text-orange-800',
        borderClass: 'border-orange-200',
        icon: '🏅',
      }
    case 'SILVER':
      return {
        label: 'Bạc',
        bgClass: 'bg-stone-100',
        textClass: 'text-stone-700',
        borderClass: 'border-stone-300',
        icon: '🛡️',
      }
    case 'BRONZE':
    default:
      return {
        label: 'Đồng',
        bgClass: 'bg-[#f5ebe4]',
        textClass: 'text-[#8c5840]',
        borderClass: 'border-[#e5d2c5]',
        icon: '🛡️',
      }
  }
}

export function getRoleBadgeMeta(roleCode?: RoleCode): {
  label: string
  shortLabel: string
  viTitle: string
  bgClass: string
  textClass: string
  dotClass: string
} {
  switch (roleCode) {
    case 'ADMIN':
      return {
        label: 'ADMIN',
        shortLabel: 'ADMIN',
        viTitle: 'Quản trị viên hệ thống',
        bgClass: 'bg-rose-100/90 border-rose-200',
        textClass: 'text-rose-800',
        dotClass: 'bg-rose-600',
      }
    case 'STORE_MANAGER':
      return {
        label: 'STORE_MANAGER',
        shortLabel: 'STORE_MGR',
        viTitle: 'Quản lý cửa hàng',
        bgClass: 'bg-[#f6e4db] border-[#e7c7b7]',
        textClass: 'text-[#8c3d25]',
        dotClass: 'bg-[#b4533c]',
      }
    case 'INVENTORY_STAFF':
      return {
        label: 'INVENTORY_STAFF',
        shortLabel: 'INV_STAFF',
        viTitle: 'Nhân viên kho & lô',
        bgClass: 'bg-[#f3ece3] border-[#dfd2c2]',
        textClass: 'text-[#735238]',
        dotClass: 'bg-[#9a6b44]',
      }
    case 'CASHIER':
    default:
      return {
        label: 'CASHIER',
        shortLabel: 'CASHIER',
        viTitle: 'Thu ngân điểm bán',
        bgClass: 'bg-amber-50 border-amber-200/80',
        textClass: 'text-amber-900',
        dotClass: 'bg-amber-600',
      }
  }
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return 'NV'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

