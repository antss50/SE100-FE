import type { ProductItem } from '../../types/api'
import type {
  Batch,
  PurchaseOrderDetail,
  PurchaseOrderLine,
  StockMovement,
} from '../../types/stock'
import type { Supplier } from '../../types/suppliers'
import { addDays, toDateOnly, toIsoLocal } from '../time'
import { SEED_USERS } from './users'

/** Cấu hình hệ thống mock (SYSTEM_SETTINGS). Màn cấu hình đầy đủ làm ở GĐ2 (AUTH-07). */
export const SEED_SYSTEM_SETTINGS: Record<string, string> = {
  EXPIRY_WARNING_DAYS: '60',
}

interface LotSeed {
  sku: string
  lotCode: string
  /** Hạn dùng tính theo số ngày so với hôm nay (âm = đã hết hạn). */
  expInDays: number
  mfgDaysAgo: number
  qty: number
  cost: number
  blocked?: number
}

interface PoSeed {
  supplierCode: string
  invoice: string
  daysAgo: number
  lots: LotSeed[]
}

/**
 * Dữ liệu kho tất định, ngày tính tương đối hôm nay để trạng thái cận hạn luôn đúng.
 * Gồm: nhiều lô trên một sản phẩm, lô cận hạn (≤ 60 ngày), lô hết hạn, lô cách ly,
 * lô tester hãng; 5 phiếu nhập COMPLETED và 1 phiếu DRAFT.
 */
const COMPLETED_POS: PoSeed[] = [
  {
    supplierCode: 'NCC004',
    invoice: 'HD-NAOS-0412',
    daysAgo: 200,
    lots: [
      { sku: 'SKU-BIO-H2O500', lotCode: 'LOT-BIO-2301', expInDays: -10, mfgDaysAgo: 560, qty: 8, cost: 250000 },
      { sku: 'SKU-BIO-H2O500', lotCode: 'LOT-BIO-2482', expInDays: 450, mfgDaysAgo: 220, qty: 58, cost: 255000 },
    ],
  },
  {
    supplierCode: 'NCC005',
    invoice: 'HD-LUXE-7781',
    daysAgo: 150,
    lots: [
      { sku: 'SKU-YSL-RPC196', lotCode: 'LOT-YSL-2390', expInDays: 12, mfgDaysAgo: 700, qty: 6, cost: 600000 },
      { sku: 'SKU-YSL-RPC196', lotCode: 'LOT-YSL-2481', expInDays: 73, mfgDaysAgo: 600, qty: 28, cost: 620000 },
      { sku: 'SKU-YSL-RPC196', lotCode: 'LOT-YSL-2482', expInDays: 300, mfgDaysAgo: 400, qty: 40, cost: 640000 },
      { sku: 'SKU-YSL-RPC196-TST', lotCode: 'LOT-YSL-TST-9981', expInDays: 500, mfgDaysAgo: 200, qty: 3, cost: 0 },
      { sku: 'SKU-LRP-ANT50', lotCode: 'LOT-LRP-2288', expInDays: -30, mfgDaysAgo: 1000, qty: 12, cost: 310000, blocked: 12 },
      { sku: 'SKU-LRP-ANT50', lotCode: 'LOT-LRP-2504', expInDays: 380, mfgDaysAgo: 300, qty: 25, cost: 320000 },
      { sku: 'SKU-KIE-MID30', lotCode: 'LOT-KIE-2502', expInDays: 250, mfgDaysAgo: 400, qty: 18, cost: 690000 },
    ],
  },
  {
    supplierCode: 'NCC001',
    invoice: 'HD-ELVN-883921',
    daysAgo: 120,
    lots: [
      { sku: 'SKU-EL-ANR50', lotCode: 'LOT-EL-2311', expInDays: 38, mfgDaysAgo: 700, qty: 45, cost: 1850000, blocked: 5 },
      { sku: 'SKU-EL-ANR50', lotCode: 'LOT-EL-2408', expInDays: 420, mfgDaysAgo: 200, qty: 60, cost: 1880000 },
      { sku: 'SKU-CLI-DDML125', lotCode: 'LOT-CLI-2503', expInDays: 600, mfgDaysAgo: 100, qty: 3, cost: 420000 },
    ],
  },
  {
    supplierCode: 'NCC002',
    invoice: 'HD-AMORE-5521',
    daysAgo: 60,
    lots: [
      { sku: 'SKU-ROM-JLT06', lotCode: 'LOT-ROM-2410', expInDays: 25, mfgDaysAgo: 700, qty: 20, cost: 85000 },
      { sku: 'SKU-ROM-JLT06', lotCode: 'LOT-ROM-2503', expInDays: 400, mfgDaysAgo: 200, qty: 35, cost: 88000 },
    ],
  },
  {
    supplierCode: 'NCC003',
    invoice: 'HD-SHI-0098',
    daysAgo: 45,
    lots: [
      { sku: 'SKU-ANE-UV60', lotCode: 'LOT-ANE-2501', expInDays: 200, mfgDaysAgo: 500, qty: 30, cost: 380000 },
      { sku: 'SKU-ANE-UV60', lotCode: 'LOT-ANE-2502', expInDays: 500, mfgDaysAgo: 150, qty: 40, cost: 390000 },
    ],
  },
]

