# Kiến thức dự án cho agent (đọc file này thay vì khám phá lại code)

> Mục đích: tiết kiệm token. Agent mới **đọc file này + CLAUDE.md + phần tài liệu nghiệp vụ của UC được giao**, rồi code luôn. Không `ls`/đọc lại toàn bộ `src/` để tìm hiểu cấu trúc. Chỉ mở file khi cần sửa nó.
> Agent học thêm điều gì mới (quy ước, bẫy, hàm dùng chung) thì **thêm vào mục 9 "Ghi chú tích lũy"** ở cuối file này, ngắn gọn.
> Cập nhật lần cuối: 2026-11-09 (sau GĐ0 + B1 + GĐ1 Kho + GĐ2 bán hàng).

## 1. Cách làm hiện tại (D21–D23)

- **Chưa viết test.** Không E2E, không component test, không unit test mới; không chạy `test`/`test:e2e`/`lint`. Test chạy theo đợt (D23): Đợt test 1 sau GĐ1+GĐ2, Đợt test 2 sau GĐ3; do fe-tester làm.
- Chỉ chạy `npm run build` (gồm `tsc -b`, chạy trong `SE100-FE/client`) **một lần trước mỗi commit** để chắc code biên dịch được. Lỗi kiểu thì sửa.
- Vẫn tuân luật nghiệp vụ và luật code trong CLAUDE.md (viết hàm thuần cho logic tiền/tồn đặt trong `src/domain/` để GĐ4 test dễ).
- Commit theo UC, không push. Ghi nhật ký `NHAT-KY-TIEN-DO.md` (1 dòng/commit là đủ), cập nhật trạng thái UC trong `TIEN-DO.md` thành `Đang test` (nghĩa: code xong, chờ GĐ4).
- Câu hỏi mở: ghi `Q<số>` vào TIEN-DO.md, không đoán.

## 2. Lệnh

Chạy trong `D:\do_an\SE100\SE100-FE\client`: `npm run dev` (Vite, đọc `.env.development` → `VITE_USE_MOCK=true`), `npm run build`. Git: repo `D:\do_an\SE100\SE100-FE`, nhánh `demo`. Git Bash dùng cú pháp POSIX.

## 3. Cây thư mục `client/src` (đã có)

```
app/store.ts            Zustand: useAuthStore (user, accessToken, setSession, clearSession), useUiStore
components/ui/          Button, ConfirmDialog, DataTable, Display (StatusBadge, StatCard, PageHeader), Feedback
                        (EmptyState, ErrorState, LoadingState), Input (FieldShell, Input, Select), Modal, Pagination,
                        Toast (toast.success/error...), cn, page-window — import từ '../../components/ui'
components/layouts/     AppLayout, Sidebar, Header (menu lấy từ routes/nav-config.ts)
domain/permissions.ts   PERMISSION_DEFINITIONS (46 mã quyền), hasPermission, ROLE→quyền; domain/pricing/ (tính giá 4 tầng, trả hàng)
features/<module>/      auth, common (ComingSoonPage), customers, dashboard, inventory (= sản phẩm/danh mục/thương hiệu),
                        pos (bản nháp cũ, viết lại GĐ2), promotions, rbac, users
lib/api-client.ts       apiRequest<T>(endpoint, {method, body: JSON.stringify(..)}) → ApiSuccessResponse<T>; ném ApiClientError
lib/query-keys.ts       queryKeys (mới có shifts, customers) — thêm key mới ở đây
mocks/                  adapter (xem mục 5)
routes/                 AppRoutes.tsx, nav-config.ts, guards.tsx
services/<module>.service.ts   chỉ gọi apiRequest; services/query.ts có toQueryString(params)
types/api.ts            kiểu chung + kiểu các module cũ. Module mới: tạo types/<module>.ts (stock.ts, suppliers.ts, pos.ts ...)
utils/format.ts         formatCurrency, formatNumber
```

Style màu: token Tailwind `@theme` trong `index.css` (`bg-accent-soft`, `text-muted`, `bg-success-soft`...). Chữ chính `#221712`, nhấn `#9a462d`, nền `#f9f3ee`. Icon `lucide-react`.

## 4. Thêm một UC mới — công thức (làm theo thứ tự này)

