# SE100 Frontend — Quản lý cửa hàng mỹ phẩm

Frontend cho hệ thống 8 phân hệ, 40 use case (xem `docs/` của repo SE100). Hiện chạy bằng **dữ liệu giả lập (mock)** trong trình duyệt; backend sẽ nối sau.

## Chạy thử

Cần Node 20.19+ hoặc 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173, mặc định VITE_USE_MOCK=true (.env.development)
```

Đăng nhập (mật khẩu chung `Password@123`): `admin`, `manager01`, `cashier01`, `inventory01`, `newstaff` (bị bắt đổi mật khẩu lần đầu). Kịch bản demo từng nhân vật: [docs/HUONG-DAN-DEMO.md](docs/HUONG-DAN-DEMO.md).
Xóa dữ liệu giả lập: mở console trình duyệt, chạy `window.__SE100_MOCK__.reset()` rồi tải lại trang.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server |
| `npm run build` | Kiểm kiểu (`tsc -b`) và build production |
| `npm run lint` | Oxlint |
| `npm run test` | Vitest (unit, mock, component) |
| `npm run test:e2e` | Playwright, tự chạy vite cổng 5174 với mock, tắt độ trễ |

## Nối backend

Đặt `VITE_USE_MOCK=false`, `VITE_BACKEND_URL` (proxy dev) và `VITE_API_BASE_URL` (mặc định `/api/v1`). Khi tắt mock, lỗi mạng hiện ra, không rơi về dữ liệu giả. Hợp đồng API đầy đủ (endpoint, quyền, request, response, mã lỗi) ở [docs/API-CONTRACT.md](docs/API-CONTRACT.md); mock trong `src/mocks/` trả đúng như hợp đồng này.

## Tài liệu trong `docs/`

| File | Nội dung |
|---|---|
| [HUONG-DAN-DEMO.md](docs/HUONG-DAN-DEMO.md) | Hướng dẫn demo từng nhân vật (admin, quản lý, nhân viên kho, thu ngân) |
| [API-CONTRACT.md](docs/API-CONTRACT.md) | Hợp đồng API cho backend (102 endpoint, 14 nhóm) |
| [TIEN-DO.md](docs/TIEN-DO.md) | Trạng thái giai đoạn, từng UC, lỗi, câu hỏi mở |
| [QUYET-DINH.md](docs/QUYET-DINH.md) | Các quyết định và chỗ làm khác thiết kế |
| [KIEN-THUC.md](docs/KIEN-THUC.md) | Sổ kiến thức: cấu trúc code, cách thêm UC, API mock |
| [NHAT-KY-TIEN-DO.md](docs/NHAT-KY-TIEN-DO.md) | Dòng thời gian từng việc |

Luật làm việc của cả dự án: [../CLAUDE.md](../CLAUDE.md).

## Stack

React 19, TypeScript, Vite, Tailwind 4, TanStack Query, Zustand, React Hook Form + Zod, React Router 7, lucide-react. Test: Vitest, Testing Library, Playwright.

## Cấu trúc `src/`

```
app/          store (phiên, UI)         components/   ui dùng chung, layouts
domain/       hàm thuần: phân quyền, tính giá, trả hàng, kho, báo cáo
features/     màn hình theo phân hệ     lib/          api-client, query-keys
mocks/        mock adapter, seed        routes/       route, guard, menu
services/     gọi API                   types/        kiểu dữ liệu
```
