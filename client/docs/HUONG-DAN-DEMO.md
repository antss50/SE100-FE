# Hướng dẫn demo theo từng nhân vật

Dành cho người demo hoặc người nghiệm thu. Ứng dụng chạy bằng **dữ liệu giả lập** lưu trong trình duyệt, chưa cần backend.

## 1. Chuẩn bị

```bash
cd SE100-FE/client
npm install          # lần đầu
npm run dev          # mở http://localhost:5173
```

- Màn hình nên đặt **1366×768 trở lên**.
- Mật khẩu chung của mọi tài khoản mẫu: `Password@123`.
- Dữ liệu lưu trong trình duyệt (localStorage), mỗi trình duyệt một bản. **Muốn quay về dữ liệu ban đầu:** mở Console (F12), chạy `window.__SE100_MOCK__.reset()`, rồi bấm F5.
- Ngày trong dữ liệu mẫu tính theo hôm nay, nên số ngày "còn X ngày" luôn đúng khi demo vào bất kỳ ngày nào.
- Thanh trên cùng có ô **"Mock · đổi vai trò"** để chuyển nhanh giữa các tài khoản (thực chất là đăng nhập lại).

## 2. Bốn nhân vật

| Tài khoản | Vai trò | Họ tên | Làm được gì | Không làm được |
|---|---|---|---|---|
| `admin` | Quản trị (ADMIN) | Đặng Quốc Khang | Tất cả: tài khoản, phân quyền, nhật ký, cấu hình, mọi nghiệp vụ và báo cáo | Không tự khóa chính mình; không bỏ quyền quản trị của ADMIN |
| `manager01` | Quản lý cửa hàng | Trần Lê Ngọc Mai | Duyệt kiểm kho và phiếu xuất khác, xác nhận bàn giao ca, quản lý khuyến mãi, nhà cung cấp, khách, cấu hình điểm, xem doanh thu | Không bán hàng tại POS; không xem lợi nhuận và giá vốn; không vào tài khoản, phân quyền, nhật ký |
| `inventory01` | Nhân viên kho | Lê Vũ Hoàng An | Nhập kho, kiểm kho, lập phiếu xuất hủy/tester/trả NCC, sản phẩm, tồn kho, báo cáo kho | Không duyệt; không bán hàng; không vào khách, khuyến mãi, ca |
| `cashier01` | Thu ngân | Nguyễn Thu Hà | Mở/chốt ca, bán hàng, đổi trả, tra khách và thêm/sửa khách, xem khuyến mãi, báo cáo ca của mình | Chỉ thấy tồn bán được (không thấy tồn cách ly, giá vốn); không khóa khách |

Thêm: `newstaff` (bị bắt **đổi mật khẩu ở lần đăng nhập đầu**), `trang.bui` (tài khoản **đã bị khóa**, đăng nhập sẽ báo lỗi).

## 3. Kịch bản demo từng nhân vật

### 3.1. Thu ngân `cashier01` — luồng bán hàng (nên demo đầu tiên)

Sau khi đăng nhập, thu ngân vào thẳng màn **POS**.

