import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button, Input, Modal, Select, toast } from '../../components/ui'
import { FieldShell } from '../../components/ui/Input'
import { queryKeys } from '../../lib/query-keys'
import { productsService } from '../../services/products.service'
import { promotionsService } from '../../services/promotions.service'
import { PROMOTION_TYPE_LABELS, type PromotionType, type PromotionView } from '../../types/promotions'
import { getErrorMessage } from '../../utils/error'
import { VoucherCustomerField, type VoucherCustomer } from './VoucherCustomerField'
import { CheckGroup, ProductRowsEditor, StepsEditor, WeekdaysPicker, type PickerOption } from './PromotionEditors'
import {
  emptyFormValues,
  formFromPromotion,
  promotionFormSchema,
  toPromotionInput,
  type PromotionFormExtras,
  type PromotionFormValues,
} from './promotion-form'

const EMPTY_EXTRAS: PromotionFormExtras = { items: [], steps: [], brandIds: [], categoryIds: [], weekdays: [] }
const TYPE_OPTIONS = (Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]).map((t) => ({
  value: t,
  label: PROMOTION_TYPE_LABELS[t],
}))
const TEXTAREA_CLASS =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'

interface PromotionFormModalProps {
  open: boolean
  /** Có giá trị thì sửa, không thì tạo mới. */
  promotion?: PromotionView | null
  onClose: () => void
}

