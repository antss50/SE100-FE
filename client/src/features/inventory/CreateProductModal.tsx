import {
  Ban,
  Barcode,
  CheckCircle2,
  CloudUpload,
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
  parsePackagingSpec,
  productsService,
} from '../../services/products.service'
import type {
  BrandItem,
  CategoryItem,
  ProductImageItem,
  ProductItem,
  ProductSkinType,
} from '../../types/api'

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
  { code: 'ALL_SKIN_TYPES', label: 'Mọi loại da (ALL_SKIN_TYPES)' },
  { code: 'OILY', label: 'Da dầu (OILY)' },
  { code: 'DRY', label: 'Da khô (DRY)' },
  { code: 'COMBINATION', label: 'Da hỗn hợp (COMBINATION)' },
  { code: 'SENSITIVE', label: 'Da nhạy cảm (SENSITIVE)' },
]

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
  const [sku, setSku] = useState(() => editingProduct?.sku || 'SKU-EL-ANR50')
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
  const [skinType, setSkinType] = useState<ProductSkinType>(
    () => editingProduct?.skinType || 'ALL_SKIN_TYPES'
  )
  const [shelfLifeMonths, setShelfLifeMonths] = useState(() =>
    String(editingProduct?.shelfLifeMonths ?? 36)
  )
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
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(
    () => editingProduct?.status || 'ACTIVE'
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasStockConflict, setHasStockConflict] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

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
        setVolume(d.volume || '')
        setSpecInput(
          d.packagingDetail || `${d.unit} ${d.volume || ''}`.trim()
        )
        setSkinType(d.skinType || 'ALL_SKIN_TYPES')
        setRetailPriceDisplay(d.retailPrice.toLocaleString('vi-VN'))
        setTaxRatePercent(`${Math.round((d.taxRate || 0.1) * 100)}%`)
        setMinStockAlert(String(d.minStockAlert ?? 5))
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

  const handleSpecChange = (val: string) => {
    setSpecInput(val)
    const parsed = parsePackagingSpec(val)
    if (parsed.unit) setUnit(parsed.unit)
    if (parsed.volume) setVolume(parsed.volume)
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

    setErrorMsg(null)
    setSuccessMsg(null)

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (
      selectedFiles.length > 5 ||
      selectedFiles.some(
        (f) => !allowedTypes.includes(f.type) || f.size > 5 * 1024 * 1024
      )
    ) {
      setErrorMsg(
        'File không đúng định dạng hoặc vượt quá dung lượng (COMMON_VALIDATION_FAILED - JPG, PNG, WEBP, tối đa 5 ảnh/lần, mỗi ảnh tối đa 5 MB)'
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
        setSuccessMsg(
          `${res.message} (${res.data.images.length} ảnh - HTTP 201)`
        )
        onSaved({
          ...editingProduct,
          images: res.data.images,
          imageUrl: res.data.images[0]?.url ?? null,
        })
      } catch (err) {
        if (err instanceof ApiClientError) {
          setErrorMsg(`${err.message} (${err.errorCode})`)
        } else {
          setErrorMsg('Không thể tải lên hình ảnh sản phẩm')
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
    setErrorMsg(null)
    setSuccessMsg(null)

    if (editingProduct) {
      setIsUploadingImage(true)
      try {
        const res = await productsService.deleteProductImage(
          editingProduct.sku,
          img.imageId
        )
        const remaining = images.filter((item) => item.imageId !== img.imageId)
        setImages(remaining)
        setSuccessMsg(`${res.message} (imageId: ${img.imageId} - HTTP 200)`)
        onSaved({
          ...editingProduct,
          images: remaining,
          imageUrl: remaining[0]?.url ?? null,
        })
      } catch (err) {
        if (err instanceof ApiClientError) {
          setErrorMsg(`${err.message} (${err.errorCode})`)
        } else {
          setErrorMsg('Không thể xóa hình ảnh sản phẩm')
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
  const handleToggleProductStatus = async (clearStockFirst = false) => {
    if (!editingProduct) return
    setErrorMsg(null)
    setHasStockConflict(false)
    setSuccessMsg(null)
    setIsSubmitting(true)

    try {
      if (status === 'ACTIVE') {
        const res = await productsService.deactivateProduct(
          editingProduct.sku,
          clearStockFirst
        )
        setStatus(res.data.status)
        if (clearStockFirst) setCurrentStock(0)
        setSuccessMsg(`${res.message} (${res.data.sku} -> ${res.data.status})`)
        onSaved({
          ...editingProduct,
          status: res.data.status,
          currentStock: clearStockFirst ? 0 : currentStock,
        })
      } else {
        const res = await productsService.restoreProduct(editingProduct.sku)
        setStatus(res.data.status)
        setSuccessMsg(`${res.message} (${res.data.sku} -> ${res.data.status})`)
        onSaved({
          ...editingProduct,
          status: res.data.status,
        })
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message} (${err.errorCode})`)
        if (err.errorCode === 'PROD_HAS_STOCK') {
          setHasStockConflict(true)
        }
      } else {
        setErrorMsg('Không thể chuyển trạng thái sản phẩm')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setHasStockConflict(false)
    setSuccessMsg(null)
    setIsSubmitting(true)

    const numericPrice = Number(retailPriceDisplay.replace(/\D/g, ''))
    const numericTax =
      parseFloat(taxRatePercent.replace('%', '').trim()) / 100 || 0.1

    try {
      if (editingProduct) {
        // UC-PROD-06: PUT /api/v1/products/{sku}
        const res = await productsService.updateProduct(editingProduct.sku, {
          productName: productName.trim(),
          brandCode,
          categoryCode,
          unit,
          volume,
          packagingDetail: specInput.trim(),
          skinType,
          shelfLifeMonths: Number(shelfLifeMonths) || 36,
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
          volume,
          skinType,
          retailPrice: numericPrice,
          taxRate: numericTax,
          minStockAlert: Number(minStockAlert) || 5,
          barcode,
          images: images.map((img) => img.url),
          packagingDetail: specInput,
          shelfLifeMonths: Number(shelfLifeMonths) || 36,
          description,
        })

        let createdProduct = res.data
        // Also support UC-PROD-09 multipart upload after create if pendingFiles exist
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
        setSuccessMsg(
          `Thêm sản phẩm "${createdProduct.productName}" (${createdProduct.sku}) thành công!`
        )
        setProductName('')
        setImages([])
        setPendingFiles([])
        setSku(`SKU-${brandCode}-${Math.floor(100 + Math.random() * 900)}`)
        handleGenerateBarcode()
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(`${err.message} (${err.errorCode})`)
      } else {
        setErrorMsg('Không thể lưu sản phẩm. Vui lòng kiểm tra lại dữ liệu.')
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
            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-800 space-y-2">
                <p>{errorMsg}</p>
                {hasStockConflict && editingProduct && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-red-200/80">
                    <span className="text-[11px] text-red-700 font-medium">
                      Tồn kho hiện tại của {editingProduct.sku}:{' '}
                      <strong>{currentStock}</strong> đơn vị (Quy tắc
                      UC-PROD-07).
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleProductStatus(true)}
                      className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      Xuất/Đặt tồn kho = 0 & Ngừng kinh doanh
                    </button>
                  </div>
                )}
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800">
                {successMsg}
              </div>
            )}

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
                      + Tạo mới
                    </button>
                  </div>
                  <select
                    value={brandCode}
                    onChange={(e) => setBrandCode(e.target.value)}
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
                    {editingProduct && (
                      <span className="text-[10px] font-semibold text-[#8c7265]">
                        (Cố định theo UC-PROD-06)
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={sku}
                    disabled={Boolean(editingProduct)}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="SKU-EL-ANR50"
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 disabled:bg-zinc-100 disabled:text-zinc-500 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 font-mono text-sm font-bold text-[#221712] outline-none transition"
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

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    Dung tích / Trọng lượng *
                  </label>
                  <input
                    type="text"
                    value={specInput}
                    onChange={(e) => handleSpecChange(e.target.value)}
                    placeholder="Chai thủy tinh 50ml"
                    className="mt-1.5 w-full rounded-xl bg-[#fceddf]/70 border border-transparent focus:border-[#d57252] focus:bg-white px-4 py-3 text-sm text-[#221712] outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    Hạn sử dụng tối đa
                  </label>
                  <div className="mt-1.5 relative">
                    <input
                      type="number"
                      min={1}
                      value={shelfLifeMonths}
                      onChange={(e) => setShelfLifeMonths(e.target.value)}
                      className="w-full rounded-xl bg-[#efefef] border border-transparent focus:border-[#d57252] focus:bg-white pl-4 pr-16 py-3 text-sm font-semibold text-[#5a5a5a] outline-none transition"
                    />
                    <span className="absolute right-4 top-3 text-sm text-[#6b5a50]">
                      Tháng
                    </span>
                  </div>
                </div>
              </div>

              {/* Parsed API fields bar: unit + volume + skinType */}
              <div className="rounded-2xl bg-[#fdf7f3] border border-[#eedcd0] p-3.5 grid sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#6e5446]">
                    Đơn vị tính (unit *)
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white border border-[#e5d2c5] px-2.5 py-1.5 text-xs font-semibold text-[#221712]"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6e5446]">
                    Dung tích tách (volume)
                  </label>
                  <input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="50ml"
                    className="mt-1 w-full rounded-lg bg-white border border-[#e5d2c5] px-2.5 py-1.5 text-xs font-mono font-semibold text-[#221712]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6e5446]">
                    Loại da (skinType)
                  </label>
                  <select
                    value={skinType}
                    onChange={(e) =>
                      setSkinType(e.target.value as ProductSkinType)
                    }
                    className="mt-1 w-full rounded-lg bg-white border border-[#e5d2c5] px-2.5 py-1.5 text-xs font-medium text-[#221712]"
                  >
                    {SKIN_OPTIONS.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
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

              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-[#221712]">
                    Định mức tồn an toàn (Min stock)
                  </label>
                  <div className="mt-1.5 relative max-w-[240px]">
                    <input
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
                          ? 'Đang kinh doanh (ACTIVE)'
                          : 'Ngừng kinh doanh (INACTIVE)'}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleToggleProductStatus(false)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        status === 'ACTIVE'
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {status === 'ACTIVE' ? (
                        <>
                          <Ban className="size-3.5" />
                          <span>Ngừng KD (UC-PROD-07)</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          <span>Khôi phục (UC-PROD-08)</span>
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

              {/* Image Upload Dropzone (UC-PROD-09 & UC-PROD-10) */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#221712]">
                    Hình ảnh mỹ phẩm sản phẩm (UC-PROD-09 & UC-PROD-10)
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
                          title={`Xóa hình ảnh #${img.imageId} (UC-PROD-10)`}
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
                  ? 'Lưu cập nhật sản phẩm (UC-PROD-06)'
                  : 'Lưu & Tiếp tục tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
