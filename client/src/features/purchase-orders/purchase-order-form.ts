import { z } from 'zod'
import type { PurchaseOrderDetail, PurchaseOrderInput, PurchaseOrderLineInput } from '../../types/stock'

const lineSchema = z.object({
  productId: z.string().min(1, 'Chọn sản phẩm'),
  lotCode: z.string().trim().min(1, 'Nhập mã lô').max(50, 'Tối đa 50 ký tự'),
  mfgDate: z.string().optional(),
  expDate: z.string().min(1, 'Nhập hạn dùng'),
  quantity: z.number({ error: 'Nhập số lượng' }).int('Số nguyên').min(1, 'Lớn hơn 0'),
  unitCost: z.number({ error: 'Nhập giá nhập' }).int('Số nguyên').min(0, 'Không âm'),
})

export const purchaseOrderFormSchema = z
  .object({
    supplierId: z.string().min(1, 'Vui lòng chọn nhà cung cấp'),
    supplierInvoiceNo: z.string().trim().max(50, 'Tối đa 50 ký tự').optional(),
    note: z.string().trim().optional(),
    lines: z.array(lineSchema).min(1, 'Phiếu nhập phải có ít nhất một dòng'),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>()
    value.lines.forEach((line, index) => {
      const key = `${line.productId}|${line.lotCode.trim().toLowerCase()}`
      if (line.productId && line.lotCode.trim() && seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['lines', index, 'lotCode'], message: 'Mã lô bị trùng trong phiếu' })
      }
      seen.add(key)
      if (line.mfgDate && line.expDate && line.mfgDate > line.expDate) {
        ctx.addIssue({ code: 'custom', path: ['lines', index, 'mfgDate'], message: 'NSX phải trước HSD' })
      }
    })
  })

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>

export const EMPTY_LINE: PurchaseOrderFormValues['lines'][number] = {
  productId: '',
  lotCode: '',
  mfgDate: '',
  expDate: '',
  quantity: 1,
  unitCost: 0,
}

export function toLineInputs(lines: PurchaseOrderFormValues['lines']): PurchaseOrderLineInput[] {
  return lines.map((l) => ({
    productId: Number(l.productId) || 0,
    lotCode: l.lotCode.trim(),
    mfgDate: l.mfgDate || undefined,
    expDate: l.expDate,
    quantity: Number.isFinite(l.quantity) ? l.quantity : 0,
    unitCost: Number.isFinite(l.unitCost) ? l.unitCost : 0,
  }))
}

export function toOrderInput(values: PurchaseOrderFormValues): PurchaseOrderInput {
  return {
    supplierId: Number(values.supplierId),
    supplierInvoiceNo: values.supplierInvoiceNo || undefined,
    note: values.note || undefined,
    lines: toLineInputs(values.lines),
  }
}

export function fromOrder(order: PurchaseOrderDetail): PurchaseOrderFormValues {
  return {
    supplierId: String(order.supplierId),
    supplierInvoiceNo: order.supplierInvoiceNo ?? '',
    note: order.note ?? '',
    lines: order.lines.map((l) => ({
      productId: String(l.productId),
      lotCode: l.lotCode,
      mfgDate: l.mfgDate ?? '',
      expDate: l.expDate,
      quantity: l.quantity,
      unitCost: l.unitCost,
    })),
  }
}
