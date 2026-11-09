Đang test 7 loại, khóa sửa khi đã có đơn 
| GĐ | Nội dung | UC | Trạng thái |
|---|---|---|---|
| 0 | Nền tảng (mock adapter, đăng nhập, phân quyền, component ui, layout, domain giá, công cụ test) | Nền | Xong |
| 1 | **Kho** (gộp cũ GĐ1+2): nhà cung cấp, nhập kho, tồn kho, cận hạn, kiểm kho, xuất đặc biệt. Gồm sửa B1 | SUPP-01..03, STK-01..07 | Xong (qua Đợt test 1, còn B2/B3 Low) |
| 2 | **Sửa phần cũ + bán hàng** (gộp cũ GĐ3+4+5): sửa AUTH/PROD/CUS/PROM cho khớp tài liệu (7 loại KM, status, luật 47), cấu hình hệ thống; mở ca, POS FEFO, voucher, dùng điểm, thanh toán, lịch sử và chi tiết đơn, đổi trả, chốt ca, lịch sử ca | AUTH-01..05, AUTH-07, PROD-01..03, CUS-01..05, PROM-01..03, POS-01..05 | Xong (qua Đợt test 1, còn B2/B3 Low) |
| T1 | **Đợt test 1** (sau GĐ1 + GĐ2): fe-tester viết và chạy test cho kho, bán hàng và phần sửa cũ; ghi lỗi; fe-coder sửa lỗi Critical/High | Kho, bán hàng, phần cũ | Xong: 70 unit mới + 28 E2E mới, 2 lỗi Low (B2, B3), Q7 mở |
| 3 | **Báo cáo** (cũ GĐ6): dashboard, 5 báo cáo, nhật ký, hiệu quả KM | REP-01..06, AUTH-06, PROM-04 | Xong (qua Đợt test 2) |
| T2 | **Đợt test 2 (cuối)** (sau GĐ3): test báo cáo, E2E xuyên suốt, hồi quy toàn bộ, sửa lỗi Critical/High | Tất cả | Xong (87/87 E2E, 325/325 unit, 0 lỗi mở) |

> Đổi ngày 2026-11-09 (D21): gộp 8 giai đoạn thành 5, kiểm thử dồn về GĐ4. Các dòng nhật ký cũ ghi GĐ theo cách đánh số cũ; GĐ0 không đổi.

## Trạng thái từng UC

