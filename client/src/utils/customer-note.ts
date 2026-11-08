export interface StructuredCustomerNote {
  skinConcerns: string[]
  allergyNote: string
  favoriteBrands: string
  careNote: string
}

const CONCERNS_PREFIX = '[Tình trạng da]: '
const ALLERGY_PREFIX = '[Dị ứng]: '
const BRANDS_PREFIX = '[Brand chuộng]: '
const NOTE_PREFIX = '[Ghi chú]: '

export function serializeCustomerNote(data: StructuredCustomerNote): string {
  const parts: string[] = []
  if (data.skinConcerns && data.skinConcerns.length > 0) {
    parts.push(`${CONCERNS_PREFIX}${data.skinConcerns.join(', ')}`)
  }
  if (data.allergyNote?.trim()) {
    parts.push(`${ALLERGY_PREFIX}${data.allergyNote.trim()}`)
  }
  if (data.favoriteBrands?.trim()) {
    parts.push(`${BRANDS_PREFIX}${data.favoriteBrands.trim()}`)
  }
  if (data.careNote?.trim()) {
    parts.push(`${NOTE_PREFIX}${data.careNote.trim()}`)
  }
  return parts.join(' | ')
}

export function parseCustomerNote(rawNote?: string | null): StructuredCustomerNote {
  const empty: StructuredCustomerNote = {
    skinConcerns: [],
    allergyNote: '',
    favoriteBrands: '',
    careNote: '',
  }

  if (!rawNote || !rawNote.trim()) {
    return empty
  }

  if (
    !rawNote.includes(CONCERNS_PREFIX) &&
    !rawNote.includes(ALLERGY_PREFIX) &&
    !rawNote.includes(BRANDS_PREFIX) &&
    !rawNote.includes(NOTE_PREFIX)
  ) {
    return {
      ...empty,
      careNote: rawNote.trim(),
    }
  }

  const segments = rawNote.split(' | ').map((s) => s.trim())
  const result: StructuredCustomerNote = { ...empty }

  for (const seg of segments) {
    if (seg.startsWith(CONCERNS_PREFIX)) {
      const val = seg.slice(CONCERNS_PREFIX.length).trim()
      result.skinConcerns = val
        ? val
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean)
        : []
    } else if (seg.startsWith(ALLERGY_PREFIX)) {
      result.allergyNote = seg.slice(ALLERGY_PREFIX.length).trim()
    } else if (seg.startsWith(BRANDS_PREFIX)) {
      result.favoriteBrands = seg.slice(BRANDS_PREFIX.length).trim()
    } else if (seg.startsWith(NOTE_PREFIX)) {
      result.careNote = seg.slice(NOTE_PREFIX.length).trim()
    } else if (seg) {
      result.careNote = result.careNote ? `${result.careNote}. ${seg}` : seg
    }
  }

  return result
}

