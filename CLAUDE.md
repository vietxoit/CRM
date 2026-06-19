# CLAUDE.md — Việt Xô CRM Portal

## Tổng quan dự án
CRM nội bộ cho công ty thép Việt Xô. Quản lý khách hàng, báo giá, đơn hàng, công nợ theo quy trình 4 bộ phận: Kinh doanh → Hỗ trợ KD → Vận chuyển → Kế toán.

## Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database:** Supabase (PostgreSQL) + Prisma ORM
- **Styling:** Tailwind CSS
- **Email:** Resend (`baogia@vietxosteel.vn`)
- **PDF:** jsPDF + Roboto font base64
- **Dev:** `localhost:3000` | LAN: `192.168.1.233:3000`

## Cấu trúc thư mục quan trọng
```
app/
├── login/page.tsx
├── customers/page.tsx              ← Danh sách KH + Kanban
├── customers/[id]/page.tsx         ← Chi tiết KH (5 tab + pipeline)
├── quotations/page.tsx             ← Danh sách báo giá
├── quotations/new/page.tsx         ← Tạo báo giá
├── quotations/[id]/page.tsx        ← Chi tiết báo giá
├── steel-prices/page.tsx           ← Bảng giá thép
├── debts/page.tsx                  ← Quản lý công nợ
└── api/
    ├── customers/route.ts
    ├── customers/[id]/route.ts     ← dùng $queryRawUnsafe (tier/credit_limit không trong schema)
    ├── customers/[id]/interactions/route.ts
    ├── customers/[id]/tasks/route.ts
    ├── customers/[id]/orders/route.ts
    ├── customers/[id]/orders/logs/route.ts
    ├── quotations/route.ts
    ├── quotations/[id]/route.ts    ← Khi accepted: copy items, tạo debt, update pipeline
    ├── quotations/[id]/pdf/route.ts
    ├── quotations/[id]/send-email/route.ts
    ├── quotations/[id]/edit/route.ts
    ├── steel-prices/route.ts
    ├── debts/route.ts
    └── debts/[id]/route.ts         ← POST thanh toán dùng $3::date cast
```

## Database

### Prisma models (camelCase)
- `Customer` — id, name, company, phone, email, value, status, assigned_to
- `Interaction` — id, customerId, content, noteType, createdAt
- `Task` — id, customerId, title, dueDate, isCompleted

### Columns thêm bằng SQL (KHÔNG có trong Prisma schema)
```sql
-- Customer
credit_limit NUMERIC DEFAULT 0
tier TEXT DEFAULT 'normal'  -- vip/priority/normal/caution/low
tier_note TEXT
pipeline TEXT DEFAULT 'approach'  -- approach/survey/quoted/negotiating/signed/delivering/collecting/done
order_status TEXT  -- (cũ, đã thay bằng pipeline)

-- quotations (raw SQL table)
sales_support TEXT       -- Hỗ trợ KD phụ trách
delivery_person TEXT     -- Nhân viên vận chuyển
delivery_status TEXT     -- pending/in_progress/delivered

-- debts (raw SQL table)
accountant TEXT          -- Kế toán phụ trách
invoice_number TEXT      -- Số hóa đơn
invoice_date DATE        -- Ngày xuất hóa đơn
```

### Raw SQL tables (snake_case)
```sql
quotations        -- id, customer_id, quote_number, status, total_value, valid_days, note, ...
quotation_items   -- id, quotation_id, product_name, unit, quantity, unit_price, total_price
steel_prices      -- id, product_name, unit, price
debts             -- id, customer_id, quotation_id, title, total_amount, paid_amount, due_date, status
debt_payments     -- id, debt_id, amount, paid_at::date, note
customer_orders   -- id, customer_id, product_name, quantity, unit_price, total_price
order_history_logs -- id, customer_id, change_summary, updated_by, created_at
```

## Quy tắc kỹ thuật quan trọng

### API Routes
```typescript
// LUÔN dùng $queryRawUnsafe cho Customer (vì có field ngoài schema)
const customers = await prisma.$queryRawUnsafe(`SELECT * FROM "Customer" WHERE id = $1`, id)

// Tên bảng Prisma phải có nháy kép
"Customer", "Interaction", "Task"

// Cột Prisma dùng camelCase với nháy kép
"customerId", "createdAt", "isCompleted"

// cast ::date cho paid_at
VALUES ($1, $2, $3::date, $4)

// cast ::uuid cho user id
WHERE id = $1::uuid
```

