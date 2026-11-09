import {
  Ban,
  Barcode,
  CheckCircle2,
  CloudUpload,
  Package,
  PlusSquare,
  Trash2,
  X,
} from 'lucide-react'
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ApiClientError } from '../../lib/api-client'
import {
  normalizeProductImages,
  productsService,
} from '../../services/products.service'
import type {
  BrandItem,
  CategoryItem,
  ProductImageItem,
  ProductItem,
  ProductSkinType,
} from '../../types/api'
import { NumberInput, toast } from '../../components/ui'

interface CreateProductModalProps {
  isOpen: boolean
  categories: CategoryItem[]
  brands: BrandItem[]
  editingProduct?: ProductItem | null
  onClose: () => void
  onSaved: (product: ProductItem) => void
  onOpenCreateCategory: () => void
  onOpenCreateBrand: () => void
}

const UNIT_OPTIONS = ['Chai', 'Thỏi', 'Tuýp', 'Lọ', 'Hộp', 'Bộ', 'Miếng']
const SKIN_OPTIONS: { code: ProductSkinType; label: string }[] = [
  { code: 'ALL_SKIN_TYPES', label: 'Tất cả' },
  { code: 'OILY', label: 'Da dầu' },
  { code: 'DRY', label: 'Da khô' },
  { code: 'COMBINATION', label: 'Da hỗn hợp' },
  { code: 'SENSITIVE', label: 'Da nhạy cảm' },
]
const VOLUME_UNITS = ['ml', 'g', 'oz', 'l'] as const
const getVolumeUnit = (unit: string) => ['Thỏi', 'Miếng'].includes(unit) ? 'g' : 'ml'
const generateProductSku = (brandCode: string) =>
  `SKU-${brandCode}-${Math.floor(100 + Math.random() * 900)}`
const parseSkinTypes = (value?: ProductSkinType | ProductSkinType[]): ProductSkinType[] =>
  !value || value === 'ALL_SKIN_TYPES' ? ['ALL_SKIN_TYPES'] : Array.isArray(value) ? value : [value]

