import type { ProductItem } from '../../types/api'
import type { DisposalDetail, InventoryCheckDetail } from '../../types/inventory'
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
  POINT_EARN_AMOUNT: '10000',
  POINT_REDEEM_VALUE: '100',
  POINT_MAX_REDEEM_PERCENT: '50',
  STORE_NAME: 'Lumina Beauty',
  STORE_ADDRESS: '124 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
  STORE_PHONE: '028 3822 0000',
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
  inventoryChecks: InventoryCheckDetail[]
  disposals: DisposalDetail[]
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

  const { inventoryChecks, disposals } = seedAdjustments(today, batches, movements, products)
  return { batches, stockMovements: movements, purchaseOrders: orders, inventoryChecks, disposals }
}

/**
 * Phiếu kiểm kho và xuất khác mẫu, đã phản ánh vào tồn và thẻ kho để dữ liệu nhất quán
 * (tồn lô = tổng biến động thẻ kho; `0 ≤ blocked ≤ onHand`).
 */
function seedAdjustments(
  today: Date,
  batches: Batch[],
  movements: StockMovement[],
  products: ProductItem[]
): { inventoryChecks: InventoryCheckDetail[]; disposals: DisposalDetail[] } {
  const staff = SEED_USERS.find((u) => u.username === 'inventory01') ?? SEED_USERS[0]
  const manager = SEED_USERS.find((u) => u.username === 'manager01') ?? SEED_USERS[0]
  const at = (daysAgo: number, hour: number) => {
    const d = addDays(today, -daysAgo)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const batchOf = (lotCode: string) => {
    const b = batches.find((x) => x.lotCode === lotCode)
    if (!b) throw new Error(`Seed kho: thiếu lô ${lotCode}`)
    return b
  }
  const productOf = (productId: number) => products.find((p) => p.id === productId)
  const move = (
    b: Batch,
    referenceType: StockMovement['referenceType'],
    referenceId: number,
    change: number,
    when: Date,
    by: number,
    reason: string
  ) => {
    b.onHandQty += change
    movements.push({
      id: movements.length + 1,
      batchId: b.id,
      referenceType,
      referenceId,
      quantityChange: change,
      balanceAfter: b.onHandQty,
      reason,
      createdBy: by,
      createdAt: toIsoLocal(when),
    })
  }
  const checkLine = (id: number, lotCode: string, snapshotQty: number, countedQty: number | null, note: string | null) => {
    const b = batchOf(lotCode)
    const p = productOf(b.productId)
    return {
      id,
      batchId: b.id,
      productId: b.productId,
      sku: p?.sku ?? '',
      productName: p?.productName ?? '',
      lotCode,
      expDate: b.expDate,
      snapshotQty,
      countedQty,
      differenceQty: countedQty === null ? null : countedQty - snapshotQty,
      note,
    }
  }
  const disposalLine = (
    id: number,
    lotCode: string,
    quantity: number,
    blockedAddedQty: number,
    unitCost: number | null,
    itemReason: string
  ) => {
    const b = batchOf(lotCode)
    const p = productOf(b.productId)
    return {
      id,
      batchId: b.id,
      productId: b.productId,
      sku: p?.sku ?? '',
      productName: p?.productName ?? '',
      lotCode,
      expDate: b.expDate,
      quantity,
      blockedAddedQty,
      unitCost,
      itemReason,
    }
  }
  const totals = (lines: { differenceQty: number | null }[]) => {
    const counted = lines.filter((l) => l.differenceQty !== null)
    return {
      lineCount: lines.length,
      differenceLineCount: counted.filter((l) => l.differenceQty !== 0).length,
      totalDifference: counted.reduce((n, l) => n + (l.differenceQty ?? 0), 0),
    }
  }
  const code = (prefix: string, when: Date) => `${prefix}${toDateOnly(when).replaceAll('-', '')}-01`

  // Kiểm kho: 1 đã duyệt (điều chỉnh -1), 1 chờ duyệt, 1 không chênh lệch, 1 bị từ chối.
  const approvedAt = at(10, 16)
  const aneLines = [checkLine(1, 'LOT-ANE-2501', 30, 29, 'Thiếu 1 chai khi đối chiếu kệ')]
  move(batchOf('LOT-ANE-2501'), 'CHECK_ADJUST', 1, -1, approvedAt, manager.id, 'Điều chỉnh theo phiếu kiểm kho: thiếu 1 chai')
  const waitingLines = [checkLine(2, 'LOT-KIE-2502', 18, 17, 'Hộp móp, đã tách riêng chờ kiểm tra')]
  const noDiffLines = [checkLine(3, 'LOT-EL-2408', 60, 60, null)]
  const rejectedLines = [checkLine(4, 'LOT-CLI-2503', 3, 2, 'Không tìm thấy 1 chai')]
  const base = { createdBy: staff.id, createdByName: staff.fullName, approvedBy: null, approvedByName: null, approvedAt: null, rejectReason: null }
  const inventoryChecks: InventoryCheckDetail[] = [
    {
      ...base,
      id: 1,
      checkCode: code('CHK', at(11, 9)),
      scopeNote: 'Kiểm kê nhóm chống nắng cuối tháng',
      status: 'APPROVED',
      snapshotAt: toIsoLocal(at(11, 9)),
      submittedAt: toIsoLocal(at(11, 11)),
      approvedBy: manager.id,
      approvedByName: manager.fullName,
      approvedAt: toIsoLocal(approvedAt),
      ...totals(aneLines),
      lines: aneLines,
    },
    {
      ...base,
      id: 2,
      checkCode: code('CHK', at(4, 9)),
      scopeNote: 'Kiểm kê nhóm dưỡng da cao cấp',
      status: 'WAITING_APPROVAL',
      snapshotAt: toIsoLocal(at(4, 9)),
      submittedAt: toIsoLocal(at(4, 11)),
      ...totals(waitingLines),
      lines: waitingLines,
    },
    {
      ...base,
      id: 3,
      checkCode: code('CHK', at(20, 9)),
      scopeNote: 'Kiểm kê định kỳ lô Estée Lauder',
      status: 'NO_DIFFERENCE',
      snapshotAt: toIsoLocal(at(20, 9)),
      submittedAt: toIsoLocal(at(20, 10)),
      ...totals(noDiffLines),
      lines: noDiffLines,
    },
    {
      ...base,
      id: 4,
      checkCode: code('CHK', at(30, 9)),
      scopeNote: 'Kiểm kê hàng ít tồn',
      status: 'REJECTED',
      snapshotAt: toIsoLocal(at(30, 9)),
      submittedAt: toIsoLocal(at(30, 10)),
      approvedBy: manager.id,
      approvedByName: manager.fullName,
      approvedAt: toIsoLocal(at(30, 15)),
      rejectReason: 'Số đếm chưa chắc chắn, kiểm lại trước khi gửi duyệt',
      ...totals(rejectedLines),
      lines: rejectedLines,
    },
  ]

  // Xuất khác: 1 tester đã duyệt (trừ 2 son), 1 hủy chờ duyệt (lô hết hạn đã cách ly sẵn).
  const testerAt = at(15, 15)
  const romCost = batchOf('LOT-ROM-2410').costPrice
  move(batchOf('LOT-ROM-2410'), 'TESTER', 1, -2, testerAt, manager.id, `${code('DISP', at(15, 10))}: đưa ra quầy làm tester`)
  const testerLines = [disposalLine(1, 'LOT-ROM-2410', 2, 2, romCost, 'Lô cận hạn nhất')]
  const destroyLines = [disposalLine(2, 'LOT-LRP-2288', 12, 0, null, 'Quá hạn dùng, đã cách ly')]
  const disposals: DisposalDetail[] = [
    {
      id: 1,
      disposalCode: code('DISP', at(15, 10)),
      issueType: 'TESTER',
      reasonCode: 'TESTER_USE',
      status: 'APPROVED',
      reason: 'Đưa 2 son tint ra quầy cho khách dùng thử',
      requestedBy: staff.id,
      requestedByName: staff.fullName,
      createdAt: toIsoLocal(at(15, 10)),
      approvedBy: manager.id,
      approvedByName: manager.fullName,
      approvedAt: toIsoLocal(testerAt),
      rejectReason: null,
      lineCount: 1,
      totalQuantity: 2,
      totalCost: 2 * romCost,
      lines: testerLines,
    },
    {
      id: 2,
      disposalCode: code('DISP', at(2, 14)),
      issueType: 'DESTROY',
      reasonCode: 'EXPIRED',
      status: 'WAITING_APPROVAL',
      reason: 'Lô kem chống nắng đã quá hạn dùng, đề nghị tiêu hủy',
      requestedBy: staff.id,
      requestedByName: staff.fullName,
      createdAt: toIsoLocal(at(2, 14)),
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      rejectReason: null,
      lineCount: 1,
      totalQuantity: 12,
      totalCost: null,
      lines: destroyLines,
    },
  ]
  return { inventoryChecks, disposals }
}
