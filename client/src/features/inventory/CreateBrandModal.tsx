import { Ban, CheckCircle2, Edit3, PlusSquare, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { ApiClientError } from '../../lib/api-client'
import { productsService } from '../../services/products.service'
import type { BrandItem } from '../../types/api'
import { toast } from '../../components/ui'

const suggestBrandCode = (name: string) => {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .match(/[A-Z0-9]+/g) || []

  if (words.length > 1) return words.map((word) => word[0]).join('')
  return (words[0] || '').slice(0, 10)
}

interface CreateBrandModalProps {
  isOpen: boolean
  editingBrand?: BrandItem | null
  onClose: () => void
  onSaved: (brand: BrandItem, mode: 'create' | 'update' | 'status') => void
}

export function CreateBrandModal({
  isOpen,
  editingBrand,
  onClose,
  onSaved,
}: CreateBrandModalProps) {
  const [brandName, setBrandName] = useState(
    () => editingBrand?.brandName || ''
  )
  const [brandCode, setBrandCode] = useState(
    () => editingBrand?.brandCode || ''
  )
  const [isCodeAutoSuggested, setIsCodeAutoSuggested] = useState(!editingBrand)
  const [description, setDescription] = useState(
    () => editingBrand?.description || ''
  )
  const [detailData, setDetailData] = useState<BrandItem | null>(
    () => editingBrand || null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // UC-PROD-17: Xem chi tiết thương hiệu GET /api/v1/brands/{brandCode}
  useEffect(() => {
    if (!isOpen || !editingBrand?.brandCode) return
    let active = true
    productsService
      .getBrandDetail(editingBrand.brandCode)
      .then((res) => {
        if (!active) return
        setDetailData(res.data)
        setBrandName(res.data.brandName)
        setBrandCode(res.data.brandCode)
        setDescription(res.data.description || '')
      })
      .catch(() => {
        // fallback to prop
      })
    return () => {
      active = false
    }
  }, [isOpen, editingBrand?.brandCode])

  if (!isOpen) return null

  const handleClose = () => {
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingBrand) {
        // UC-PROD-18: PUT /api/v1/brands/{brandCode}
        const res = await productsService.updateBrand(editingBrand.brandCode, {
          brandName,
          description,
        })
        onSaved(res.data, 'update')
        onClose()
      } else {
        // UC-PROD-03: POST /api/v1/brands
        const res = await productsService.createBrand({
          brandCode,
          brandName,
          description,
        })
        onSaved(res.data, 'create')
        setBrandName('')
                setBrandCode('')
                setIsCodeAutoSuggested(true)
        setDescription('')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message)
      } else {
        toast.error('Không thể lưu thương hiệu')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    const current = detailData || editingBrand
    if (!current) return
    setIsSubmitting(true)

    try {
      if (current.status === 'ACTIVE') {
        // UC-PROD-19: PATCH /api/v1/brands/{brandCode}/deactivate
        const res = await productsService.deactivateBrand(current.brandCode)
        const updated: BrandItem = {
          ...current,
          status: res.data.status,
        }
        setDetailData(updated)
        onSaved(updated, 'status')
      } else {
        // UC-PROD-20: PATCH /api/v1/brands/{brandCode}/restore
        const res = await productsService.restoreBrand(current.brandCode)
        const updated: BrandItem = {
          ...current,
          status: res.data.status,
        }
        setDetailData(updated)
        onSaved(updated, 'status')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message)
      } else {
        toast.error('Không thể thay đổi trạng thái thương hiệu')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentStatus = (detailData || editingBrand)?.status || 'ACTIVE'
  const currentCount = (detailData || editingBrand)?.productCount ?? 0

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#ead8ce] shadow-2xl">
        {/* Top Modal Header */}
        <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd]">
          <div className="flex items-center gap-2.5">
            {editingBrand ? (
              <Edit3 className="size-5 text-[#9a3b20]" />
            ) : (
              <PlusSquare className="size-5 text-[#9a3b20]" />
            )}
            <h3 className="text-base font-extrabold text-[#221712]">
              {editingBrand
                ? `Chi tiết & Cập nhật Thương hiệu (${editingBrand.brandCode})`
                : 'Khởi tạo Thương hiệu mới'}
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

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#8c673a]">
                1. THÔNG TIN ĐỊNH DANH THƯƠNG HIỆU
              </p>
              {editingBrand && (
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

            <div>
              <label className="block text-xs font-bold text-[#221712]">
                Tên thương hiệu mỹ phẩm *
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => {
                  const name = e.target.value
                  setBrandName(name)
                  if (!editingBrand && isCodeAutoSuggested) {
                    setBrandCode(suggestBrandCode(name))
                  }
                }}
                placeholder="Ví dụ: La Roche-Posay, Chanel, Dior..."
                className="mt-2 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 text-sm text-[#221712] placeholder:text-[#9c8478] outline-none transition"
                required
              />
            </div>

            <div>
              <div className="flex flex-wrap items-baseline gap-x-1">
                <label className="block text-xs font-bold text-[#221712]">
                  Mã thương hiệu nội bộ *
                </label>
                <span className="text-[11px] text-[#8a7062]">
                  (Nhập mã mới hoặc chọn gợi ý chuẩn)
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={brandCode}
                  disabled={Boolean(editingBrand)}
                  onChange={(e) => {
                    setIsCodeAutoSuggested(false)
                    setBrandCode(e.target.value.toUpperCase())
                  }}
                  placeholder="Ví dụ: LRP"
                  className="w-56 rounded-xl bg-[#fceddf]/70 disabled:bg-zinc-100 disabled:text-zinc-500 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 font-mono text-sm font-semibold text-[#221712] outline-none transition"
                  required
                />
                {editingBrand && (
                  <span className="text-[11px] text-[#8a7062]">
                    (Không đổi được brandCode)
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#221712]">
                Mô tả thương hiệu
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ví dụ: Dược mỹ phẩm Pháp chuyên biệt cho làn da nhạy cảm..."
                className="mt-2 w-full rounded-2xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white p-4 text-sm italic text-[#221712] placeholder:text-[#7e675c] outline-none transition"
              />
            </div>

            {editingBrand && (
              <div className="pt-2 border-t border-[#f1e3d9] flex items-center justify-between gap-3">
                <div className="text-[11px] text-[#7c6356]">
                  {currentStatus === 'ACTIVE'
                    ? 'Ngừng sử dụng thương hiệu: Chỉ cho phép khi không còn sản phẩm đang kinh doanh.'
                    : 'Thương hiệu đang ngừng sử dụng. Bạn có thể khôi phục lại.'}
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
                : editingBrand
                  ? 'Lưu cập nhật'
                  : 'Lưu & Tiếp tục tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
