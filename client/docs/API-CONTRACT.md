# API contract (frontend đề xuất cho backend)

> Quy ước chung: [../../CLAUDE.md](../../CLAUDE.md) mục 5.1. Mock trong `src/mocks/` phải trả đúng như file này.
> Mỗi endpoint một mục theo mẫu dưới. Đổi contract đã có thì ghi lý do vào QUYET-DINH.md.

## Mẫu

### `POST /purchase-orders/{id}/confirm` — STK-01
- **Quyền:** `STOCK_IMPORT`
- **Request:** header `Idempotency-Key`; body `{}`
- **Response 200:** `PurchaseOrderDetail`
- **Lỗi:** `404 STK_PO_NOT_FOUND`, `409 STK_PO_ALREADY_CONFIRMED`, `422 STK_PO_EMPTY`
- **Ghi chú:** bấm 2 lần không cộng tồn 2 lần (luật 30).

---

## Kiểu dùng chung

```ts
type ApiSuccessResponse<T> = { success: true; message?: string; data: T }
type ApiErrorResponse = { success: false; errorCode: string; message: string; errors?: { field: string; message: string }[] }
type PaginatedData<T> = { items: T[]; page: number; pageSize: number; totalItems: number }
```

<!-- Agent thêm các mục theo module bên dưới: AUTH, PRODUCT, SUPPLIER, INVENTORY, CUSTOMER, PROMOTION, POS, REPORT, SYSTEM -->

## Quy ước chung cho mọi endpoint dưới đây

- Header `Authorization: Bearer <accessToken>` cho mọi endpoint, trừ endpoint ghi **Công khai**.
- `401 AUTH_UNAUTHORIZED`: thiếu/sai token, phiên bị thu hồi, tài khoản bị khóa. FE gọi `POST /auth/refresh-token` một lần rồi gọi lại; vẫn 401 thì đăng xuất.
- `403 AUTH_FORBIDDEN`: thiếu quyền ghi ở mục **Quyền** (mã quyền khai báo trong `src/domain/permissions.ts`).
- `400 COMMON_VALIDATION_FAILED`: body sai kiểu/thiếu trường; `errors = [{ field, message }]`.
- `404 COMMON_NOT_FOUND`: không có API.
- Danh sách: query `page` (từ 1), `pageSize` (mặc định 20), `keyword`; trả `PaginatedData<T>`.
- Kiểu dữ liệu (`AuthUser`, `UserItem`, `CustomerItem`, `ProductItem`…) lấy theo `src/types/api.ts`.

> **GĐ0:** các endpoint dưới đây ghi **đúng như service hiện tại đang gọi** (code sprint 1–2). Chỗ lệch DATABASE.md/KHUYEN_MAI.md (5 loại khuyến mãi cũ, trường hiển thị phụ trong `UserItem`/`CustomerItem`…) sửa ở GĐ3 và ghi lý do vào QUYET-DINH.md.

## AUTH

### `POST /auth/login` — AUTH-01
- **Quyền:** Công khai
- **Request:** `{ username: string, password: string }` — `username` nhận username hoặc mã nhân viên (`LUM-084`, `LUM084`).
- **Response 200:** `{ accessToken, refreshToken, user: AuthUser }`; `user.permissions` là danh sách mã quyền hiệu lực.
- **Lỗi:** `401 AUTH_INVALID_CREDENTIALS` (kèm số lần sai), `403 AUTH_ACCOUNT_LOCKED` (Admin khóa), `403 AUTH_ACCOUNT_TEMP_LOCKED` (sai 5 lần → khóa 15 phút, luật 46).
- **Ghi chú:** `user.mustChangePassword = true` thì FE bắt đổi mật khẩu trước khi dùng (luật 47).

### `POST /auth/refresh-token`
- **Quyền:** Công khai
- **Request:** `{ refreshToken }` · **Response 200:** `{ accessToken, refreshToken }` (xoay vòng, token cũ hết hiệu lực)
- **Lỗi:** `401 AUTH_REFRESH_TOKEN_INVALID`

### `POST /auth/logout` — AUTH-02
- **Quyền:** Công khai (có token thì thu hồi phiên của token đó)
- **Request:** `{ refreshToken }` · **Response 200:** `null`

### `POST /auth/change-password` — AUTH-03
- **Quyền:** đã đăng nhập
- **Request:** `{ oldPassword, newPassword }` · **Response 200:** `null`; đặt `mustChangePassword = false`
- **Lỗi:** `400 AUTH_OLD_PASSWORD_INCORRECT`, `422 AUTH_PASSWORD_POLICY_VIOLATED` (≥ 8 ký tự, có hoa, thường, số)

