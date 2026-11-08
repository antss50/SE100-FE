import type { ProductImageItem } from '../types/api'

export function parsePackagingSpec(specInput: string): {
  unit: string
  volume: string
  packagingDetail: string
} {
  const trimmed = specInput.trim()
  if (!trimmed) {
    return { unit: 'Chai', volume: '', packagingDetail: '' }
  }

  const volMatch = trimmed.match(
    /(\d+(?:[.,]\d+)?\s*(?:ml|g|oz|l|miếng|viên))/i
  )
  const volume = volMatch ? volMatch[1].replace(/\s+/g, '') : ''

  const knownUnits = [
    'Chai',
    'Thỏi',
    'Tuýp',
    'Lọ',
    'Hộp',
    'Bộ',
    'Túi',
    'Miếng',
  ]
  const matchedUnit =
    knownUnits.find((u) =>
      trimmed.toLowerCase().startsWith(u.toLowerCase())
    ) ||
    knownUnits.find((u) => trimmed.toLowerCase().includes(u.toLowerCase())) ||
    trimmed.split(/\s+/)[0] ||
    'Chai'

  return {
    unit: matchedUnit,
    volume,
    packagingDetail: trimmed,
  }
}

export function normalizeProductImages(
  rawImages: unknown,
  imageUrl?: string | null
): ProductImageItem[] {
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    return rawImages
      .map((item, idx) => {
        if (typeof item === 'string') {
          return { imageId: idx + 1, url: item }
        }
        if (item && typeof item === 'object' && 'url' in item) {
          const obj = item as { imageId?: number; url?: string }
          return {
            imageId: Number(obj.imageId) || idx + 1,
            url: String(obj.url || ''),
          }
        }
        return null
      })
      .filter((x): x is ProductImageItem => Boolean(x && x.url))
  }
  if (imageUrl) {
    return [{ imageId: 1, url: imageUrl }]
  }
  return []
}
