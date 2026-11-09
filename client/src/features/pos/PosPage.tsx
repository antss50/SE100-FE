import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileClock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiStore } from '../../app/store'
import { useCan } from '../../app/usePermission'
import { Button, toast } from '../../components/ui'
import { queryKeys } from '../../lib/query-keys'
import { ordersService } from '../../services/orders.service'
import { shiftsService } from '../../services/shifts.service'
import type { CartInput, OrderRecord, PosProduct } from '../../types/pos'
import { getErrorMessage } from '../../utils/error'
import { formatDateTime } from '../../utils/format'
import { CartPanel } from './components/CartPanel'
import { CustomerPanel } from './components/CustomerPanel'
import { DraftsModal } from './components/DraftsModal'
import { PaymentPanel } from './components/PaymentPanel'
import { ProductSearchPanel } from './components/ProductSearchPanel'
import { ReceiptModal } from './components/ReceiptModal'
import { usePosStore } from './pos-store'

/** POS-02, POS-03, CUS-04, PROM-03: màn thu ngân. Giá, khuyến mãi, lô FEFO do máy chủ tính; màn này chỉ giữ giỏ hàng nháp. */
export function PosPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const openShiftModal = useUiStore((s) => s.openShiftModal)
  const canOpenShift = useCan('POS_SHIFT_OPEN')
  const [showDrafts, setShowDrafts] = useState(false)
  const [receipt, setReceipt] = useState<OrderRecord | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const scanRef = useRef<HTMLInputElement | null>(null)
  const phoneRef = useRef<HTMLInputElement | null>(null)

  const items = usePosStore((s) => s.items)
  const customerId = usePosStore((s) => s.customerId)
  const voucherCode = usePosStore((s) => s.voucherCode)
  const pointsRequested = usePosStore((s) => s.pointsRequested)
  const exchangeReturnId = usePosStore((s) => s.exchangeReturnId)
  const draftId = usePosStore((s) => s.draftId)
  const addProduct = usePosStore((s) => s.addProduct)

  const shiftQuery = useQuery({ queryKey: queryKeys.shifts.current, queryFn: () => shiftsService.getCurrentShift() })
  const shift = shiftQuery.data?.data.shift ?? null
  const noShift = shiftQuery.isSuccess && !shift

  const cart: CartInput = useMemo(
    () => ({ items, customerId, voucherCode: voucherCode.trim() || null, pointsRequested, exchangeReturnId }),
    [items, customerId, voucherCode, pointsRequested, exchangeReturnId]
  )
  const quoteQuery = useQuery({
    queryKey: queryKeys.pos.quote(cart),
    queryFn: () => ordersService.quote(cart),
    enabled: items.length > 0,
    placeholderData: (prev) => prev,
    retry: false,
  })
  const quote = items.length > 0 && !quoteQuery.isError ? quoteQuery.data?.data : undefined
  const draftsCount = useQuery({ queryKey: queryKeys.pos.drafts, queryFn: () => ordersService.drafts() }).data?.data.length ?? 0

  const afterChange = () => {
    for (const key of [queryKeys.pos.all, queryKeys.shifts.all, queryKeys.orders.all, queryKeys.customers.all, queryKeys.stock.all]) {
      void queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const complete = useMutation({
    mutationFn: () => {
      const s = usePosStore.getState()
      return ordersService.complete({
        ...cart,
        paymentMethod: s.paymentMethod,
        amountReceived: s.paymentMethod === 'CASH' ? Number(s.amountReceived) || 0 : null,
        draftId: s.draftId,
        pointsRequested: quote?.pointsUsed ?? cart.pointsRequested,
      })
    },
    onSuccess: (res) => {
      setReceipt(res.data)
      usePosStore.getState().reset()
      afterChange()
    },
    onError: (e) => {
      toast.error(getErrorMessage(e))
      afterChange()
    },
  })

  const saveDraft = useMutation({
    mutationFn: () => ordersService.saveDraft({ ...cart, draftId }),
    onSuccess: (res) => {
      toast.success(`Đã lưu đơn nháp ${res.data.orderCode}`)
      usePosStore.getState().reset()
      afterChange()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const onAdd = useCallback(
    (p: PosProduct) => {
      addProduct(p.id, p.productName)
    },
    [addProduct]
  )

  const canComplete = !noShift && items.length > 0 && Boolean(quote) && quote!.issues.length === 0
  const completeRef = useRef<() => void>(() => undefined)
  completeRef.current = () => {
    if (!canComplete || complete.isPending) return
    const s = usePosStore.getState()
    if (s.paymentMethod === 'CASH' && (Number(s.amountReceived) || 0) < (quote?.amountDue ?? 0)) {
      toast.error('Khách đưa thiếu tiền, chưa thể hoàn tất')
      return
    }
    complete.mutate()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const focusers: Record<string, () => void> = {
        F1: () => searchRef.current?.focus(),
        F2: () => scanRef.current?.focus(),
        F3: () => phoneRef.current?.focus(),
        F4: () => navigate('/returns'),
        F8: () => navigate('/shifts', { state: { closeShift: true } }),
        F9: () => completeRef.current(),
      }
      const action = focusers[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Màn hình thu ngân POS</h1>
          <p className="text-xs text-muted">
            {shift ? `Ca ${shift.shiftCode} · mở lúc ${formatDateTime(shift.openedAt)}` : 'Chưa mở ca làm việc'}
            {draftId !== null && ' · đang sửa đơn nháp'}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<FileClock className="size-4" aria-hidden="true" />} onClick={() => setShowDrafts(true)}>
          Đơn nháp{draftsCount > 0 ? ` (${draftsCount})` : ''}
        </Button>
      </div>

      {noShift && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Chưa mở ca nên chưa thể lập đơn. Mở ca và nhập tiền đầu ca để bắt đầu bán hàng.
          </p>
          {canOpenShift && <Button onClick={openShiftModal}>Mở ca</Button>}
        </div>
      )}
      {exchangeReturnId !== null && (
        <p className="rounded-2xl border border-info/30 bg-info-soft p-3 text-sm text-info">
          Đơn mua hàng đổi: giá trị hàng trả được trừ vào đơn. Tổng hàng mới phải lớn hơn hoặc bằng giá trị hàng cũ; phần vượt khách nộp thêm.
        </p>
      )}
      {quoteQuery.isError && items.length > 0 && (
        <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger">
          {getErrorMessage(quoteQuery.error)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <ProductSearchPanel searchRef={searchRef} scanRef={scanRef} disabled={noShift} onAdd={onAdd} />
        <div className="space-y-4">
          <CustomerPanel phoneRef={phoneRef} quote={quote} disabled={noShift} />
          <CartPanel quote={quote} disabled={noShift} />
          <PaymentPanel
            quote={quote}
            quoting={quoteQuery.isFetching}
            disabled={noShift}
            completing={complete.isPending}
            savingDraft={saveDraft.isPending}
            onComplete={() => completeRef.current()}
            onSaveDraft={() => saveDraft.mutate()}
            onReturn={() => navigate('/returns')}
          />
        </div>
      </div>

      {showDrafts && <DraftsModal onClose={() => setShowDrafts(false)} />}
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}
