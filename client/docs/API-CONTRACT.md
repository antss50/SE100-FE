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

## PROMOTION (PROM-01, PROM-02)

Kiểu: `PromotionView` = bản ghi PROMOTIONS (DATABASE.md mục 24, camelCase: `id, promotionName, description, promotionType, status DRAFT|ACTIVE|PAUSED, voucherCode, customerId, applyScope, discountType, discountValue, maxDiscountAmount, fixedPrice, comboPrice, buyQuantity, isRepeatable, minOrderValue, minTierId, startAt, endAt, dailyStartTime, dailyEndTime, weekdays ("1,3,5"), maxQuantity, usageLimit, limitPerCustomer, createdBy, createdAt, updatedAt`) kèm bảng con `items[{productId, role TARGET|BUY|GIFT|COMBO_ITEM, quantity}]`, `brandIds[]`, `categoryIds[]`, `steps[{minOrderValue, discountType, discountValue, maxDiscountAmount}]` và các trường tính: `phase UPCOMING|RUNNING|ENDED` (theo ngày), `usedCount` (đếm từ đơn COMPLETED), `locked` (`usedCount > 0`), `minTierName`, `customerName`. 7 loại: `PRODUCT_DISCOUNT, FLASH_PRICE, BUY_X_GET_Y, COMBO, ORDER_TIERED, VOUCHER, ORDER_GIFT`.

### `GET /promotions` — PROM-01
- **Quyền:** `PROMOTION_VIEW` · **Query:** `keyword` (tên, mã voucher), `type`, `status`, `phase`, `page`, `pageSize` · **Response 200:** `PaginatedData<PromotionView>`

### `GET /promotions/{id}` — PROM-01
- **Quyền:** `PROMOTION_VIEW` · **Response 200:** `PromotionView` · **Lỗi:** `404 PROM_NOT_FOUND`

### `POST /promotions` — PROM-02
- **Quyền:** `PROMOTION_MANAGE`
- **Request:** các cột PROMOTIONS ở trên (trừ `id, createdBy, createdAt, updatedAt`) kèm `status?: DRAFT|ACTIVE` (mặc định `DRAFT`) và bảng con. Cột bắt buộc theo loại: `PRODUCT_DISCOUNT` (applyScope, discountType, discountValue + sản phẩm/thương hiệu/danh mục theo scope), `FLASH_PRICE` (fixedPrice + sản phẩm TARGET), `BUY_X_GET_Y` (buyQuantity + BUY + GIFT), `COMBO` (comboPrice + >= 2 COMBO_ITEM), `ORDER_TIERED` (>= 1 bậc, không trùng ngưỡng), `ORDER_GIFT` (minOrderValue + GIFT), `VOUCHER` (voucherCode, discountType, discountValue). Cột không thuộc loại được lưu NULL.
- **Response 201:** `PromotionView`
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `409 PROM_VOUCHER_DUPLICATED`, `422 PROM_INVALID` (thiếu cột theo loại), `422 PROM_DATE_RANGE_INVALID`, `422 PROM_LIMIT_PER_CUSTOMER_INVALID`

### `PUT /promotions/{id}` — PROM-02
- **Quyền:** `PROMOTION_MANAGE` · **Request:** như `POST` · **Response 200:** `PromotionView`
- Đã có đơn dùng (`locked`): chỉ được đổi `promotionName`, `description`, `endAt`; đổi mức giảm, điều kiện hay bảng con trả `409 PROM_FIELD_LOCKED` (luật 10).
- **Lỗi:** `404 PROM_NOT_FOUND`, `409 PROM_FIELD_LOCKED`, và các lỗi của `POST`

### `PATCH /promotions/{id}/status` — PROM-02
- **Quyền:** `PROMOTION_MANAGE` · **Request:** `{ status: ACTIVE|PAUSED }` · **Response 200:** `PromotionView`
- `DRAFT → ACTIVE`, `ACTIVE ↔ PAUSED`.
- **Lỗi:** `404 PROM_NOT_FOUND`, `409 PROM_STATUS_INVALID`

> `GET /promotions/{code}/report` (PROM-04) sẽ viết lại ở GĐ3 (tính từ đơn hàng thật).

## POS · Ca bán hàng (POS-01, POS-05)