1. **Mở ca.** POS đang báo "Chưa mở ca nên chưa thể lập đơn". Bấm **Mở ca**, nhập tiền đầu ca (ví dụ `2.000.000`), xác nhận. *Điểm nhấn: không mở ca thì không bán được (luật 35–36).*
2. **Bán hàng cơ bản.** Bấm vào sản phẩm trong danh sách (hoặc F1 để tìm, F2 để quét mã vạch). Ví dụ: `Son Thỏi Lì YSL Rouge Pur Couture #196` (1.150.000 đ). *Điểm nhấn: cột "Lô FEFO" tự chọn lô hết hạn sớm nhất; số lượng vượt tồn lô đầu thì tự tách sang lô kế.*
3. **Gắn khách và hạng thẻ.** Ở ô khách nhập SĐT `0918234567` (Nguyễn Thị Thùy Dung, chi tiêu cao nhất) rồi bấm Tìm. *Điểm nhấn: hạng thẻ giảm thêm ở tầng 2, cả lên món đã giảm.*
4. **Khuyến mãi 4 tầng.** Thêm vài món để đơn đạt ≥ 800.000 đ rồi nhập voucher `GIAM100` (giảm 100.000 đ). Đơn ≥ 2.000.000 đ sẽ được tặng thêm son bóng (quà theo hóa đơn); đơn ≥ 3.000.000 đ có bậc thang giảm. Khung "Khuyến mãi 4 tầng" bên phải hiển thị từng tầng. Voucher `WELCOME10` chỉ dùng khi đã gắn khách hạng Bạc trở lên. *Điểm nhấn: mỗi đơn chỉ nhận một khoản giảm tiền ở tầng 3, hệ thống tự lấy cái lợi hơn.*
5. **Dùng điểm.** Với khách có điểm, nhập số điểm muốn dùng; hệ thống chặn nếu vượt 50% giá trị đơn.
6. **Thanh toán.** Chọn một phương thức (Tiền mặt / Chuyển khoản / Thẻ). Tiền mặt: nhập tiền khách đưa, nếu thiếu thì nút hoàn tất bị khóa. Bấm **Hoàn tất (F9)**, cửa sổ in hóa đơn hiện ra. *Điểm nhấn: hoàn tất là một giao dịch, trừ tồn theo lô, ghi thẻ kho, tích điểm cho khách ngay.*
7. **Đơn nháp.** Thêm món rồi bấm **Đơn nháp** để lưu, mở lại sau.
8. **Xem lại đơn.** Menu **Lịch sử đơn hàng** → mở đơn vừa bán xem chi tiết (đơn đã hoàn tất không có nút sửa/xóa).
9. **Đổi trả.** Menu **Đổi trả hàng** → chọn đơn vừa bán → chọn lý do:
   - *Hàng lỗi*: hoàn tiền theo số khách đã trả, hàng nhận về bị cách ly.
   - *Khách đổi ý*: chỉ được **đổi hàng**, hàng mới phải có giá trị ≥ hàng cũ, và phải còn nguyên seal (hàng đã mở seal thì bị từ chối, không lập phiếu).
   *Điểm nhấn: không bù voucher; điểm đã dùng không hoàn; điểm đã tích bị thu hồi theo tỷ lệ.*
10. **Chốt ca.** Menu **Quản lý ca** → ca đang mở → **Chốt ca**: nhập số tiền thực đếm. Nếu lệch so với kỳ vọng thì **bắt buộc nhập giải trình**. Chốt ca bị chặn khi còn đơn nháp: hủy hoặc hoàn tất đơn nháp trước.
11. **Chỉ thấy tồn bán được.** Menu **Tồn kho & Cận hạn** → chỉ có cột "Bán được", không có cột tồn cách ly hay giá vốn.

### 3.2. Nhân viên kho `inventory01` — nhập kho, kiểm kho, xuất hủy

