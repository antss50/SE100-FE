# Tiến độ frontend

> Luật: [../../CLAUDE.md](../../CLAUDE.md). Nhánh: `demo`. Mỗi giai đoạn chạy: agent code → agent kiểm thử → agent code sửa lỗi → kiểm thử lại, đến khi không còn lỗi Critical/High.

Trạng thái: `Chưa làm` · `Đang code` · `Đang test` · `Đang sửa` · `Xong` · `Chặn` (kèm mã câu hỏi).

## Giai đoạn

| GĐ | Nội dung | UC | Trạng thái |
|---|---|---|---|
| 0 | Nền tảng: mock adapter + `VITE_USE_MOCK`, chuyển service cũ sang adapter, bỏ tự đăng nhập, `domain/permissions.ts` + guard, component `ui/`, token màu, lazy route, sidebar theo thiết kế, cài Vitest + Playwright, port `pricing.ts` và `returns.ts` từ code mẫu kèm 12 test | Nền | Chưa làm |
| 1 | Nhà cung cấp, nhập kho | SUPP-01..03, STK-01 | Chưa làm |
| 2 | Tồn kho, cận hạn, kiểm kho, xuất đặc biệt | STK-02..07 | Chưa làm |
| 3 | Rà và sửa phần cũ cho khớp tài liệu; cấu hình | AUTH-01..05, AUTH-07, PROD-01..03, CUS-01..05, PROM-01..02 | Chưa làm |
| 4 | Mở ca, bán hàng FEFO, voucher, dùng điểm, thanh toán, lịch sử và chi tiết đơn | POS-01..03, PROM-03, CUS-04 | Chưa làm |
| 5 | Đổi trả, chốt ca, lịch sử và chi tiết ca | POS-04, POS-05 | Chưa làm |
| 6 | Báo cáo, dashboard, nhật ký, hiệu quả khuyến mãi | REP-01..06, AUTH-06, PROM-04 | Chưa làm |
| 7 | Hồi quy toàn bộ, E2E xuyên suốt, rà luật nghiệp vụ | Tất cả | Chưa làm |

## Trạng thái từng UC

| UC | Tên | GĐ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| AUTH-01 | Đăng nhập | 3 | Chưa làm | Có code cũ |
| AUTH-02 | Đăng xuất | 3 | Chưa làm | Có code cũ |
| AUTH-03 | Đổi mật khẩu | 3 | Chưa làm | Có code cũ |
| AUTH-04 | Quản lý tài khoản nhân viên | 3 | Chưa làm | Có code cũ |
| AUTH-05 | Vai trò & phân quyền | 3 | Chưa làm | Có code cũ |
| AUTH-06 | Nhật ký hệ thống | 6 | Chưa làm | |
| AUTH-07 | Cấu hình hệ thống | 3 | Chưa làm | |
| PROD-01 | Sản phẩm / SKU | 3 | Chưa làm | Có code cũ |
| PROD-02 | Danh mục | 3 | Chưa làm | Có code cũ |
| PROD-03 | Thương hiệu | 3 | Chưa làm | Có code cũ |
| SUPP-01 | Quản lý NCC | 1 | Chưa làm | |
| SUPP-02 | Tra cứu & chi tiết NCC | 1 | Chưa làm | |
| SUPP-03 | Lịch sử nhập của NCC | 1 | Chưa làm | |
| STK-01 | Phiếu nhập kho theo lô | 1 | Chưa làm | Đường găng |
| STK-02 | Tra cứu tồn theo SP & lô | 2 | Chưa làm | |
| STK-03 | Cận hạn / hết hạn | 2 | Chưa làm | |
| STK-04 | Lập phiếu kiểm kho | 2 | Chưa làm | |
| STK-05 | Duyệt kiểm kho | 2 | Chưa làm | |
| STK-06 | Lập phiếu xuất khác | 2 | Chưa làm | |
| STK-07 | Duyệt phiếu xuất khác | 2 | Chưa làm | |
| CUS-01 | Tra cứu & hồ sơ KH | 3 | Chưa làm | Có code cũ |
| CUS-02 | Quản lý hồ sơ KH | 3 | Chưa làm | Có code cũ |
| CUS-03 | Tích/thu hồi điểm, xét hạng (hệ thống) | 3 | Chưa làm | Hiện ở lịch sử điểm |
| CUS-04 | Dùng điểm khi thanh toán | 4 | Chưa làm | |
| CUS-05 | Cấu hình điểm & hạng | 3 | Chưa làm | Có code cũ |
| PROM-01 | Tra cứu KM | 3 | Chưa làm | Có code cũ, lệch 7 loại |
| PROM-02 | Quản lý KM | 3 | Chưa làm | Có code cũ, lệch 7 loại |
| PROM-03 | Áp voucher khi bán | 4 | Chưa làm | |
| PROM-04 | Hiệu quả KM | 6 | Chưa làm | |
| POS-01 | Mở ca | 4 | Chưa làm | Có modal cũ |
| POS-02 | Lập đơn FEFO | 4 | Chưa làm | Đường găng, viết lại |
| POS-03 | Thanh toán & hóa đơn | 4 | Chưa làm | Đường găng |
| POS-04 | Đổi trả & hoàn tiền | 5 | Chưa làm | Đường găng |
| POS-05 | Kiểm đếm & chốt ca | 5 | Chưa làm | |
| REP-01 | Dashboard | 6 | Chưa làm | Có code cũ |
| REP-02 | Doanh thu & lợi nhuận gộp | 6 | Chưa làm | |
| REP-03 | Bán hàng | 6 | Chưa làm | |
| REP-04 | Tồn kho & hạn dùng | 6 | Chưa làm | |
| REP-05 | Nhập hàng | 6 | Chưa làm | |
| REP-06 | Khách hàng | 6 | Chưa làm | |

## Lỗi

| Mã | GĐ | UC | Mức | Mô tả và bước tái hiện | Trạng thái |
|---|---|---|---|---|---|

## Câu hỏi mở

Agent ghi câu hỏi ở đây thay vì tự đoán. Chủ dự án trả lời thì chuyển câu trả lời sang QUYET-DINH.md.

| Mã | GĐ | Câu hỏi | Phương án đề xuất | Trả lời |
|---|---|---|---|---|
