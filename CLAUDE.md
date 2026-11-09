# LUẬT FRONTEND SE100 — bắt buộc cho mọi agent và người code

> Đọc hết file này trước khi viết dòng code đầu tiên. Gặp chỗ file này, tài liệu và thiết kế không trả lời được thì **không đoán**: ghi câu hỏi vào mục "Câu hỏi mở" của [client/docs/TIEN-DO.md](client/docs/TIEN-DO.md), bỏ qua phần đó, làm tiếp phần khác, và nêu câu hỏi trong báo cáo cuối.

Đường dẫn trong file này tính từ `D:\do_an\SE100`. Mã nguồn frontend ở `SE100-FE/client`.

## 1. Nguồn sự thật và thứ tự ưu tiên

Khi hai nơi ghi khác nhau, tin theo thứ tự:

1. `docs/QUY_TAC_NGHIEP_VU.md`: 59 luật cố định.
2. `docs/DATABASE.md` (tên cột, enum, ràng buộc) và `docs/KHUYEN_MAI.md` (cách tính giá).
3. `docs/mau-code/khuyen-mai/*.ts`: code mẫu tính giá và trả hàng, đã có 12 test chạy qua.
4. `docs/DANH_GIA_USECASE.md`: danh sách 40 UC (mục 3), ma trận phân quyền (mục 4), quy tắc chung (mục 6).
5. Thiết kế `UI/` (PDF xuất từ Figma).
6. Code cũ trong `SE100-FE/client/src`.

Thiết kế hoặc code cũ trái tài liệu thì **làm theo tài liệu**, và ghi một dòng vào [client/docs/QUYET-DINH.md](client/docs/QUYET-DINH.md).

## 2. Quyết định đã chốt với chủ dự án (2026-11-08)

| # | Nội dung | Quyết định |
|---|---|---|
| D1 | Phạm vi | Làm **toàn bộ 40 UC**. UC chưa có thiết kế (REP-01..06, AUTH-06, AUTH-07) thì dựng theo phong cách các màn đã có |
| D2 | Bản thiết kế kho | Theo thư mục `UI/Kiểm kê kho/` (bản LUMINA POS). `UI/Kiểm đếm & Đối soát/` và `UI/Xuất hủy/` (bản Lumina Atelier) **chỉ tham khảo bố cục**; bỏ chuyển kho, chi nhánh, vị trí kệ |
| D3 | Code cũ lệch tài liệu | **Sửa cho khớp tài liệu** (type, mock, màn hình). Màn POS cũ viết lại theo thiết kế |
| D4 | Kiểm thử | Vitest + Testing Library cho logic và component; Playwright cho E2E |
| D5 | Mock | Cờ `VITE_USE_MOCK`. Bỏ cơ chế "lỗi mạng thì rơi về mock" |
| D6 | Git | Làm trên nhánh `demo` (tách từ `feat/sprint1-2`) trong repo `SE100-FE`. Từ 2026-11-08 được push lên `origin/demo`; chỉ **điều phối** push, sau khi cổng chất lượng của giai đoạn qua. Agent code/kiểm thử không push |
| D7 | Nhịp chạy | Agent tự chạy, tự test hết các giai đoạn; chỉ dừng khi có câu hỏi cần chủ dự án quyết |

## 3. Bản đồ UC → thiết kế

| UC | Thiết kế (trong `UI/`) |
|---|---|
| SUPP-01..03 Nhà cung cấp | `Quản lý Nhà cung cấp/*` |
| STK-01 Nhập kho | `Nhập kho/*` |
| STK-02, STK-03 Tồn kho, cận hạn | `Tồn kho/*` |
| STK-04, STK-05 Kiểm kho | `Kiểm kê kho/Kiểm kê kho · *` |
| STK-06, STK-07 Xuất hủy, tester, trả NCC | `Kiểm kê kho/Xuất đặc biệt · *` |
| POS-02, POS-03, PROM-03, CUS-04 Bán hàng, thanh toán | `Bán hàng & POS/Màn Hình Thu Ngân Bán Hàng POS Siêu Tốc.pdf`, `Lịch sử đơn hàng.pdf`, `Chi tiết đơn hàng.pdf` |
| POS-04 Đổi trả | `Bán hàng & POS/Phiếu trả hàng.pdf` |
| POS-01, POS-05 Mở ca, chốt ca | `Quản lý ca bán hàng/*` |
| Còn lại | Không có thiết kế: theo layout và component chung |