1. **Nhập kho.** Menu **Nhập hàng theo lô FEFO** → tạo phiếu: chọn nhà cung cấp đang hoạt động, thêm dòng (sản phẩm, mã lô, ngày sản xuất, **hạn dùng**, số lượng, giá nhập). Lưu nháp hoặc xác nhận. Khi nhập lô có hạn **sớm hơn** lô đang tồn, hệ thống cảnh báo "xoay kệ" (chỉ nhắc, không chặn). Nhập thêm vào một lô đã có thì giá vốn tính bình quân gia quyền. *Điểm nhấn: bấm xác nhận hai lần không cộng tồn hai lần; phiếu đã hoàn tất không sửa/xóa được.*
2. **Tồn kho theo lô.** Menu **Tồn kho & Cận hạn**: lọc cận hạn, hết hạn, đang cách ly; có cột tồn thực, cách ly, giá vốn. Nút **Quét FEFO** ở thanh trên cùng mở đúng màn này với ô quét mã đã sẵn sàng. Có sẵn lô cận hạn (ví dụ `LOT-YSL-2390`, còn khoảng 12 ngày) và lô tester của hãng (không bao giờ bán được).
3. **Kiểm kho.** Menu **Kiểm kê kho** → **Tạo phiếu**, chọn các lô cần kiểm. Khi bắt đầu, hệ thống chụp tồn và **khóa các lô** (POS không bán lô đang bị khóa). Nhập số đếm thực tế (ô để trống không phải 0), gửi duyệt. Phiếu không có chênh lệch thì tự hoàn tất.
4. **Xuất hủy / tester / trả NCC.** Menu **Xuất hủy & Xuất đặc biệt** → tạo phiếu loại Xuất hủy, Xuất tester hoặc Trả nhà cung cấp. *Điểm nhấn: lập phiếu là hàng bị cách ly ngay, nhưng tồn chỉ bị trừ khi Quản lý duyệt.*
5. **Phân quyền.** Thử vào `/pos`, `/customers`, `/users` bằng cách gõ thẳng địa chỉ: bị chặn.

### 3.3. Quản lý `manager01` — duyệt, khuyến mãi, theo dõi

Để có phiếu cần duyệt, nên chạy **3.2 trước**: dùng `inventory01` lập một phiếu kiểm kho có chênh lệch và một phiếu xuất hủy, rồi đổi sang `manager01`.

1. **Duyệt kiểm kho.** Menu **Kiểm kê kho** → mở phiếu chờ duyệt → **Duyệt** (tồn được cộng phần chênh lệch, ghi thẻ kho) hoặc **Từ chối** (bắt buộc nhập lý do, lô được mở khóa).
2. **Duyệt xuất hủy.** Menu **Xuất hủy & Xuất đặc biệt** → mở phiếu → Duyệt (trừ tồn) hoặc Từ chối (trả lại phần đã cách ly).
3. **Khuyến mãi.** Menu **Khuyến mãi 4 tầng** → tạo chương trình (7 loại: giảm theo sản phẩm, đồng giá giờ vàng, mua X tặng Y, combo, bậc thang theo đơn, voucher, quà theo hóa đơn). Với loại Voucher có thể giới hạn **chỉ dành cho một khách** (tìm theo SĐT). Chương trình đã có đơn dùng thì **khóa sửa** mức giảm, chỉ tạm dừng hoặc gia hạn. Nút **Xem hiệu quả** cho lượt dùng, tổng giảm, doanh thu, top khách.
4. **Hạng thẻ và điểm.** Menu **Cấu hình điểm & hạng**: sửa mốc chi tiêu, **% giảm** từng hạng, số tiền để được 1 điểm, giá trị 1 điểm, mức dùng điểm tối đa.
5. **Ca bán hàng.** Menu **Quản lý ca** xem mọi ca (kể cả chênh lệch tiền) và **xác nhận bàn giao** ca đã chốt.
6. **Báo cáo.** Menu **Báo cáo tài chính & Excel**: doanh thu, bán hàng, tồn kho và hạn dùng, nhập hàng, khách hàng; có xuất CSV. *Điểm nhấn: Quản lý thấy doanh thu nhưng không thấy lợi nhuận gộp và giá vốn.*
7. **Không có:** màn POS, tài khoản, phân quyền, nhật ký hệ thống.

### 3.4. Quản trị `admin` — toàn quyền, hệ thống và kiểm soát

