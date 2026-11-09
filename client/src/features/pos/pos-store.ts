import { create } from 'zustand'
import type { CartInput, CartItemInput, PaymentMethod } from '../../types/pos'

/** Giỏ hàng nháp phía client (CLAUDE.md mục 4: Zustand chỉ cho state client). Giá và lô luôn do máy chủ tính. */
interface PosState {
  items: CartItemInput[]
  /** Tên hiển thị của sản phẩm trong giỏ (chỉ để vẽ giao diện). */
  names: Record<number, string>
  customerId: number | null
  voucherCode: string
  pointsRequested: number
  draftId: number | null
  exchangeReturnId: number | null
  paymentMethod: PaymentMethod
  amountReceived: string
  addProduct: (productId: number, name: string, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  setBatch: (productId: number, batchId: number | null) => void
  removeProduct: (productId: number) => void
  setCustomer: (customerId: number | null) => void
  setVoucher: (code: string) => void
  setPoints: (points: number) => void
  setPayment: (method: PaymentMethod) => void
  setReceived: (value: string) => void
  loadDraft: (cart: CartInput, draftId: number, names: Record<number, string>) => void
  setDraftId: (id: number | null) => void
  startExchange: (returnId: number) => void
  reset: () => void
}

const INITIAL = {
  items: [] as CartItemInput[],
  names: {} as Record<number, string>,
  customerId: null as number | null,
  voucherCode: '',
  pointsRequested: 0,
  draftId: null as number | null,
  exchangeReturnId: null as number | null,
  paymentMethod: 'CASH' as PaymentMethod,
  amountReceived: '',
}

export const usePosStore = create<PosState>((set) => ({
  ...INITIAL,
  addProduct: (productId, name, quantity = 1) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === productId)
      return {
        names: { ...s.names, [productId]: name },
        items: existing
          ? s.items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i))
          : [...s.items, { productId, quantity, batchId: null }],
      }
    }),
  setQuantity: (productId, quantity) =>
    set((s) => ({
      items: quantity <= 0 ? s.items.filter((i) => i.productId !== productId) : s.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    })),
  setBatch: (productId, batchId) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, batchId } : i)) })),
  removeProduct: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
  setCustomer: (customerId) => set({ customerId, pointsRequested: 0, voucherCode: '' }),
  setVoucher: (voucherCode) => set({ voucherCode }),
  setPoints: (pointsRequested) => set({ pointsRequested }),
  setPayment: (paymentMethod) => set({ paymentMethod }),
  setReceived: (amountReceived) => set({ amountReceived }),
  loadDraft: (cart, draftId, names) =>
    set({
      ...INITIAL,
      names,
      items: cart.items,
      customerId: cart.customerId,
      voucherCode: cart.voucherCode ?? '',
      pointsRequested: cart.pointsRequested,
      exchangeReturnId: cart.exchangeReturnId ?? null,
      draftId,
    }),
  setDraftId: (draftId) => set({ draftId }),
  startExchange: (exchangeReturnId) => set({ ...INITIAL, exchangeReturnId }),
  reset: () => set({ ...INITIAL }),
}))

/** Giỏ hàng gửi lên máy chủ. */
export function selectCart(s: PosState): CartInput {
  return {
    items: s.items,
    customerId: s.customerId,
    voucherCode: s.voucherCode.trim() || null,
    pointsRequested: s.pointsRequested,
    exchangeReturnId: s.exchangeReturnId,
  }
}