### Client
```typescript
// Auth: localStorage-based (không dùng cookie vì LAN IP)
import { fetchWithAuth } from '@/lib/fetchWithAuth'  // tự attach Bearer token

// Prisma singleton
import { prisma } from '@/lib/prisma'

// AuthGuard wrap mọi trang cần auth
export default function Page() {
  return <AuthGuard><PageComponent /></AuthGuard>
}
```

### React
```typescript
// Fragment trong .map() PHẢI dùng React.Fragment với key
quotations.map(q => (
  <React.Fragment key={q.id}>
    ...
  </React.Fragment>
))
```

## Pipeline bán hàng (8 bước)
```
approach → survey → quoted → negotiating → signed → delivering → collecting → done
Kinh doanh                               Hỗ trợ KD  Vận chuyển  Kế toán
```

### Tự động chuyển pipeline:
- Báo giá `accepted` → pipeline chuyển sang `signed`
- Debt `paid` hoàn toàn → pipeline chuyển sang `done`

## Logic nghiệp vụ

### Khi báo giá được Chấp nhận (status = 'accepted'):
1. Copy items từ `quotation_items` → `customer_orders` (KHÔNG xóa cũ, thêm mới)
2. Ghi log vào `order_history_logs`
3. Cập nhật `Customer.value` = SUM tất cả customer_orders
4. Tạo công nợ trong `debts` (nếu chưa có)
5. Cập nhật `Customer.status` = 'Thành công'

### Phân loại KH (tier):
- `vip` ⭐ — Doanh số >500tr, thanh toán đúng hạn
- `priority` 🔵 — Khách thân thiết
- `normal` 🟢 — Mặc định
- `caution` 🟡 — Nợ quá hạn, vượt credit_limit
- `low` ⚪ — Ít mua, không tiềm năng

### Giá trị KH hiển thị:
- 🎯 **Ước tính** = `Customer.value` (nhập tay)
- 📈 **Đã chốt HĐ** = SUM(`debts.total_amount`)
- ✅ **Đã thanh toán** = SUM(`debts.paid_amount`)
- ⚠️ **Còn nợ** = SUM(`debts.remaining_amount`)

## Môi trường
```env
RESEND_API_KEY=re_hLkhgEod_87qoHbaTs1SZjoufbftp8LMX
NOTIFY_EMAIL=vietxo.it@gmail.com
NEXT_PUBLIC_SUPABASE_URL=https://uplggsrcxbmkvwltwqxs.supabase.co
NEXT_PUBLIC_APP_URL=http://192.168.1.233:3000
```

## Lỗi thường gặp & Fix

| Lỗi | Fix |
|-----|-----|
| `relation "interactions" does not exist` | Dùng `"Interaction"` và `"customerId"` |
| `column "paid_at" is of type date` | Dùng `$3::date` |
| `uuid = text` | Dùng `$1::uuid` |
| `max clients reached` | Singleton `lib/prisma.ts` |
| `tier not in schema` | Dùng `$queryRawUnsafe` thay `prisma.customer.findUnique` |
| React key prop warning | Dùng `React.Fragment key={id}` thay `<>` |

## Tính năng đã hoàn thiện
- [x] Auth localStorage + AuthGuard
- [x] CRUD Khách hàng + Kanban board
- [x] Trang chi tiết KH với 5 tab (Đơn hàng, Báo giá, Công nợ, Nhật ký, Việc làm)
- [x] Pipeline 8 bước với thanh tiến trình + phân công bộ phận
- [x] Phân loại KH (tier) + Khuyến nghị tự động
- [x] Giới hạn công nợ (credit_limit) + cảnh báo
- [x] Tạo/Sửa/Xóa Báo giá
- [x] Xuất PDF (Roboto font tiếng Việt)
- [x] Gửi email qua Resend
- [x] Copy nội dung Zalo
- [x] Trang chi tiết báo giá `/quotations/[id]`
- [x] Quản lý công nợ + ghi nhận thanh toán
- [x] Phân công Hỗ trợ KD, Vận chuyển cho đơn hàng
- [x] Phân công Kế toán + số hóa đơn cho công nợ
- [x] Bảng giá thép CRUD

## Tính năng chưa làm
- [ ] Tự động chuyển pipeline theo hành động
- [ ] Import Excel danh sách KH
- [ ] Dashboard KPI nhân viên
- [ ] Thông báo nhắc việc qua email
- [ ] Deploy Windows Server on-premise
