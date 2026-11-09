import { useMutation } from '@tanstack/react-query'
import { ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, toast } from '../../components/ui'
import { stockService } from '../../services/stock.service'
import { getErrorMessage } from '../../utils/error'
import { formatDate, formatNumber } from '../../utils/format'
import { ExpiryBadge } from './ExpiryBadge'

interface Props {
  /** Focus ô quét ngay khi mở (nút "Quét FEFO" ở header, D19). */
  autoFocus?: boolean
  showDetailLink: boolean
}

/** Ô quét barcode/SKU: hiện các lô của sản phẩm theo thứ tự FEFO (D19, Q1). Phím tắt F2. */
export function FefoScanPanel({ autoFocus, showDetailLink }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [autoFocus])

  const lookup = useMutation({
    mutationFn: (value: string) => stockService.fefo(value),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const result = lookup.data?.data

  return (
    <section className="rounded-2xl border border-line bg-white p-4" aria-label="Quét FEFO">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) lookup.mutate(code.trim())
        }}
      >
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Quét mã vạch hoặc nhập SKU</span>
          <ScanLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent" aria-hidden="true" />
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Quét mã vạch hoặc nhập SKU rồi Enter để xem lô xuất trước theo FEFO (F2)"
            className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
        <Button type="submit" loading={lookup.isPending}>
          Tra cứu FEFO
        </Button>
      </form>
      {result && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink">
            {result.productName} <span className="font-mono text-xs font-normal text-muted">{result.sku}</span>
          </p>
          {result.batches.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Không có lô nào bán được (hết hàng, hết hạn, cách ly hoặc đang khóa kiểm kho).</p>
          ) : (
            <ol className="mt-2 divide-y divide-line rounded-xl border border-line">
              {result.batches.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {b.fefoRank}
                  </span>
                  {showDetailLink ? (
                    <Link to={`/stock/${b.id}`} className="font-mono font-semibold text-accent hover:underline">
                      {b.lotCode}
                    </Link>
                  ) : (
                    <span className="font-mono font-semibold">{b.lotCode}</span>
                  )}
                  <span>HSD {formatDate(b.expDate)}</span>
                  <ExpiryBadge status={b.expiryStatus} days={b.daysToExpiry} />
                  <span className="ml-auto font-semibold">Bán được: {formatNumber(b.availableQty)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
