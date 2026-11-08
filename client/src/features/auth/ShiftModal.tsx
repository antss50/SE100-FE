import { Banknote, Clock, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { useUiStore } from '../../app/store'
import { ApiClientError } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { shiftsService } from '../../services/shifts.service'
import type { ShiftInfo } from '../../types/api'
import { formatCurrency } from '../../utils/format'

export function ShiftModal() {
  const isOpen = useUiStore((s) => s.isShiftModalOpen)
  const closeShiftModal = useUiStore((s) => s.closeShiftModal)
  const queryClient = useQueryClient()

  const [currentShift, setCurrentShift] = useState<ShiftInfo | null>(null)
  const [openingCash, setOpeningCash] = useState('2000000')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    shiftsService
      .getCurrentShift()
      .then((res) => {
        if (active) {
          setCurrentShift(res.data.shift)
        }
      })
      .catch(() => {
        // ignore
      })
    return () => {
      active = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOpenShift = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setStatusMsg(null)
    setIsLoading(true)

    try {
      const cashNum = Number(openingCash)
      const res = await shiftsService.openShift(cashNum)
      setCurrentShift(res.data)
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.current })
      setStatusMsg(res.message || 'Mở ca làm việc thành công')
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message} (${err.errorCode})`)
      } else {
        setErrorMsg('Không thể mở ca làm việc')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseShift = async () => {
    if (!currentShift) return
    setErrorMsg(null)
    try {
      await shiftsService.closeShift(currentShift.shiftId)
      setCurrentShift(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.current })
      setStatusMsg('Đã chốt bàn giao ca hiện tại. Bạn có thể mở ca mới.')
    } catch (err) {
      setErrorMsg(err instanceof ApiClientError ? `${err.message} (${err.errorCode})` : 'Không thể chốt ca')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#ead8ce] shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#fbeae2] text-[#9f432b] grid place-items-center">
              <Clock className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2b1d16]">
                Quản lý Ca làm việc POS (G12)
              </h3>
              <p className="text-xs text-[#7c6356]">
                Kiểm tra & khai báo tiền mặt đầu ca thu ngân
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeShiftModal}
            className="rounded-lg p-1.5 text-[#8c7365] hover:bg-[#f6ede7]"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
            {statusMsg}
          </div>
        )}

        {currentShift ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-[#faf4f0] border border-[#e7d6cb] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#785e51]">Mã phiên ca (shiftId):</span>
                <span className="font-mono font-bold text-[#2b1d16]">
                  #SHIFT-0{currentShift.shiftId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#785e51]">Trạng thái:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  <span className="size-1.5 rounded-full bg-emerald-600" />
                  Đang mở ({currentShift.status})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#785e51]">Tiền mặt đầu ca (openingCash):</span>
                <span className="font-bold text-[#9f432b]">
                  {formatCurrency(currentShift.openingCash)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#785e51]">Thời điểm mở ca:</span>
                <span className="font-mono text-[#3d2b22]">
                  {new Date(currentShift.openedAt).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={closeShiftModal}
                className="px-4 py-2 rounded-xl border border-[#e3d2c7] text-xs font-semibold text-[#5e473c]"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                className="px-4 py-2 rounded-xl bg-[#9f432b] text-white text-xs font-semibold hover:bg-[#863520] cursor-pointer"
              >
                Chốt & Đóng ca hiện tại
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleOpenShift} className="mt-5 space-y-4">
            <div className="rounded-xl bg-amber-50/80 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
              Hiện chưa có ca làm việc nào đang mở. Vui lòng nhập số tiền mặt đầu ca
              để bắt đầu bán hàng.
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#543e34]">
                Số tiền mặt đầu ca (openingCash - VNĐ) *
              </label>
              <div className="mt-1.5 relative">
                <Banknote className="size-4 text-[#9a7d6f] absolute left-3.5 top-3" />
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full rounded-xl bg-[#fcf7f4] border border-[#e6d5ca] pl-10 pr-3.5 py-2.5 text-sm font-mono font-semibold text-[#2b1d16] outline-none focus:border-[#b4533c]"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={closeShiftModal}
                className="px-4 py-2 rounded-xl border border-[#e3d2c7] text-xs font-semibold text-[#5e473c]"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 rounded-xl bg-[#9f432b] text-white text-xs font-semibold hover:bg-[#863520] cursor-pointer"
              >
                {isLoading ? 'Đang mở ca...' : 'Xác nhận Mở ca POS'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