### `GET /users/me`
- **Quyền:** đã đăng nhập · **Response 200:** `AuthUser`

### `GET /users` — AUTH-04
- **Quyền:** `USER_MANAGE`
- **Query:** `keyword` (họ tên, mã NV, username, email, SĐT), `role`, `status` (`ACTIVE`/`LOCKED`), `page`, `pageSize`
- **Response 200:** `PaginatedData<UserItem>`

### `POST /users` — AUTH-04
- **Quyền:** `USER_MANAGE`
- **Request:** `{ employeeCode, username, password, fullName, email, phoneNumber, roleIds: number[] }`
- **Response 201:** `{ id, employeeCode, username }`; tài khoản mới có `mustChangePassword = true`
- **Lỗi:** `409 USER_EXISTED` (trùng username/mã NV/email), `400 ROLE_NOT_FOUND`

### `GET /users/{idOrCode}` — AUTH-04
- **Quyền:** `USER_MANAGE` · `idOrCode`: id, mã nhân viên hoặc username · **Response 200:** `UserItem`
- **Lỗi:** `404 USER_NOT_FOUND`

### `PATCH /users/{id}` — AUTH-04
- **Quyền:** `USER_MANAGE`
- **Request:** `{ fullName?, email?, phoneNumber?, jobTitle? }` · **Response 200:** `UserItem`
- **Lỗi:** `404 USER_NOT_FOUND`, `409 USER_EXISTED` (email trùng)

### `POST /users/{id}/lock` — AUTH-04
- **Quyền:** `USER_MANAGE`
- **Request:** `{ reason?: string }` · **Response 200:** `UserItem` (`status = LOCKED`)
- **Lỗi:** `404 USER_NOT_FOUND`, `409 USER_ALREADY_LOCKED`, `422 AUTH_CANNOT_LOCK_SELF` (luật 48)
- **Ghi chú:** thu hồi mọi phiên của tài khoản ngay (luật 52).

### `POST /users/{id}/unlock` — AUTH-04
- **Quyền:** `USER_MANAGE` · **Request:** `{}` · **Response 200:** `UserItem` (xóa cả khóa tạm `lockedUntil`, đặt lại số lần sai)
- **Lỗi:** `404 USER_NOT_FOUND`, `409 USER_NOT_LOCKED`

### `GET /rbac/roles` — AUTH-05
- **Quyền:** `ROLE_MANAGE`
- **Response 200:** `RbacRole[]` = `{ id, roleCode, roleName, isSystem, description, shortCode, badgeNote, permissionIds: number[], _count: { userRoles } }`

### `GET /rbac/permissions` — AUTH-05
- **Quyền:** `ROLE_MANAGE`
- **Response 200:** `Record<module, RbacPermissionItem[]>`, `RbacPermissionItem = { id, permissionCode, permissionName, module, moduleTitle, immutableForRoles? }`
- **Ghi chú:** danh sách quyền seed sẵn theo `src/domain/permissions.ts`, không có API thêm/xóa quyền (luật 51).

### `PUT /rbac/roles/{roleId}/permissions` — AUTH-05
- **Quyền:** `ROLE_MANAGE`
- **Request:** `{ permissionIds: number[] }` · **Response 200:** `{ roleId, totalPermissions }`
- **Lỗi:** `404 ROLE_NOT_FOUND`, `400 PERMISSION_NOT_FOUND`, `422 AUTH_ADMIN_PERMISSION_REQUIRED` (bỏ `USER_MANAGE`/`ROLE_MANAGE` của ADMIN, luật 49)
- **Ghi chú:** ghi audit log.

### `POST /rbac/roles/reset-default` — AUTH-05
- **Quyền:** `ROLE_MANAGE` · **Request:** `{}` · **Response 200:** `RbacRole[]` (ma trận về mặc định của `domain/permissions.ts`). Ghi audit log.

### `GET /audit-logs` — AUTH-06
- **Quyền:** `AUDIT_LOG_VIEW`
- **Query:** `roleCode`, `page`, `pageSize` (mặc định 50) · **Response 200:** `PaginatedData<AuditLogItem>`
- **Ghi chú:** cấu trúc `AuditLogItem` hiện theo màn RBAC cũ; GĐ6 đổi theo bảng AUDIT_LOGS.

## PRODUCT