Kiểu: `CashierShift` (CASHIER_SHIFTS: `shiftId, shiftCode (CAyyyymmdd-nn), cashierId, cashierName, openedAt, openingCash, closedAt, expectedCash, actualCash, differenceAmount, note, status OPEN|CLOSED, handoverConfirmedBy, handoverConfirmedByName`), `ShiftSummary` (tính từ đơn và phiếu trả, không lưu: `orderCount, returnCount, draftCount, cashSales, transferSales, cardSales, cashCollected, cashRefunded, expectedCash, totalSales, totalRefunded`). Tiền mặt thu của đơn = `totalAmount − exchangeCreditAmount` (chỉ đơn `CASH`); `expectedCash = openingCash + cashCollected − cashRefunded` (chỉ phiếu trả `refundMethod = CASH`).

### `GET /shifts/current` — POS-01
- **Quyền:** `POS_VIEW` · **Response 200:** `{ hasOpenShift, shift: CashierShift | null }` — ca `OPEN` của người đăng nhập

### `GET /shifts` — POS-05 (lịch sử ca)
- **Quyền:** `POS_VIEW` (thu ngân chỉ thấy ca của mình; có `POS_SHIFT_HANDOVER_CONFIRM` thì thấy mọi ca) · **Query:** `status OPEN|CLOSED`, `keyword` (mã ca, thu ngân), `page`, `pageSize` · **Response 200:** `PaginatedData<CashierShift & { summary: ShiftSummary }>`

### `GET /shifts/{id}` — POS-05 (chi tiết ca)
- **Quyền:** `POS_VIEW` · **Response 200:** `{ shift, summary, orders: OrderListItem[], returns: ReturnListItem[] }`
- **Lỗi:** `404 POS_SHIFT_NOT_FOUND`, `403 AUTH_FORBIDDEN` (thu ngân xem ca người khác)

### `POST /shifts/open` — POS-01
- **Quyền:** `POS_SHIFT_OPEN` · **Request:** `{ openingCash: number }` (số nguyên ≥ 0) · **Response 201:** `CashierShift`
- **Lỗi:** `409 POS_SHIFT_ALREADY_OPEN` (luật 35)

### `POST /shifts/{id}/close` — POS-05 (kiểm đếm, chốt ca)
- **Quyền:** `POS_SHIFT_CLOSE` (chỉ thu ngân mở ca) · **Request:** `{ actualCash: number (>= 0), note? }` · **Response 200:** `{ shift, summary }` (`CLOSED`, ghi `expectedCash`, `actualCash`, `differenceAmount = actual − expected`)
- **Lỗi:** `404 POS_SHIFT_NOT_FOUND`, `403 POS_SHIFT_NOT_OWNER`, `409 POS_SHIFT_NOT_OPEN`, `422 POS_SHIFT_HAS_DRAFT` (còn đơn nháp, luật 36), `422 POS_SHIFT_NOTE_REQUIRED` (lệch tiền thì bắt buộc giải trình, luật 37)

### `POST /shifts/{id}/confirm-handover` — POS-05
- **Quyền:** `POS_SHIFT_HANDOVER_CONFIRM` · **Response 200:** `CashierShift` (`handoverConfirmedBy` = người xác nhận; ghi audit)
- **Lỗi:** `404 POS_SHIFT_NOT_FOUND`, `409 POS_SHIFT_NOT_CLOSED`, `409 POS_HANDOVER_ALREADY_CONFIRMED`

## POS · Bán hàng và thanh toán (POS-02, POS-03, PROM-03, CUS-04)

Giá luôn do máy chủ tính bằng đúng thuật toán 4 tầng ở KHUYEN_MAI.md (FE không gửi số tiền, không tin số từ FE). Kiểu: `CartInput` (`items: [{ productId, quantity, batchId? }], customerId, voucherCode, pointsRequested, exchangeReturnId?`; `batchId` có giá trị = thu ngân đổi lô thủ công), `OrderQuote` (`lines[] { key, productId, sku, productName, quantity, unitPrice, lineType NORMAL|GIFT, linePromotionId/Name, promoGroupNo, lineDiscount, tierDiscount, orderDiscount, pointsDiscount, lineTotal, taxAmount, allocations[] { batchId, lotCode, expDate, quantity, overridden } }, subtotalAmount, lineDiscountAmount, tierDiscountAmount, orderPromotionId/Name, orderDiscountAmount, pointsUsed, pointsDiscountAmount, discountAmount, taxAmount, totalAmount, exchangeCreditAmount, amountDue, messages[], issues[] { productId, message }, pointsToEarn, maxRedeemablePoints`), `OrderRecord` (ORDERS kèm `lines[]` ORDER_DETAILS, camelCase 1-1 DATABASE.md mục 27-28, thêm `cashierName, customerName, customerPhone, orderPromotionName, voucherCode, pointsEarned, draftCart`).

