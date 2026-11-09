import { forwardRef, useCallback, useEffect, useState, type InputHTMLAttributes } from 'react'

function digitsAndDecimal(value: string): string {
  const cleaned = value.replace(/,/g, '').replace(/[^\d.-]/g, '')
  const negative = cleaned.startsWith('-') ? '-' : ''
  const unsigned = cleaned.replace(/-/g, '')
  const [integer = '', ...fraction] = unsigned.split('.')
  return `${negative}${integer}${fraction.length ? `.${fraction.join('')}` : ''}`
}

function groupDigits(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  const raw = digitsAndDecimal(String(value))
  const negative = raw.startsWith('-') ? '-' : ''
  const unsigned = negative ? raw.slice(1) : raw
  const [integer = '', ...fraction] = unsigned.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative}${grouped}${fraction.length ? `.${fraction.join('')}` : ''}`
}

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> {
  type?: 'number' | 'text'
  value?: string | number
  defaultValue?: string | number
  valueAsNumber?: boolean
  setValueAs?: (value: unknown) => unknown
}

/** Text input that groups digits for display while exposing plain numeric text to callbacks. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, defaultValue, onChange, inputMode, type: _type, valueAsNumber: _valueAsNumber, setValueAs: _setValueAs, ...rest },
  forwardedRef
) {
  const controlled = value !== undefined
  const [display, setDisplay] = useState(() => groupDigits(value ?? defaultValue))

  useEffect(() => {
    if (controlled) setDisplay(groupDigits(value))
  }, [controlled, value])

  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
      if (node) node.value = groupDigits(node.value)
    },
    [forwardedRef]
  )

  return (
    <input
      {...rest}
      ref={setRef}
      type="text"
      inputMode={inputMode ?? 'decimal'}
      value={controlled ? display : undefined}
      defaultValue={controlled ? undefined : defaultValue}
      onChange={(event) => {
        const raw = digitsAndDecimal(event.currentTarget.value)
        setDisplay(groupDigits(raw))
        event.currentTarget.value = raw
        onChange?.(event)
        event.currentTarget.value = groupDigits(raw)
      }}
    />
  )
})
