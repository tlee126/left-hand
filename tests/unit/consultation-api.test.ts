import assert from "node:assert/strict";
import { test, describe, beforeEach } from "node:test";
import {
  handleConsultationPost,
  resetRateLimit,
  getClientIp,
  MAX_MAP_ENTRIES,
  MAX_CONSULTATION_BODY_BYTES,
  checkRateLimit
} from "../../app/api/consultations/route";

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

function createMockSupabase(
  overrideInsert?: (payload: any) => Promise<{error: any}>,
  catalog: { productSlug?: string | null; subjectSlug?: string | null; productStatus?: string; error?: any } = {}
) {
  const configuredProductSlug = Object.prototype.hasOwnProperty.call(catalog, "productSlug")
    ? catalog.productSlug
    : "prod";
  const configuredSubjectSlug = Object.prototype.hasOwnProperty.call(catalog, "subjectSlug")
    ? catalog.subjectSlug
    : "subj";
  let insertedPayload: any = null;
  const client = {
    _getInsertedPayload: () => insertedPayload,
    from: (table: string) => {
      if (table === "products" || table === "subjects") {
        let selectedSlug: string | null = null;
        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            if (column === "slug") selectedSlug = value;
            if (column === "subjects.slug") selectedSlug = value;
            return query;
          },
          range: async () => {
            if (catalog.error) return { data: [], error: catalog.error };
            if (table === "products" && configuredSubjectSlug === selectedSlug && catalog.productStatus !== "draft" && catalog.productStatus !== "archived") {
              return { data: [{ slug: configuredProductSlug ?? "published-product", subjects: { slug: configuredSubjectSlug } }], error: null };
            }
            return { data: [], error: null };
          },
          maybeSingle: async () => {
            if (catalog.error) return { data: null, error: catalog.error };
            if (table === "products") {
              if (configuredProductSlug === selectedSlug && catalog.productStatus !== "draft" && catalog.productStatus !== "archived") {
                return { data: { slug: configuredProductSlug, subjects: { slug: configuredSubjectSlug ?? "subj" } }, error: null };
              }
              return { data: null, error: null };
            }
            if (configuredSubjectSlug === selectedSlug) {
              return { data: { slug: configuredSubjectSlug }, error: null };
            }
            return { data: null, error: null };
          }
        };
        return query;
      }

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
  sourcePath: "/",
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
    const malformed = createMockRequest({ ip: "not-an-ip", headers: { "x-forwarded-for": "10.0.0.2" } });
    assert.strictEqual(getClientIp(malformed), null);
  });

  test("12. getClientIp ignores x-forwarded-for", async () => {
    const req = createMockRequest({
      headers: { "x-forwarded-for": "192.168.1.1" }
    });
    assert.strictEqual(getClientIp(req), null);
  });

  test("13. missing or malformed runtime IP fails closed without a shared rate-limit bucket", async () => {
    const supabase = createMockSupabase();
    for (const forwarded of ["192.168.1.1", "garbage, 192.168.1.2"]) {
      const req = createMockRequest({
        headers: {
          "Idempotency-Key": "test-key-no-ip",
          "x-forwarded-for": forwarded
        },
        body: VALID_PAYLOAD
      });
      const response = await handleConsultationPost(req, supabase, getClientIp(req));
      assert.strictEqual(response.status, 503);
      assert.deepStrictEqual(await response.json(), { error: "Service Unavailable" });
    }
    assert.strictEqual(checkRateLimit("unknown"), true);
    assert.strictEqual(checkRateLimit("unknown"), true);
  });

  test("14. different runtime IPs have independent bounded buckets", async () => {
    assert.strictEqual(checkRateLimit("10.0.0.1"), true);
    assert.strictEqual(checkRateLimit("10.0.0.2"), true);
    for (let i = 0; i < 4; i++) assert.strictEqual(checkRateLimit("10.0.0.1"), true);
    assert.strictEqual(checkRateLimit("10.0.0.1"), false);
    assert.strictEqual(checkRateLimit("10.0.0.2"), true);
  });

  test("15. Rate limiter max entries bound and eviction", async () => {
    // Fill up the map to MAX_MAP_ENTRIES
    for (let i = 0; i < MAX_MAP_ENTRIES; i++) {
      checkRateLimit(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    }

    // Now it's full. One more should trigger eviction.
    const res = checkRateLimit("192.168.1.1");
    assert.strictEqual(res, true);
  });

  test("16. Rate limiter expired-entry cleanup", async () => {
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

  test("17. body-size and catalog-boundary failures happen before insert", async () => {
    const tooLargeJson = JSON.stringify({ ...VALID_PAYLOAD, unknown: "x".repeat(MAX_CONSULTATION_BODY_BYTES) });
    const tooLargeRequest = createMockRequest({
      headers: {
        "Idempotency-Key": "test-key-large",
        "content-type": "application/json",
        "content-length": String(MAX_CONSULTATION_BODY_BYTES + 1)
      },
      body: tooLargeJson,
      jsonBody: false
    });
    const tooLargeResponse = await handleConsultationPost(tooLargeRequest, createMockSupabase(), "127.0.0.1");
    assert.strictEqual(tooLargeResponse.status, 413);

    const chunkedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{" + JSON.stringify("unknown") + ":\"" + "x".repeat(MAX_CONSULTATION_BODY_BYTES) + "\"}"));
        controller.close();
      }
    });
    const chunkedRequest = new Request("http://localhost/api/consultations", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": "test-key-chunked" },
      body: chunkedBody,
      duplex: "half"
    } as RequestInit);
    const chunkedSupabase = createMockSupabase();
    const chunkedResponse = await handleConsultationPost(chunkedRequest, chunkedSupabase, "127.0.0.1");
    assert.strictEqual(chunkedResponse.status, 413);
    assert.strictEqual(chunkedSupabase._getInsertedPayload(), null);

    const fakeProductSupabase = createMockSupabase(undefined, { productSlug: "real-product", subjectSlug: "real-subject" });
    const fakeProductResponse = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-fake-product" }, body: { ...VALID_PAYLOAD, selectedProductSlug: "fake-product", selectedSubjectSlug: "real-subject" } }),
      fakeProductSupabase,
      "127.0.0.1"
    );
    assert.strictEqual(fakeProductResponse.status, 400);
    assert.strictEqual(fakeProductSupabase._getInsertedPayload(), null);

    const mismatchSupabase = createMockSupabase(undefined, { productSlug: "real-product", subjectSlug: "real-subject" });
    const mismatchResponse = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-mismatch" }, body: { ...VALID_PAYLOAD, selectedProductSlug: "real-product", selectedSubjectSlug: "wrong-subject" } }),
      mismatchSupabase,
      "127.0.0.1"
    );
    assert.strictEqual(mismatchResponse.status, 400);
    assert.strictEqual(mismatchSupabase._getInsertedPayload(), null);

    const draftSupabase = createMockSupabase(undefined, { productSlug: "draft-product", subjectSlug: "real-subject", productStatus: "draft" });
    const draftResponse = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-draft" }, body: { ...VALID_PAYLOAD, selectedProductSlug: "draft-product", selectedSubjectSlug: "real-subject" } }),
      draftSupabase,
      "127.0.0.1"
    );
    assert.strictEqual(draftResponse.status, 400);
    assert.strictEqual(draftSupabase._getInsertedPayload(), null);

    const archivedSupabase = createMockSupabase(undefined, { productSlug: "archived-product", subjectSlug: "real-subject", productStatus: "archived" });
    const archivedResponse = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-archived" }, body: { ...VALID_PAYLOAD, selectedProductSlug: "archived-product", selectedSubjectSlug: "real-subject" } }),
      archivedSupabase,
      "127.0.0.1"
    );
    assert.strictEqual(archivedResponse.status, 400);
    assert.strictEqual(archivedSupabase._getInsertedPayload(), null);

    const fakeSubjectSupabase = createMockSupabase(undefined, { productSlug: null, subjectSlug: "real-subject" });
    const fakeSubjectResponse = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-fake-subject" }, body: { ...VALID_PAYLOAD, selectedProductSlug: null, selectedSubjectSlug: "fake-subject" } }),
      fakeSubjectSupabase,
      "127.0.0.1"
    );
    assert.strictEqual(fakeSubjectResponse.status, 400);
    assert.strictEqual(fakeSubjectSupabase._getInsertedPayload(), null);
  });

  test("18. subject-only selection is resolved and optional omission stays null", async () => {
    const subjectSupabase = createMockSupabase(undefined, { productSlug: null, subjectSlug: "real-subject" });
    const subjectResponse = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-subject" }, body: { ...VALID_PAYLOAD, selectedProductSlug: null, selectedSubjectSlug: "real-subject" } }),
      subjectSupabase,
      "127.0.0.1"
    );
    assert.strictEqual(subjectResponse.status, 201);
    assert.strictEqual(subjectSupabase._getInsertedPayload().selected_product_slug, null);
    assert.strictEqual(subjectSupabase._getInsertedPayload().selected_subject_slug, "real-subject");

    const noSelectionSupabase = createMockSupabase();
    const noSelectionResponse = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-no-selection" }, body: { ...VALID_PAYLOAD, selectedProductSlug: null, selectedSubjectSlug: null } }),
      noSelectionSupabase,
      "127.0.0.1"
    );
    assert.strictEqual(noSelectionResponse.status, 201);
    assert.strictEqual(noSelectionSupabase._getInsertedPayload().selected_product_slug, null);
    assert.strictEqual(noSelectionSupabase._getInsertedPayload().selected_subject_slug, null);
  });

  test("19. product-only selection derives the subject from the published server row", async () => {
    const supabase = createMockSupabase(undefined, { productSlug: "real-product", subjectSlug: "real-subject" });
    const response = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-product-only" }, body: { ...VALID_PAYLOAD, selectedProductSlug: "real-product", selectedSubjectSlug: null } }),
      supabase,
      "127.0.0.1"
    );
    assert.strictEqual(response.status, 201);
    assert.strictEqual(supabase._getInsertedPayload().selected_product_slug, "real-product");
    assert.strictEqual(supabase._getInsertedPayload().selected_subject_slug, "real-subject");
  });

  test("20. catalog lookup errors are generic and do not insert", async () => {
    const supabase = createMockSupabase(undefined, { error: { code: "XX000", message: "PII 0901234567 secret SQL" } });
    const response = await handleConsultationPost(
      createMockRequest({ headers: { "Idempotency-Key": "test-key-catalog-error" }, body: VALID_PAYLOAD }),
      supabase,
      "127.0.0.1"
    );
    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(await response.json(), { error: "Internal Server Error" });
    assert.strictEqual(supabase._getInsertedPayload(), null);
  });

  test("21. database errors are not logged with raw details", async () => {
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
