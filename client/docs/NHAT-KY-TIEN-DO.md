# Nhật ký tiến độ agent

> Ghi theo thời gian, mới nhất ở **dưới cùng**. Mỗi agent tự ghi khi bắt đầu, khi xong từng việc, và khi kết thúc.
> Bảng tổng hợp trạng thái UC, lỗi và câu hỏi mở vẫn nằm ở [TIEN-DO.md](TIEN-DO.md); file này là dòng thời gian chi tiết.

## Cách ghi

Mỗi mục là một dòng trong bảng:

| Cột | Ghi gì |
|---|---|
| Thời gian | `YYYY-MM-DD HH:mm` (lấy bằng lệnh `date "+%Y-%m-%d %H:%M"`) |
| Agent | `điều phối`, `fe-coder`, `fe-tester` |
| GĐ | Số giai đoạn (0–7) |
| Sự kiện | `Bắt đầu`, `Xong việc`, `Commit`, `Test`, `Lỗi`, `Câu hỏi`, `Kết thúc` |
| Chi tiết | Việc gì, file chính, hash commit, kết quả lint/build/test (số pass/fail), mã lỗi/câu hỏi |

Không xóa hay sửa dòng cũ; ghi sai thì thêm dòng mới đính chính.

## Nhật ký

| Thời gian | Agent | GĐ | Sự kiện | Chi tiết |
|---|---|---|---|---|
| 2026-11-08 22:15 | điều phối | – | Bắt đầu | Đọc tài liệu `docs/`, code `SE100-FE/client`, 29 PDF thiết kế trong `UI/`. Code cũ: build và lint qua, chưa có test |
| 2026-11-08 22:30 | điều phối | – | Xong việc | Chốt 7 quyết định với chủ dự án (D1–D7 trong QUYET-DINH.md). Tạo nhánh `demo` từ `feat/sprint1-2`; push bị từ chối (403) nên chỉ commit ở máy |
| 2026-11-08 22:35 | điều phối | – | Commit | `b08f39b` docs: luật frontend (`CLAUDE.md`), TIEN-DO.md, QUYET-DINH.md, API-CONTRACT.md. Tạo agent `fe-coder`, `fe-tester` trong `D:\do_an\SE100\.claude\agents\` |
| 2026-11-08 22:36 | điều phối | 0 | Bắt đầu | Giao GĐ0 (nền tảng) cho fe-coder |
| 2026-11-08 22:48 | fe-coder | 0 | Commit | `d065626` chore: cài Vitest, Testing Library, Playwright và cấu hình test (ghi bù bởi điều phối) |
| 2026-11-08 22:48 | fe-coder | 0 | Commit | `a80f710` feat: port domain tính giá và trả hàng từ code mẫu kèm 12 test (ghi bù bởi điều phối) |
| 2026-11-08 22:48 | fe-coder | 0 | Commit | `8a63110` feat: domain phân quyền theo ma trận DANH_GIA_USECASE mục 4 (ghi bù bởi điều phối) |
| 2026-11-08 22:48 | fe-coder | 0 | Xong việc | Đang làm mock adapter (`src/mocks/`, chưa commit) |
| 2026-11-08 22:49 | fe-coder | 0 | Test | Sau commit 8a63110: vitest 34/34 pass (12 giá + 22 phân quyền), lint 0 lỗi, tsc qua |
| 2026-11-08 22:59 | fe-coder | 0 | Xong việc | Mock adapter src/mocks (router method+path, db localStorage se100_mock_*_v2, giao dịch, độ trễ VITE_MOCK_DELAY_MS, resetMockDb, window.__SE100_MOCK__); api-client bỏ fallbackHandler; service chỉ gọi apiRequest; xóa lib/mock-db.ts; POS bỏ ghi mockDb; API-CONTRACT.md ghi AUTH/PRODUCT/CUSTOMER/PROMOTION/POS |
| 2026-11-08 22:59 | fe-coder | 0 | Test | lint 0 lỗi; build qua; vitest 46/46 pass (thêm 12 test mock adapter) |
| 2026-11-08 22:59 | fe-coder | 0 | Commit | refactor: mock adapter VITE_USE_MOCK, chuyển logic mock khỏi service (hash ghi ở dòng sau) |
| 2026-11-08 22:59 | fe-coder | 0 | Commit | 043a8e4 refactor: mock adapter VITE_USE_MOCK, chuyển logic mock khỏi service |
| 2026-11-08 23:01 | fe-coder | 0 | Xong việc | Component dùng chung src/components/ui (Button, Input, Select, Modal giữ focus + Esc, ConfirmDialog, DataTable 3 trạng thái, Pagination, StatusBadge, StatCard, PageHeader, EmptyState, Toast) và token màu @theme trong index.css |
| 2026-11-08 23:01 | fe-coder | 0 | Test | lint 0 lỗi; build qua; vitest 57/57 pass (thêm 11 test component) |
| 2026-11-08 23:07 | fe-coder | 0 | Commit | 87201c8 feat: component ui dùng chung và token màu @theme |
| 2026-11-08 23:07 | fe-coder | 0 | Xong việc | Layout LUMINA POS (Sidebar 5 nhóm, đủ mục 40 UC, ẩn mục thiếu quyền; Header role/ca/Quét FEFO/Mở-Chốt ca), guard quyền RequirePermission + HomeGate, route lazy, trang Đang phát triển dùng chung; đăng nhập không tự động, 5 tài khoản seed, đổi vai trò nhanh chỉ khi mock |
| 2026-11-08 23:07 | fe-coder | 0 | Test | lint 0 lỗi; build qua; vitest 64/64 pass; playwright 2/2 pass |
| 2026-11-08 23:07 | fe-coder | 0 | Commit | 2431667 feat: layout LUMINA POS, guard quyền, route lazy và đăng nhập theo mock |
| 2026-11-08 23:07 | fe-coder | 0 | Xong việc | Smoke E2E e2e/smoke.spec.ts (chưa đăng nhập về /login; admin đăng nhập thấy dashboard, đăng xuất về /login); tsconfig.e2e.json kiểm kiểu e2e |
| 2026-11-08 23:08 | fe-coder | 0 | Commit | 92096f7 test: smoke e2e đăng nhập admin và đăng xuất |
| 2026-11-08 23:08 | fe-coder | 0 | Câu hỏi | Q1: nút Quét FEFO trên header làm gì (đề xuất: mở tra cứu tồn STK-02 với ô quét barcode); tạm chuyển tới /stock |
| 2026-11-08 23:08 | fe-coder | 0 | Test | Cổng chất lượng cuối GĐ0: lint 0 lỗi; build qua; vitest 64/64 pass (5 file); playwright 2/2 pass |
| 2026-11-08 23:08 | fe-coder | 0 | Kết thúc | GĐ0 → Đang test. Ghi QUYET-DINH D9–D18, TIEN-DO Q1. Commit: d065626, a80f710, 8a63110, 043a8e4, 87201c8, 2431667, 92096f7 và commit docs này |
| 2026-11-08 23:09 | fe-tester | 0 | Bắt đầu | Kiểm thử GĐ0 nền tảng (d065626 → 0ac157d): đăng nhập/phiên, phân quyền đối chiếu ma trận mục 4, mock adapter, 12 test giá, layout, cổng chất lượng |
| 2026-11-08 23:18 | fe-tester | 0 | Test | Lần chạy E2E đầu (54 test): 53 pass, 1 fail (quay lại trang cũ sau đăng nhập) → lỗi B1, đánh test.fixme. Vitest 229/229 pass (thêm 3 file: ma trận quyền từng ô, mock contract qua apiRequest, chế độ không mock) |
| 2026-11-08 23:18 | fe-tester | 0 | Lỗi | B1 (Low): vào URL bảo vệ khi chưa đăng nhập, đăng nhập xong không quay lại trang đó mà về / |
| 2026-11-08 23:23 | fe-tester | 0 | Test | Cổng chất lượng: lint 0 lỗi; build qua; vitest 229/229 pass (8 file); playwright 2 lần liên tiếp: mỗi lần 54 pass, 0 fail, 1 fixme (B1), không chập chờn |
| 2026-11-08 23:23 | fe-tester | 0 | Xong việc | Đối chiếu: permissions.ts khớp từng ô ma trận mục 4; 12 test giá port nguyên văn (so từng dòng, thuật toán pricing/returns giống hệt code mẫu); mock đúng envelope/errorCode/status mẫu mọi module, 401/403, reset() và seed tất định; sidebar/header khớp bản LUMINA (D9); 8 màn cũ mở không lỗi console. newstaff: hộp đổi mật khẩu mở sau đăng nhập (chặn dùng app để GĐ3) |
| 2026-11-08 23:23 | fe-tester | 0 | Commit | ad9287c test: kiểm thử GĐ0 nền tảng (phân quyền, mock adapter, đăng nhập, layout) |
| 2026-11-08 23:23 | fe-tester | 0 | Kết thúc | GĐ0 → Xong (không còn lỗi Critical/High; B1 Low mở). Commit ad9287c và commit nhật ký này |
| 2026-11-09 08:47 | fe-coder | 1 | Bắt đầu | GĐ1 nhóm Kho (SUPP, STK-01..07); đọc KIEN-THUC, CLAUDE, TIEN-DO |
| 2026-11-09 08:47 | fe-coder | 1 | Commit | 927bdfa feat(supp-01): NCC (SUPP-01..03) xong, build qua; trạng thái UC -> Đang test |
| 2026-11-09 08:52 | fe-coder | 1 | Hash đính chính | Commit SUPP-01..03 có hash thực là 97aead8 (dòng log trước ghi hash cũ do amend) |
| 2026-11-09 08:52 | fe-coder | 1 | Xong việc | STK-01 nhập kho: domain/stock (batch, purchase-warnings), mocks/stock-ledger.ts, seed lô/phiếu nhập, handler purchase-orders (idempotency, bình quân gia quyền, cảnh báo xoay kệ), màn danh sách/form/chi tiết; build qua |
| 2026-11-09 08:55 | fe-coder | 1 | Xong việc | STK-02/03: types stock + inventory (kiểm kho, xuất khác), handler /stock/*, màn Tồn kho (tab cận hạn/cách ly, quét FEFO D19, thu ngân chỉ thấy tồn khả dụng), chi tiết lô + thẻ kho; build qua |
| 2026-11-09 08:55 | fe-coder | 1 | Commit | 14cba6f feat(stk-01) đã commit trước đó |
| 2026-11-09 08:58 | fe-coder | 1 | Xong việc | STK-04/05 kiểm kho: handler inventory-checks (chụp tồn + khóa lô, ô trống != 0, gửi duyệt/tự hoàn tất, duyệt cộng chênh vào tồn hiện tại + CHECK_ADJUST, từ chối bắt buộc lý do), LotPicker dùng chung, màn danh sách/tạo/nhập kết quả/duyệt; build qua |