### `GET /products` — PROD-01
- **Quyền:** `PRODUCT_VIEW`
- **Query:** `keyword` (tên, SKU, barcode, thương hiệu), `brandCode`, `categoryCode`, `status` (`ACTIVE`/`INACTIVE`/`LOW_STOCK`), `page`, `pageSize`
- **Response 200:** `PaginatedData<ProductItem>` (kèm `categoryName`, `brandName`)

### `GET /products/{sku}` — PROD-01
- **Quyền:** `PRODUCT_VIEW` · **Response 200:** `ProductItem` · **Lỗi:** `404 PROD_NOT_FOUND`

### `POST /products` — PROD-01
- **Quyền:** `PRODUCT_MANAGE`
- **Request:** `{ sku, productName, categoryCode, brandCode, unit, volume?, skinType?, retailPrice (>0), taxRate (≥0), minStockAlert?, barcode?, images?: string[], packagingDetail?, shelfLifeMonths?, description? }`
- **Response 201:** `ProductItem`
- **Lỗi:** `409 PROD_SKU_DUPLICATED`, `409 PROD_BARCODE_DUPLICATED`, `404 PROD_CATEGORY_NOT_FOUND`, `404 PROD_BRAND_NOT_FOUND`

### `PUT /products/{sku}` — PROD-01
- **Quyền:** `PRODUCT_MANAGE` · **Request:** như POST, bỏ `sku`, `images` · **Response 200:** `ProductItem`
- **Lỗi:** `404 PROD_NOT_FOUND`, `404 PROD_CATEGORY_NOT_FOUND`, `404 PROD_BRAND_NOT_FOUND`, `409 PROD_BARCODE_DUPLICATED`

### `PATCH /products/{sku}/deactivate` — PROD-01
- **Quyền:** `PRODUCT_MANAGE` · **Response 200:** `{ sku, status: 'INACTIVE' }`
- **Lỗi:** `404 PROD_NOT_FOUND`, `409 PROD_HAS_STOCK` (còn tồn)

### `PATCH /products/{sku}/restore` — PROD-01
- **Quyền:** `PRODUCT_MANAGE` · **Response 200:** `{ sku, status: 'ACTIVE' }` · **Lỗi:** `404 PROD_NOT_FOUND`

### `POST /products/{sku}/images` — PROD-01
- **Quyền:** `PRODUCT_MANAGE`
- **Request:** `multipart/form-data`, trường `files` (1–5 tệp JPEG/PNG/WEBP, ≤ 5 MB/tệp)
- **Response 201:** `{ sku, images: { imageId, url }[] }`
- **Lỗi:** `404 PROD_NOT_FOUND`, `422 PROD_IMAGE_INVALID`

### `DELETE /products/{sku}/images/{imageId}` — PROD-01
- **Quyền:** `PRODUCT_MANAGE` · **Response 200:** `null` · **Lỗi:** `404 PROD_NOT_FOUND`, `404 PROD_IMAGE_NOT_FOUND`

### `GET /categories`, `GET /categories/{categoryCode}` — PROD-02
- **Quyền:** `PRODUCT_VIEW` · **Query:** `keyword`, `status`, `page`, `pageSize`
- **Response 200:** `PaginatedData<CategoryItem>` / `CategoryItem` (kèm `productCount`) · **Lỗi:** `404 PROD_CATEGORY_NOT_FOUND`

### `POST /categories` — PROD-02
- **Quyền:** `PRODUCT_MANAGE` · **Request:** `{ categoryCode, categoryName, description? }` · **Response 201:** `CategoryItem`
- **Lỗi:** `409 PROD_CATEGORY_DUPLICATED`

### `PUT /categories/{categoryCode}` — PROD-02
- **Quyền:** `PRODUCT_MANAGE` · **Request:** `{ categoryName, description? }` · **Response 200:** `CategoryItem` · **Lỗi:** `404 PROD_CATEGORY_NOT_FOUND`

### `PATCH /categories/{categoryCode}/deactivate`, `PATCH /categories/{categoryCode}/restore` — PROD-02
- **Quyền:** `PRODUCT_MANAGE` · **Response 200:** `{ categoryCode, status }`
- **Lỗi:** `404 PROD_CATEGORY_NOT_FOUND`, `409 PROD_CATEGORY_HAS_PRODUCTS` (còn sản phẩm đang kinh doanh, chỉ khi deactivate)

