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

Consultation intake rate limiting uses canonical platform-provided IP metadata when
available. A deployment behind a proxy must set both
`CONSULTATION_TRUSTED_PROXY=true` and `CONSULTATION_TRUSTED_PROXY_HOPS=<n>` only
after the terminating edge is verified to strip client-supplied forwarding headers,
write its own `X-Forwarded-For`/`X-Real-IP`, and be the only path to Next.js. The
route canonicalizes IPv4, IPv6 and IPv4-mapped IPv6 before rate limiting; it never
shares an `unknown` bucket. Source attribution persists an allowlisted internal
pathname only (never query parameters).
- Private storage, upload metadata và signed URL đã có.
- Product entitlement, student workspace, learning progress và study plans đã có.
- Schema repository hiện có migration từ `0001` đến `0026` (`0017` xử lý profile signup, `0018` bổ sung invariant semantic cho catalog, `0019` cung cấp transaction-safe admin catalog RPC, `0020` đóng direct table-mutation boundary, `0021` chuẩn hóa search Unicode, `0022` đóng mutation/semantic boundary, `0023` duy trì search document cho child fields, `0024` harden consultation workflow, `0025` loại trigger legacy ghi đè audit, và `0026` đóng direct consultation INSERT bằng RPC kiểm soát).

Consultation rows cannot be inserted directly by `anon` or `authenticated` after
`0026`. The public form calls the exact-signature `submit_consultation_intake`
RPC through the API, which repeats source-path, published-catalog, subject relation,
format, and request-id checks in PostgreSQL. Because a public RPC cannot derive a
trustworthy network IP on its own, the IP rate limit is an HTTP-edge/API control;
the edge contract above must be enforced so callers cannot bypass it by reaching a
different origin. Database validation and idempotency still apply to every RPC call.

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