1. **Type** trong `src/types/<module>.ts` (camelCase 1-1 với cột DATABASE.md; enum giữ nguyên giá trị mục 7).
2. **Seed** trong `src/mocks/seed/<module>.ts` (hàm `seedXxx(today: Date)`, ngày tính tương đối bằng `addDays` từ `mocks/time.ts`).
3. **Bảng mock**: thêm vào `MockTables` + `buildSeed()` trong `mocks/db.ts`; **tăng `MOCK_DB_VERSION`** (đang là 7) mỗi khi đổi cấu trúc/seed.
4. **Handler** `src/mocks/handlers/<module>.ts` xuất mảng `MockRoute[]`; đăng ký trong `mocks/index.ts` (`mockRoutes`).
5. **Service** `src/services/<module>.service.ts` gọi `apiRequest`.
6. **Query key** trong `lib/query-keys.ts`.
7. **Màn hình** `src/features/<module>/...` dùng `useQuery`/`useMutation` (TanStack), form RHF + Zod, component `components/ui`.
8. **Route + menu**: `routes/nav-config.ts` đã khai báo mục và quyền cho đủ 40 UC (mục đang là "Đang phát triển" có `plannedPhase`). Làm màn thật thì: import lazy trong `AppRoutes.tsx` (`lazyNamed(() => import('../features/x/XPage'), 'XPage')`), thêm vào `PAGES['/đường-dẫn']`, **xóa `plannedPhase`** của mục đó; route con (chi tiết/tạo mới) thêm vào `SUB_ROUTES` kèm quyền.
9. **API-CONTRACT.md**: ghi endpoint (method, path, quyền, request, response, mã lỗi).

## 5. Mock adapter — API nội bộ

- `MockRoute = { method, path: '/purchase-orders/:id/confirm', public?, permission?: PermissionCode | PermissionCode[], handler(ctx) }`. Router tự trả 401 (chưa đăng nhập), 403 (thiếu quyền), 404/405.
- `ctx`: `{ method, path, params, query: URLSearchParams, body, headers, db: MockTransaction, user, permissions, accessToken, now }`.
- `ctx.db` (giao dịch): `read('table')` trả bản sao sửa trực tiếp được → sửa xong gọi `db.touch('table')`, hoặc `db.write('table', mảngMới)`; `db.nextSeq('tên')` sinh số tăng dần. Chỉ ghi xuống localStorage khi handler trả về thành công (`db.commit()` do router gọi); **ném lỗi = không ghi gì** (luật 40). Muốn trả lỗi nhưng vẫn ghi: `failAndCommit(status, code, msg)`.
- `mocks/http.ts`: `ok(data, message?, status=200)`, `new MockHttpError(status, errorCode, message, errors?)`, `notFound(code, msg)`, `parseBody(zodSchema, body)` (sai → 400 `COMMON_VALIDATION_FAILED`), `paginate(items, query, defaultPageSize=20)`, `keywordOf(query)`, `sameText(a,b)`.
- `mocks/time.ts`: `addDays`, `addMinutes`, `toDateOnly(d)` (`YYYY-MM-DD`), `toIsoLocal(d)`, `toQueryString` ở `services/query.ts`.
- Mã lỗi: `MODULE_ĐIỀU_GÌ` (vd `STK_PO_ALREADY_CONFIRMED`). 400 = body sai; 404; 409 = xung đột trạng thái; 422 = vi phạm luật nghiệp vụ.
- Mock bảng hiện có: users, passwords, sessions, permissions, roles, auditLogs, shifts, customers, categories, brands, products, loyaltyConfig, promotions, counters, **suppliers, purchaseOrders (kèm lines), batches, stockMovements, inventoryChecks (kèm lines), disposals (kèm lines), systemSettings, idempotencyKeys**. Ngưỡng cận hạn nằm trên từng sản phẩm (`products.expiryWarningValue/expiryWarningUnit (fallback products.expiryWarningDays)`).
- Ghi audit log từ handler: xem `mocks/handlers/rbac.ts` / `users.ts` (mẫu thêm vào bảng `auditLogs`).
- Thay đổi tồn kho trong mock: **luôn** kèm 1 dòng `stockMovements` cùng giao dịch (luật 28) và giữ `0 ≤ blockedQty ≤ onHandQty`. Helper dùng chung đã có ở `src/mocks/stock-ledger.ts` (xem mục 9 dòng GĐ1).

## 6. Phân quyền