### `GET /brands`, `GET /brands/{brandCode}` — PROD-03
- Như danh mục: **Quyền** `PRODUCT_VIEW`; `PaginatedData<BrandItem>` / `BrandItem`; `404 PROD_BRAND_NOT_FOUND`

### `POST /brands`, `PUT /brands/{brandCode}` — PROD-03
- **Quyền:** `PRODUCT_MANAGE` · **Request:** `{ brandCode, brandName, description? }` / `{ brandName, description? }`
- **Response:** `201`/`200 BrandItem` · **Lỗi:** `409 PROD_BRAND_DUPLICATED`, `404 PROD_BRAND_NOT_FOUND`

### `PATCH /brands/{brandCode}/deactivate`, `PATCH /brands/{brandCode}/restore` — PROD-03
- **Quyền:** `PRODUCT_MANAGE` · **Response 200:** `{ brandCode, status }`
- **Lỗi:** `404 PROD_BRAND_NOT_FOUND`, `409 PROD_BRAND_HAS_PRODUCTS`

## CUSTOMER

### `GET /customers` — CUS-01
- **Quyền:** `CUSTOMER_VIEW`
- **Query:** `keyword` (mã, SĐT, tên, email), `phone` (khớp đúng SĐT, dùng kiểm trùng), `tierId`, `status`, `sortBy` (mặc định chi tiêu giảm dần, `SPENT_ASC`, `POINTS_DESC`), `page`, `pageSize`
- **Response 200:** `PaginatedData<CustomerItem>`

### `GET /customers/{customerCode}` — CUS-01
- **Quyền:** `CUSTOMER_VIEW` · **Response 200:** `CustomerItem` · **Lỗi:** `404 CUS_NOT_FOUND`

### `POST /customers` — CUS-02
- **Quyền:** `CUSTOMER_EDIT`
- **Request:** `{ fullName, phoneNumber (10–11 số), email?, dateOfBirth? (YYYY-MM-DD), gender?, address?, skinType?, note?, status? }`
- **Response 201:** `CustomerItem` (hạng mặc định BRONZE, 0 điểm)
- **Lỗi:** `409 CUS_PHONE_DUPLICATED`

### `PUT /customers/{customerCode}` — CUS-02
- **Quyền:** `CUSTOMER_EDIT` · **Request:** các trường như POST, đều tùy chọn, **không có `status`** · **Response 200:** `CustomerItem`
- **Lỗi:** `404 CUS_NOT_FOUND`, `409 CUS_PHONE_DUPLICATED`

### `POST /customers/{customerCode}/deactivate`, `POST /customers/{customerCode}/activate` — CUS-02
- **Quyền:** `CUSTOMER_LOCK` (thu ngân không có) · **Request:** `{}` · **Response 200:** `CustomerItem` · **Lỗi:** `404 CUS_NOT_FOUND`

### `GET /loyalty-config` — CUS-05
- **Quyền:** đã đăng nhập (POS cần đọc) · **Response 200:** `LoyaltyConfigData`

### `PUT /loyalty-config` — CUS-05
- **Quyền:** `LOYALTY_CONFIG`
- **Request:** `{ amountPerPoint (>0), redemptionValuePerPoint?, tiers: { tier: BRONZE|SILVER|GOLD|DIAMOND, minSpend }[] }`
- **Response 200:** `LoyaltyConfigData`
- **Lỗi:** `422 CUS_TIER_SPEND_INVALID` (BRONZE = 0, hạng sau lớn hơn hạng trước)

## PROMOTION

### `GET /promotions` — PROM-01
- **Quyền:** `PROMOTION_VIEW` · **Query:** `keyword` (mã, tên), `status`, `page`, `pageSize` · **Response 200:** `PaginatedData<PromotionItem>`

### `POST /promotions` — PROM-02
- **Quyền:** `PROMOTION_MANAGE`
- **Request:** `CreatePromotionRequest` (kiểu cũ: `PERCENT_ORDER`, `FIXED_ORDER`, `BUY_X_GET_Y`, `COMBO`, `STEP_DISCOUNT`)
- **Response 201:** `PromotionItem`
- **Lỗi:** `409 PROM_VOUCHER_DUPLICATED`, `422 PROM_DATE_RANGE_INVALID`, `422 PROM_LIMIT_PER_CUSTOMER_INVALID`, `422 PROM_DISCOUNT_VALUE_INVALID`
- **Ghi chú:** GĐ3 đổi sang 7 loại theo KHUYEN_MAI.md.