1. **Dashboard.** Trang chủ: doanh thu hôm nay, biểu đồ 7 ngày, cảnh báo cận hạn, hết hạn, tồn dưới ngưỡng, phiếu chờ duyệt.
2. **Báo cáo đầy đủ.** Menu **Báo cáo tài chính & Excel**: chỉ Admin thấy **lợi nhuận gộp** (doanh thu thuần chưa VAT trừ giá vốn). Đổi khoảng ngày; nhập ngày bắt đầu sau ngày kết thúc sẽ báo lỗi. Hàng trả được trừ vào kỳ phát sinh trả hàng.
3. **Tài khoản nhân viên.** Menu **Tài khoản nhân viên**: tạo tài khoản mới (mã NV tự sinh nếu để trống, bắt đổi mật khẩu lần đầu), khóa/mở khóa. Không có nút khóa chính mình. Khóa tài khoản là thu hồi phiên đăng nhập ngay.
4. **Phân quyền.** Menu **Phân quyền vai trò**: tick quyền theo vai trò. Không thêm/xóa được quyền (danh sách có sẵn trong code), không bỏ được quyền quản trị của ADMIN, không xóa được vai trò hệ thống.
5. **Nhật ký hệ thống.** Menu **Nhật ký hệ thống**: lọc theo người, hành động, module, ngày; bấm một dòng để xem dữ liệu trước và sau. Vừa làm các bước trên sẽ thấy ngay các bản ghi (đăng nhập, hoàn tất đơn, chốt ca, đổi cấu hình, đổi lô thủ công...). Mật khẩu và token không bao giờ nằm trong nhật ký.
6. **Cấu hình hệ thống.** Menu **Cấu hình hệ thống**: số ngày cảnh báo cận hạn (mặc định 60), tham số điểm, thời hạn đổi trả (mặc định 7 ngày), thông tin cửa hàng in trên hóa đơn.

### 3.5. Các tình huống kiểm tra nhanh (bất kỳ vai trò)

| Muốn chứng minh | Cách làm |
|---|---|
| Khóa tạm sau 5 lần sai (luật 46) | Ở trang đăng nhập nhập sai mật khẩu 5 lần với một tài khoản → báo khóa 15 phút |
| Bắt đổi mật khẩu lần đầu (luật 47) | Đăng nhập `newstaff` → hộp đổi mật khẩu không đóng được, chưa dùng được app. Mật khẩu mới cần ≥ 8 ký tự, có chữ hoa, chữ thường, số |
| Tài khoản bị khóa | Đăng nhập `trang.bui` → báo tài khoản bị khóa |
| Chặn vào trang không có quyền | Đăng nhập `cashier01`, gõ `/users` trên thanh địa chỉ → trang "không đủ quyền" |
| Không bán lô hết hạn / hàng tester | Ở POS tìm sản phẩm tester của hãng → không xuất hiện; lô hết hạn không được chọn |
| Chứng từ hoàn tất không sửa | Mở một đơn hoặc phiếu nhập đã hoàn tất → không có nút sửa/xóa |

## 4. Thứ tự demo gợi ý (khoảng 15 phút)

1. `inventory01`: nhập kho một phiếu mới, xem lô xuất hiện ở Tồn kho (3 phút).
2. `cashier01`: mở ca, bán một đơn có khách và voucher, hoàn tất, xem lịch sử (5 phút).
3. `cashier01`: trả hàng lỗi một đơn, rồi chốt ca có giải trình (3 phút).
4. `manager01`: duyệt một phiếu xuất hủy, xác nhận bàn giao ca (2 phút).
5. `admin`: xem báo cáo doanh thu và lợi nhuận, rồi nhật ký hệ thống thấy toàn bộ các bước vừa làm (2 phút).

## 5. Giới hạn cần nói thật khi demo

- Chưa có backend: dữ liệu chỉ nằm trong trình duyệt đang dùng; xóa dữ liệu trình duyệt hoặc chạy lệnh reset là mất.
- Máy in: in hóa đơn dùng hộp thoại in của trình duyệt.
- Hệ thống chỉ cho **một cửa hàng**: không có chọn chi nhánh, chuyển kho hay vị trí kệ (luật 57, 59), dù một số thiết kế Figma bản Atelier có.
- Báo cáo, dashboard, nhật ký, cấu hình hệ thống không có thiết kế Figma, nên được dựng theo phong cách các màn có sẵn.