Mã quyền kho/NCC đã có sẵn: `STOCK_IMPORT_VIEW|CREATE`, `STOCK_VIEW`, `STOCK_VIEW_AVAILABLE`, `STOCK_EXPIRY_VIEW`, `STOCK_CHECK_VIEW|CREATE`, `STOCK_ADJUST_APPROVE`, `STOCK_DISPOSAL_VIEW|CREATE|APPROVE`, `SUPPLIER_VIEW|MANAGE`. POS: `POS_VIEW`, `POS_SHIFT_OPEN`, `POS_CHECKOUT`, `POS_RETURN`, `POS_SHIFT_CLOSE`, `POS_SHIFT_HANDOVER_CONFIRM`. Khác: `PRODUCT_VIEW|MANAGE`, `CUSTOMER_VIEW|EDIT|LOCK`, `LOYALTY_REDEEM|CONFIG`, `PROMOTION_VIEW|MANAGE|APPLY_VOUCHER|REPORT`, `REPORT_*`, `USER_MANAGE`, `ROLE_MANAGE`, `AUDIT_LOG_VIEW`, `SYSTEM_SETTINGS_MANAGE`. Hạ tầng đã khớp ma trận mục 4; **không đổi** `domain/permissions.ts` trừ khi thiếu mã quyền (thì thêm cả vào role map).

Ẩn nút theo quyền trong component: lấy `permissions` từ `useAuthStore((s) => s.user?.permissions)` rồi `hasPermission(permissions, 'MÃ_QUYỀN')`.

## 7. Seed hiện có

- Tài khoản (mật khẩu `Password@123`): `admin`, `manager01`, `cashier01`, `inventory01`, `newstaff` (mustChangePassword), `trang.bui` (LOCKED).
- `mocks/seed/catalog.ts`: danh mục `CAT_*`, thương hiệu, sản phẩm (kiểu `ProductItem` ở `types/api.ts`, **chưa có** `isSellable`, `productId` số — nếu thiếu thì thêm vào type + seed và ghi QUYET-DINH).
- `seed/customers.ts`, `seed/loyalty.ts`, `seed/promotions.ts` (5 loại KM cũ, sửa ở GĐ2), `seed/rbac.ts`, `seed/users.ts`.

## 8. Bảng đối chiếu nhanh UC → tài liệu → thiết kế

Xem CLAUDE.md mục 3 (UC → PDF). Tài liệu: bảng trong `docs/DATABASE.md` (mục lục ở đầu file; dùng `grep -n "^### "` để nhảy tới bảng cần), đặc tả UC trong `docs/DANH_GIA_USECASE.md` mục 2.x, luật trong `docs/QUY_TAC_NGHIEP_VU.md`. Không cần đọc cả file; đọc đúng mục.

Đọc PDF thiết kế: công cụ Read với đường dẫn tuyệt đối (mỗi file 1 trang). Bản ảnh thu nhỏ đã có sẵn ở `C:\Users\huypro37\AppData\Local\Temp\claude\c49ed172c34b796d\df3167b6-cb14-40ea-bb7a-cac1083dd7b2\scratchpad\ui\NN.png` (+ `NN.txt` text trích ra) — dùng nếu còn tồn tại để đỡ render lại; PDF gốc vẫn là nguồn chính. Số thứ tự: 01 Chi tiết đơn, 02 Lịch sử đơn, 03 POS, 04 Phiếu trả, 05–09 Kiểm kê (chi tiết chờ duyệt, danh sách, từ chối, nhập kết quả, tạo phiếu/chọn lô), 10–12 Xuất đặc biệt (chi tiết, danh sách, tạo phiếu trả NCC), 16 Chi tiết nhập kho, 17 Danh sách nhập kho, 18 Form nhập kho, 19 Chi tiết NCC, 20 Danh sách NCC, 21 Form NCC, 22 Biên bản chốt ca, 23 Chi tiết ca, 24 Lịch sử ca, 25 Chi tiết SP tồn kho, 26 Danh sách tồn kho theo lô. Số 13–15, 27–29 là bản Atelier (chỉ tham khảo, D2).

## 9. Ghi chú tích lũy (agent thêm dòng mới ở đây)