### `PUT /promotions/{voucherCode}` — PROM-02
- **Quyền:** `PROMOTION_MANAGE` · **Request:** `Partial<CreatePromotionRequest>` · **Response 200:** `PromotionItem`
- **Lỗi:** `404 PROM_NOT_FOUND`, `409 PROM_FIELD_LOCKED` (đã có đơn dùng: chỉ được gia hạn, tăng lượt — luật 10)

### `PATCH /promotions/{voucherCode}/pause` — PROM-02
- **Quyền:** `PROMOTION_MANAGE` · **Response 200:** `{ voucherCode, status }` (đảo `ACTIVE` ↔ `PAUSED`)
- **Lỗi:** `404 PROM_NOT_FOUND`, `409 PROM_STATUS_INVALID`

### `GET /promotions/{voucherCode}/report` — PROM-04
- **Quyền:** `PROMOTION_REPORT` · **Response 200:** `PromotionReportData` · **Lỗi:** `404 PROM_NOT_FOUND`
- **Ghi chú:** mock trả số liệu minh họa; tính thật từ đơn hàng ở GĐ6.

## POS

### `GET /shifts/current` — POS-01
- **Quyền:** `POS_VIEW` · **Response 200:** `{ hasOpenShift, shift: ShiftInfo | null }` — ca `OPEN` của người đăng nhập

### `POST /shifts/open` — POS-01
- **Quyền:** `POS_SHIFT_OPEN`
- **Request:** `{ openingCash: number }` (số nguyên ≥ 0) · **Response 201:** `ShiftInfo`
- **Lỗi:** `409 POS_SHIFT_ALREADY_OPEN` (luật 35)

### `POST /shifts/{shiftId}/close` — POS-05 (tạm)
- **Quyền:** `POS_SHIFT_CLOSE`
- **Request:** `{}` · **Response 200:** `ShiftInfo` (`status = CLOSED`)
- **Lỗi:** `404 POS_SHIFT_NOT_FOUND`, `403 POS_SHIFT_NOT_OWNER`, `409 POS_SHIFT_NOT_OPEN`
- **Ghi chú:** GĐ5 bổ sung kiểm đếm tiền, giải trình lệch (luật 37), chặn khi còn đơn nháp (luật 36).

## SUPPLIER (SUPP-01..03)

Quy ước chung: `SupplierItem = Supplier + { orderCount, totalPurchaseAmount, lastPurchaseDate, brands[], draftOrderCount }` (số liệu tính từ phiếu nhập `COMPLETED`). `phoneNumber` UNIQUE; không có công nợ (luật 58). Ngừng hợp tác = `INACTIVE`, không xóa.

### `GET /suppliers` — SUPP-02
- **Quyền:** `SUPPLIER_VIEW` · **Query:** `keyword` (tên, mã, MST, SĐT, người liên hệ, thương hiệu), `status` (`ACTIVE|INACTIVE`), `page`, `pageSize`
- **Response 200:** `{ items: SupplierItem[], page, pageSize, totalItems, summary: { total, active, inactive, totalOrders, totalPurchaseAmount } }`

### `GET /suppliers/{id}` — SUPP-02
- **Quyền:** `SUPPLIER_VIEW` · **Response 200:** `SupplierItem` · **Lỗi:** `404 SUPP_NOT_FOUND`

### `GET /suppliers/{id}/products` — SUPP-02
- **Quyền:** `SUPPLIER_VIEW` · **Response 200:** `{ productId, sku, productName, brandName, totalQuantity, lastUnitCost, lastPurchaseDate }[]` (sản phẩm từng có trong phiếu nhập `COMPLETED` của NCC; không có bảng gán)

### `POST /suppliers` — SUPP-01
- **Quyền:** `SUPPLIER_MANAGE` · **Request:** `{ supplierName, taxCode?, phoneNumber, email?, address, contactPerson?, note? }` · **Response 201:** `SupplierItem` (mã `NCCxxx` do hệ thống sinh)
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `409 SUPP_PHONE_DUPLICATED`, `409 SUPP_EMAIL_DUPLICATED`, `409 SUPP_TAX_CODE_DUPLICATED`

### `PUT /suppliers/{id}` — SUPP-01
- **Quyền:** `SUPPLIER_MANAGE` · **Request:** như tạo mới · **Response 200:** `SupplierItem` · **Lỗi:** như tạo mới + `404 SUPP_NOT_FOUND`

