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
        bgClass: 'bg-gradient-to-r from-[#e0f2fe] via-[#60a5fa] to-[#1d4ed8]',
        textClass: 'text-black',
        borderClass: 'border-amber-300',
        icon: '',
      }
    case 'GOLD':
      return {
        label: 'Vàng',
        bgClass: 'bg-gradient-to-r from-[#fef9c3] via-[#facc15] to-[#ca8a04]',
        textClass: 'text-orange-800',
        borderClass: 'border-orange-200',
        icon: '',
      }
    case 'SILVER':
      return {
        label: 'Bạc',
        bgClass: 'bg-gradient-to-r from-[#f3f4f6] via-[#d1d5db] to-[#8b929e]',
        textClass: 'text-stone-700',
        borderClass: 'border-stone-300',
        icon: '',
      }
    case 'BRONZE':
    default:
      return {
        label: 'Đồng',
        bgClass: 'bg-gradient-to-r from-[#f5efe8] via-[#ecc38e] to-[#d9821b]',
        textClass: 'text-[#8c5840]',
        borderClass: 'border-[#e5d2c5]',
        icon: '',
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


const pad2 = (n: number) => String(n).padStart(2, '0')

/** `dd/MM/yyyy` từ ISO hoặc `YYYY-MM-DD`; rỗng thì trả `—`. Ngày thuần không bị lệch múi giờ. */
export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** `dd/MM/yyyy HH:mm` từ ISO. */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(value)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const ACTION_LABELS: Record<string, string> = {
  EARN: 'Tích điểm',
  REDEEM: 'Dùng điểm',
  REVOKE: 'Thu hồi điểm',
  ADJUST: 'Điều chỉnh',
}

/** Nhãn tiếng Việt của POINT_HISTORIES.action_type (CUS-03). */
export function pointActionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType
}

/** ISO thì định dạng `dd/MM/yyyy HH:mm`; chuỗi đã định dạng sẵn (dữ liệu mẫu cũ) thì giữ nguyên. */
export function formatAnyDateTime(value?: string | null): string {
  if (!value) return '—'
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? formatDateTime(value) : value
}
