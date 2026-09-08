# LEFT HAND

LEFT HAND - Onthidithoi là hệ sinh thái hỗ trợ sinh viên UFM học tập và ôn thi.

## Stack

- Next.js App Router
- React và TypeScript
- Tailwind CSS và Framer Motion
- Supabase (Auth, database, RLS và private storage)

## Chạy local

Yêu cầu Node.js `v24.15.0` và npm `11.12.1`.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`. Điền các biến Supabase phù hợp vào `.env.local`; không commit file env local.

Demo auth chỉ dành cho development/test và cần đồng thời `NEXT_PUBLIC_DEMO_MODE=true`, `NEXT_PUBLIC_DEMO_EMAIL` và `NEXT_PUBLIC_DEMO_PASSWORD`. Các biến này không được cấu hình trong production.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm test
npm run test:integration
npm run verify:db
```

## Trạng thái hiện tại

- Public catalog chạy từ dữ liệu published trong Supabase qua server repository; không dùng catalog static làm nguồn production.
- Auth, signup, profile và account approval đã có.
- Admin shell, consultation và catalog CRUD đã có.
- Private storage, upload metadata và signed URL đã có.
- Product entitlement, student workspace, learning progress và study plans đã có.
- Schema repository hiện có migration từ `0001` đến `0018` (`0017` xử lý profile signup, `0018` bổ sung các invariant semantic cho catalog).

`npm run verify:db` kiểm tra tĩnh migration, seed và RLS contract. Đây không phải live database verification; việc xác nhận Supabase instance thực tế cần credentials và môi trường database tương ứng.

## Chưa làm

- Order/cart.
- Checkout, payment và webhook.
- Tutor booking/room.
- Notifications/email.
- CI/E2E production.
- Staging/production runbook.

Các mục trên chưa được coi là production-ready.

## Bảo mật

Không commit `.env`, `.env.local`, API key, password, access token hoặc secret dịch vụ bên thứ ba. Chỉ commit `.env.example` với tên biến và placeholder rỗng.