export function CreateProductModal({
  isOpen,
  categories,
  brands,
  editingProduct,
  onClose,
  onSaved,
  onOpenCreateCategory,
  onOpenCreateBrand,
}: CreateProductModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [productName, setProductName] = useState(
    () => editingProduct?.productName || ''
  )
  const [brandCode, setBrandCode] = useState(
    () => editingProduct?.brandCode || brands[0]?.brandCode || 'EL'
  )
  const [categoryCode, setCategoryCode] = useState(
    () =>
      editingProduct?.categoryCode || categories[0]?.categoryCode || 'PERFUME'
  )
  const [sku, setSku] = useState(() => editingProduct?.sku || generateProductSku(brands[0]?.brandCode || 'EL'))
  const [barcode, setBarcode] = useState(
    () => editingProduct?.barcode || '887167485488'
  )
  const [specInput, setSpecInput] = useState(
    () =>
      editingProduct?.packagingDetail ||
      (editingProduct
        ? `${editingProduct.unit} ${editingProduct.volume || ''}`.trim()
        : 'Chai thủy tinh 50ml')
  )
  const [unit, setUnit] = useState(() => editingProduct?.unit || 'Chai')
  const [volume, setVolume] = useState(() => editingProduct?.volume || '50ml')
  const [volumeUnit, setVolumeUnit] = useState(() => editingProduct?.volume?.match(/[a-z]+$/i)?.[0]?.toLowerCase() || getVolumeUnit(editingProduct?.unit || 'Chai'))
  const [skinTypes, setSkinTypes] = useState<ProductSkinType[]>(() => parseSkinTypes(editingProduct?.skinType))
  const [shelfLifeMonths, setShelfLifeMonths] = useState(() =>
    editingProduct?.shelfLifeValue != null
      ? String(editingProduct.shelfLifeValue)
      : editingProduct?.shelfLifeMonths == null ? '' : String(editingProduct.shelfLifeMonths)
  )
  const [shelfLifeUnit, setShelfLifeUnit] = useState<'days' | 'months' | 'years'>(() => editingProduct?.shelfLifeUnit ?? 'months')
  const [expiryWarningDays, setExpiryWarningDays] = useState(() => String(editingProduct?.expiryWarningValue ?? editingProduct?.expiryWarningDays ?? 60))
  const [expiryWarningUnit, setExpiryWarningUnit] = useState<'days' | 'months' | 'years'>(() => editingProduct?.expiryWarningUnit ?? 'days')
  const [retailPriceDisplay, setRetailPriceDisplay] = useState(() =>
    editingProduct
      ? editingProduct.retailPrice.toLocaleString('vi-VN')
      : '3.550.000'
  )
  const [taxRatePercent, setTaxRatePercent] = useState(() =>
    editingProduct
      ? `${Math.round((editingProduct.taxRate || 0.1) * 100)}%`
      : '10%'
  )
  const [minStockAlert, setMinStockAlert] = useState(() =>
    String(editingProduct?.minStockAlert ?? 10)
  )
  const [currentStock, setCurrentStock] = useState(
    () => editingProduct?.currentStock ?? 0
  )
  const [description, setDescription] = useState(
    () => editingProduct?.description || ''
  )
  const [images, setImages] = useState<ProductImageItem[]>(() =>
    normalizeProductImages(editingProduct?.images, editingProduct?.imageUrl)
  )
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [status, setStatus] = useState<'ACTIVE' | 'DISCONTINUED'>(
    () => editingProduct?.status || 'ACTIVE'
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // UC-PROD-05: Xem chi tiết sản phẩm GET /api/v1/products/{sku}
  useEffect(() => {
    if (!isOpen || !editingProduct?.sku) return
    let active = true
    productsService
      .getProductDetail(editingProduct.sku)
      .then((res) => {
        if (!active) return
        const d = res.data
        setProductName(d.productName)
        setBrandCode(d.brandCode)
        setCategoryCode(d.categoryCode)
        setSku(d.sku)
        setBarcode(d.barcode || '')
        setUnit(d.unit)
        setVolume(d.volume?.replace(/[a-z]+$/i, '') || '')
        setVolumeUnit(d.volume?.match(/[a-z]+$/i)?.[0]?.toLowerCase() || getVolumeUnit(d.unit))
        setSpecInput(
          d.packagingDetail || `${d.unit} ${d.volume || ''}`.trim()
        )
        setSkinTypes(parseSkinTypes(d.skinType))
        setRetailPriceDisplay(d.retailPrice.toLocaleString('vi-VN'))
        setTaxRatePercent(`${Math.round((d.taxRate || 0.1) * 100)}%`)
        setMinStockAlert(String(d.minStockAlert ?? 5))
        setShelfLifeMonths(d.shelfLifeValue != null ? String(d.shelfLifeValue) : d.shelfLifeMonths == null ? '' : String(d.shelfLifeMonths))
        setShelfLifeUnit(d.shelfLifeUnit ?? 'months')
        setExpiryWarningDays(String(d.expiryWarningValue ?? d.expiryWarningDays ?? 60))
        setExpiryWarningUnit(d.expiryWarningUnit ?? 'days')
        setCurrentStock(d.currentStock ?? 0)
        setDescription(d.description || '')
        setImages(normalizeProductImages(d.images, d.imageUrl))
        setStatus(d.status)
      })
      .catch(() => {
        // fallback to prop data
      })

    return () => {
      active = false
    }
  }, [isOpen, editingProduct?.sku])

  if (!isOpen) return null

  const handleUnitChange = (nextUnit: string) => {
    setUnit(nextUnit)
    setVolumeUnit(getVolumeUnit(nextUnit))
  }

  const handleSkinTypeChange = (code: ProductSkinType) => {
    setSkinTypes((current) => {
      if (code === 'ALL_SKIN_TYPES') return ['ALL_SKIN_TYPES']
      if (current.includes(code)) {
        const next = current.filter((item) => item !== code && item !== 'ALL_SKIN_TYPES')
        return next.length ? next : ['ALL_SKIN_TYPES']
      }
      const specific = current.filter((item) => item !== 'ALL_SKIN_TYPES')
      return [...specific, code]
    })
  }

  const handlePriceChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '')
    if (!digitsOnly) {
      setRetailPriceDisplay('')
      return
    }
    setRetailPriceDisplay(Number(digitsOnly).toLocaleString('vi-VN'))
  }

  const handleGenerateBarcode = () => {
    const random13 =
      '893' +
      Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('')
    setBarcode(random13)
  }

  // UC-PROD-09: Tải lên hình ảnh sản phẩm POST /api/v1/products/{sku}/images (multipart/form-data)
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const selectedFiles = Array.from(fileList)
    e.target.value = ''

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (
      selectedFiles.length > 5 ||
      selectedFiles.some(
        (f) => !allowedTypes.includes(f.type) || f.size > 5 * 1024 * 1024
      )
    ) {
      toast.error(
        'File không đúng định dạng hoặc vượt quá dung lượng. Chỉ nhận JPG, PNG, WEBP; tối đa 5 ảnh/lần, mỗi ảnh tối đa 5 MB.'
      )
      return
    }

    if (editingProduct) {
      setIsUploadingImage(true)
      try {
        const res = await productsService.uploadProductImages(
          editingProduct.sku,
          selectedFiles
        )
        setImages(res.data.images)
        onSaved({
          ...editingProduct,
          images: res.data.images,
          imageUrl: res.data.images[0]?.url ?? null,
        })
      } catch (err) {
        if (err instanceof ApiClientError) {
          toast.error(err.message)
        } else {
          toast.error('Không thể tải lên hình ảnh sản phẩm')
        }
      } finally {
        setIsUploadingImage(false)
      }
    } else {
      // Creation mode: preview locally and upload on submit
      setPendingFiles((prev) => [...prev, ...selectedFiles].slice(0, 5))
      selectedFiles.forEach((file) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setImages((prev) => [
              ...prev,
              {
                imageId: Date.now() + Math.floor(Math.random() * 1000),
                url: reader.result as string,
              },
            ])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  // UC-PROD-10: Xóa hình ảnh sản phẩm DELETE /api/v1/products/{sku}/images/{imageId}
  const handleDeleteImage = async (img: ProductImageItem, index: number) => {
    if (editingProduct) {
      setIsUploadingImage(true)
      try {
        await productsService.deleteProductImage(
          editingProduct.sku,
          img.imageId
        )
        const remaining = images.filter((item) => item.imageId !== img.imageId)
        setImages(remaining)
        onSaved({
          ...editingProduct,
          images: remaining,
          imageUrl: remaining[0]?.url ?? null,
        })
      } catch (err) {
        if (err instanceof ApiClientError) {
          toast.error(err.message)
        } else {
          toast.error('Không thể xóa hình ảnh sản phẩm')
        }
      } finally {
        setIsUploadingImage(false)
      }
    } else {
      setImages((prev) => prev.filter((_, i) => i !== index))
      setPendingFiles((prev) => prev.filter((_, i) => i !== index))
    }
  }

  // UC-PROD-07 & UC-PROD-08: Ngừng kinh doanh / Khôi phục sản phẩm
  const handleToggleProductStatus = async () => {
    if (!editingProduct) return
    setIsSubmitting(true)

    try {
      if (status === 'ACTIVE') {
        const res = await productsService.deactivateProduct(editingProduct.sku)
        setStatus(res.data.status)
        onSaved({
          ...editingProduct,
          status: res.data.status,
          currentStock,
        })
      } else {
        const res = await productsService.restoreProduct(editingProduct.sku)
        setStatus(res.data.status)
        onSaved({
          ...editingProduct,
          status: res.data.status,
        })
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message)
      } else {
        toast.error('Không thể chuyển trạng thái sản phẩm')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const numericPrice = Number(retailPriceDisplay.replace(/\D/g, ''))
    const numericTax =
      parseFloat(taxRatePercent.replace('%', '').trim()) / 100 || 0.1
    const shelfLifeValue = Number(shelfLifeMonths)
    const shelfLifeInMonths = shelfLifeUnit === 'years'
      ? shelfLifeValue * 12
      : shelfLifeUnit === 'days' ? Math.ceil(shelfLifeValue / 30) : shelfLifeValue
    const expiryWarningValue = Number(expiryWarningDays)
    const expiryWarningDaysLegacy = Math.min(
      3650,
      expiryWarningValue * (expiryWarningUnit === 'years' ? 365 : expiryWarningUnit === 'months' ? 30 : 1),
    )

    try {
      if (editingProduct) {
        // UC-PROD-06: PUT /api/v1/products/{sku}
        const res = await productsService.updateProduct(editingProduct.sku, {
          productName: productName.trim(),
          brandCode,
          categoryCode,
          unit,
          volume: volume ? `${volume.replace(/[a-z]+$/i, '')}${volumeUnit}` : '',
          packagingDetail: specInput.trim(),
          skinType: skinTypes.length === 1 ? skinTypes[0] : skinTypes,
          shelfLifeMonths: shelfLifeMonths === '' ? null : shelfLifeInMonths,
          shelfLifeValue: shelfLifeMonths === '' ? null : shelfLifeValue,
          shelfLifeUnit: shelfLifeMonths === '' ? null : shelfLifeUnit,
          expiryWarningDays: expiryWarningDaysLegacy,
          expiryWarningValue,
          expiryWarningUnit,
          retailPrice: numericPrice,
          taxRate: numericTax,
          minStockAlert: Number(minStockAlert) || 5,
          barcode: barcode.trim(),
          description: description.trim(),
        })
        onSaved(res.data)
        onClose()
      } else {
        // UC-PROD-01: POST /api/v1/products
        const res = await productsService.createProduct({
          sku,
          productName,
          categoryCode,
          brandCode,
          unit,
          volume: volume ? `${volume.replace(/[a-z]+$/i, '')}${volumeUnit}` : '',
          skinType: skinTypes.length === 1 ? skinTypes[0] : skinTypes,
          retailPrice: numericPrice,
          taxRate: numericTax,
          minStockAlert: Number(minStockAlert) || 5,
          barcode,
          images: images.map((img) => img.url),
          packagingDetail: specInput,
          shelfLifeMonths: shelfLifeMonths === '' ? null : shelfLifeInMonths,
          shelfLifeValue: shelfLifeMonths === '' ? null : shelfLifeValue,
          shelfLifeUnit: shelfLifeMonths === '' ? null : shelfLifeUnit,
          expiryWarningDays: expiryWarningDaysLegacy,
          expiryWarningValue,
          expiryWarningUnit,
          description,
        })

        let createdProduct = res.data
        if (pendingFiles.length > 0 && (!images || images.length === 0)) {
          const uploadRes = await productsService.uploadProductImages(
            createdProduct.sku,
            pendingFiles
          )
          createdProduct = {
            ...createdProduct,
            images: uploadRes.data.images,
            imageUrl: uploadRes.data.images[0]?.url ?? null,
          }
        }

        onSaved(createdProduct)
        setProductName('')
        setImages([])
        setPendingFiles([])
        setSku(generateProductSku(brandCode))
        handleGenerateBarcode()
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast.error(err.message)
      } else {
        toast.error('Không thể lưu sản phẩm. Vui lòng kiểm tra lại dữ liệu.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#ead8ce] shadow-2xl">
        {/* Top Modal Header */}
        <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-b border-[#edd9cd] shrink-0">
          <div className="flex items-center gap-2.5">
            <PlusSquare className="size-5 text-[#9a3b20]" />
            <h3 className="text-base font-extrabold text-[#221712]">
              {editingProduct
                ? `Chi tiết & Cập nhật Sản phẩm (${editingProduct.sku})`
                : 'Khởi tạo Sản phẩm mới'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#5e473b] hover:bg-black/5 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto flex flex-col justify-between"
          noValidate
        >
          <div className="p-6 space-y-6">
            {/* SECTION 1: THÔNG TIN ĐỊNH DANH & PHÂN LOẠI */}
            <div className="space-y-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#8c673a]">
                1. THÔNG TIN ĐỊNH DANH & PHÂN LOẠI
              </p>

              <div>
                <label className="block text-xs font-bold text-[#221712]">
                  Tên sản phẩm mỹ phẩm niêm yết *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ví dụ: Tinh Chất Phục Hồi Da ANR Estée Lauder 50ml"
                  className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 text-sm text-[#221712] placeholder:text-[#9c8478] outline-none transition"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#221712]">
                      Thương hiệu mỹ phẩm *
                    </label>
                    <button
                      type="button"
                      onClick={onOpenCreateBrand}
                      className="text-[11px] font-bold text-[#9a462d] hover:underline cursor-pointer"
                    >
                      + Thêm thương hiệu mới
                    </button>
                  </div>
                  <select
                    value={brandCode}
                    onChange={(e) => {
                      const nextBrandCode = e.target.value
                      setBrandCode(nextBrandCode)
                      if (!editingProduct) setSku(generateProductSku(nextBrandCode))
                    }}
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 text-sm font-medium text-[#221712] outline-none transition"
                  >
                    {brands.map((b) => (
                      <option key={b.brandCode} value={b.brandCode}>
                        {b.brandName} ({b.brandCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#221712]">
                      Mã Danh mục nội bộ *
                    </label>
                    <button
                      type="button"
                      onClick={onOpenCreateCategory}
                      className="text-[11px] font-bold text-[#9a462d] hover:underline cursor-pointer"
                    >
                      + Tạo danh mục
                    </button>
                  </div>
                  <select
                    value={categoryCode}
                    onChange={(e) => setCategoryCode(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 text-sm font-medium text-[#221712] outline-none transition"
                  >
                    {categories.map((cat) => (
                      <option key={cat.categoryCode} value={cat.categoryCode}>
                        {cat.categoryCode} — {cat.categoryName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#221712]">
                      Mã SKU nội bộ *
                    </label>
                    <span className="text-[10px] font-semibold text-[#8c7265]">
                      (Có thể tự chỉnh sửa)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="SKU-EL-ANR50"
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 font-mono text-sm font-bold text-[#221712] outline-none transition"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#221712]">
                      Mã vạch quốc tế (EAN-13)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      title="Sinh mã vạch EAN-13 ngẫu nhiên"
                      className="text-[#6e564a] hover:text-[#9a462d] cursor-pointer"
                    >
                      <Barcode className="size-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="887167485488"
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 font-mono text-sm font-semibold text-[#221712] outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: QUY CÁCH & HẠN DÙNG KHUYẾN NGHỊ */}
            <div className="space-y-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#8c673a]">
                2. QUY CÁCH & HẠN DÙNG KHUYẾN NGHỊ
              </p>

              {/* Bố cục đồng bộ 3 cột: Đơn vị tính | Dung tích/Trọng lượng | Hạn sử dụng tối đa */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    ĐƠN VỊ TÍNH / BAO BÌ *
                  </label>
                  <div className="mt-1.5 flex items-center rounded-xl bg-[#fceddf]/70 border border-transparent focus-within:border-[#d57252] focus-within:bg-white px-3 py-2.5">
                    <Package aria-hidden="true" className="mr-2 size-4 shrink-0 text-[#b95738]" />
                    <select
                      value={unit}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      aria-label="Đơn vị tính / Bao bì"
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#221712] outline-none cursor-pointer"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    DUNG TÍCH / TRỌNG LƯỢNG *
                  </label>
                  <div className="mt-1.5 flex w-full overflow-hidden rounded-xl bg-[#fceddf]/70 border border-transparent focus-within:border-[#d57252] focus-within:bg-white">
                    <NumberInput
                      type="text"
                      inputMode="decimal"
                      value={volume.replace(/[a-z]+$/i, '')}
                      onChange={(e) => setVolume(e.target.value)}
                      placeholder="50"
                      aria-label="Dung tích hoặc trọng lượng"
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-xs font-mono font-semibold text-[#221712] outline-none"
                    />
                    <select
                      value={volumeUnit}
                      onChange={(e) => setVolumeUnit(e.target.value)}
                      aria-label="Đơn vị dung tích"
                      className="border-l border-[#e5d2c5]/60 bg-transparent px-2.5 py-2.5 text-xs font-semibold text-[#6e5446] outline-none cursor-pointer"
                    >
                      {VOLUME_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    HẠN SỬ DỤNG TỐI ĐA
                  </label>
                  <div className="mt-1.5 flex w-full overflow-hidden rounded-xl border border-transparent bg-[#fceddf]/70 focus-within:border-[#d57252] focus-within:bg-white">
                    <NumberInput
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Không giới hạn"
                      value={shelfLifeMonths}
                      onChange={(e) => setShelfLifeMonths(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-xs font-semibold text-[#5a5a5a] outline-none"
                    />
                    <select value={shelfLifeUnit} onChange={(e) => setShelfLifeUnit(e.target.value as typeof shelfLifeUnit)} aria-label="Maximum shelf life unit" className="w-20 shrink-0 border-l border-[#e5d2c5]/60 bg-transparent px-2 py-2.5 text-xs font-semibold text-[#221712] outline-none cursor-pointer"><option value="days">{"Ng\u00e0y"}</option><option value="months">{"Th\u00e1ng"}</option><option value="years">{"N\u0103m"}</option></select>
                  </div>
                </div>
              </div>

              {/* Loại da thích hợp */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[#221712]">
                    LOẠI DA THÍCH HỢP *
                  </label>
                  <span className="text-[10px] text-[#8a6a58]">Có thể chọn nhiều tiêu chí hoặc chọn Tất cả</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {SKIN_OPTIONS.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      aria-pressed={skinTypes.includes(s.code)}
                      onClick={() => handleSkinTypeChange(s.code)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d57252]/40 cursor-pointer ${
                        skinTypes.includes(s.code)
                          ? 'border-[#b95738] bg-[#b95738] text-white shadow-sm'
                          : 'border-[#e5d2c5] bg-white text-[#6e5446] hover:border-[#d57252] hover:bg-[#faeee7]'
                      }`}
                    >
                      {s.label} {skinTypes.includes(s.code) && s.code === 'ALL_SKIN_TYPES' && '✓'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#fceddf]/70 px-5 py-3.5 text-xs text-[#695246] leading-relaxed">
                Khi hàng về kho, hệ thống tự động gán Expired Date theo Lô nhập
                thực tế. Xuất kho ưu tiên Lô hết hạn trước.
              </div>
            </div>

            {/* SECTION 3: GIÁ BÁN NIÊM YẾT, VAT & ĐỊNH MỨC AN TOÀN */}
            <div className="space-y-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#8c673a]">
                3. GIÁ BÁN NIÊM YẾT, VAT & ĐỊNH MỨC AN TOÀN
              </p>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#221712]">
                      Giá bán lẻ niêm yết (VND) *
                    </label>
                    {editingProduct && (
                      <span className="text-[10px] font-medium text-[#8a6a58]">
                        Áp dụng cho đơn lập sau khi lưu
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={retailPriceDisplay}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="3.550.000"
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 font-mono text-base font-extrabold text-[#9a3b20] outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    Thuế suất VAT *
                  </label>
                  <select
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(e.target.value)}
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3.5 text-sm font-semibold text-[#221712] outline-none transition"
                  >
                    <option value="10%">10% (0.10)</option>
                    <option value="8%">8% (0.08)</option>
                    <option value="5%">5% (0.05)</option>
                    <option value="0%">0% (Không chịu thuế)</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    Định mức tồn an toàn (Min stock)
                  </label>
                  <div className="mt-1.5 relative">
                    <NumberInput
                      type="number"
                      min={0}
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(e.target.value)}
                      className="w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white pl-4 pr-16 py-3 font-mono text-sm font-bold text-[#221712] outline-none transition"
                    />
                    <span className="absolute right-4 top-3 text-xs text-[#695246]">
                      Đơn vị
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#221712]">NGƯỠNG CẢNH BÁO CẬN HẠN</label>
                  <div className="mt-1.5 flex w-full overflow-hidden rounded-xl border border-transparent bg-[#fceddf]/70 focus-within:border-[#d57252] focus-within:bg-white">
                    <NumberInput
                      type="number"
                      min={0}
                      step={1}
                      value={expiryWarningDays}
                      onChange={(e) => setExpiryWarningDays(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm font-bold text-[#221712] outline-none"
                    />
                    <select value={expiryWarningUnit} onChange={(e) => setExpiryWarningUnit(e.target.value as typeof expiryWarningUnit)} aria-label="Expiry warning unit" className="w-28 shrink-0 border-l border-[#e5d2c5]/60 bg-transparent px-3 py-2.5 text-xs font-semibold text-[#221712] outline-none cursor-pointer"><option value="days">{"Ng\u00e0y"}</option><option value="months">{"Th\u00e1ng"}</option><option value="years">{"N\u0103m"}</option></select>
                  </div>
                </div>

                {editingProduct && (
                  <div className="rounded-2xl bg-[#fbf4ef] border border-[#ebd9ce] p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-[#6e5446]">
                        Trạng thái kinh doanh
                      </p>
                      <span
                        className={`mt-1 inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {status === 'ACTIVE'
                          ? 'Đang kinh doanh'
                          : 'Ngừng kinh doanh'}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleToggleProductStatus()}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        status === 'ACTIVE'
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {status === 'ACTIVE' ? (
                        <>
                          <Ban className="size-3.5" />
                          <span>Ngừng KD</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          <span>Khôi phục</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#221712]">
                  Mô tả sản phẩm
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả chi tiết..."
                  className="mt-1.5 w-full rounded-2xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white p-4 text-xs italic text-[#221712] placeholder:text-[#7e675c] outline-none transition"
                />
              </div>

              {/* Image Upload Dropzone */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#221712]">
                    Hình ảnh mỹ phẩm sản phẩm
                  </label>
                  {isUploadingImage && (
                    <span className="text-[11px] font-bold text-[#9a3b20]">
                      Đang đồng bộ ảnh...
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 rounded-2xl bg-[#fceddf]/70 hover:bg-[#fae3d0] border border-dashed border-[#dfb9a3] p-6 text-center cursor-pointer transition"
                >
                  <CloudUpload className="size-7 text-[#7d5a3b] mx-auto" />
                  <p className="mt-2 text-sm font-extrabold text-[#221712]">
                    Kéo thả ảnh hoặc Bấm để tải lên (multipart/form-data: files)
                  </p>
                  <p className="mt-1 text-xs text-[#695246]">
                    Hỗ trợ JPG, PNG, WebP tối đa 5 ảnh/lần, mỗi ảnh tối đa 5MB
                  </p>
                </div>

                {images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {images.map((img, idx) => (
                      <div
                        key={img.imageId || idx}
                        className="relative size-20 rounded-xl overflow-hidden border border-[#e2cbbd] bg-white group"
                      >
                        <img
                          src={img.url}
                          alt={`Product ${idx + 1}`}
                          className="size-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[9px]">
                          #{img.imageId}
                        </span>
                        <button
                          type="button"
                          title={`Xóa hình ảnh #${img.imageId}`}
                          onClick={() => handleDeleteImage(img, idx)}
                          className="absolute top-1 right-1 size-6 rounded-full bg-red-600/90 hover:bg-red-700 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="bg-[#f9ebe2] px-6 py-4 flex items-center justify-between border-t border-[#edd9cd] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl bg-[#a3a3a3] hover:bg-[#8f8f8f] text-black font-bold text-sm transition cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl bg-[#d97757] hover:bg-[#c46344] text-white font-bold text-sm shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting
                ? 'Đang lưu...'
                : editingProduct
                  ? 'Lưu cập nhật sản phẩm'
                  : 'Lưu & Tiếp tục tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