### `POST /suppliers/{id}/deactivate` — SUPP-01
- **Quyền:** `SUPPLIER_MANAGE` · **Request:** `{ acknowledgeDraft?: boolean }` · **Response 200:** `SupplierItem` (`INACTIVE`)
- **Lỗi:** `404 SUPP_NOT_FOUND`, `409 SUPP_ALREADY_INACTIVE`, `409 SUPP_HAS_DRAFT_ORDERS` (còn phiếu nhập `DRAFT`, gửi lại với `acknowledgeDraft = true` để vẫn ngừng)

### `POST /suppliers/{id}/activate` — SUPP-01
- **Quyền:** `SUPPLIER_MANAGE` · **Response 200:** `SupplierItem` (`ACTIVE`) · **Lỗi:** `404 SUPP_NOT_FOUND`, `409 SUPP_ALREADY_ACTIVE`

## STOCK · Nhập kho (STK-01)

Kiểu: `PurchaseOrder` (header: `id, poCode, supplierId, supplierCode, supplierName, supplierInvoiceNo, totalAmount, status DRAFT|COMPLETED|CANCELLED, note, createdBy, createdByName, createdAt, confirmedAt, lineCount, totalQuantity`), `PurchaseOrderDetail = PurchaseOrder + lines[]` (dòng: `id, productId, sku, productName, lotCode, mfgDate, expDate, quantity, unitCost, lineTotal, batchId, existingBatch?`), `PurchaseWarning = { type: ROTATE_SHELF|NEAR_EXPIRY|EXPIRED|COST_AVERAGED, lineIndex, sku, lotCode, message }`. Mã phiếu `PNyyyymmdd-nn`. Tiền là số nguyên đồng.

### `GET /purchase-orders` — STK-01, SUPP-03
- **Quyền:** `STOCK_IMPORT_VIEW` · **Query:** `keyword` (mã phiếu, tên NCC, số hóa đơn), `status`, `supplierId`, `page`, `pageSize` · **Response 200:** `PaginatedData<PurchaseOrder>` (mới nhất trước)

### `GET /purchase-orders/{id}` — STK-01
- **Quyền:** `STOCK_IMPORT_VIEW` · **Response 200:** `PurchaseOrderDetail` · **Lỗi:** `404 STK_PO_NOT_FOUND`

### `POST /purchase-orders` — STK-01 (lưu nháp)
- **Quyền:** `STOCK_IMPORT_CREATE` · **Request:** `{ supplierId, supplierInvoiceNo?, note?, lines: [{ productId, lotCode, mfgDate?, expDate, quantity (>0), unitCost (>=0) }] }` · **Response 201:** `PurchaseOrderDetail` (`DRAFT`)
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `404 SUPP_NOT_FOUND`, `404 PROD_NOT_FOUND`, `422 STK_SUPPLIER_INACTIVE` (chỉ NCC `ACTIVE`), `422 STK_PRODUCT_INACTIVE`, `422 STK_DUPLICATE_LOT` (trùng sản phẩm + mã lô trong phiếu), `422 STK_EXP_DATE_INVALID` (HSD phải sau ngày nhập), `422 STK_MFG_DATE_INVALID`

### `PUT /purchase-orders/{id}` — STK-01
- **Quyền:** `STOCK_IMPORT_CREATE` · **Request / Lỗi:** như tạo mới · **Response 200:** `PurchaseOrderDetail`
- **Lỗi thêm:** `409 STK_PO_NOT_EDITABLE` (chỉ sửa `DRAFT`; phiếu `COMPLETED` không sửa/xóa, luật 41)

### `POST /purchase-orders/preview-warnings` — STK-01
- **Quyền:** `STOCK_IMPORT_VIEW` · **Request:** `{ lines: [{ productId, lotCode, expDate }] }` · **Response 200:** `PurchaseWarning[]` (không ghi dữ liệu). Cảnh báo xoay kệ khi HSD lô mới sớm hơn lô còn tồn (luật 31), cận hạn/quá hạn theo `EXPIRY_WARNING_DAYS`, giá vốn bình quân khi lô đã có (luật 29).