- GĐ0: `playwright.config.ts` chạy cổng 5174 (B1 đã sửa, commit 1e1a035, 87dbd31). Dev server 5173 của người dùng: không đụng.
- GĐ0: trang "Đang phát triển" = `features/common/ComingSoonPage.tsx`, hiện cho mọi mục menu chưa có trong `PAGES`.
- Tiếng Việt có dấu trong mọi chuỗi giao diện; file TS/TSX UTF-8.
- GĐ1 Kho — **`mocks/stock-ledger.ts`** (POS/đổi trả GĐ2 phải dùng, không tự sửa `onHandQty`): `applyStockChange(db, {batch, change, referenceType, referenceId, reason, userId, now})` đổi tồn + ghi thẻ kho `balanceAfter` + cập nhật `products.currentStock`, ném 422 nếu tồn âm hoặc blocked > onHand; `adjustBlockedQty(db, batch, delta)` đổi cách ly (không có thẻ kho); `findBatchByLot`, `findBatchById`, `assertBatchNotLocked` (409 `STK_BATCH_LOCKED`), `todayOf(now)`, `nextTableId(db, counter, maxHienCo)`, `referenceCodeOf` (mã chứng từ cho thẻ kho; thêm case SALE/RETURN khi có đơn).
- GĐ1 — domain thuần (GĐ4 test): `domain/stock/batch.ts` (`expiryStatus`, `daysUntilExpiry`, `sellableQty`, `compareFefo`, `weightedAverageCost`), `domain/stock/purchase-warnings.ts` (`collectPurchaseWarnings`). POS FEFO ở GĐ2 dùng lại `sellableQty` + `compareFefo`; endpoint `GET /stock/fefo?code=` đã trả lô bán được theo FEFO.
- GĐ1 — mock stock API: `GET /stock/batches` trả thêm `onHandQty/blockedQty/costPrice` **chỉ khi** người gọi có `STOCK_VIEW` hoặc `STOCK_EXPIRY_VIEW`; thu ngân (`STOCK_VIEW_AVAILABLE`) chỉ nhận lô bán được và không có 3 trường đó. Seed kho: 9 SKU (id 1-9, SKU 9 là tester hãng `isSellable=false`), 16 lô (cận hạn, hết hạn, cách ly, tester), 5 phiếu nhập COMPLETED + 1 DRAFT, 4 phiếu kiểm kho (APPROVED/WAITING/NO_DIFFERENCE/REJECTED), 2 phiếu xuất khác (TESTER APPROVED, DESTROY WAITING); tồn lô luôn bằng tổng thẻ kho.
- GĐ1 — UI dùng chung mới: `app/usePermission.ts` (`useCan(quyền)`), `utils/error.ts` (`getErrorMessage`), `utils/format.ts` thêm `formatDate`/`formatDateTime`, `features/stock/LotPicker.tsx` (chọn lô cho kiểm kho/xuất khác), `ExpiryBadge`, `FefoScanPanel`. Chuyển trang kèm dữ liệu qua `navigate(path, { state: { batchIds, issueType } })` (màn Tồn kho → `/inventory-checks/new`, `/disposals/new`).
- GĐ1 — cách chạy thử mock mà không viết test: bundle bằng `npx rolldown src/mocks/index.ts --format esm --platform node -o <scratchpad>/mocks.mjs`, `sed` thay `import.meta.env.VITE_MOCK_DELAY_MS` bằng `"0"`, polyfill `localStorage` bằng Map rồi gọi `handleMockRequest(path, {method, headers: new Headers(...), body})` trong một file `.mjs` ở scratchpad (không đưa vào repo). Đã kiểm: nhập kho + idempotency + bình quân gia quyền, kiểm kho, xuất khác, quyền thu ngân.
- Công cụ Bash của agent đôi khi báo `unexpected EOF while looking for matching '` với heredoc/chuỗi chứa dấu nháy lẫn tiếng Việt: ghi file bằng công cụ Write/Edit thay vì heredoc dài.
- GĐ2 — **bán hàng** (mock = "máy chủ"): `mocks/sales-engine.ts` `priceCart(db, cart, now, {exchangeCreditAmount})` = `domain/pricing.calculateOrder` + phân bổ lô FEFO (lô đổi tay đứng đầu) → `OrderQuote`; `mocks/sales-complete.ts` `completeSale` (một giao dịch: trừ tồn bằng `applyStockChange` `SALE`, ghi ORDERS/ORDER_DETAILS, tích/dùng điểm bằng `mocks/loyalty.ts` `recordPoints`, xét hạng, audit `OVERRIDE_FEFO`); `mocks/returns-engine.ts` (`evaluateReturn` dùng `calculateReturn`, `describeReturnable`); `mocks/sales-views.ts` (`summarizeShift`, `cashInDrawer`, `amountDueOf`); `mocks/promotion-engine.ts` (`buildUsageIndex` đếm lượt từ đơn COMPLETED, `toDomainPromotions`). Bảng mock mới: `orders` (kèm `lines`, đơn nháp lưu `draftCart`), `returns` (kèm `lines`), `returnPolicies`; `promotions` đổi sang `PromotionRecord` (DATABASE.md 24, id số); `shifts` = `CashierShift`. `MOCK_DB_VERSION = 7`.
- GĐ2 — FE bán hàng: `features/pos/` (PosPage + `components/` + `pos-store.ts` Zustand giỏ nháp + `receipt.ts` in hóa đơn bằng cửa sổ mới, lỗi in chỉ báo), `features/orders/`, `features/returns/`, `features/shifts/`, `features/settings/`, `features/promotions/` (PromotionFormModal + PromotionEditors). Phím tắt POS F1-F4, F8, F9 gắn ở `PosPage`. Services: `orders.service.ts`, `returns.service.ts`, `shifts.service.ts`, `settings.service.ts`, `promotions.service.ts` (theo id). Kiểu: `types/pos.ts`, `types/promotions.ts`, `types/settings.ts`. Điểm dùng/giá trị 1 điểm: `SYSTEM_SETTINGS` là nguồn duy nhất (`mocks/loyalty.ts` `loyaltySettings`).
- GĐ2 — bẫy: nhiều file trong repo là CRLF nên `node -e` replace chuỗi nhiều dòng hay trượt (dùng công cụ Edit, hoặc regex `\r?\n`); `node -e` trong bash với chuỗi tiếng Việt có dấu nháy/`${}` dễ vỡ, ghi file bằng Write. Chạy thử mock: bundle `npx rolldown src/mocks/index.ts --format esm --platform node -o <scratch>/mocks.mjs` rồi `sed` VITE_MOCK_DELAY_MS thành `"0"`; đã có kịch bản bán hàng, hoàn tất, chốt ca, trả hàng, đổi hàng chạy qua (scratchpad, không đưa vào repo). Router mock chặn người `mustChangePassword` ngoài nhóm `/auth` (luật 47).
- Hoàn tất GĐ2 — **seed đơn mẫu** ở `mocks/seed/sales.ts` (`seedSales`, gọi cuối `buildSeed`): chạy `completeSale`/`createReturn`/`saveDraft` thật trên `MockTransaction` bộ nhớ (`new MockTransaction(tables)` không chạm localStorage), mỗi bước bọc `attempt` (hoàn nguyên nếu lỗi). Kết quả: 12 đơn (11 COMPLETED + 1 nháp), 2 phiếu trả (1 hàng lỗi hoàn tiền mặt, 1 đổi hàng + đơn đổi), 3 ca CLOSED của `cashier01` (ngày -3, -2, -1; ca -2 lệch -20.000 có giải trình; ca -3 đã xác nhận bàn giao), 1 ca OPEN + đơn nháp của `newstaff` (hôm nay). `cashier01` KHÔNG có ca mở (test mở ca được). Chi tiêu/điểm 6 khách đã cộng theo đơn. `MOCK_DB_VERSION = 8`. Kiểm bằng rolldown + node (thẻ kho = tồn lô, đúng với 6 ngày mẫu khác nhau).
- Mã mới: nhân viên `NV0001..NV0006` (bỏ định dạng LUM-xxx; đăng nhập bằng mã NV vẫn được, `NV0003` = cashier01), khách `KH0001..KH0006` (khách mới = `KH0007`). `POST /users` bỏ trống `employeeCode` thì tự sinh `NV<số tiếp>`.
- CUS-05: `LoyaltyTierThreshold.discountPercent` (0-100) lưu ở `loyaltyConfig`; POS đọc hiện hành qua `tierDiscountRateOf(db, tierCode)` (`mocks/loyalty.ts`), không dùng `customer.tier.discountRate` (bản chụp cũ). Voucher riêng 1 khách: ô tìm SĐT ở `PromotionFormModal` (`VoucherCustomerField`), domain đã chặn khách khác (luật 11).
- In hóa đơn: `printReceipt` dùng iframe ẩn trong trang (không `window.open`). Lô chọn tay trong đơn nháp không còn bán được thì `priceCart` quay về FEFO và thêm `messages`, không ném lỗi.
- Seed đơn làm khuyến mãi dùng trong đó bị `locked` (đã có đơn): 1, 2, 5, 6, 7, 8, 9 ... — E2E sửa khuyến mãi nên tạo KM mới hoặc dùng KM 3, 10-13.
- Audit (D47): `mocks/audit.ts` có `AUDIT_RULES` (method+path → action/module) chạy trong `router.dispatch` trước `commit`; thêm thao tác ghi mới thì thêm một dòng luật, không cần sửa handler. Seed cũ dùng `writeAudit`, `appendAuditLog` đã bỏ. Test: `mocks/audit-flows.test.ts`.
- PROM-04: `domain/reports/promotion-effect.ts` (`buildPromotionEffect`); trang `features/reports/PromotionEffectPage.tsx`, route con `promotions/:promotionId/report`, nút "Xem hiệu quả" ở danh sách KM (quyền `PROMOTION_REPORT`). Mặc định kỳ = quý này.