/** PROM-02: tạo / sửa khuyến mãi 7 loại. Đã có đơn dùng thì chỉ sửa tên, mô tả, ngày kết thúc (luật 10). */
export function PromotionFormModal({ open, promotion, onClose }: PromotionFormModalProps) {
  const queryClient = useQueryClient()
  const [extras, setExtras] = useState<PromotionFormExtras>(EMPTY_EXTRAS)
  const [voucherCustomer, setVoucherCustomer] = useState<VoucherCustomer | null>(null)
  const submitStatus = useRef<'DRAFT' | 'ACTIVE'>('ACTIVE')
  const locked = Boolean(promotion?.locked)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PromotionFormValues>({ resolver: zodResolver(promotionFormSchema), defaultValues: emptyFormValues() })

  useEffect(() => {
    if (!open) return
    if (promotion) {
      const form = formFromPromotion(promotion)
      reset(form.values)
      setExtras(form.extras)
      setVoucherCustomer(
        promotion.customerId === null ? null : { id: promotion.customerId, name: promotion.customerName ?? `Khách #${promotion.customerId}`, phone: null }
      )
    } else {
      reset(emptyFormValues())
      setExtras(EMPTY_EXTRAS)
      setVoucherCustomer(null)
    }
  }, [open, promotion, reset])

  const { data: catalog } = useQuery({
    queryKey: queryKeys.catalog.forPromotions,
    queryFn: async () => {
      const [products, brands, categories, loyalty] = await Promise.all([
        productsService.getProducts({ pageSize: 500 }),
        productsService.getBrands({ pageSize: 200 }),
        productsService.getCategories({ pageSize: 200 }),
        promotionsService.getLoyaltyConfig(),
      ])
      return {
        products: products.data.items
          .filter((p) => p.id !== undefined)
          .map((p): PickerOption => ({ id: p.id as number, label: `${p.sku} · ${p.productName}` })),
        brands: brands.data.items.map((b): PickerOption => ({ id: b.id as number, label: b.brandName })),
        categories: categories.data.items.map((c): PickerOption => ({ id: c.id as number, label: c.categoryName })),
        tiers: loyalty.data.tiers,
      }
    },
    enabled: open,
    staleTime: 60_000,
  })

  const type = watch('promotionType')
  const scope = watch('applyScope')
  const products = useMemo(() => catalog?.products ?? [], [catalog])

  const mutation = useMutation({
    mutationFn: (values: PromotionFormValues) => {
      const payload = {
        ...toPromotionInput(values, extras),
        customerId: values.promotionType === 'VOUCHER' ? (voucherCustomer?.id ?? null) : null,
        status: submitStatus.current,
      }
      return promotion ? promotionsService.update(promotion.id, payload) : promotionsService.create(payload)
    },
    onSuccess: (res) => {
      toast.success(res.message ?? 'Đã lưu chương trình khuyến mãi')
      void queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all })
      onClose()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setItems = (items: PromotionFormExtras['items']) => setExtras((x) => ({ ...x, items }))
  const isTier1 = type === 'PRODUCT_DISCOUNT' || type === 'FLASH_PRICE' || type === 'BUY_X_GET_Y' || type === 'COMBO'
  const showDiscount = type === 'PRODUCT_DISCOUNT' || type === 'VOUCHER'

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      size="lg"
      title={promotion ? `Sửa khuyến mãi #${promotion.id}` : 'Tạo chương trình khuyến mãi'}
      description="Mỗi sản phẩm hưởng tối đa 1 khuyến mãi tầng 1; tầng 3 chỉ có 1 khoản giảm tiền (bậc thang hoặc voucher, lấy cái lợi hơn)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          {(!promotion || promotion.status === 'DRAFT') && (
            <Button
              type="submit"
              form="promotion-form"
              variant="secondary"
              loading={mutation.isPending}
              onClick={() => (submitStatus.current = 'DRAFT')}
            >
              Lưu nháp
            </Button>
          )}
          <Button
            type="submit"
            form="promotion-form"
            loading={mutation.isPending}
            onClick={() => (submitStatus.current = 'ACTIVE')}
          >
            {promotion ? 'Lưu thay đổi' : 'Tạo và kích hoạt'}
          </Button>
        </>
      }
    >
      <form
        id="promotion-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
      >
        {locked && (
          <p className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning sm:col-span-2">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Chương trình đã có {promotion?.usedCount} đơn dùng nên khóa mức giảm, điều kiện và danh sách sản phẩm. Chỉ được
            sửa tên, mô tả, ngày kết thúc hoặc tạm dừng.
          </p>
        )}
        <Input
          label="Tên chương trình"
          required
          containerClassName="sm:col-span-2"
          error={errors.promotionName?.message}
          {...register('promotionName')}
        />
        <Select
          label="Loại khuyến mãi"
          options={TYPE_OPTIONS}
          disabled={Boolean(promotion)}
          hint={isTier1 ? 'Tầng 1: giảm theo dòng hàng, tự động' : 'Tầng 3: giảm theo hóa đơn'}
          {...register('promotionType')}
        />
        {type === 'VOUCHER' && (
          <Input
            label="Mã voucher"
            required
            disabled={locked}
            hint="Nhập tại quầy POS, tự viết hoa"
            {...register('voucherCode')}
          />
        )}
        {type === 'VOUCHER' && <VoucherCustomerField value={voucherCustomer} onChange={setVoucherCustomer} disabled={locked} />}
        <FieldShell id="promotion-description" label="Mô tả" className="sm:col-span-2">
          <textarea id="promotion-description" rows={2} className={TEXTAREA_CLASS} {...register('description')} />
        </FieldShell>

        <Input label="Bắt đầu" type="datetime-local" required disabled={locked} error={errors.startAt?.message} {...register('startAt')} />
        <Input label="Kết thúc" type="datetime-local" required error={errors.endAt?.message} {...register('endAt')} />

        {type === 'PRODUCT_DISCOUNT' && (
          <Select
            label="Phạm vi áp dụng"
            disabled={locked}
            options={[
              { value: 'ALL', label: 'Toàn bộ sản phẩm' },
              { value: 'PRODUCT', label: 'Theo sản phẩm' },
              { value: 'BRAND', label: 'Theo thương hiệu' },
              { value: 'CATEGORY', label: 'Theo danh mục' },
            ]}
            {...register('applyScope')}
          />
        )}
        {showDiscount && (
          <>
            <Select
              label="Kiểu giảm"
              disabled={locked}
              options={[
                { value: 'PERCENT', label: 'Phần trăm (%)' },
                { value: 'FIXED_AMOUNT', label: 'Số tiền (đ)' },
              ]}
              {...register('discountType')}
            />
            <Input label="Mức giảm" type="number" min={0} disabled={locked} {...register('discountValue')} />
            <Input label="Trần giảm (đ)" type="number" min={0} disabled={locked} {...register('maxDiscountAmount')} />
          </>
        )}
        {type === 'FLASH_PRICE' && (
          <>
            <Input label="Giá đồng giá (đ)" type="number" min={0} disabled={locked} hint="Chỉ áp khi thấp hơn giá niêm yết" {...register('fixedPrice')} />
            <Input label="Tổng số lượng bán giá KM" type="number" min={1} disabled={locked} {...register('maxQuantity')} />
            <Input label="Khung giờ từ" type="time" disabled={locked} {...register('dailyStartTime')} />
            <Input label="Khung giờ đến" type="time" disabled={locked} {...register('dailyEndTime')} />
          </>
        )}
        {type === 'BUY_X_GET_Y' && (
          <>
            <Input label="Số món cần mua" type="number" min={1} disabled={locked} {...register('buyQuantity')} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" disabled={locked} {...register('isRepeatable')} />
              Lặp theo bội số (mua 4 tặng 2)
            </label>
          </>
        )}
        {type === 'COMBO' && <Input label="Giá cả bộ (đ)" type="number" min={0} disabled={locked} {...register('comboPrice')} />}
        {(type === 'VOUCHER' || type === 'ORDER_GIFT') && (
          <Input label="Đơn từ (đ)" type="number" min={0} disabled={locked} hint="Xét trên tiền sau tầng 1 và 2" {...register('minOrderValue')} />
        )}

        <Select
          label="Hạng thẻ tối thiểu"
          disabled={locked}
          placeholder="Mọi khách (kể cả vãng lai)"
          hint="Chọn hạng thì đơn bắt buộc có khách"
          options={(catalog?.tiers ?? []).map((t, i) => ({ value: String(i + 1), label: t.tierName ?? t.tier }))}
          {...register('minTierId')}
        />
        <Input label="Tổng lượt dùng" type="number" min={1} hint="Bỏ trống = không giới hạn" {...register('usageLimit')} />
        <Input
          label="Lượt dùng mỗi khách"
          type="number"
          min={1}
          disabled={locked}
          hint="Có giới hạn thì đơn bắt buộc có khách"
          {...register('limitPerCustomer')}
        />

        <div className="space-y-3 sm:col-span-2">
          {type === 'FLASH_PRICE' && (
            <WeekdaysPicker value={extras.weekdays} onChange={(weekdays) => setExtras((x) => ({ ...x, weekdays }))} disabled={locked} />
          )}
          {(type === 'FLASH_PRICE' || (type === 'PRODUCT_DISCOUNT' && scope === 'PRODUCT')) && (
            <ProductRowsEditor title="Sản phẩm áp dụng" role="TARGET" items={extras.items} products={products} onChange={setItems} disabled={locked} />
          )}
          {type === 'PRODUCT_DISCOUNT' && scope === 'BRAND' && (
            <CheckGroup
              title="Thương hiệu áp dụng"
              options={catalog?.brands ?? []}
              selected={extras.brandIds}
              onChange={(brandIds) => setExtras((x) => ({ ...x, brandIds }))}
              disabled={locked}
            />
          )}
          {type === 'PRODUCT_DISCOUNT' && scope === 'CATEGORY' && (
            <CheckGroup
              title="Danh mục áp dụng"
              options={catalog?.categories ?? []}
              selected={extras.categoryIds}
              onChange={(categoryIds) => setExtras((x) => ({ ...x, categoryIds }))}
              disabled={locked}
            />
          )}
          {type === 'BUY_X_GET_Y' && (
            <>
              <ProductRowsEditor title="Nhóm sản phẩm cần mua" role="BUY" items={extras.items} products={products} onChange={setItems} disabled={locked} />
              <ProductRowsEditor title="Quà tặng" role="GIFT" quantityLabel="Số lượng quà" items={extras.items} products={products} onChange={setItems} disabled={locked} />
            </>
          )}
          {type === 'COMBO' && (
            <ProductRowsEditor title="Sản phẩm trong combo" role="COMBO_ITEM" quantityLabel="Số lượng" items={extras.items} products={products} onChange={setItems} disabled={locked} />
          )}
          {type === 'ORDER_GIFT' && (
            <ProductRowsEditor title="Quà tặng" role="GIFT" quantityLabel="Số lượng quà" items={extras.items} products={products} onChange={setItems} disabled={locked} />
          )}
          {type === 'ORDER_TIERED' && (
            <StepsEditor steps={extras.steps} onChange={(steps) => setExtras((x) => ({ ...x, steps }))} disabled={locked} />
          )}
        </div>
      </form>
    </Modal>
  )
}
