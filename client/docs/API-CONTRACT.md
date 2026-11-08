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