### `GET /pos/products` — POS-02
- **Quyền:** `POS_CHECKOUT` · **Query:** `keyword` (tên, SKU, barcode), `code` (khớp đúng barcode/SKU, dùng khi quét), `page`, `pageSize` · **Response 200:** `PaginatedData<PosProduct>` (`id, sku, barcode, productName, brandName, categoryName, retailPrice, sellableQty, firstLotCode, firstLotExpDate, nearExpiry`)
- Chỉ SKU `ACTIVE`, `isSellable = true` và còn tồn bán được (luật 24, 34); không lộ `onHandQty`, `blockedQty`, giá vốn.

### `GET /pos/products/{id}/lots` — POS-02
- **Quyền:** `POS_CHECKOUT` · **Response 200:** `PosLot[]` (`batchId, lotCode, expDate, sellableQty, nearExpiry`) theo FEFO; chỉ lô còn hạn, không khóa kiểm kho, `onHand − blocked > 0` (để đổi lô thủ công)

### `POST /orders/quote` — POS-02, POS-03
- **Quyền:** `POS_CHECKOUT` (`PROMOTION_APPLY_VOUCHER` nếu có `voucherCode`, `LOYALTY_REDEEM` nếu `pointsRequested > 0`) · **Request:** `CartInput` · **Response 200:** `OrderQuote` (không ghi gì)
- Tính giá bằng `calculateOrder` (tầng 1 dòng hàng, tầng 2 hạng thẻ, tầng 3 bậc thang/voucher/quà, tầng 4 điểm), phân bổ lô FEFO tách lô (lô thu ngân chọn tay đứng đầu). Thiếu tồn thì ghi vào `issues`, không báo lỗi. Voucher không dùng được / thua bậc thang thì lý do nằm ở `messages`.
- **Lỗi:** `404 POS_PRODUCT_NOT_FOUND`, `422 POS_PRODUCT_NOT_SELLABLE`, `422 POS_QUANTITY_INVALID`, `404 CUS_NOT_FOUND`, `422 POS_CUSTOMER_INACTIVE`, `404 STK_BATCH_NOT_FOUND`, `422 POS_BATCH_EXPIRED`, `422 POS_BATCH_NOT_SELLABLE`, `403 AUTH_FORBIDDEN`

### `POST /orders/complete` — POS-03 (hoàn tất = 1 giao dịch, luật 40)
- **Quyền:** `POS_CHECKOUT` · **Request:** `CartInput` + `{ paymentMethod: CASH|BANK_TRANSFER|CARD, amountReceived?, draftId? }` · **Response 201:** `OrderRecord` (`COMPLETED`)
- Một giao dịch: tính lại giá/lô/lượt voucher; kiểm tiền; mỗi dòng (kể cả quà) trừ lô qua thẻ kho `SALE` (`referenceId` = id đơn); ghi ORDERS/ORDER_DETAILS (`unitCost` = giá vốn lô); khách đang hoạt động thì ghi `REDEEM` (−điểm dùng), `EARN` (`floor((totalAmount − exchangeCreditAmount) / POINT_EARN_AMOUNT)`, đơn đổi hàng tích theo tiền khách thực nộp), cộng `totalSpent` (`totalAmount`), xét hạng ngay (chỉ tăng); đổi lô tay khác lô FEFO đầu tiên thì ghi audit `OVERRIDE_FEFO`. Đơn đổi hàng (`exchangeReturnId`): `amountDue = totalAmount − exchangeCreditAmount`, gắn `exchangeOrderId` cho phiếu trả.
- **Lỗi:** `409 POS_SHIFT_NOT_OPEN`, `409 POS_DRAFT_NOT_FOUND`, `422 POS_CART_EMPTY`, `422 POS_INSUFFICIENT_STOCK`, `422 PROM_VOUCHER_INVALID`, `422 POS_POINTS_EXCEED_LIMIT`, `422 POS_CASH_INSUFFICIENT` (tiền mặt thiếu, luật 39), `422 RET_EXCHANGE_BELOW_CREDIT` (hàng mới < hàng cũ), `409 RET_EXCHANGE_ALREADY_USED`, `404 RET_NOT_FOUND`, `422 RET_NOT_EXCHANGE`, `409 STK_BATCH_LOCKED`, `422 STK_INSUFFICIENT_STOCK`, và các lỗi của `quote`