const DRAFT_PO = {
  supplierCode: 'NCC001',
  invoice: 'HD-ELVN-884102',
  note: 'Bổ sung hàng cho mùa lễ hội, chờ đối chiếu hóa đơn.',
  lines: [{ sku: 'SKU-EL-ANR50', lotCode: 'LOT-EL-2512', expInDays: 700, mfgDaysAgo: 30, qty: 24, cost: 1900000 }],
}

export interface StockSeed {
  batches: Batch[]
  stockMovements: StockMovement[]
  purchaseOrders: PurchaseOrderDetail[]
}

export function seedStock(today: Date, suppliers: Supplier[], products: ProductItem[]): StockSeed {
  const staff = SEED_USERS.find((u) => u.username === 'inventory01') ?? SEED_USERS[0]
  const productBySku = (sku: string) => {
    const p = products.find((x) => x.sku === sku)
    if (!p?.id) throw new Error(`Seed kho: thiếu sản phẩm ${sku}`)
    return p
  }
  const supplierByCode = (code: string) => {
    const s = suppliers.find((x) => x.supplierCode === code)
    if (!s) throw new Error(`Seed kho: thiếu nhà cung cấp ${code}`)
    return s
  }

  const batches: Batch[] = []
  const movements: StockMovement[] = []
  const orders: PurchaseOrderDetail[] = []
  let lineId = 0

  const makeLine = (lot: Omit<LotSeed, 'blocked'>, batchId: number | null): PurchaseOrderLine => {
    const product = productBySku(lot.sku)
    lineId += 1
    return {
      id: lineId,
      productId: product.id as number,
      sku: product.sku,
      productName: product.productName,
      lotCode: lot.lotCode,
      mfgDate: toDateOnly(addDays(today, -lot.mfgDaysAgo)),
      expDate: toDateOnly(addDays(today, lot.expInDays)),
      quantity: lot.qty,
      unitCost: lot.cost,
      lineTotal: lot.qty * lot.cost,
      batchId,
    }
  }

  COMPLETED_POS.forEach((po, index) => {
    const supplier = supplierByCode(po.supplierCode)
    const confirmed = addDays(today, -po.daysAgo)
    confirmed.setHours(9, 30, 0, 0)
    const poId = index + 1
    const poCode = `PN${toDateOnly(confirmed).replaceAll('-', '')}-01`
    const lines = po.lots.map((lot) => {
      const batchId = batches.length + 1
      batches.push({
        id: batchId,
        productId: productBySku(lot.sku).id as number,
        lotCode: lot.lotCode,
        mfgDate: toDateOnly(addDays(today, -lot.mfgDaysAgo)),
        expDate: toDateOnly(addDays(today, lot.expInDays)),
        costPrice: lot.cost,
        onHandQty: lot.qty,
        blockedQty: lot.blocked ?? 0,
        lockedByCheckId: null,
        createdAt: toIsoLocal(confirmed),
      })
      movements.push({
        id: movements.length + 1,
        batchId,
        referenceType: 'PURCHASE',
        referenceId: poId,
        quantityChange: lot.qty,
        balanceAfter: lot.qty,
        reason: `Nhập kho theo phiếu ${poCode}`,
        createdBy: staff.id,
        createdAt: toIsoLocal(confirmed),
      })
      return makeLine(lot, batchId)
    })
    orders.push({
      id: poId,
      poCode,
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
      supplierInvoiceNo: po.invoice,
      totalAmount: lines.reduce((n, l) => n + l.lineTotal, 0),
      status: 'COMPLETED',
      note: null,
      createdBy: staff.id,
      createdByName: staff.fullName,
      createdAt: toIsoLocal(confirmed),
      confirmedAt: toIsoLocal(confirmed),
      lineCount: lines.length,
      totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
      lines,
    })
  })

  const supplier = supplierByCode(DRAFT_PO.supplierCode)
  const draftCreated = addDays(today, -1)
  draftCreated.setHours(14, 5, 0, 0)
  const draftLines = DRAFT_PO.lines.map((l) => makeLine(l, null))
  orders.push({
    id: orders.length + 1,
    poCode: `PN${toDateOnly(draftCreated).replaceAll('-', '')}-01`,
    supplierId: supplier.id,
    supplierCode: supplier.supplierCode,
    supplierName: supplier.supplierName,
    supplierInvoiceNo: DRAFT_PO.invoice,
    totalAmount: draftLines.reduce((n, l) => n + l.lineTotal, 0),
    status: 'DRAFT',
    note: DRAFT_PO.note,
    createdBy: staff.id,
    createdByName: staff.fullName,
    createdAt: toIsoLocal(draftCreated),
    confirmedAt: null,
    lineCount: draftLines.length,
    totalQuantity: draftLines.reduce((n, l) => n + l.quantity, 0),
    lines: draftLines,
  })

  return { batches, stockMovements: movements, purchaseOrders: orders }
}