### `POST /purchase-orders/{id}/confirm` — STK-01
- **Quyền:** `STOCK_IMPORT_CREATE` · **Header bắt buộc:** `Idempotency-Key` · **Response 200:** `{ order: PurchaseOrderDetail, warnings: PurchaseWarning[] }`
- Một giao dịch: với mỗi dòng tạo lô mới hoặc cộng vào lô `(productId, lotCode)` đã có (giá vốn bình quân gia quyền), cộng `onHandQty`, ghi `STOCK_MOVEMENTS` `PURCHASE` (`balanceAfter`, `createdBy`), gán `batchId`, đặt `COMPLETED` + `confirmedAt`. Lỗi ở bất kỳ dòng nào thì không ghi gì (luật 28, 40).
- Gửi lại cùng `Idempotency-Key` cho cùng phiếu: trả lại kết quả cũ (`warnings: []`), không cộng tồn lần hai (luật 30).
- **Lỗi:** `400 COMMON_IDEMPOTENCY_KEY_REQUIRED`, `409 COMMON_IDEMPOTENCY_KEY_REUSED`, `409 STK_PO_ALREADY_CONFIRMED` (khóa khác nhưng phiếu đã hoàn tất), `409 STK_PO_NOT_EDITABLE` (đã hủy), `409 STK_BATCH_LOCKED` (lô đang khóa kiểm kho), `422 STK_LOT_EXP_MISMATCH` (lô đã có nhưng khác HSD), cùng các lỗi nghiệp vụ như tạo mới

### `POST /purchase-orders/{id}/cancel` — STK-01
- **Quyền:** `STOCK_IMPORT_CREATE` · **Response 200:** `PurchaseOrderDetail` (`CANCELLED`) · **Lỗi:** `404 STK_PO_NOT_FOUND`, `409 STK_PO_NOT_EDITABLE`

## STOCK · Tồn kho theo lô, cận hạn (STK-02, STK-03)

`StockBatchItem`: `id, productId, sku, productName, barcode, brandName, categoryName, unit, isSellable, lotCode, mfgDate, expDate, daysToExpiry, expiryStatus (OK|NEAR_EXPIRY|EXPIRED), availableQty, fefoRank` và, **chỉ khi người gọi có `STOCK_VIEW` hoặc `STOCK_EXPIRY_VIEW`**, thêm `onHandQty, blockedQty, costPrice, lockedByCheckId, createdAt`. Người chỉ có `STOCK_VIEW_AVAILABLE` (thu ngân) chỉ nhận lô bán được (`availableQty > 0`) và không có các trường tồn thực, cách ly, giá vốn.
`availableQty = onHandQty − blockedQty`, bằng 0 nếu lô hết hạn (`expDate < hôm nay`), đang khóa kiểm kho hoặc SKU `isSellable = false` (luật 24, 26). `expiryStatus` theo `EXPIRY_WARNING_DAYS`. `fefoRank`: thứ tự trong sản phẩm (1 = xuất trước), null nếu không bán được.

### `GET /stock/batches` — STK-02, STK-03
- **Quyền:** `STOCK_VIEW` | `STOCK_VIEW_AVAILABLE` | `STOCK_EXPIRY_VIEW` · **Query:** `keyword` (SKU, tên, mã lô, mã vạch), `expiry` (`ALL|WARNING|NEAR_EXPIRY|EXPIRED|OK`, `WARNING` = cận hạn + hết hạn), `categoryCode`, `productId`, `quarantined=true`, `inStockOnly=true`, `page`, `pageSize` (4 bộ lọc cuối chỉ có tác dụng với người xem đủ) · **Response 200:** `PaginatedData<StockBatchItem>` sắp theo FEFO (HSD sớm trước)

### `GET /stock/summary` — STK-02
- **Quyền:** `STOCK_VIEW` | `STOCK_EXPIRY_VIEW` · **Response 200:** `{ skuCount, lotCount, nearExpiryLots, expiredLots, quarantinedUnits, quarantinedValue, expiryWarningDays }` (chỉ tính lô còn tồn thực > 0)

### `GET /stock/fefo?code=` — STK-02 (nút "Quét FEFO", D19)
- **Quyền:** `STOCK_VIEW` | `STOCK_VIEW_AVAILABLE` · **Query:** `code` = barcode hoặc SKU · **Response 200:** `{ productId, sku, productName, barcode, batches: StockBatchItem[] }` (chỉ lô bán được, sắp FEFO)
- **Lỗi:** `400 COMMON_VALIDATION_FAILED` (thiếu code), `404 PROD_NOT_FOUND`

### `GET /stock/batches/{id}` — STK-02
- **Quyền:** `STOCK_VIEW` | `STOCK_EXPIRY_VIEW` · **Response 200:** `StockBatchDetail = StockBatchItem + { supplierName, retailPrice, pendingDisposalQty, movements: [{ id, batchId, referenceType, referenceId, referenceCode, quantityChange, balanceAfter, reason, createdBy, createdByName, createdAt }] }` (thẻ kho mới nhất trước) · **Lỗi:** `404 STK_BATCH_NOT_FOUND`