### `GET /orders/drafts`, `POST /orders/drafts`, `POST /orders/{id}/cancel` — POS-02 (đơn nháp)
- **Quyền:** `POS_CHECKOUT`. `GET` trả `OrderListItem[]` đơn nháp của người đăng nhập. `POST /orders/drafts` nhận `CartInput + { draftId? }` (có `draftId` = cập nhật), cần ca đang mở, trả `OrderRecord` `DRAFT` (có `draftCart`, chưa trừ tồn). `POST /orders/{id}/cancel` chỉ cho đơn nháp của chính mình (`CANCELLED`).
- **Lỗi:** `409 POS_SHIFT_NOT_OPEN`, `422 POS_CART_EMPTY`, `409 POS_DRAFT_NOT_FOUND`, `409 POS_ORDER_NOT_DRAFT` (chứng từ hoàn tất không hủy, luật 41), `403 AUTH_FORBIDDEN`, `404 POS_ORDER_NOT_FOUND`

### `GET /orders` — POS-03 (lịch sử đơn)
- **Quyền:** `POS_VIEW` (thu ngân chỉ thấy đơn của mình; có `POS_SHIFT_HANDOVER_CONFIRM` thì thấy mọi đơn) · **Query:** `keyword` (mã đơn, tên/SĐT khách), `status DRAFT|COMPLETED|CANCELLED`, `paymentMethod`, `fromDate`, `toDate` (`YYYY-MM-DD`), `shiftId`, `page`, `pageSize` · **Response 200:** `PaginatedData<OrderListItem> & { summary: { completedCount, totalRevenue, cashCollected } }`

### `GET /orders/{id}` — POS-03 (chi tiết đơn)
- **Quyền:** `POS_VIEW` · **Response 200:** `{ order: OrderRecord, returns: ReturnListItem[], returnedQuantities: { [orderDetailId]: number }, shiftCode }`
- **Lỗi:** `404 POS_ORDER_NOT_FOUND`, `403 AUTH_FORBIDDEN`

## POS · Đổi trả hàng (POS-04)

Kiểu: `ReturnOrderRecord` (RETURN_ORDERS kèm `lines[]` RETURN_ORDER_DETAILS, camelCase 1-1 DATABASE.md mục 29-30: `id, returnCode (RETyyyymmdd-nnnn), originalOrderId, originalOrderCode, shiftId, processedBy, processedByName, returnReason DEFECTIVE|CHANGE_OF_MIND, returnNote, totalRefundAmount, refundMethod CASH|BANK_TRANSFER|EXCHANGE, pointsRevoked, status, createdAt, exchangeOrderId, exchangeOrderCode`; dòng: `id, orderDetailId, productId, sku, productName, batchId, lotCode, quantity, lineKind RETURN|GIFT_CHARGE, refundAmount (âm với GIFT_CHARGE), unitCost, itemCondition INTACT|DAMAGED_OR_OPENED`), `ReturnListItem` (không có `lines`, có `lineCount`). Tiền hoàn tính bằng `calculateReturn` (KHUYEN_MAI.md mục 6): theo `lineTotal` đã lưu, không tính lại khuyến mãi, không hoàn lượt voucher, trừ giá trị quà khi mất điều kiện, thu hồi điểm theo tỷ lệ.

### `GET /orders/{id}/returnable` — POS-04
- **Quyền:** `POS_RETURN` · **Response 200:** `{ order: OrderRecord, lines: (OrderLine & { returnedQuantity, returnableQuantity })[], maxReturnDays, daysSincePurchase, expired }`
- **Lỗi:** `404 POS_ORDER_NOT_FOUND`, `422 RET_ORDER_NOT_COMPLETED`