| UC | Tên | GĐ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| AUTH-01 | Đăng nhập | 3 | Xong | Mã NV dạng NV0001; khóa tài khoản thu hồi phiên |
| AUTH-02 | Đăng xuất | 3 | Xong | Đăng xuất xóa phiên |
| AUTH-03 | Đổi mật khẩu | 3 | Xong | Bắt đổi MK lần đầu: hộp không đóng được, mock chặn API (luật 47) |
| AUTH-04 | Quản lý tài khoản nhân viên | 3 | Xong | USERS chỉ ACTIVE/LOCKED; không tự khóa mình; mã NV tự sinh NV0007 khi bỏ trống |
| AUTH-05 | Vai trò & phân quyền | 3 | Xong | Role hệ thống không xóa; ADMIN giữ quyền quản trị; quyền không thêm/xóa trên giao diện |
| AUTH-06 | Nhật ký hệ thống | 6 | Xong | `/audit-logs`; audit tự động qua router (D47) |
| AUTH-07 | Cấu hình hệ thống | 3 | Xong | Màn /settings + API; nguồn duy nhất cho tham số điểm |
| PROD-01 | Sản phẩm / SKU | 3 | Xong | Status ACTIVE/DISCONTINUED, bỏ nút đặt tồn = 0 |
| PROD-02 | Danh mục | 3 | Xong | CATEGORIES ACTIVE/INACTIVE; số SP tính từ dữ liệu |
| PROD-03 | Thương hiệu | 3 | Xong | BRANDS ACTIVE/INACTIVE; số SP tính từ dữ liệu |
| SUPP-01 | Quản lý NCC | 1 | Xong | |
| SUPP-02 | Tra cứu & chi tiết NCC | 1 | Xong | |
| SUPP-03 | Lịch sử nhập của NCC | 1 | Xong | |
| STK-01 | Phiếu nhập kho theo lô | 1 | Xong | Đường găng |
| STK-02 | Tra cứu tồn theo SP & lô | 2 | Xong | |
| STK-03 | Cận hạn / hết hạn | 2 | Xong | |
| STK-04 | Lập phiếu kiểm kho | 2 | Xong | |
| STK-05 | Duyệt kiểm kho | 2 | Xong | |
| STK-06 | Lập phiếu xuất khác | 2 | Xong | |
| STK-07 | Duyệt phiếu xuất khác | 2 | Xong | |
| CUS-01 | Tra cứu & hồ sơ KH | 3 | Xong | Mã KH KH0001..; bỏ chi nhánh |
| CUS-02 | Quản lý hồ sơ KH | 3 | Xong | Mã KH KH0007; thu ngân thêm/sửa, không khóa (ẩn nút, mock 403) |
| CUS-03 | Tích/thu hồi điểm, xét hạng (hệ thống) | 3 | Xong | Lịch sử điểm EARN/REDEEM/REVOKE/ADJUST trong hồ sơ khách; tích/thu hồi chạy ở POS |
| CUS-04 | Dùng điểm khi thanh toán | 4 | Xong | Dùng điểm tối đa theo POINT_MAX_REDEEM_PERCENT |
| CUS-05 | Cấu hình điểm & hạng | 3 | Xong | Sửa mốc chi tiêu và % giảm từng hạng (D42); Admin + Manager |
| PROM-01 | Tra cứu KM | 3 | Xong | 7 loại, phase theo ngày |
| PROM-02 | Quản lý KM | 3 | Xong | 7 loại, khóa sửa khi có đơn |
| PROM-03 | Áp voucher khi bán | 4 | Xong | Voucher qua domain pricing |
| PROM-04 | Hiệu quả KM | 6 | Xong | `/promotions/:id/report`, nút Xem hiệu quả (D48) |
| POS-01 | Mở ca | 4 | Xong | Mở ca qua modal, mỗi thu ngân 1 ca |
| POS-02 | Lập đơn FEFO | 4 | Xong | POS FEFO viết lại, phím tắt F1-F9, đơn nháp |
| POS-03 | Thanh toán & hóa đơn | 4 | Xong | Thanh toán 1 giao dịch mock, lịch sử + chi tiết đơn, in hóa đơn |
| POS-04 | Đổi trả & hoàn tiền | 5 | Xong | Phiếu trả 2 lý do, đổi hàng qua POS, két thiếu hoàn CK |
| POS-05 | Kiểm đếm & chốt ca | 5 | Xong | Kiểm đếm, chốt ca, lịch sử, bàn giao |
| REP-01 | Dashboard | 6 | Xong | Dashboard mới theo quyền (thay trang demo); NV kho chỉ widget kho |
| REP-02 | Doanh thu & lợi nhuận gộp | 6 | Xong | Báo cáo tab Doanh thu/Bán hàng, Manager không thấy lợi nhuận |
| REP-03 | Bán hàng | 6 | Xong | Báo cáo tab Doanh thu/Bán hàng, Manager không thấy lợi nhuận |
| REP-04 | Tồn kho & hạn dùng | 6 | Xong | Tab Tồn kho/Nhập hàng/Khách hàng ở /reports (còn B4 Medium: tester) |
| REP-05 | Nhập hàng | 6 | Xong | Tab Tồn kho/Nhập hàng/Khách hàng ở /reports |
| REP-06 | Khách hàng | 6 | Xong | Tab Tồn kho/Nhập hàng/Khách hàng ở /reports |

## Lỗi

| Mã | GĐ | UC | Mức | Mô tả và bước tái hiện | Trạng thái |
|---|---|---|---|---|---|
| B1 | 0 | AUTH-01 | Low | Vào URL bảo vệ khi chưa đăng nhập (ví dụ `/customers`) → về `/login`; đăng nhập `manager01` xong về `/` thay vì quay lại `/customers`. `RequireAuth` có lưu `state.from` và `LoginPage` có `navigate(from)`, nhưng nghi `<Navigate to="/">` (nhánh `isAuthenticated`) chạy sau và đè. Tài liệu không bắt buộc tính năng này, nhưng code đã hứa trong comment guard. Test: `e2e/auth/login-session.spec.ts` › "B1: vào URL bảo vệ khi chưa đăng nhập, đăng nhập xong quay lại đúng trang" (`test.fixme`) | Mở |
| B2 | 2 | Nền (mock seed) | Low | Seed không tất định theo giây: ca OPEN của newstaff lấy `openedAt` từ giờ hiện tại có giây nên 2 lần `reset()` cách nhau qua ranh giới giây cho dữ liệu khác nhau (test cũ `mock-contract.test.ts` > "hai lần reset liên tiếp cho dữ liệu giống hệt nhau" thỉnh thoảng fail). Tái hiện: dựng `buildSeed` với giờ 10:00:00 và 10:00:07 → khác ở `shifts[3].openedAt`. Vi phạm: CLAUDE.md mục 6 (reset về seed tất định). Test: `src/mocks/determinism.test.ts` (`it.skip` B2) | Đã sửa (GĐ3, seed làm tròn 10 phút) |
| B3 | 2 | AUTH-03 | Low | Hộp "Đổi mật khẩu bảo mật" (`ChangePasswordModal`) không có `role="dialog"`/`aria-modal`, nhãn ô nhập không gắn `htmlFor` nên trình đọc màn hình và `getByRole('dialog')`/`getByLabel` không dùng được. Tái hiện: đăng nhập `newstaff`, kiểm cây truy cập. Test: `e2e/t1/main-flows.spec.ts` (f) phải dùng text thay vì role | Đã sửa (GĐ3, role=dialog, htmlFor) |
| B4 | 3 | REP-04 | Medium | Báo cáo tồn kho: SKU `isSellable=false` (tester, vd `SKU-YSL-RPC196-TST`, productId 9) có `availableQty = 3` ở `/reports/stock` trong khi lô tương ứng ở `/stock/batches` có `availableQty = 0`; tồn bán được phải loại hàng không bán được (luật 24, CLAUDE mục 7). Tái hiện: admin gọi hai API so sánh. Test: `src/mocks/reports-flows.test.ts` (skip, B4) | Đã sửa (đã đóng) |