## STOCK · Kiểm kho (STK-04, STK-05)

Kiểu: `InventoryCheck` (`id, checkCode (CHKyyyymmdd-nn), scopeNote, status IN_PROGRESS|WAITING_APPROVAL|APPROVED|REJECTED|CANCELLED|NO_DIFFERENCE, snapshotAt, createdBy, createdByName, submittedAt, approvedBy, approvedByName, approvedAt, rejectReason, lineCount, differenceLineCount, totalDifference`), `InventoryCheckDetail = InventoryCheck + lines[]` (dòng: `id, batchId, productId, sku, productName, lotCode, expDate, snapshotQty, countedQty (null = chưa nhập), differenceQty, note`).

### `GET /inventory-checks`
- **Quyền:** `STOCK_CHECK_VIEW` · **Query:** `keyword` (mã phiếu, phạm vi), `status`, `page`, `pageSize` · **Response 200:** `PaginatedData<InventoryCheck>`

### `GET /inventory-checks/{id}`
- **Quyền:** `STOCK_CHECK_VIEW` · **Response 200:** `InventoryCheckDetail` · **Lỗi:** `404 STK_CHECK_NOT_FOUND`

### `POST /inventory-checks` — STK-04 (bắt đầu kiểm: chụp tồn + khóa lô)
- **Quyền:** `STOCK_CHECK_CREATE` · **Request:** `{ scopeNote?, batchIds: number[] (>= 1) }` · **Response 201:** `InventoryCheckDetail` (`IN_PROGRESS`, `snapshotQty` = tồn lúc bấm, mỗi lô `lockedByCheckId` = id phiếu)
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `404 STK_BATCH_NOT_FOUND`, `409 STK_BATCH_LOCKED` (lô đang bị phiếu khác khóa)

### `PUT /inventory-checks/{id}/counts` — STK-04 (lưu nháp)
- **Quyền:** `STOCK_CHECK_CREATE` · **Request:** `{ lines: [{ lineId, countedQty: number | null, note? }] }` (`null` = chưa nhập; ô trống không phải 0) · **Response 200:** `InventoryCheckDetail`
- **Lỗi:** `404 STK_CHECK_LINE_NOT_FOUND`, `409 STK_CHECK_NOT_IN_PROGRESS`

### `POST /inventory-checks/{id}/submit` — STK-04
- **Quyền:** `STOCK_CHECK_CREATE` · **Request:** như `counts` (lưu số đếm lần cuối rồi gửi) · **Response 200:** `InventoryCheckDetail`
- Mọi dòng phải có `countedQty`; tính `differenceQty = countedQty − snapshotQty`; gỡ khóa các lô. Không dòng nào chênh lệch thì `NO_DIFFERENCE` (tự hoàn tất, luật 32); ngược lại `WAITING_APPROVAL`.
- **Lỗi:** `422 STK_CHECK_INCOMPLETE`, `409 STK_CHECK_NOT_IN_PROGRESS`

### `POST /inventory-checks/{id}/cancel` — STK-04
- **Quyền:** `STOCK_CHECK_CREATE` · **Response 200:** `InventoryCheckDetail` (`CANCELLED`, gỡ khóa lô) · **Lỗi:** `409 STK_CHECK_NOT_IN_PROGRESS`

### `POST /inventory-checks/{id}/approve` — STK-05
- **Quyền:** `STOCK_ADJUST_APPROVE` · **Response 200:** `InventoryCheckDetail` (`APPROVED`)
- Một giao dịch: với mỗi dòng `differenceQty ≠ 0` cộng `differenceQty` vào `onHandQty` **hiện tại** của lô (không đặt lại bằng số đếm) và ghi `STOCK_MOVEMENTS` `CHECK_ADJUST`.
- **Lỗi:** `409 STK_CHECK_NOT_WAITING`, `422 STK_INSUFFICIENT_STOCK` (tồn hiện tại không đủ để trừ), `422 STK_BLOCKED_EXCEEDS_ON_HAND`

### `POST /inventory-checks/{id}/reject` — STK-05
- **Quyền:** `STOCK_ADJUST_APPROVE` · **Request:** `{ reason }` (bắt buộc) · **Response 200:** `InventoryCheckDetail` (`REJECTED`, tồn không đổi)
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `409 STK_CHECK_NOT_WAITING`
