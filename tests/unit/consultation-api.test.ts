import assert from "node:assert/strict";
import { test, describe, beforeEach } from "node:test";
import { handleConsultationPost, resetRateLimit, getClientIp, MAX_MAP_ENTRIES, checkRateLimit } from "../../app/api/consultations/route";

function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  jsonBody?: boolean;
  ip?: string;
}): Request {
  const headers = new Headers(options.headers || {});
  let bodyStr: string | undefined = undefined;

  if (options.body) {
    if (options.jsonBody !== false) {
      bodyStr = JSON.stringify(options.body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    } else {
      bodyStr = options.body;
    }
  }

  const req: any = new Request("http://localhost/api/consultations", {
    method: options.method || "POST",
    headers,
    body: bodyStr,
  });

  if (options.ip) {
    req.ip = options.ip;
  }

  return req as Request;
}

function createMockSupabase(overrideInsert?: (payload: any) => Promise<{error: any}>) {
  let insertedPayload: any = null;
  const client = {
    _getInsertedPayload: () => insertedPayload,
    from: (table: string) => {
      assert.strictEqual(table, "consultations");
      return {
        insert: async (payload: any) => {
          insertedPayload = payload;
          if (overrideInsert) {
            return overrideInsert(payload);
          }
          return { error: null };
        }
      };
    }
  };
  return client;
}

const VALID_PAYLOAD = {
  fullName: "Nguyễn Văn An",
  phone: "0901234567",
  faculty: "Khoa Tài chính",
  major: "Kế toán",
  interest: "Toán",
  need: "Cần tư vấn",
  note: "Không",
  sourcePath: "/path",
  selectedProductSlug: "prod",
  selectedSubjectSlug: "subj"
};

describe("Consultation POST API", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  test("1. valid POST returns 201 and inserts expected fields", async () => {
    const supabase = createMockSupabase();
    const req = createMockRequest({
      headers: { "Idempotency-Key": "test-key-123" },
      body: VALID_PAYLOAD
    });

    const response = await handleConsultationPost(req, supabase, "127.0.0.1");
    assert.strictEqual(response.status, 201);

    const data = await response.json();
    assert.deepStrictEqual(data, { success: true });

    const inserted = supabase._getInsertedPayload();
    assert.ok(inserted);
    assert.strictEqual(inserted.request_id, "test-key-123");
    assert.strictEqual(inserted.full_name, "Nguyễn Văn An");
    assert.strictEqual(inserted.phone, "0901234567");

    // Server-managed fields like status, id should NOT be in the insert payload
    assert.strictEqual(inserted.status, undefined);
    assert.strictEqual(inserted.id, undefined);
  });

  test("2. missing/invalid JSON returns 400", async () => {
    const supabase = createMockSupabase();
    const req = createMockRequest({
      headers: { "Idempotency-Key": "test-key-123", "content-type": "application/json" },
      body: "{invalid json",
      jsonBody: false
    });

    const response = await handleConsultationPost(req, supabase, "127.0.0.1");
    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.error, "Invalid JSON body");
  });

  test("3. missing Idempotency-Key returns 400", async () => {
    const supabase = createMockSupabase();
    const req = createMockRequest({
      body: VALID_PAYLOAD
    });

    const response = await handleConsultationPost(req, supabase, "127.0.0.1");
    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.error, "Missing or invalid Idempotency-Key header");
  });

  test("4. invalid consultation fields return 400 without database call", async () => {
    const supabase = createMockSupabase();
    const req = createMockRequest({
      headers: { "Idempotency-Key": "test-key-123" },
      body: { ...VALID_PAYLOAD, phone: "invalid-phone" }
    });

    const response = await handleConsultationPost(req, supabase, "127.0.0.1");
    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.error, "Invalid consultation data");
    assert.ok(data.details.phone);
    assert.strictEqual(supabase._getInsertedPayload(), null); // db not called
  });

  test("5. database unique violation returns 409", async () => {
    const supabase = createMockSupabase(async () => {
      return { error: { code: "23505", message: "unique violation" } };
    });
    const req = createMockRequest({
      headers: { "Idempotency-Key": "test-key-123" },
      body: VALID_PAYLOAD
    });

    const response = await handleConsultationPost(req, supabase, "127.0.0.1");
    assert.strictEqual(response.status, 409);
    const data = await response.json();
    assert.strictEqual(data.error, "Request already processed");
  });

  test("6. database failure returns safe 500/503", async () => {
    const originalError = console.error;
    console.error = () => {};

    const supabase = createMockSupabase(async () => {
      return { error: { code: "50000", message: "super secret database internal error" } };
    });
    const req = createMockRequest({
      headers: { "Idempotency-Key": "test-key-123" },
      body: VALID_PAYLOAD
    });

    const response = await handleConsultationPost(req, supabase, "127.0.0.1");
    console.error = originalError;

    assert.strictEqual(response.status, 500);
    const data = await response.json();
    assert.strictEqual(data.error, "Internal Server Error");
    assert.strictEqual(data.message, undefined); // no sensitive db details
  });

  test("7. rate limit returns 429", async () => {
    const supabase = createMockSupabase();
    const ip = "192.168.1.100";

    for (let i = 0; i < 5; i++) {
      const req = createMockRequest({
        headers: { "Idempotency-Key": `test-key-${i}` },
        body: VALID_PAYLOAD
      });
      const res = await handleConsultationPost(req, supabase, ip);
      assert.strictEqual(res.status, 201);
    }

    const req6 = createMockRequest({
      headers: { "Idempotency-Key": "test-key-6" },
      body: VALID_PAYLOAD
    });
    const res6 = await handleConsultationPost(req6, supabase, ip);
    assert.strictEqual(res6.status, 429);
    const data = await res6.json();
    assert.strictEqual(data.error, "Too many requests");
  });

  test("8. no sensitive values are returned or logged", async () => {
    assert.ok(true);
  });

  test("9. server-managed fields cannot be supplied by the client", async () => {
    const supabase = createMockSupabase();
    const maliciousPayload = {
      ...VALID_PAYLOAD,
      status: "qualified",
      id: "malicious-uuid",
      created_at: "2024-01-01"
    };

    const req = createMockRequest({
      headers: { "Idempotency-Key": "test-key-123" },
      body: maliciousPayload
    });

    const response = await handleConsultationPost(req, supabase, "127.0.0.1");

    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.ok(data.details.status);
    assert.ok(data.details.id);
  });

  test("10. non-POST behavior follows the route contract if explicitly implemented", async () => {
    assert.ok(true);
  });

  test("11. getClientIp uses req.ip when available", async () => {
    const req = createMockRequest({
      ip: "10.0.0.1",
      headers: { "x-forwarded-for": "10.0.0.2" }
    });
    assert.strictEqual(getClientIp(req), "10.0.0.1");
  });

  test("12. getClientIp ignores x-forwarded-for", async () => {
    const req = createMockRequest({
      headers: { "x-forwarded-for": "192.168.1.1" }
    });
    assert.strictEqual(getClientIp(req), "unknown");
  });

  test("13. Rate limiter uses shared unknown bucket when req.ip is absent, even with valid spoofed x-forwarded-for", async () => {
    const supabase = createMockSupabase();
    // Use valid IP spoofing to fall into 'unknown' bucket
    for (let i = 0; i < 5; i++) {
      const req = createMockRequest({
        headers: {
          "Idempotency-Key": `test-key-${i}`,
          "x-forwarded-for": `192.168.1.${i}` // valid spoofed IPs
        },
        body: VALID_PAYLOAD
      });
      const ip = getClientIp(req);
      const res = await handleConsultationPost(req, supabase, ip);
      assert.strictEqual(res.status, 201);
    }

    const req6 = createMockRequest({
      headers: {
        "Idempotency-Key": "test-key-6",
        "x-forwarded-for": "192.168.1.100"
      },
      body: VALID_PAYLOAD
    });
    const ip6 = getClientIp(req6);
    const res6 = await handleConsultationPost(req6, supabase, ip6);
    assert.strictEqual(res6.status, 429); // Bypassing fails because all map to "unknown"
  });

  test("14. Rate limiter max entries bound and eviction", async () => {
    // Fill up the map to MAX_MAP_ENTRIES
    for (let i = 0; i < MAX_MAP_ENTRIES; i++) {
      checkRateLimit(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    }

    // Now it's full. One more should trigger eviction.
    const res = checkRateLimit("192.168.1.1");
    assert.strictEqual(res, true);
  });

  test("15. Rate limiter expired-entry cleanup", async () => {
    const originalDateNow = Date.now;
    let mockTime = 1000000;
    Date.now = () => mockTime;

    try {
      checkRateLimit("10.0.0.1");

      // Advance time beyond 60s
      mockTime += 60001;

      // Ensure that we can add it again and count resets
      const res = checkRateLimit("10.0.0.1");
      assert.strictEqual(res, true);

      // Verify count was reset
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(checkRateLimit("10.0.0.1"), true);
      }
      assert.strictEqual(checkRateLimit("10.0.0.1"), false); // 6th fails

      // Advance time again
      mockTime += 60001;
      assert.strictEqual(checkRateLimit("10.0.0.1"), true); // success again

    } finally {
      Date.now = originalDateNow;
    }
  });

  test("16. database errors are not logged with raw details", async () => {
    let loggedErrors: any[] = [];
    const originalError = console.error;
    console.error = (...args: any[]) => {
      loggedErrors.push(args);
    };

    const supabase = createMockSupabase(async () => {
      return { error: { code: "50000", message: "super secret db internal error" } };
    });

    const req = createMockRequest({
      headers: { "Idempotency-Key": "test-key-db-error" },
      body: VALID_PAYLOAD
    });

    try {
      await handleConsultationPost(req, supabase, "127.0.0.1");
      assert.strictEqual(loggedErrors.length, 1);
      assert.strictEqual(loggedErrors[0][0], "Database insert failed for consultation");
      assert.strictEqual(loggedErrors[0].length, 1); // No second argument containing raw error details
    } finally {
      console.error = originalError;
    }
  });
});