### `POST /returns/quote` — POS-04
- **Quyền:** `POS_RETURN` · **Request:** `{ originalOrderId, reason, items: [{ orderDetailId, quantity, condition }] }` · **Response 200:** `{ lines: [{ orderDetailId, kind, quantity, refundAmount, toBlocked, productName }], totalRefund, pointsRevoked, messages[], refundMethod, cashShortfall }` (không ghi gì)
- `refundMethod` là hình thức thực tế: đổi ý luôn `EXCHANGE`; hoàn `CASH` mà két ca hiện tại không đủ tiền mặt (đầu ca + thu tiền mặt − chi hoàn tiền mặt) thì chuyển `BANK_TRANSFER` và `cashShortfall = true` (luật 23).
- **Lỗi:** `404 POS_ORDER_NOT_FOUND`, `422 RET_ORDER_NOT_COMPLETED`, `422 RET_EXPIRED` (quá `maxReturnDays`, luật 16), `422 RET_NO_ITEMS`, `422 RET_SEAL_BROKEN` (đổi ý mà hàng đã mở seal), `422 RET_DUPLICATE_LINE`, `404 RET_LINE_NOT_FOUND`, `422 RET_QUANTITY_EXCEEDED` (vượt số đã mua/còn lại), `422 RET_REFUND_NOT_ALLOWED`, `422 RET_INVALID`

### `POST /returns` — POS-04 (một giao dịch: nhận hàng + hoàn tiền)
- **Quyền:** `POS_RETURN` · **Request:** như `quote` + `{ note?, refundMethod: CASH|BANK_TRANSFER|EXCHANGE }` (đổi ý bắt buộc `EXCHANGE`) · **Response 201:** `ReturnOrderRecord` (`COMPLETED`, gắn ca hiện tại, không cần Manager duyệt, không cấp voucher bù)
- Một giao dịch: mỗi dòng `RETURN` cộng `onHandQty` lô gốc kèm thẻ kho `RETURN` (`referenceId` = id phiếu); hàng lỗi (`DEFECTIVE`) hoặc `DAMAGED_OR_OPENED` cộng cả `blockedQty` (cách ly); dòng `GIFT_CHARGE` không nhập kho; khách đang có hồ sơ thì ghi `REVOKE` (−điểm), trừ `totalSpent` bằng tiền hoàn, **không hạ hạng**; điểm đã dùng không hoàn.
- **Lỗi:** như `quote`, thêm `409 POS_SHIFT_NOT_OPEN`, `409 STK_BATCH_LOCKED`, `422 STK_BLOCKED_EXCEEDS_ON_HAND`
- Đổi hàng: sau phiếu `EXCHANGE`, thu ngân lập đơn bán với `exchangeReturnId` (xem `POST /orders/complete`).

### `GET /returns` — POS-04
- **Quyền:** `POS_VIEW` (thu ngân chỉ thấy phiếu của mình) · **Query:** `keyword` (mã phiếu, mã hóa đơn), `reason`, `page`, `pageSize` · **Response 200:** `PaginatedData<ReturnListItem>`

### `GET /returns/{id}` — POS-04
- **Quyền:** `POS_VIEW` · **Response 200:** `ReturnOrderRecord` · **Lỗi:** `404 RET_NOT_FOUND`, `403 AUTH_FORBIDDEN`

## SETTINGS · Cấu hình hệ thống (AUTH-07)

### `GET /settings/store`
- **Quyền:** đã đăng nhập (in hóa đơn) · **Response 200:** `{ name, address, phone }` (`STORE_NAME`, `STORE_ADDRESS`, `STORE_PHONE`)

### `GET /settings` — AUTH-07
- **Quyền:** `SYSTEM_SETTINGS_MANAGE` · **Response 200:** `{ settings: [{ key, value, description, kind number|text }], maxReturnDays }` — khóa: `EXPIRY_WARNING_DAYS, POINT_EARN_AMOUNT, POINT_REDEEM_VALUE, POINT_MAX_REDEEM_PERCENT, STORE_NAME, STORE_ADDRESS, STORE_PHONE`; `maxReturnDays` = `RETURN_POLICIES.max_return_days` của chính sách mặc định

