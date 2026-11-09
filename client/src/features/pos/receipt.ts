import { PAYMENT_METHOD_LABELS, type OrderRecord } from '../../types/pos'
import type { StoreInfo } from '../../types/settings'
import { formatCurrency, formatDateTime } from '../../utils/format'

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** HTML hóa đơn in ra khổ 80mm. */
export function buildReceiptHtml(order: OrderRecord, store: StoreInfo | undefined): string {
  const rows = order.lines
    .map(
      (l) =>
        `<tr><td>${esc(l.productName)}<br><small>Lô ${esc(l.lotCode)} · ${l.quantity} × ${formatCurrency(l.unitPrice)}${l.lineType === 'GIFT' ? ' (quà tặng)' : ''}</small></td><td style="text-align:right">${formatCurrency(l.lineTotal)}</td></tr>`
    )
    .join('')
  const line = (label: string, value: string) => `<tr><td>${label}</td><td style="text-align:right">${value}</td></tr>`
  const discounts = [
    order.lineDiscountAmount > 0 ? line('Giảm khuyến mãi', `−${formatCurrency(order.lineDiscountAmount)}`) : '',
    order.tierDiscountAmount > 0 ? line('Giảm hạng thẻ', `−${formatCurrency(order.tierDiscountAmount)}`) : '',
    order.orderDiscountAmount > 0 ? line('Giảm hóa đơn', `−${formatCurrency(order.orderDiscountAmount)}`) : '',
    order.pointsDiscountAmount > 0 ? line(`Dùng ${order.pointsUsed} điểm`, `−${formatCurrency(order.pointsDiscountAmount)}`) : '',
    order.exchangeCreditAmount > 0 ? line('Trừ giá trị hàng đổi', `−${formatCurrency(order.exchangeCreditAmount)}`) : '',
  ].join('')
  const due = order.totalAmount - order.exchangeCreditAmount
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(order.orderCode)}</title>
<style>body{font-family:Arial,sans-serif;width:72mm;margin:0 auto;font-size:12px;color:#000}h1{font-size:15px;text-align:center;margin:8px 0 2px}
p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse;margin-top:6px}td{padding:3px 0;vertical-align:top}small{color:#444}
.total td{font-weight:bold;font-size:14px;border-top:1px dashed #000;padding-top:6px}</style></head><body>
<h1>${esc(store?.name ?? 'Cửa hàng')}</h1><p>${esc(store?.address ?? '')}</p><p>${esc(store?.phone ?? '')}</p>
<p><b>HÓA ĐƠN BÁN HÀNG</b></p><p>${esc(order.orderCode)} · ${esc(formatDateTime(order.completedAt))}</p>
<p>Thu ngân: ${esc(order.cashierName)}${order.customerName ? ` · Khách: ${esc(order.customerName)}` : ''}</p>
<table>${rows}</table><table>${line('Tổng tiền hàng', formatCurrency(order.subtotalAmount))}${discounts}
<tr class="total"><td>KHÁCH PHẢI TRẢ</td><td style="text-align:right">${formatCurrency(due)}</td></tr>
${line('Đã gồm VAT', formatCurrency(order.taxAmount))}${line('Thanh toán', order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] : '')}
${order.amountReceived !== null ? line('Tiền khách đưa', formatCurrency(order.amountReceived)) + line('Tiền thừa', formatCurrency(order.changeDue ?? 0)) : ''}</table>
<p style="margin-top:10px">Cảm ơn quý khách!</p></body></html>`
}

/**
 * In bằng khung ẩn trong trang (không dùng `window.open` nên không bị trình duyệt chặn popup).
 * Trả `false` nếu không in được (lỗi in không chặn đơn, luật 39).
 */
export function printReceipt(html: string): boolean {
  let frame: HTMLIFrameElement | null = null
  try {
    frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.setAttribute('title', 'Hóa đơn in')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(frame)
    const win = frame.contentWindow
    const doc = frame.contentDocument
    if (!win || !doc) {
      frame.remove()
      return false
    }
    doc.open()
    doc.write(html)
    doc.close()
    const target = frame
    const cleanup = () => window.setTimeout(() => target.remove(), 500)
    win.addEventListener('afterprint', cleanup)
    window.setTimeout(() => target.remove(), 120_000)
    win.focus()
    win.print()
    return true
  } catch {
    frame?.remove()
    return false
  }
}
