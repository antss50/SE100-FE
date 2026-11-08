import { Ban, CheckCircle2, Edit3, PlusSquare, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { ApiClientError } from '../../lib/api-client'
import { productsService } from '../../services/products.service'
import type { CategoryItem } from '../../types/api'

interface CreateCategoryModalProps {
  isOpen: boolean
  editingCategory?: CategoryItem | null
  onClose: () => void
  onSaved: (category: CategoryItem, mode: 'create' | 'update' | 'status') => void
}

const PRESET_CODES = [
  'PERFUME',
  'CAT_SKINCARE',
  'CAT_MAKEUP',
  'CAT_SUNCARE',
  'CAT_CLEANSER',
  'CAT_BODYCARE',
  'CAT_HAIR',
  'CAT_GIFTSET',
]

export function CreateCategoryModal({
  isOpen,
  editingCategory,
  onClose,
  onSaved,
}: CreateCategoryModalProps) {
  const [categoryName, setCategoryName] = useState(
    () => editingCategory?.categoryName || ''
  )
  const [categoryCode, setCategoryCode] = useState(
    () => editingCategory?.categoryCode || 'PERFUME'
  )
  const [description, setDescription] = useState(
    () => editingCategory?.description || ''
  )
  const [detailData, setDetailData] = useState<CategoryItem | null>(
    () => editingCategory || null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // UC-PROD-12: Xem chi tiết danh mục GET /api/v1/categories/{categoryCode}
  useEffect(() => {
    if (!isOpen || !editingCategory?.categoryCode) return
    let active = true
    productsService
      .getCategoryDetail(editingCategory.categoryCode)
      .then((res) => {
        if (!active) return
        setDetailData(res.data)
        setCategoryName(res.data.categoryName)
        setCategoryCode(res.data.categoryCode)
        setDescription(res.data.description || '')
      })
      .catch(() => {
        // fallback to prop data
      })
    return () => {
      active = false
    }
  }, [isOpen, editingCategory?.categoryCode])

  if (!isOpen) return null

  const handleClose = () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setIsSubmitting(true)

    try {
      if (editingCategory) {
        // UC-PROD-13: PUT /api/v1/categories/{categoryCode}
        const res = await productsService.updateCategory(
          editingCategory.categoryCode,
          {
            categoryName,
            description,
          }
        )
        onSaved(res.data, 'update')
        onClose()
      } else {
        // UC-PROD-02: POST /api/v1/categories
        const res = await productsService.createCategory({
          categoryCode,
          categoryName,
          description,
        })
        onSaved(res.data, 'create')
        setSuccessMsg(
          `Đã thêm danh mục "${res.data.categoryName}" (${res.data.categoryCode}) thành công!`
        )
        setCategoryName('')
        setDescription('')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message} (${err.errorCode})`)
      } else {
        setErrorMsg('Không thể lưu danh mục')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    const current = detailData || editingCategory
    if (!current) return
    setErrorMsg(null)
    setSuccessMsg(null)
    setIsSubmitting(true)

    try {
      if (current.status === 'ACTIVE') {
        // UC-PROD-14: PATCH /api/v1/categories/{categoryCode}/deactivate
        const res = await productsService.deactivateCategory(
          current.categoryCode
        )
        const updated: CategoryItem = {
          ...current,
          status: res.data.status,
        }
        setDetailData(updated)
        onSaved(updated, 'status')
        setSuccessMsg(res.message || 'Ngừng sử dụng danh mục thành công')
      } else {
        // UC-PROD-15: PATCH /api/v1/categories/{categoryCode}/restore
        const res = await productsService.restoreCategory(current.categoryCode)
        const updated: CategoryItem = {
          ...current,
          status: res.data.status,
        }
        setDetailData(updated)
        onSaved(updated, 'status')
        setSuccessMsg(res.message || 'Khôi phục danh mục thành công')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message} (${err.errorCode})`)
      } else {
        setErrorMsg('Không thể thay đổi trạng thái danh mục')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentStatus = (detailData || editingCategory)?.status || 'ACTIVE'
  const currentCount = (detailData || editingCategory)?.productCount ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#ead8ce] shadow-2xl">
        {/* Top Modal Header */}
        <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd]">
          <div className="flex items-center gap-2.5">
            {editingCategory ? (
              <Edit3 className="size-5 text-[#9a3b20]" />
            ) : (
              <PlusSquare className="size-5 text-[#9a3b20]" />
            )}
            <h3 className="text-base font-extrabold text-[#221712]">
              {editingCategory
                ? `Chi tiết & Cập nhật Danh mục (${editingCategory.categoryCode})`
                : 'Khởi tạo Danh mục mới'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[#5e473b] hover:bg-black/5 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#8c673a]">
                1. THÔNG TIN ĐỊNH DANH & PHÂN LOẠI
              </p>
              {editingCategory && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#f5e3d8] text-[#9a462d] font-mono font-bold">
                    {currentCount} sản phẩm
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold ${
                      currentStatus === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {currentStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-800">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#221712]">
                Tên danh mục *
              </label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ví dụ: Nước hoa"
                className="mt-2 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 text-sm text-[#221712] placeholder:text-[#9c8478] outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#221712]">
                Mã Danh mục nội bộ *
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  list="category-code-presets"
                  value={categoryCode}
                  disabled={Boolean(editingCategory)}
                  onChange={(e) =>
                    setCategoryCode(e.target.value.toUpperCase())
                  }
                  placeholder="VD: PERFUME, CAT_SKINCARE"
                  className="w-56 rounded-xl bg-[#fceddf]/70 disabled:bg-zinc-100 disabled:text-zinc-500 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 font-mono text-sm font-semibold text-[#221712] outline-none transition"
                  required
                />
                {!editingCategory && (
                  <datalist id="category-code-presets">
                    {PRESET_CODES.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                )}
                <span className="text-[11px] text-[#8a7062]">
                  {editingCategory
                    ? '(Không đổi được categoryCode theo UC-PROD-13)'
                    : '(Nhập mã mới hoặc chọn gợi ý chuẩn)'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#221712]">
                Mô tả danh mục
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập mô tả chi tiết..."
                className="mt-2 w-full rounded-2xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white p-4 text-sm italic text-[#221712] placeholder:text-[#7e675c] outline-none transition"
              />
            </div>

            {editingCategory && (
              <div className="pt-2 border-t border-[#f1e3d9] flex items-center justify-between gap-3">
                <div className="text-[11px] text-[#7c6356]">
                  {currentStatus === 'ACTIVE'
                    ? 'Ngừng sử dụng danh mục (UC-PROD-14): Chỉ cho phép khi không còn sản phẩm đang kinh doanh.'
                    : 'Danh mục đang ngừng sử dụng. Bạn có thể khôi phục lại (UC-PROD-15).'}
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleToggleStatus}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    currentStatus === 'ACTIVE'
                      ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {currentStatus === 'ACTIVE' ? (
                    <>
                      <Ban className="size-3.5" />
                      <span>Ngừng sử dụng</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span>Khôi phục</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-t border-[#edd9cd]">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 rounded-2xl bg-[#a3a3a3] hover:bg-[#8f8f8f] text-black font-bold text-sm transition cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl bg-[#d97757] hover:bg-[#c46344] text-white font-bold text-sm shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang lưu...'
                : editingCategory
                  ? 'Lưu cập nhật (UC-PROD-13)'
                  : 'Lưu & Tiếp tục tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
