import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, PackageMinus, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useCan } from '../../app/usePermission'
import { toast } from '../../components/ui'
import { ApiClientError } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { productsService } from '../../services/products.service'
import type {
  DeactivateProductResult,
  DestroyReasonCode,
  ProductItem,
} from '../../types/api'
import { getErrorMessage } from '../../utils/error'
import { formatNumber } from '../../utils/format'
import { REASON_LABEL, REASONS_BY_TYPE } from '../disposals/disposal-meta'

interface DiscontinueProductModalProps {
  product: ProductItem | null
  onClose: () => void
  onSuccess: (result: DeactivateProductResult) => void
}

const DEFAULT_REASON =
  'Xuất hủy toàn bộ tồn trong kho và hàng trưng bày để ngừng kinh doanh sản phẩm'

export function DiscontinueProductModal({
  product,
  onClose,
  onSuccess,
}: DiscontinueProductModalProps) {
  const queryClient = useQueryClient()
  const canApproveDisposal = useCan('STOCK_DISPOSAL_APPROVE')
  const [reasonCode, setReasonCode] = useState<DestroyReasonCode>('DAMAGED')
  const [reason, setReason] = useState(DEFAULT_REASON)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!product) return null

  const stockQty = product.currentStock ?? 0
  const trimmedReason = reason.trim()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmedReason) {
      toast.error('Vui lòng nhập diễn giải lý do xuất hủy')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await productsService.deactivateProduct(product.sku, {
        disposal: {
          reasonCode,
          reason: trimmedReason,
        },
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.disposals.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.pos.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all })
      toast.success(
        res.message ||
          (res.data.disposalStatus === 'APPROVED'
            ? `Đã xuất hủy tồn kho và ngừng kinh doanh ${res.data.sku}`
            : `Đã lập phiếu xuất hủy ${res.data.disposalCode ?? ''} chờ duyệt`)
      )
      onSuccess(res.data)
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message)
      } else {
        toast.error(getErrorMessage(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discontinue-product-modal-title"
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-[#ead8ce] shadow-2xl">
        {/* Header */}
        <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd]">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-red-100 text-red-700 grid place-items-center shrink-0">
              <PackageMinus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="discontinue-product-modal-title"
                className="text-base font-extrabold text-[#221712]"
              >
                Xuất hủy tồn kho & Ngừng kinh doanh
              </h3>
              <p className="text-[11px] font-mono font-semibold text-[#7c6356]">
                {product.sku}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="rounded-lg p-1.5 text-[#5e473b] hover:bg-black/5 cursor-pointer disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Product & Stock Summary */}
            <div className="rounded-2xl bg-[#fdf6f1] border border-[#ebd9ce] p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#7c6356]">Sản phẩm</p>
                <p className="mt-0.5 text-sm font-extrabold text-[#221712]">
                  {product.productName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold uppercase text-red-700">
                  Tồn cần xử lý
                </p>
                <p className="mt-0.5 font-mono text-xl font-extrabold text-red-600">
                  {formatNumber(stockQty)}{' '}
                  <span className="text-xs font-semibold text-[#695246]">
                    {product.unit}
                  </span>
                </p>
              </div>
            </div>

            {/* Role-aware Notice */}
            <div className="rounded-2xl bg-amber-50/90 border border-amber-200 p-3.5 flex items-start gap-2.5 text-xs text-amber-950 leading-relaxed">
              <AlertTriangle
                className="size-4 text-amber-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                {canApproveDisposal ? (
                  <p>
                    Sản phẩm còn tồn trong kho hoặc trưng bày. Hệ thống sẽ{' '}
                    <strong>tự động lập và duyệt phiếu xuất hủy</strong> toàn bộ{' '}
                    <strong>{formatNumber(stockQty)}</strong> sản phẩm còn lại
                    (trừ tồn về 0, ghi thẻ kho), đồng thời chuyển ngay sang{' '}
                    <strong>Ngừng kinh doanh</strong>.
                  </p>
                ) : (
                  <p>
                    Sản phẩm còn tồn trong kho hoặc trưng bày. Hệ thống sẽ{' '}
                    <strong>lập phiếu xuất hủy chờ Quản lý duyệt</strong> và
                    cách ly ngay toàn bộ{' '}
                    <strong>{formatNumber(stockQty)}</strong> sản phẩm. Ngay sau
                    khi Quản lý duyệt phiếu, sản phẩm sẽ{' '}
                    <strong>tự động chuyển sang Ngừng kinh doanh</strong>.
                  </p>
                )}
              </div>
            </div>

            {/* Reason Code */}
            <div>
              <label
                htmlFor="discontinue-reason-code"
                className="block text-xs font-bold text-[#221712]"
              >
                Mã lý do xuất hủy *
              </label>
              <select
                id="discontinue-reason-code"
                value={reasonCode}
                onChange={(e) =>
                  setReasonCode(e.target.value as DestroyReasonCode)
                }
                className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 text-sm font-semibold text-[#221712] outline-none transition cursor-pointer"
              >
                {(REASONS_BY_TYPE.DESTROY as DestroyReasonCode[]).map((code) => (
                  <option key={code} value={code}>
                    {REASON_LABEL[code]} ({code})
                  </option>
                ))}
              </select>
            </div>

            {/* Reason Note */}
            <div>
              <label
                htmlFor="discontinue-reason-note"
                className="block text-xs font-bold text-[#221712]"
              >
                Diễn giải lý do xuất hủy *
              </label>
              <textarea
                id="discontinue-reason-note"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do xuất hủy tồn kho trước khi ngừng kinh doanh..."
                required
                className="mt-1.5 w-full rounded-2xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white p-3.5 text-sm text-[#221712] placeholder:text-[#9c8478] outline-none transition"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between gap-3 border-t border-[#edd9cd]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-white border border-[#dcc8bc] hover:bg-[#f5eae3] text-[#4a362c] font-bold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !trimmedReason}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <Ban className="size-4" aria-hidden="true" />
              <span>
                {isSubmitting
                  ? 'Đang xử lý...'
                  : canApproveDisposal
                    ? 'Xuất hủy & Ngừng kinh doanh'
                    : 'Lập phiếu xuất hủy & Chờ duyệt'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

