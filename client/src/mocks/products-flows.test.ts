import { beforeEach, describe, expect, it } from 'vitest'
import { expectFail, freshDb, get, loginAs, post, put, send } from '../test/api-helpers'
import type { ProductItem } from '../types/api'

beforeEach(freshDb)

describe('PROD đơn vị hạn dùng', () => {
  it('tạo, sửa và tải lại độc lập giá trị cùng đơn vị của cả hai trường', async () => {
    await loginAs('admin')
    const existing = await get<ProductItem>('/products/SKU-EL-ANR50')
    const update = {
      productName: existing.productName,
      categoryCode: existing.categoryCode,
      brandCode: existing.brandCode,
      unit: existing.unit,
      volume: existing.volume,
      skinType: existing.skinType,
      retailPrice: existing.retailPrice,
      taxRate: existing.taxRate,
      shelfLifeMonths: 1,
      shelfLifeValue: 30,
      shelfLifeUnit: 'days',
      expiryWarningDays: 60,
      expiryWarningValue: 2,
      expiryWarningUnit: 'months',
    }
    await send('/products/SKU-EL-ANR50', put(update))

    const edited = await get<ProductItem>('/products/SKU-EL-ANR50')
    expect([edited.shelfLifeValue, edited.shelfLifeUnit]).toEqual([30, 'days'])
    expect([edited.expiryWarningValue, edited.expiryWarningUnit]).toEqual([2, 'months'])
    await expectFail('/purchase-orders', post({ supplierId: 1, lines: [{
      productId: existing.id,
      lotCode: 'UNIT-DAY-HSD',
      mfgDate: '2029-01-01',
      expDate: '2029-02-01',
      quantity: 1,
      unitCost: 1,
    }] }), 422, 'STK_EXP_DATE_EXCEEDS_SHELF_LIFE')

    await send('/products', post({
      ...update,
      sku: 'SKU-UNIT-ROUNDTRIP',
      productName: 'Unit roundtrip',
      categoryCode: existing.categoryCode,
      brandCode: existing.brandCode,
      shelfLifeMonths: 30,
      shelfLifeValue: 30,
      shelfLifeUnit: 'days',
      expiryWarningDays: 365,
      expiryWarningValue: 1,
      expiryWarningUnit: 'years',
    }))
    const created = await get<ProductItem>('/products/SKU-UNIT-ROUNDTRIP')
    expect([created.shelfLifeValue, created.shelfLifeUnit]).toEqual([30, 'days'])
    expect([created.expiryWarningValue, created.expiryWarningUnit]).toEqual([1, 'years'])
  })
})
