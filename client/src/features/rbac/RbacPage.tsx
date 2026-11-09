import { Link } from 'react-router-dom'
import {
  Ban,
  Check,
  CheckCircle2,
  FileSearch,
  KeyRound,
  Lock,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { PERMISSION_MODULE_TITLES } from '../../domain/permissions'
import { ApiClientError } from '../../lib/api-client'
import { rbacService } from '../../services/rbac.service'
import type {
  RbacPermissionItem,
  RbacPermissionsGrouped,
  RbacRole,
  RoleCode,
} from '../../types/api'

/** Thứ tự và tên nhóm quyền lấy từ domain/permissions.ts. */
const MODULE_ORDER = Object.keys(PERMISSION_MODULE_TITLES)
const MODULE_TITLES: Record<string, string> = Object.fromEntries(
  Object.entries(PERMISSION_MODULE_TITLES).map(([k, v], i) => [k, `NHÓM ${i + 1}: ${v.toUpperCase()}`])
)

export function RbacPage() {
  const [roles, setRoles] = useState<RbacRole[]>([])
  const [permissionsGrouped, setPermissionsGrouped] =
    useState<RbacPermissionsGrouped>({})
  const [selectedRoleCode, setSelectedRoleCode] = useState<RoleCode | 'ALL'>(
    'ADMIN'
  )
  const [searchKeyword, setSearchKeyword] = useState('')
  const [categoryTab, setCategoryTab] = useState<
    'ALL' | 'INVENTORY_FEFO' | 'FINANCE'
  >('ALL')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([rbacService.getRoles(), rbacService.getPermissions()]).then(
      ([rolesRes, permsRes]) => {
        if (active) {
          setRoles(rolesRes.data)
          setPermissionsGrouped(permsRes.data)
        }
      }
    )
    return () => {
      active = false
    }
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4000)
  }

  const getRoleByCode = (code: RoleCode): RbacRole | undefined =>
    roles.find((r) => r.roleCode === code)

  const hasPermission = (roleCode: RoleCode, permId: number): boolean => {
    if (roleCode === 'ADMIN') return true
    const role = getRoleByCode(roleCode)
    return Boolean(role?.permissionIds?.includes(permId))
  }

  const handleTogglePermission = (
    roleCode: RoleCode,
    perm: RbacPermissionItem
  ) => {
    if (roleCode === 'ADMIN') {
      showFeedback(
        'error',
        'Không thể thay đổi quyền của Quản trị viên hệ thống (CANNOT_MODIFY_ADMIN)'
      )
      return
    }
    if (perm.immutableForRoles?.includes(roleCode)) {
      showFeedback(
        'error',
        `Quyền "${perm.permissionCode}" là bất biến (cố định theo hệ thống) cho vai trò ${roleCode}`
      )
      return
    }
    if (perm.isStrict && roleCode === 'CASHIER') {
      showFeedback(
        'error',
        'Quyền Override Giá / Chiết khấu tự do bị cấm tuyệt đối với Thu ngân để bảo vệ ca'
      )
      return
    }

    setRoles((prev) =>
      prev.map((role) => {
        if (role.roleCode !== roleCode) return role
        const currentIds = role.permissionIds || []
        const exists = currentIds.includes(perm.id)
        const nextIds = exists
          ? currentIds.filter((id) => id !== perm.id)
          : [...currentIds, perm.id]
        return {
          ...role,
          permissionIds: nextIds,
        }
      })
    )
  }

  const handleSaveMatrix = async () => {
    setIsSaving(true)
    try {
      const editableRoles = roles.filter((r) => r.roleCode !== 'ADMIN')
      for (const role of editableRoles) {
        await rbacService.updateRolePermissions(role.id, {
          permissionIds: role.permissionIds || [],
        })
      }
      showFeedback(
        'success',
        'Cập nhật quyền hạn cho vai trò thành công (PUT /api/v1/rbac/roles/:roleId/permissions)'
      )
    } catch (err) {
      if (err instanceof ApiClientError) {
        showFeedback('error', `${err.message}`)
      } else {
        showFeedback('error', 'Không thể lưu ma trận phân quyền')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefault = async () => {
    try {
      setRoles(await rbacService.resetDefaultMatrix())
      showFeedback('success', 'Đã khôi phục ma trận phân quyền về mặc định chuẩn')
    } catch (err) {
      showFeedback('error', err instanceof ApiClientError ? err.message : 'Không thể khôi phục ma trận phân quyền')
    }
  }

  const totalPermissionsCount = Object.values(permissionsGrouped).flat().length || 24

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="rounded-3xl bg-[#faf1eb] border border-[#ebd7cb] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="size-12 rounded-2xl bg-[#da7756] text-white grid place-items-center shadow-sm shrink-0">
            <Shield className="size-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#221712]">
              Phân quyền ma trận vai trò & Nhật ký thao tác (Audit Log)
            </h1>
            <p className="mt-0.5 text-xs text-[#7c6255]">
              Mô hình phân quyền kiểm soát truy cập dựa trên vai trò (RBAC) đồng
              bộ hóa chính sách FEFO
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-[#e3d0c4] hover:bg-[#fdf8f5] px-4 py-2.5 text-xs font-semibold text-[#4a362c] transition cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Khôi phục mặc định</span>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveMatrix}
            className="inline-flex items-center gap-2 rounded-xl bg-[#d57252] hover:bg-[#be5e3e] text-white px-5 py-2.5 text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-60"
          >
            <CheckCircle2 className="size-4" />
            <span>
              {isSaving ? 'Đang lưu ma trận...' : 'Lưu ma trận phân quyền'}
            </span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] underline ml-4"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">
              TÀI KHOẢN HOẠT ĐỘNG
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#221712]">28</span>
              <span className="text-xs text-[#8a7062]">nhân sự</span>
            </div>
          </div>
          <div className="size-10 rounded-xl bg-[#fbeae2] text-[#b4533c] grid place-items-center">
            <Users className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">
              TỔNG ĐIỂM QUYỀN (PERMISSIONS)
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-[#221712]">24</span>
              <span className="text-xs text-[#8a7062]">rules</span>
            </div>
          </div>
          <div className="size-10 rounded-xl bg-[#f7efe4] text-[#9a6b3b] grid place-items-center">
            <KeyRound className="size-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">
              QUYỀN KHẨN CẤP (OVERRIDES)
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-red-700">0</span>
              <span className="text-xs text-[#8a7062]">vi phạm</span>
            </div>
          </div>
          <div className="size-10 rounded-xl bg-red-50 text-red-600 grid place-items-center">
            <ShieldAlert className="size-5" />
          </div>
        </div>

        <Link
          to="/audit-logs"
          className="rounded-2xl bg-white border border-[#ead9ce] p-5 shadow-2xs flex items-center justify-between hover:bg-[#fbf5f0]"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c7265]">NHẬT KÝ HỆ THỐNG</p>
            <p className="mt-1.5 text-sm font-semibold text-[#221712]">Xem lịch sử thao tác và đổi quyền</p>
          </div>
          <div className="size-10 rounded-xl bg-[#f6ece4] text-[#7b5836] grid place-items-center">
            <FileSearch className="size-5" />
          </div>
        </Link>
      </div>

      {/* Main Split Grid: 4 Standard Roles (Left) + Matrix Table (Right) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: 4 Vai Trò Chuẩn */}
        <div className="lg:col-span-4 space-y-3.5">
          <div className="flex items-center gap-2 px-1">
            <Users className="size-4 text-[#b4533c]" />
            <h2 className="text-sm font-extrabold text-[#221712]">
              4 Vai Trò Chuẩn
            </h2>
          </div>

          {roles.map((role) => {
            const isSelected = selectedRoleCode === role.roleCode
            const permCount =
              role.roleCode === 'ADMIN'
                ? 24
                : role.permissionIds?.length ?? 0

            return (
              <div
                key={role.id}
                onClick={() => setSelectedRoleCode(role.roleCode)}
                className={`rounded-3xl p-5 border transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#fcf1ea] border-[#d57252] shadow-sm'
                    : 'bg-white border-[#ead9ce] hover:border-[#d9bfb0]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-10 rounded-2xl grid place-items-center text-xs font-extrabold ${
                        role.roleCode === 'ADMIN'
                          ? 'bg-[#d57252] text-white'
                          : 'bg-[#f4e5dc] text-[#7c432b]'
                      }`}
                    >
                      {role.shortCode || role.roleCode.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#221712]">
                        {role.roleName}
                      </h3>
                      <p className="text-[11px] text-[#856b5d]">
                        {role._count?.userRoles ?? 1} Tài khoản nhân sự
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#f5e3d8] text-[#9f432b] font-mono text-[10px] font-bold">
                    {role.roleCode}
                  </span>
                </div>

                <p className="mt-3 text-xs text-[#695246] leading-relaxed">
                  {role.description}
                </p>

                <div className="mt-4 pt-3 border-t border-[#efe0d6] flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#9f432b]">
                    <span className="size-2 rounded-full bg-[#d57252]" />
                    {permCount}/{totalPermissionsCount} Quyền
                  </span>
                  <span className="text-[#8b7265] font-medium">
                    {role.badgeNote}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right 8 Cols: Permission Matrix */}
        <div className="lg:col-span-8 rounded-3xl bg-white border border-[#ead9ce] shadow-2xs overflow-hidden">
          {/* Search & Category Tabs Bar */}
          <div className="p-4 sm:p-5 border-b border-[#f1e4dc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="size-4 text-[#9a7e70] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm kiếm hành động / mã quyền..."
                className="w-full rounded-xl bg-[#fcf7f4] border border-[#e8d7cc] pl-10 pr-4 py-2 text-xs text-[#221712] outline-none focus:border-[#b4533c]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <span className="text-[11px] text-[#8c7365] mr-1">Hiển thị:</span>
              {[
                { key: 'ALL', label: 'Tất cả (24)' },
                { key: 'INVENTORY_FEFO', label: 'Kho & FEFO' },
                { key: 'FINANCE', label: 'Tài chính' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() =>
                    setCategoryTab(
                      tab.key as 'ALL' | 'INVENTORY_FEFO' | 'FINANCE'
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    categoryTab === tab.key
                      ? 'bg-[#d57252] text-white'
                      : 'bg-[#f8f0ea] text-[#6d5448] hover:bg-[#efe2d8]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Matrix Column Header */}
          <div className="grid grid-cols-12 items-center bg-[#faf3ee] border-b border-[#eedfd6] px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#7e6457]">
            <div className="col-span-6">
              HÀNH ĐỘNG NGHIỆP VỤ / QUYỀN THẨM QUYỀN
            </div>
            <div className="col-span-1 text-center">
              <span className="text-[#9f432b] block">ADMIN</span>
              <span className="text-[9px] font-normal lowercase">toàn quyền</span>
            </div>
            <div className="col-span-2 text-center">
              <span className="text-[#221712] block">STORE_MGR</span>
              <span className="text-[9px] font-normal lowercase">quản lý</span>
            </div>
            <div className="col-span-1 text-center">
              <span className="text-[#785233] block">INV_STAFF</span>
              <span className="text-[9px] font-normal lowercase">kho lô</span>
            </div>
            <div className="col-span-2 text-center">
              <span className="text-[#221712] block">CASHIER</span>
              <span className="text-[9px] font-normal lowercase">thu ngân</span>
            </div>
          </div>

          {/* Grouped Permissions Rows */}
          <div className="divide-y divide-[#f3e7df]">
            {Array.from(
              new Set([...MODULE_ORDER, ...Object.keys(permissionsGrouped)])
            ).map((moduleKey) => {
              const items = (permissionsGrouped[moduleKey] || []).filter(
                (perm) => {
                  if (
                    categoryTab !== 'ALL' &&
                    perm.categoryTag !== categoryTab
                  ) {
                    return false
                  }
                  if (searchKeyword.trim()) {
                    const kw = searchKeyword.trim().toLowerCase()
                    return (
                      perm.permissionName.toLowerCase().includes(kw) ||
                      perm.permissionCode.toLowerCase().includes(kw)
                    )
                  }
                  return true
                }
              )

              if (items.length === 0) return null

              return (
                <div key={moduleKey}>
                  <div className="bg-[#fdf8f4] px-5 py-2.5 text-[11px] font-extrabold text-[#9f432b] tracking-wide border-b border-[#f3e7df]">
                    {MODULE_TITLES[moduleKey] || `NHÓM: ${moduleKey}`}
                  </div>

                  <div className="divide-y divide-[#f6ece6]">
                    {items.map((perm) => {
                      const adminImmutable =
                        perm.immutableForRoles?.includes('ADMIN')
                      const cashierImmutable =
                        perm.immutableForRoles?.includes('CASHIER')

                      return (
                        <div
                          key={perm.id}
                          className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-[#fdfaf8] transition"
                        >
                          {/* Permission Name & Code */}
                          <div className="col-span-6 pr-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  perm.isStrict
                                    ? 'text-red-700'
                                    : 'text-[#221712]'
                                }`}
                              >
                                {perm.permissionName}
                              </span>
                              {perm.isStrict && (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-extrabold uppercase">
                                  STRICT
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-[#8d7467] mt-0.5">
                              {perm.permissionCode}
                            </p>
                          </div>

                          {/* ADMIN Column (Always enabled / locked) */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleTogglePermission('ADMIN', perm)
                              }
                              title="Quyền Quản trị viên hệ thống (Bất biến)"
                              className="size-6 rounded-md bg-[#873e29] text-white grid place-items-center cursor-not-allowed"
                            >
                              {adminImmutable ? (
                                <Lock className="size-3.5" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                            </button>
                          </div>

                          {/* STORE_MANAGER Column */}
                          <div className="col-span-2 flex justify-center">
                            {perm.forbiddenForRoles?.includes(
                              'STORE_MANAGER'
                            ) ? (
                              <span className="size-6 rounded-md bg-[#f5eee9] text-[#bba79c] grid place-items-center">
                                <X className="size-3.5" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleTogglePermission('STORE_MANAGER', perm)
                                }
                                className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                                  hasPermission('STORE_MANAGER', perm.id)
                                    ? 'bg-[#da7756] justify-end'
                                    : 'bg-[#e2d5cc] justify-start'
                                }`}
                              >
                                <span className="size-4 rounded-full bg-white shadow-2xs" />
                              </button>
                            )}
                          </div>

                          {/* INVENTORY_STAFF Column */}
                          <div className="col-span-1 flex justify-center">
                            {perm.forbiddenForRoles?.includes(
                              'INVENTORY_STAFF'
                            ) ? (
                              <span className="size-6 rounded-md bg-[#f5eee9] text-[#bba79c] grid place-items-center">
                                <X className="size-3.5" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleTogglePermission(
                                    'INVENTORY_STAFF',
                                    perm
                                  )
                                }
                                className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                                  hasPermission('INVENTORY_STAFF', perm.id)
                                    ? 'bg-[#da7756] justify-end'
                                    : 'bg-[#e2d5cc] justify-start'
                                }`}
                              >
                                <span className="size-4 rounded-full bg-white shadow-2xs" />
                              </button>
                            )}
                          </div>

                          {/* CASHIER Column */}
                          <div className="col-span-2 flex justify-center">
                            {perm.isStrict ? (
                              <span
                                title="Cấm tuyệt đối (Bảo vệ ca)"
                                className="size-6 rounded-md bg-red-50 text-red-600 grid place-items-center"
                              >
                                <Ban className="size-3.5" />
                              </span>
                            ) : cashierImmutable ? (
                              <span
                                title="Bất biến (Cố định theo hệ thống)"
                                className="size-6 rounded-md bg-[#7c6a5e] text-white grid place-items-center"
                              >
                                <Lock className="size-3.5" />
                              </span>
                            ) : perm.forbiddenForRoles?.includes('CASHIER') ? (
                              <span className="size-6 rounded-md bg-[#f5eee9] text-[#bba79c] grid place-items-center">
                                <X className="size-3.5" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleTogglePermission('CASHIER', perm)
                                }
                                className={`w-10 h-5 rounded-full p-0.5 transition flex items-center cursor-pointer ${
                                  hasPermission('CASHIER', perm.id)
                                    ? 'bg-[#da7756] justify-end'
                                    : 'bg-[#e2d5cc] justify-start'
                                }`}
                              >
                                <span className="size-4 rounded-full bg-white shadow-2xs" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Matrix Legend Footer */}
          <div className="bg-[#fdf9f6] border-t border-[#eedfd6] px-5 py-4 space-y-2 text-[11px] text-[#7a6154]">
            <div className="flex flex-wrap items-center gap-5">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-4 rounded bg-[#873e29] text-white grid place-items-center">
                  <Lock className="size-2.5" />
                </span>
                <span>Bất biến (Cố định theo hệ thống)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 h-3.5 rounded-full bg-[#da7756] inline-block" />
                <span>Đang cấp quyền</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 h-3.5 rounded-full bg-[#e2d5cc] inline-block" />
                <span>Đang vô hiệu</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-700 font-semibold">
                <Ban className="size-3.5" />
                <span>Cấm tuyệt đối (Bảo vệ ca)</span>
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#9a8173]">
              Đã lưu lần cuối: Hôm nay lúc 11:42 bởi Mai Trần
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
