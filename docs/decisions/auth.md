# Architecture Decision Record: Authentication & Session Management

## Context & Requirements

The LEFT HAND platform provides educational products (materials, courses, tutoring) with protected student workspaces (`/ca-nhan`), purchased entitlements, and order histories.

Previous iterations relied on demo client-side mock authentication. Phase 3 replaces this demo model with production-grade authentication backed by Supabase Auth and server-enforced sessions.

## Key Decisions

### 1. Primary Authentication Method: Email & Password with Verification
- Users register and sign in using email and password.
- Verification emails are dispatched by Supabase with a secure one-time authorization code.
- Email verification redirect leads to `/auth/callback?code=...`.

### 2. Cookie-Based Server Session Handling
- Server components, Route Handlers, and Server Actions read session and user states through `@supabase/ssr` with HttpOnly, secure cookies via `lib/supabase/server.ts`.
- The auth callback exchanges authorization codes for session tokens on the server side (`app/auth/callback/route.ts`).
- Server helpers in `lib/auth/session.ts` provide:
  - `getAuthUser()`: Validates token authenticity against Supabase auth servers (`auth.getUser()`).
  - `getAuthSession()`: Reads the current session.
  - `requireAuthUser()`: Enforces authentication and throws `UnauthorizedError`.

### 3. Server-Side Authorization as the Primary Security Boundary
- Entitlement checks and protected routes verify user ID and roles strictly on the server (Server Components and Route Handlers).
- Client state is treated as purely presentational and never trusted for access control or entitlement verification.

### 4. Zero Service-Role Key Exposure
- Only public variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are accessed by client code or standard server operations.
- Supabase Row Level Security (RLS) policies enforce database isolation per `auth.uid()`.
- Service-role keys are never included in frontend bundles, repositories, or public configuration.