# Nhật ký quyết định frontend

Ghi mọi chỗ làm khác thiết kế, khác code cũ, hoặc chọn một trong nhiều cách hiểu tài liệu. Mỗi dòng một quyết định, mới nhất ở dưới.

| Mã | Ngày | Nội dung | Lý do / nguồn | Người quyết |
|---|---|---|---|---|
| D1 | 2026-11-08 | Làm toàn bộ 40 UC, kể cả UC chưa có thiết kế | Chủ dự án | Chủ dự án |
| D2 | 2026-11-08 | Theo thiết kế `UI/Kiểm kê kho/`; bản Lumina Atelier chỉ tham khảo, bỏ chuyển kho, chi nhánh, kệ | Luật 57, 59 | Chủ dự án |
| D3 | 2026-11-08 | Sửa code sprint 1-2 cho khớp DATABASE.md và KHUYEN_MAI.md; viết lại màn POS | Thứ tự ưu tiên tài liệu | Chủ dự án |
| D4 | 2026-11-08 | Vitest + Testing Library + Playwright | | Chủ dự án |
| D5 | 2026-11-08 | Mock bật bằng `VITE_USE_MOCK`; bỏ fallback tự động khi lỗi mạng | Fallback che lỗi thật khi có backend | Chủ dự án |
| D6 | 2026-11-08 | Làm trên nhánh `demo` của repo SE100-FE, commit ở máy, không push (tài khoản huypro2005 chưa có quyền push vào antss50/SE100-FE) | | Chủ dự án |
| D7 | 2026-11-08 | Agent tự chạy hết các giai đoạn, chỉ dừng khi có câu hỏi | | Chủ dự án |
| D8 | 2026-11-08 | Trạng thái phiếu xuất đặc biệt không có `Nháp` dù thiết kế có | DATABASE.md mục 7: `WAITING_APPROVAL/APPROVED/REJECTED` | Theo tài liệu |
| D9 | 2026-11-08 | Sidebar giữ 5 nhóm của bản LUMINA nhưng tách/thêm mục để đủ 40 UC: "Kiểm kê & Xuất hủy" tách thành "Kiểm kê kho" và "Xuất hủy & Xuất đặc biệt"; thêm "Tồn kho & Cận hạn", "Lịch sử đơn hàng", "Đổi trả hàng", "Quản lý ca", "Cấu hình điểm & hạng", "Tài khoản nhân viên", "Phân quyền vai trò", "Nhật ký hệ thống", "Cấu hình hệ thống". Bỏ dòng chi nhánh dưới logo, chuông thông báo số giả, "Lumina Cloud v4.2 · Sẵn sàng" | Luật 57 (1 cửa hàng), CLAUDE.md mục 3 (bỏ số liệu trang trí); mỗi mục gắn 1 quyền nên tách để ẩn đúng theo ma trận | fe-coder (GĐ0) |
| D10 | 2026-11-08 | Tài khoản nhân viên, phân quyền chỉ ADMIN (code cũ cho cả Manager); cấu hình điểm/hạng chỉ ADMIN, Manager (code cũ cho cả thu ngân) | DANH_GIA_USECASE mục 4: AUTH-04..06 chỉ Admin; CUS-05 Admin, Manager | Theo tài liệu |
| D11 | 2026-11-08 | Thu ngân không có REP-01 nên trang chủ sau đăng nhập là POS; người khác vào Dashboard | Ma trận REP-01: thu ngân "—" | fe-coder (GĐ0) |
| D12 | 2026-11-08 | Bỏ thao tác "đặt tồn = 0 rồi ngừng kinh doanh" (tham số `clearStockFirst`) của màn sản phẩm cũ; ngừng kinh doanh khi còn tồn luôn trả `409 PROD_HAS_STOCK` | Luật 28: mọi thay đổi tồn phải có thẻ kho; muốn hết tồn thì lập phiếu xuất | Theo tài liệu |
| D13 | 2026-11-08 | Sai mật khẩu 5 lần thì khóa tạm 15 phút (`lockedUntil`), không chuyển `LOCKED` vĩnh viễn như code cũ; bỏ chặn "không khóa tài khoản ADMIN khác", chỉ chặn tự khóa | Luật 46, 48; DATABASE.md USERS.locked_until | Theo tài liệu |
| D14 | 2026-11-08 | Body sai kiểu/thiếu trường trả `400 COMMON_VALIDATION_FAILED` (code cũ trả 422); 422 dành cho vi phạm luật nghiệp vụ | CLAUDE.md mục 5.1 | Theo tài liệu |
| D15 | 2026-11-08 | Domain giá đặt ở thư mục `src/domain/pricing/` (`pricing.ts`, `returns.ts`, `types.ts`) thay vì 2 file `domain/pricing.ts`, `domain/returns.ts` | Theo yêu cầu điều phối GĐ0; thuật toán giữ nguyên | Điều phối |
| D16 | 2026-11-08 | Màn POS cũ bấm hoàn tất không còn ghi điểm/chi tiêu khách vào dữ liệu (trước đây ghi thẳng localStorage). Chỉ hiện thông báo cho tới khi viết lại POS ở GĐ4 | Màn hình không được import mock (CLAUDE.md mục 4); chưa có API lập đơn | fe-coder (GĐ0) |
| D17 | 2026-11-08 | `GET /loyalty-config` chỉ cần đăng nhập (không cần `LOYALTY_CONFIG`) vì POS của thu ngân cần đọc tỷ lệ điểm | CUS-04 thu ngân dùng điểm | fe-coder (GĐ0) |
| D18 | 2026-11-08 | Mock đổi vai trò nhanh = đăng nhập lại tài khoản seed tương ứng (không giả quyền phía client) | Mock phải kiểm quyền theo token như server thật (CLAUDE.md 5.2) | fe-coder (GĐ0) |
| D19 | 2026-11-08 | Q1: nút "Quét FEFO" trên header chuyển tới màn Tồn kho theo lô (STK-02), ô quét barcode focus sẵn; quét xong hiện các lô của sản phẩm theo thứ tự FEFO. Chỉ hiện với người có quyền xem tồn | Trả lời Q1 | Chủ dự án |
| D20 | 2026-11-08 | Thay D6: tài khoản đã có quyền push. Nhánh `demo` push lên `origin/demo`; điều phối push sau mỗi giai đoạn qua cổng chất lượng, agent không push | Chủ dự án | Chủ dự án |
| D21 | 2026-11-09 | Gộp 8 giai đoạn thành 5 (GĐ0 nền tảng, GĐ1 kho, GĐ2 sửa cũ + bán hàng, GĐ3 báo cáo, GĐ4 kiểm thử toàn bộ); test E2E/component dồn về GĐ4 vì thời gian gấp và test tốn token. Giữ unit test cho hàm thuần domain/. Rủi ro: lỗi lộ muộn, tới GĐ4 mới sửa | Chủ dự án | Chủ dự án |