Đọc PDF bằng công cụ Read (đường dẫn tuyệt đối, ví dụ `D:\do_an\SE100\UI\Nhập kho\Form tạo Phiếu nhập kho.pdf`). Mỗi file 1 trang.

**Những thứ trong thiết kế phải bỏ**, vì trái luật: chọn chi nhánh, chuyển kho nội bộ, vị trí kệ/khu vực, giảm giá hàng móp hộp, trạng thái `Nháp` của phiếu xuất (enum chỉ có `WAITING_APPROVAL/APPROVED/REJECTED`), số liệu "thời gian thực/cloud live" trang trí. Sidebar theo bản LUMINA POS (nhóm `1. TỔNG QUAN` … `5. HỆ THỐNG`).

## 4. Kiến trúc code

Stack giữ nguyên: React 19, TypeScript, Vite, Tailwind 4, TanStack Query, Zustand, React Hook Form + Zod, React Router 7, lucide-react. **Không thêm thư viện runtime mới** nếu chưa ghi lý do vào QUYET-DINH.md. Thư viện dev cho test (vitest, @testing-library/*, jsdom, @playwright/test) được phép.

```
client/src/
├── app/            providers, store (Zustand: phiên đăng nhập, UI, giỏ hàng POS)
├── components/
│   ├── layouts/    AppLayout, sidebar, header
│   └── ui/         component dùng chung: Button, Input, Select, Modal, ConfirmDialog, DataTable,
│                   Pagination, StatusBadge, StatCard, PageHeader, EmptyState, Toast
├── domain/         HÀM THUẦN, không React, không gọi API: tính giá 4 tầng, FEFO, trả hàng,
│                   chốt ca, trạng thái hạn dùng, phân quyền. Mỗi file có *.test.ts cạnh nó
├── features/<module>/   màn hình theo phân hệ: suppliers, purchase-orders, stock, inventory-checks,
│                   disposals, pos, returns, shifts, orders, reports, audit-logs, settings, ...
├── lib/            api-client, query-client, query-keys
├── mocks/          mock adapter: db (seed + lưu localStorage), handlers theo module
├── routes/         AppRoutes, guard quyền
├── services/       <module>.service.ts: chỉ gọi apiRequest, không chứa logic mock
├── types/          <module>.ts cho từng phân hệ; api.ts giữ kiểu chung (envelope, phân trang)
└── utils/          format tiền, ngày, số
```

Quy tắc:

- **Server state dùng TanStack Query** (`useQuery`/`useMutation`, key khai báo tập trung trong `lib/query-keys.ts`, mutation xong thì `invalidateQueries`). Không `useEffect` + `useState` để tải dữ liệu.
- **Form dùng React Hook Form + Zod.** Schema Zod đặt cạnh form, thông báo lỗi tiếng Việt.
- **Zustand chỉ cho state phía client** (phiên, UI, giỏ hàng nháp). Không chép dữ liệu server vào Zustand.
- **Màn hình không import `mocks/`.** Chỉ service được gọi `apiRequest`; chỉ `lib/api-client.ts` biết đến mock adapter.
- File component dưới khoảng 400 dòng; dài hơn thì tách component con trong cùng thư mục feature.
- Không `any`, không `console.log`, không code bị comment bỏ, không `// TODO` không kèm mã câu hỏi mở.
- Route lazy-load theo feature (`React.lazy`) để giảm bundle.

## 5. API contract và mock

### 5.1. Quy ước API (FE và BE dùng chung)

- Gốc: `VITE_API_BASE_URL` (mặc định `/api/v1`). REST, tên tài nguyên số nhiều, kebab-case: `/purchase-orders`, `/inventory-checks/{id}/approve`.
- Envelope thành công: `{ success: true, message?, data }`. Lỗi: `{ success: false, errorCode, message, errors? }` với HTTP status đúng nghĩa (400 dữ liệu sai, 401 chưa đăng nhập, 403 thiếu quyền, 404 không có, 409 xung đột nghiệp vụ, 422 vi phạm luật nghiệp vụ).
- `errorCode` dạng `UPPER_SNAKE`, có tiền tố module: `STK_BATCH_LOCKED`, `POS_SHIFT_NOT_OPEN`, `RET_SEAL_BROKEN`.
- Danh sách: query `page` (từ 1), `pageSize`, `keyword`, bộ lọc riêng; trả `PaginatedData<T> = { items, page, pageSize, totalItems }`.
- Tên trường camelCase, ánh xạ 1-1 từ cột trong DATABASE.md (`exp_date` → `expDate`, `on_hand_qty` → `onHandQty`). Enum giữ nguyên giá trị trong DATABASE.md mục 7.
- Ngày giờ: chuỗi ISO 8601 (`2026-11-08T09:30:00+07:00`); ngày thuần (hạn dùng, ngày sinh): `YYYY-MM-DD`. Tiền: `number`, đơn vị đồng, số nguyên.
- Mọi endpoint mới hoặc đổi phải ghi vào [client/docs/API-CONTRACT.md](client/docs/API-CONTRACT.md): method, path, quyền, request, response, mã lỗi. BE sẽ code theo file này.

### 5.2. Mock adapter (`VITE_USE_MOCK`)

- `VITE_USE_MOCK=true`: `apiRequest` chuyển request tới `mocks/` (khớp theo method + path), **không gọi fetch**. `false`: chỉ gọi API thật; lỗi hiện ra, không rơi về mock.
- Mock hành xử như server thật: kiểm quyền theo token, kiểm Zod, áp luật nghiệp vụ, trả đúng envelope và errorCode như API-CONTRACT.md. Có độ trễ 150–300 ms (tắt được khi test).
- Dữ liệu lưu localStorage, key có hậu tố phiên bản (`se100_mock_<bảng>_v2`). Đổi cấu trúc seed thì tăng phiên bản.
- Seed **tất định**, ngày tính tương đối so với hôm nay (ví dụ lô hết hạn sau 30 ngày), để trạng thái cận hạn luôn đúng khi chạy test ở bất kỳ ngày nào.
- Có hàm `resetMockDb()` và trong chế độ mock gắn `window.__SE100_MOCK__ = { reset }` cho Playwright.
- Thao tác ghi nhiều bảng (hoàn tất đơn, duyệt kiểm kho…) trong mock phải "nguyên tử": tính hết rồi mới ghi; lỗi giữa chừng thì không ghi gì (luật 40).
- Mỗi thay đổi tồn trong mock ghi kèm một dòng `stockMovements` (luật 28).

### 5.3. Đăng nhập trong chế độ mock

- Không tự đăng nhập sẵn. Mở app chưa có phiên thì về `/login`.
- Seed 4 tài khoản, mật khẩu chung `Password@123`: `admin` (ADMIN), `manager01` (STORE_MANAGER), `cashier01` (CASHIER), `inventory01` (INVENTORY_STAFF). Thêm 1 tài khoản `newstaff` có `mustChangePassword = true` để test luật 47.
- Nút "chuyển nhanh vai trò" chỉ hiện khi `VITE_USE_MOCK=true`.

## 6. Phân quyền

- Ma trận theo `docs/DANH_GIA_USECASE.md` mục 4. Khai báo một lần trong `domain/permissions.ts` (mã quyền dạng `MODULE_ACTION` như `STOCK_ADJUST_APPROVE`, `POS_CHECKOUT`, `REPORT_PROFIT`), map role → quyền.
- Route bọc guard theo quyền; menu sidebar ẩn mục không có quyền; nút thao tác ẩn hoặc vô hiệu khi chỉ có quyền xem (👁).
- Trường hợp đặc biệt cần làm đúng: Thu ngân chỉ thấy tồn khả dụng; Manager xem doanh thu nhưng không xem lợi nhuận (REP-02); NV kho chỉ thấy widget kho ở dashboard; Thu ngân chỉ xem báo cáo ca của mình (REP-03); Thu ngân thêm/sửa khách nhưng không khóa.

## 7. Luật nghiệp vụ giao diện phải thể hiện

Không cần chép lại 59 luật; dưới đây là những luật dễ làm sai ở FE.

- **Tồn bán được** = `onHand − blocked`, chỉ lô còn hạn và không bị khóa kiểm kho (24). Bán đến hết ngày `expDate` (26). Cảnh báo cận hạn theo `EXPIRY_WARNING_DAYS`.
- **FEFO** (25): POS tự chọn lô hạn sớm nhất, thiếu thì tách sang lô kế. Đổi lô thủ công phải chọn lô còn hạn và ghi audit `OVERRIDE_FEFO` (27). SKU `isSellable = false` không bao giờ hiện ở POS.
- **Giá**: dùng `domain/pricing.ts` port từ `docs/mau-code/khuyen-mai/tinh-gia.ts`, giữ nguyên thuật toán và chép 12 test sang Vitest. Trả hàng dùng `domain/returns.ts` port từ `tra-hang.ts`. Không tự viết công thức khác.
- **Ca** (35–37): POS không lập đơn khi chưa mở ca; mỗi thu ngân 1 ca mở; còn đơn nháp thì không chốt ca; tiền lệch bắt buộc giải trình.
- **Thanh toán** (38–39): 1 phương thức/đơn (`CASH`, `BANK_TRANSFER`, `CARD`); tiền mặt khách đưa thiếu thì khóa nút hoàn tất.
- **Đổi trả** (14–23): chỉ 2 lý do `DEFECTIVE`, `CHANGE_OF_MIND`; khách đổi ý chỉ đổi hàng, phải còn seal và trong `maxReturnDays`; trả không vượt số đã mua; hàng mới ≥ hàng cũ; tiền hoàn theo `lineTotal`; không voucher bù; không cần Manager duyệt.
- **Kho** (29–34): nhập kho bấm 2 lần không cộng 2 lần (khóa nút + idempotency key); cảnh báo xoay kệ khi lô mới hạn sớm hơn; kiểm kho: bắt đầu thì khóa lô, ô trống không phải 0, không chênh lệch thì tự hoàn tất; xuất hủy/tester/trả NCC: lập phiếu thì cách ly ngay, duyệt mới trừ tồn, từ chối thì trả lại.
- **Chứng từ đã hoàn tất** không có nút sửa/xóa (41).
- **Tài khoản** (46–52): khóa 15 phút sau 5 lần sai; bắt đổi mật khẩu lần đầu; không tự khóa chính mình; không bỏ quyền quản trị của ADMIN; không xóa role hệ thống; không thêm/xóa quyền trên giao diện.
- **Khuyến mãi** (1–13): 7 loại `PRODUCT_DISCOUNT, FLASH_PRICE, BUY_X_GET_Y, COMBO, ORDER_TIERED, VOUCHER, ORDER_GIFT`; status `DRAFT/ACTIVE/PAUSED`; "sắp diễn ra/đang chạy/đã kết thúc" tính theo ngày; đã có đơn dùng thì khóa sửa mức giảm và điều kiện.
- **Báo cáo** (53–56): doanh thu theo `completedAt`; hàng trả trừ vào kỳ trả; doanh thu thuần, lợi nhuận gộp đúng công thức; `fromDate ≤ toDate`.

## 8. Giao diện

- Toàn bộ chữ trên giao diện là **tiếng Việt có dấu**; tên biến, hàm, file là tiếng Anh.
- Định dạng: tiền `1.250.000 ₫` (dùng `utils/format.ts`), ngày `dd/MM/yyyy`, giờ `HH:mm`.
- Màu: khai báo token trong `src/index.css` (`@theme`), dùng token trong code mới; code cũ đổi dần khi chạm vào. Bảng màu hiện tại: chữ chính `#221712`, nhấn `#9a462d`, nền `#f9f3ee`, nền thẻ `#fcf7f4`, viền `#ead9ce`, chữ phụ `#7c6356`.
- Ưu tiên màn hình desktop 1366×768 trở lên; POS phải dùng được ở 1366×768 không cuộn ngang. Dưới 1024px sidebar thu gọn.
- Phím tắt POS theo thiết kế: F1 tìm hàng, F2 quét barcode, F3 khách hàng, F4 đổi trả, F8 chốt ca, F9 hoàn tất.
- Mọi danh sách có trạng thái đang tải, rỗng, lỗi. Mọi thao tác ghi có trạng thái đang gửi (khóa nút) và thông báo kết quả. Thao tác không đảo ngược được (duyệt, từ chối, hoàn tất, khóa tài khoản) phải có hộp xác nhận.
- Accessibility tối thiểu: input có `<label>`, nút có `type`, icon-only có `aria-label`, modal đóng bằng Esc và giữ focus.

## 9. Kiểm thử

- **(D21) Test dồn về GĐ4.** Các quy định dưới đây áp dụng cho GĐ4; GĐ1–3 chỉ cần unit test hàm thuần `domain/`.
- `npm run test` (Vitest, jsdom), `npm run test:e2e` (Playwright, Chromium, tự khởi động `vite` với `VITE_USE_MOCK=true` và tắt độ trễ mock).
- **Unit (bắt buộc):** mọi file trong `domain/`, mock handler có luật nghiệp vụ (ca, kho, đổi trả, thanh toán).
- **Component:** form có validate phức tạp (tạo phiếu nhập, thanh toán, phiếu trả, chốt ca).
- **E2E:** mỗi UC ít nhất 1 luồng thành công và các luồng bị chặn quan trọng; mỗi test `reset` mock trước khi chạy; đăng nhập bằng tài khoản seed đúng vai trò. Thêm 1 test xuyên suốt: đăng nhập → nhập kho → mở ca → bán hàng → thanh toán → đổi trả → chốt ca → xem báo cáo.
- Test viết từ **tiêu chí chấp nhận trong tài liệu**, không viết theo những gì code đang làm.
- Không tự test code của mình: agent kiểm thử viết test, agent code sửa lỗi (QUY-TAC-DU-AN mục 7).
- Mức lỗi: Critical (mất dữ liệu, sai tiền, sai tồn, sập màn), High (luồng chính không chạy, vi phạm luật nghiệp vụ), Medium (lệch thiết kế ảnh hưởng thao tác), Low (thẩm mỹ).

## 10. Cổng chất lượng trước mỗi commit

Chạy trong `SE100-FE/client`, tất cả phải qua:

```bash
npm run lint
npm run build          # gồm tsc -b
npm run test
npm run test:e2e       # chỉ từ GĐ4 (D21); GĐ1–3 bỏ qua dòng này
```

Không bỏ qua, không tắt rule, không `--no-verify`. Lỗi của test có sẵn trước khi bạn làm cũng phải báo lại.

## 11. Git

- Repo: `SE100-FE` (repo riêng). Nhánh làm việc: **`demo`** (theo dõi `origin/demo`). Không tạo nhánh khác. Agent code/kiểm thử không push; điều phối push lên `origin/demo` khi giai đoạn qua cổng chất lượng. Không force push, không amend commit đã có, không sửa lịch sử.
- Mỗi UC hoặc nhóm UC ít nhất 1 commit riêng: `feat(stk-01): lập phiếu nhập kho theo lô`, `test(stk-01): e2e nhập kho`, `fix(pos-03): …`, `refactor: …`, `chore: …` (QUY-TAC-GIT mục 6). Cuối commit message thêm dòng:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Không commit `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `.env`.
- Chỉ `git add` file mình sửa, không `git add -A` mù.

## 12. Môi trường

- Windows 11, có Git Bash và PowerShell. Node 24, npm 12. Dev server Vite cổng 5173.
- Không chạy lệnh tải/cài toàn cục; cài thư viện bằng `npm install -D` trong `client/`.
- Không để tiến trình dev server chạy treo sau khi xong việc.

## 13. Tài liệu theo dõi

- [client/docs/TIEN-DO.md](client/docs/TIEN-DO.md): giai đoạn, trạng thái từng UC, bảng lỗi, câu hỏi mở. Cập nhật khi bắt đầu và khi xong mỗi phần.
- [client/docs/NHAT-KY-TIEN-DO.md](client/docs/NHAT-KY-TIEN-DO.md): **nhật ký theo thời gian, bắt buộc ghi**. Mỗi agent thêm một dòng (không sửa dòng cũ) khi: bắt đầu nhiệm vụ, xong mỗi việc/UC, mỗi commit (hash + message), mỗi lần chạy test (số pass/fail), phát hiện lỗi hoặc câu hỏi mở, và khi kết thúc. File này được commit cùng commit của việc vừa ghi.
- [client/docs/QUYET-DINH.md](client/docs/QUYET-DINH.md): mọi chỗ làm khác thiết kế/code cũ và lý do.
- [client/docs/API-CONTRACT.md](client/docs/API-CONTRACT.md): hợp đồng API cho BE.
