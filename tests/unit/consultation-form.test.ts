import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  generateIdempotencyKey,
  resolveCtaMetadata,
  buildConsultationPayload,
  submitConsultation,
  initialValues,
  type FormValues
} from "../../components/site/consultation-form";
import { validateConsultationInput } from "../../lib/validation/consultation";

describe("Phase 4.1-D: Consultation Form and API Integration", () => {
  describe("1. CTA Metadata Resolution", () => {
    test("resolves material CTA parameters correctly", () => {
      const result = resolveCtaMetadata(
        "?interest=ke-toan-tai-chinh-1&type=material",
        "/tai-lieu/ke-toan-tai-chinh-1"
      );
      assert.strictEqual(result.selectedProductSlug, "ke-toan-tai-chinh-1");
      assert.strictEqual(result.selectedSubjectSlug, "ke-toan-tai-chinh-1");
      assert.strictEqual(result.resolvedInterest, "Kế toán tài chính 1");
      assert.strictEqual(result.resolvedNeed, "Tài liệu ôn thi");
      assert.strictEqual(
        result.sourcePath,
        "/tai-lieu/ke-toan-tai-chinh-1?interest=ke-toan-tai-chinh-1&type=material"
      );
    });

    test("resolves course CTA parameters correctly", () => {
      const result = resolveCtaMetadata(
        "?interest=lop-on-thi-cuoi-ky-marketing&type=course",
        "/"
      );
      assert.strictEqual(result.selectedProductSlug, "lop-on-thi-cuoi-ky-marketing");
      assert.strictEqual(result.selectedSubjectSlug, "marketing-can-ban");
      assert.strictEqual(result.resolvedInterest, "Marketing căn bản");
      assert.strictEqual(result.resolvedNeed, "Khóa học / lớp ôn");
      assert.strictEqual(
        result.sourcePath,
        "/?interest=lop-on-thi-cuoi-ky-marketing&type=course"
      );
    });

    test("resolves tutor CTA parameters correctly", () => {
      const result = resolveCtaMetadata(
        "?interest=tutor-ke-toan-tai-chinh-1&type=tutor",
        "/"
      );
      assert.strictEqual(result.selectedProductSlug, "tutor-ke-toan-tai-chinh-1");
      assert.strictEqual(result.selectedSubjectSlug, "ke-toan-tai-chinh-1");
      assert.strictEqual(result.resolvedInterest, "Kế toán tài chính 1");
      assert.strictEqual(result.resolvedNeed, "Peer Tutor 1:1");
    });

    test("resolves direct subject slug CTA parameters correctly", () => {
      const result = resolveCtaMetadata("?interest=toan-cao-cap", "/");
      assert.strictEqual(result.selectedProductSlug, null);
      assert.strictEqual(result.selectedSubjectSlug, "toan-cao-cap");
      assert.strictEqual(result.resolvedInterest, "Toán cao cấp");
    });

    test("handles empty query parameters cleanly", () => {
      const result = resolveCtaMetadata("", "/");
      assert.strictEqual(result.selectedProductSlug, null);
      assert.strictEqual(result.selectedSubjectSlug, null);
      assert.strictEqual(result.resolvedInterest, undefined);
      assert.strictEqual(result.resolvedNeed, undefined);
      assert.strictEqual(result.sourcePath, "/");
    });
  });

  describe("2. Consultation Payload Construction and Validation Contract", () => {
    const sampleValues: FormValues = {
      fullName: "Nguyễn Văn An",
      phone: "0901234567",
      faculty: "Kế toán - Kiểm toán",
      major: "Kế toán",
      interest: "Kế toán tài chính 1",
      need: "Tài liệu ôn thi",
      note: "Cần tài liệu trước thứ 6"
    };

    test("builds valid payload conforming to ConsultationInput", () => {
      const payload = buildConsultationPayload(sampleValues, {
        sourcePath: "/?interest=ke-toan-tai-chinh-1",
        selectedProductSlug: "ke-toan-tai-chinh-1"
      });

      assert.strictEqual(payload.fullName, "Nguyễn Văn An");
      assert.strictEqual(payload.phone, "0901234567");
      assert.strictEqual(payload.faculty, "Kế toán - Kiểm toán");
      assert.strictEqual(payload.major, "Kế toán");
      assert.strictEqual(payload.interest, "Kế toán tài chính 1");
      assert.strictEqual(payload.need, "Tài liệu ôn thi");
      assert.strictEqual(payload.note, "Cần tài liệu trước thứ 6");
      assert.strictEqual(payload.sourcePath, "/?interest=ke-toan-tai-chinh-1");
      assert.strictEqual(payload.selectedProductSlug, "ke-toan-tai-chinh-1");
      assert.strictEqual(payload.selectedSubjectSlug, "ke-toan-tai-chinh-1");

      const validation = validateConsultationInput(payload);
      assert.strictEqual(validation.isValid, true);
    });

    test("normalizes empty optional fields to null", () => {
      const payload = buildConsultationPayload(
        {
          ...sampleValues,
          major: "   ",
          note: ""
        },
        {}
      );

      assert.strictEqual(payload.major, null);
      assert.strictEqual(payload.note, null);
      assert.strictEqual(payload.sourcePath, null);
      assert.strictEqual(payload.selectedProductSlug, null);
    });

    test("dynamically resolves selectedSubjectSlug from interest name", () => {
      const payload = buildConsultationPayload(
        {
          ...sampleValues,
          interest: "Kinh tế vi mô"
        },
        {}
      );

      assert.strictEqual(payload.selectedSubjectSlug, "kinh-te-vi-mo");
    });

    test("safely sets selectedSubjectSlug to null when interest is non-canonical", () => {
      const payload = buildConsultationPayload(
        {
          ...sampleValues,
          interest: "Môn khác / mình sẽ ghi rõ ở ghi chú"
        },
        {}
      );

      assert.strictEqual(payload.selectedSubjectSlug, null);
    });

    test("never includes server-managed database fields in payload", () => {
      const payload = buildConsultationPayload(sampleValues, {}) as any;

      assert.strictEqual(payload.id, undefined);
      assert.strictEqual(payload.status, undefined);
      assert.strictEqual(payload.created_at, undefined);
      assert.strictEqual(payload.updated_at, undefined);
      assert.strictEqual(payload.owner_id, undefined);
      assert.strictEqual(payload.user_id, undefined);
      assert.strictEqual(payload.request_id, undefined);
    });
  });

  describe("3. Idempotency Key Generation", () => {
    test("generates standard RFC4122 v4 UUID format", () => {
      const key = generateIdempotencyKey();
      assert.ok(typeof key === "string");
      assert.strictEqual(key.length, 36);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.ok(uuidRegex.test(key), `Key "${key}" should match UUID v4 format`);
    });

    test("consecutive generations produce unique keys", () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      assert.notStrictEqual(key1, key2);
    });
  });

  describe("4. API Submission and Response Handling", () => {
    const payload = buildConsultationPayload(
      {
        fullName: "Trần Thị B",
        phone: "0912345678",
        faculty: "Marketing",
        major: "Marketing",
        interest: "Marketing căn bản",
        need: "Khóa học / lớp ôn",
        note: ""
      },
      { sourcePath: "/" }
    );

    test("handles 201 Created successfully", async () => {
      let capturedUrl = "";
      let capturedOptions: any = null;

      const mockFetch = async (url: any, options: any) => {
        capturedUrl = url.toString();
        capturedOptions = options;
        return {
          status: 201,
          json: async () => ({ success: true })
        } as Response;
      };

      const result = await submitConsultation(payload, "test-key-201", mockFetch as any);

      assert.strictEqual(capturedUrl, "/api/consultations");
      assert.strictEqual(capturedOptions.method, "POST");
      assert.strictEqual(capturedOptions.headers["Content-Type"], "application/json");
      assert.strictEqual(capturedOptions.headers["Idempotency-Key"], "test-key-201");
      assert.deepStrictEqual(JSON.parse(capturedOptions.body), payload);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 201);
      assert.ok(result.message.includes("Đã nhận nhu cầu"));
    });

    test("handles 409 Conflict as already received", async () => {
      const mockFetch = async () => {
        return {
          status: 409,
          json: async () => ({ error: "Request already processed" })
        } as Response;
      };

      const result = await submitConsultation(payload, "test-key-409", mockFetch as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 409);
      assert.ok(result.message.includes("đã được tiếp nhận"));
      assert.strictEqual(result.message.includes("Request already processed"), false);
    });

    test("handles 400 Bad Request with validation details safely", async () => {
      const mockFetch = async () => {
        return {
          status: 400,
          json: async () => ({
            error: "Invalid consultation data",
            details: { phone: "Số điện thoại Việt Nam không hợp lệ." }
          })
        } as Response;
      };

      const result = await submitConsultation(payload, "test-key-400", mockFetch as any);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.ok(result.message.includes("Vui lòng kiểm tra lại"));
      assert.deepStrictEqual(result.details, {
        phone: "Số điện thoại Việt Nam không hợp lệ."
      });
    });

    test("handles 429 Too Many Requests with retry-later message", async () => {
      const mockFetch = async () => {
        return {
          status: 429,
          json: async () => ({ error: "Too many requests" })
        } as Response;
      };

      const result = await submitConsultation(payload, "test-key-429", mockFetch as any);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 429);
      assert.ok(result.message.includes("thử lại sau"));
      assert.strictEqual(result.message.includes("Too many requests"), false);
    });

    test("handles 500 / 503 errors with generic safe message", async () => {
      for (const status of [500, 503]) {
        const mockFetch = async () => {
          return {
            status,
            json: async () => ({ error: "Internal Server Error" })
          } as Response;
        };

        const result = await submitConsultation(payload, `test-key-${status}`, mockFetch as any);

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.status, status);
        assert.ok(result.message.includes("Hệ thống đang bận hoặc tạm thời gián đoạn"));
        assert.strictEqual(result.message.includes("Internal Server Error"), false);
      }
    });

    test("handles network exception with connection error message", async () => {
      const mockFetch = async () => {
        throw new Error("Failed to fetch");
      };

      const result = await submitConsultation(payload, "test-key-network", mockFetch as any);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 0);
      assert.ok(result.message.includes("Không thể kết nối đến máy chủ"));
      assert.strictEqual(result.message.includes("Failed to fetch"), false);
    });
  });

  describe("5. Static Contracts and Security Checks", () => {
    test("components/site/consultation-form.tsx is a client component with 'use client'", async () => {
      const filePath = path.resolve(process.cwd(), "components/site/consultation-form.tsx");
      const content = await fs.readFile(filePath, "utf-8");
      assert.ok(
        content.trim().startsWith('"use client";') || content.trim().startsWith("'use client';"),
        "File must start with use client directive"
      );
    });

    test("consultation-form.tsx does NOT import server-only Supabase modules or keys", async () => {
      const filePath = path.resolve(process.cwd(), "components/site/consultation-form.tsx");
      const content = await fs.readFile(filePath, "utf-8");
      assert.strictEqual(content.includes("@/lib/supabase/server"), false);
      assert.strictEqual(content.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
      assert.strictEqual(content.includes("service_role"), false);
    });

    test("initialValues initializes all fields to empty strings", () => {
      assert.deepStrictEqual(initialValues, {
        fullName: "",
        phone: "",
        faculty: "",
        major: "",
        interest: "",
        need: "",
        note: ""
      });
    });
  });
});