### `PUT /settings` — AUTH-07
- **Quyền:** `SYSTEM_SETTINGS_MANAGE` · **Request:** `{ settings: { [key]: string }, maxReturnDays?: number (0-365) }` · **Response 200:** như `GET`. Ghi audit khi có thay đổi.
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `422 SET_KEY_UNKNOWN`, `422 SET_VALUE_INVALID` (số nguyên >= 1, riêng `EXPIRY_WARNING_DAYS` >= 0; `POINT_MAX_REDEEM_PERCENT` <= 100; chuỗi không rỗng)
- **Ghi chú:** `GET/PUT /loyalty-config` đọc/ghi `POINT_EARN_AMOUNT` và `POINT_REDEEM_VALUE` ở cùng nơi này (một nguồn sự thật).

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

## STOCK · Xuất hủy / tester / trả NCC (STK-06, STK-07)

Kiểu: `Disposal` (`id, disposalCode (DISPyyyymmdd-nn), issueType DESTROY|TESTER|RETURN_TO_SUPPLIER, reasonCode EXPIRED|NEAR_EXPIRY|DAMAGED|RECALL|RETURN_DEFECT|TESTER_USE, status WAITING_APPROVAL|APPROVED|REJECTED, reason, requestedBy, requestedByName, createdAt, approvedBy, approvedByName, approvedAt, rejectReason, lineCount, totalQuantity, totalCost (null đến khi duyệt)`), `DisposalDetail = Disposal + lines[]` (dòng: `id, batchId, productId, sku, productName, lotCode, expDate, quantity, blockedAddedQty, unitCost (null đến khi duyệt), itemReason`). Không có trạng thái Nháp (D8).

### `GET /disposals`
- **Quyền:** `STOCK_DISPOSAL_VIEW` · **Query:** `keyword` (mã phiếu, lý do), `status`, `issueType`, `page`, `pageSize` · **Response 200:** `PaginatedData<Disposal>`

### `GET /disposals/{id}`
- **Quyền:** `STOCK_DISPOSAL_VIEW` · **Response 200:** `DisposalDetail` · **Lỗi:** `404 STK_DISPOSAL_NOT_FOUND`

### `POST /disposals` — STK-06 (lập phiếu, cách ly ngay)
- **Quyền:** `STOCK_DISPOSAL_CREATE` · **Request:** `{ issueType, reasonCode, reason, lines: [{ batchId, quantity (>0), itemReason? }] }` · **Response 201:** `DisposalDetail` (`WAITING_APPROVAL`)
- Cho mỗi lô, `pending` = tổng `quantity` các phiếu `WAITING_APPROVAL` khác trên lô; `freeBlocked = blockedQty − pending`; nếu `quantity > freeBlocked` thì `blockedQty += quantity − freeBlocked` và ghi `blockedAddedQty` (luật 33). Chặn nếu `quantity > onHandQty − pending`. Tồn thực tế chưa đổi, chưa có thẻ kho.
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `404 STK_BATCH_NOT_FOUND`, `409 STK_BATCH_LOCKED` (lô đang khóa kiểm kho), `422 STK_DUPLICATE_LOT`, `422 STK_INSUFFICIENT_STOCK`, `422 STK_ISSUE_TYPE_NOT_ALLOWED` (SKU `isSellable=false` chỉ xuất bằng `TESTER`/`DESTROY`)

### `POST /disposals/{id}/approve` — STK-07
- **Quyền:** `STOCK_DISPOSAL_APPROVE` · **Response 200:** `DisposalDetail` (`APPROVED`)
- Một giao dịch: mỗi dòng `blockedQty −= quantity`, `onHandQty −= quantity`, ghi `STOCK_MOVEMENTS` (`DISPOSAL` / `TESTER` / `SUPPLIER_RETURN` theo `issueType`, `quantityChange = −quantity`), chụp `unitCost = costPrice` lô, tính `totalCost`.
- **Lỗi:** `404 STK_DISPOSAL_NOT_FOUND`, `409 STK_DISPOSAL_NOT_WAITING`, `409 STK_BATCH_LOCKED`

### `POST /disposals/{id}/reject` — STK-07
- **Quyền:** `STOCK_DISPOSAL_APPROVE` · **Request:** `{ reason }` (bắt buộc) · **Response 200:** `DisposalDetail` (`REJECTED`; `blockedQty −= blockedAddedQty` từng dòng, tồn thực tế không đổi)
- **Lỗi:** `400 COMMON_VALIDATION_FAILED`, `409 STK_DISPOSAL_NOT_WAITING`
