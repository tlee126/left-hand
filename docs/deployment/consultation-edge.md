# Consultation production contract

The intake route has two accepted identity sources:

1. Platform-native request IP metadata (NextRequest.ip) supplied by the hosting
   runtime; or
2. A signed proxy header when native metadata is unavailable.

For the signed contract, the terminating proxy must canonicalize the client IP
(IPv4, RFC 5952 IPv6, or IPv4-mapped IPv6), set
X-Consultation-Client-IP, and set
X-Consultation-Client-IP-Signature to the lowercase hexadecimal HMAC-SHA256
of that canonical IP using CONSULTATION_PROXY_SIGNING_SECRET. The secret is
stored only in proxy/server secret configuration. The application rejects the
header unless CONSULTATION_TRUSTED_PROXY=true, the signature verifies, and the
IP parses successfully.

The application never trusts X-Forwarded-For or X-Real-IP, so a direct-origin
request or forged unsigned header cannot select a rate-limit bucket. Production
must route traffic only through the signing proxy, keep the direct origin
unreachable, and configure the same secret at the proxy and Next.js runtime.

The consultation RPC is not a browser/API credential. Migration 0027 revokes
EXECUTE from PUBLIC, anon, and authenticated, and grants it only to
service_role. /api/consultations imports lib/supabase/server-admin.ts, which is
marked server-only and reads SUPABASE_SERVICE_ROLE_KEY; this key must not be
NEXT_PUBLIC_*, imported by client code, or returned in a response.

## Verification

Apply migrations 0001 through 0027 to an isolated test database using the
approved database release process, then set:

PHASE4_LIVE_SCHEMA_READY=true
PHASE4_TEST_SUPABASE_URL=...
PHASE4_TEST_SUPABASE_ANON_KEY=...
PHASE4_TEST_SUPABASE_SERVICE_ROLE_KEY=...

Run npm run test:phase4:live. It exercises real PostgREST direct INSERT/RPC
denials, server-only RPC success, duplicate idempotency, and source validation.
The optional role/RLS, trigger rollback, and concurrent-CAS fixtures require
real test-user access tokens and a seeded test consultation; their absence is
reported as a limitation, not a pass.

Set PHASE4_APP_URL and install Playwright before npm run test:phase4:browser.
The browser harness exercises the real form, route response, overflow handling,
and an approved-admin page when a storage state is supplied. It does not
fabricate database mutation results.
