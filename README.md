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
npm run test:phase4:live
npm run test:phase4:browser
```

## Trạng thái hiện tại

- Public catalog chạy từ dữ liệu published trong Supabase qua server repository; không dùng catalog static làm nguồn production.
- Auth, signup, profile và account approval đã có.
- Admin shell, consultation và catalog CRUD đã có.

Consultation intake rate limiting uses canonical platform-provided IP metadata when
available. If the platform does not expose it, the terminating proxy must sign the
canonical IP in X-Consultation-Client-IP using the server-only
CONSULTATION_PROXY_SIGNING_SECRET. The route never trusts X-Forwarded-For or
X-Real-IP, never shares an unknown bucket, and canonicalizes IPv4, IPv6, and
IPv4-mapped IPv6 before rate limiting.
- Private storage, upload metadata và signed URL đã có.
- Product entitlement, student workspace, learning progress và study plans đã có.
- Schema repository hiện có migration từ `0001` đến `0027` (`0017` xử lý profile signup, `0018` bổ sung invariant semantic cho catalog, `0019` cung cấp transaction-safe admin catalog RPC, `0020` đóng direct table-mutation boundary, `0021` chuẩn hóa search Unicode, `0022` đóng mutation/semantic boundary, `0023` duy trì search document cho child fields, `0024` harden consultation workflow, `0025` loại trigger legacy ghi đè audit, `0026` đóng direct consultation INSERT bằng RPC kiểm soát, và `0027` thu hồi RPC khỏi public roles).
Schema sequence: `0001` → `0002` → `0003` → `0004` → `0005` → `0006` → `0007` → `0008` → `0009` → `0010` → `0011` → `0012` → `0013` → `0014` → `0015` → `0016` → `0017` → `0018` → `0019` → `0020` → `0021` → `0022` → `0023` → `0024` → `0025` → `0026` → `0027`.

Consultation rows cannot be inserted directly by `anon` or `authenticated` after
`0026`, and `0027` also revokes direct RPC execution from those roles. The public
form calls the exact-signature `submit_consultation_intake` RPC through the API's
server-only service-role client. PostgreSQL repeats source-path, published-catalog,
subject relation, format, and request-id checks; database validation and idempotency
remain defense in depth for the controlled server boundary.

`npm run verify:db` kiểm tra tĩnh migration, seed và RLS contract. Đây không phải
live database verification. `npm run test:phase4:live` là harness thật, không mock,
và chỉ chạy khi test database đã apply `0001` → `0027` cùng credentials test.
`npm run test:phase4:browser` cần Playwright và app URL. Môi trường hiện tại chưa
cung cấp các điều kiện live/browser này.

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
Schema sequence: `0001` → `0002` → `0003` → `0004` → `0005` → `0006` → `0007` → `0008` → `0009` → `0010` → `0011` → `0012` → `0013` → `0014` → `0015` → `0016` → `0017` → `0018` → `0019` → `0020` → `0021` → `0022` → `0023` → `0024` → `0025` → `0026` → `0027`.