## Câu hỏi mở

Agent ghi câu hỏi ở đây thay vì tự đoán. Chủ dự án trả lời thì chuyển câu trả lời sang QUYET-DINH.md.

| Mã | GĐ | Câu hỏi | Phương án đề xuất | Trả lời |
|---|---|---|---|---|
| Q1 | 0 | Nút "Quét FEFO" trên header (thiết kế LUMINA) làm gì? Tài liệu không mô tả. | Mở màn tra cứu tồn theo lô (STK-02) với ô quét barcode được focus sẵn. GĐ0 tạm cho nút chuyển tới `/stock`, chỉ hiện với người có quyền xem tồn. | |
| Q2 | 1 | Kiểm kho (STK-04): ô giải trình chênh lệch từng lô có bắt buộc khi `differenceQty ≠ 0` không? Tài liệu chỉ ghi `note` là "Giải trình chênh lệch", không nói bắt buộc. | Hiện để tùy chọn (giao diện chỉ gợi ý). Nếu bắt buộc: thêm kiểm tra ở `submit` (422 `STK_CHECK_NOTE_REQUIRED`) và đánh dấu * ở cột giải trình. | Không bắt buộc (D30) |
| Q3 | 1 | Phiếu xuất khác loại trả NCC (STK-06): thiết kế có nhà cung cấp, người nhận hàng trả, tham chiếu phiếu nhập, nhưng bảng DISPOSAL_REQUESTS không có cột nào cho các thông tin này. Có thêm cột (vd. `supplier_id`, `po_id`) không? | Giữ theo DATABASE.md (không có), nhập thông tin NCC vào ô diễn giải lý do. Nếu cần: thêm `supplier_id`, `ref_po_id` vào DISPOSAL_REQUESTS rồi cập nhật form. | Giữ theo DATABASE.md, không lưu NCC (D30) |
| Q4 | 2 | `CUSTOMER_TIERS.discount_rate` (QUY_TAC mục 9: "mốc chi tiêu và % giảm từng hạng" chỉnh được) nên sửa ở đâu? Màn CUS-05 hiện chỉ sửa mốc chi tiêu. | Thêm ô "% giảm" từng hạng vào màn CUS-05 và lưu cùng `PUT /loyalty-config` (mock đang để cố định 0/5/8/12%). | Làm theo phương án đề xuất, Admin + Manager sửa (D42) |
| Q5 | 2 | Voucher riêng 1 khách (`PROMOTIONS.customer_id`, "quản lý tạo thủ công khi cần"): chọn khách ở đâu trong form tạo khuyến mãi? | Thêm ô tìm khách theo SĐT vào form loại `VOUCHER` (khi chọn thì chỉ khách đó dùng được). | Làm theo phương án đề xuất; để trống = voucher chung (D43) |
| Q6 | 2 | Đơn đổi hàng (`exchange_return_id`) hoàn tất: voucher/khuyến mãi áp bình thường trên hàng mới, hay đơn đổi không được dùng voucher (vì đã có giá trị quy đổi)? Tài liệu chỉ nói tổng đơn phải ≥ giá trị hàng trả. | Cho áp khuyến mãi như đơn thường; giá trị quy đổi chỉ trừ ở bước thanh toán (đang làm vậy). | Cho dùng voucher bình thường (D44) |
| Q7 | T1 | API-CONTRACT.md ghi `quote`/`complete` với lô chọn tay đã hết hạn trả `422 POS_BATCH_EXPIRED`, nhưng mock (a08b76f, ghi ở KIEN-THUC mục 9) quay về FEFO và chỉ thêm `messages`. Hợp đồng và code lệch nhau, QUYET-DINH chưa ghi. | Giữ hành vi hiện tại (an toàn: không bán lô hết hạn), sửa API-CONTRACT.md bỏ lỗi đó khỏi quote và ghi QUYET-DINH. Test hiện kiểm đúng hành vi "không bán lô hết hạn", không ép mã lỗi. | Giữ hành vi hiện tại, sửa API-CONTRACT (D45) |
