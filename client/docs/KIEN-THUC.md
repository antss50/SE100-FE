# Kiến thức dự án cho agent (đọc file này thay vì khám phá lại code)

> Mục đích: tiết kiệm token. Agent mới **đọc file này + CLAUDE.md + phần tài liệu nghiệp vụ của UC được giao**, rồi code luôn. Không `ls`/đọc lại toàn bộ `src/` để tìm hiểu cấu trúc. Chỉ mở file khi cần sửa nó.
> Agent học thêm điều gì mới (quy ước, bẫy, hàm dùng chung) thì **thêm vào mục 9 "Ghi chú tích lũy"** ở cuối file này, ngắn gọn.
> Cập nhật lần cuối: 2026-11-09 (sau GĐ0 + B1).

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
3. **Bảng mock**: thêm vào `MockTables` + `buildSeed()` trong `mocks/db.ts`; **tăng `MOCK_DB_VERSION`** (đang là 2) mỗi khi đổi cấu trúc/seed.
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
- Mock bảng hiện có: users, passwords, sessions, permissions, roles, auditLogs, shifts, customers, categories, brands, products, loyaltyConfig, promotions, counters.
- Ghi audit log từ handler: xem `mocks/handlers/rbac.ts` / `users.ts` (mẫu thêm vào bảng `auditLogs`).
- Thay đổi tồn kho trong mock: **luôn** kèm 1 dòng `stockMovements` cùng giao dịch (luật 28) và giữ `0 ≤ blockedQty ≤ onHandQty`. Nên viết helper dùng chung trong `src/mocks/stock-ledger.ts` (tạo ở GĐ1) để POS/kiểm kho/xuất hủy dùng lại.

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
