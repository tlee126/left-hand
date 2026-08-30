import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  validateConsultationInput,
  validateConsultation,
  normalizeVietnamesePhone,
  isValidVietnamesePhone,
  CONSULTATION_LIMITS,
  KNOWN_CONSULTATION_FIELDS,
  type ConsultationInput
} from "../../lib/validation/consultation";

describe("Phase 4.1-B: Shared Consultation Validation", () => {
  describe("1. Valid Submissions & Trimming Normalization", () => {
    test("accepts valid complete input with all required and optional fields", () => {
      const input: ConsultationInput = {
        fullName: "Nguyễn Văn An",
        phone: "0901234567",
        faculty: "Khoa Tài chính - Ngân hàng",
        major: "Tài chính doanh nghiệp",
        interest: "Kế toán tài chính 1",
        need: "Tài liệu ôn thi trắc nghiệm & tự luận",
        note: "Cần tài liệu trước kỳ thi giữa kỳ tuần sau",
        sourcePath: "/tai-lieu/ke-toan-tai-chinh-1",
        selectedProductSlug: "tai-lieu-ke-toan-tai-chinh-1",
        selectedSubjectSlug: "ke-toan-tai-chinh-1"
      };

      const result = validateConsultationInput(input);

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.errors, {});
      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.data, {
        fullName: "Nguyễn Văn An",
        phone: "0901234567",
        faculty: "Khoa Tài chính - Ngân hàng",
        major: "Tài chính doanh nghiệp",
        interest: "Kế toán tài chính 1",
        need: "Tài liệu ôn thi trắc nghiệm & tự luận",
        note: "Cần tài liệu trước kỳ thi giữa kỳ tuần sau",
        sourcePath: "/tai-lieu/ke-toan-tai-chinh-1",
        selectedProductSlug: "tai-lieu-ke-toan-tai-chinh-1",
        selectedSubjectSlug: "ke-toan-tai-chinh-1"
      });
    });

    test("accepts valid input with all optional fields omitted and normalizes them to null", () => {
      const input: ConsultationInput = {
        fullName: "Trần Thị Mai",
        phone: "0987654321",
        faculty: "Khoa Kế toán",
        interest: "Nguyên lý kế toán",
        need: "Khóa học / lớp ôn cấp tốc"
      };

      const result = validateConsultationInput(input);

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.data, {
        fullName: "Trần Thị Mai",
        phone: "0987654321",
        faculty: "Khoa Kế toán",
        major: null,
        interest: "Nguyên lý kế toán",
        need: "Khóa học / lớp ôn cấp tốc",
        note: null,
        sourcePath: null,
        selectedProductSlug: null,
        selectedSubjectSlug: null
      });
    });

    test("trims leading/trailing whitespace on all fields and normalizes empty strings to null", () => {
      const input: ConsultationInput = {
        fullName: "   Lê Hoàng Long   ",
        phone: "  0912345678  ",
        faculty: "  Khoa Luật  ",
        major: "   ",
        interest: "  Pháp luật đại cương  ",
        need: "  Peer Tutor 1:1  ",
        note: "   ",
        sourcePath: "   ",
        selectedProductSlug: "",
        selectedSubjectSlug: "   "
      };

      const result = validateConsultation(input);

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.data?.fullName, "Lê Hoàng Long");
      assert.strictEqual(result.data?.phone, "0912345678");
      assert.strictEqual(result.data?.faculty, "Khoa Luật");
      assert.strictEqual(result.data?.major, null);
      assert.strictEqual(result.data?.interest, "Pháp luật đại cương");
      assert.strictEqual(result.data?.need, "Peer Tutor 1:1");
      assert.strictEqual(result.data?.note, null);
      assert.strictEqual(result.data?.sourcePath, null);
      assert.strictEqual(result.data?.selectedProductSlug, null);
      assert.strictEqual(result.data?.selectedSubjectSlug, null);
    });
  });

  describe("2. Vietnamese Phone Normalization & Validation", () => {
    test("accepts and normalizes various valid Vietnamese mobile phone formats", () => {
      const testCases = [
        { input: "0901234567", expected: "0901234567" },
        { input: "091 234 5678", expected: "0912345678" },
        { input: "098-765-4321", expected: "0987654321" },
        { input: "093.456.7890", expected: "0934567890" },
        { input: "(097) 123-4567", expected: "0971234567" },
        { input: "0381234567", expected: "0381234567" },
        { input: "0581234567", expected: "0581234567" },
        { input: "0771234567", expected: "0771234567" },
        { input: "0861234567", expected: "0861234567" }
      ];

      for (const { input, expected } of testCases) {
        assert.strictEqual(
          normalizeVietnamesePhone(input),
          expected,
          `Expected ${input} to normalize to ${expected}`
        );
        assert.strictEqual(isValidVietnamesePhone(input), true);
      }
    });

    test("accepts and normalizes international +84 and 84 formats", () => {
      const testCases = [
        { input: "+84901234567", expected: "0901234567" },
        { input: "+84 901 234 567", expected: "0901234567" },
        { input: "+84-901-234-567", expected: "0901234567" },
        { input: "(+84) 901 234 567", expected: "0901234567" },
        { input: "84901234567", expected: "0901234567" },
        { input: "0084901234567", expected: "0901234567" }
      ];

      for (const { input, expected } of testCases) {
        assert.strictEqual(
          normalizeVietnamesePhone(input),
          expected,
          `Expected international format ${input} to normalize to ${expected}`
        );
      }
    });

    test("accepts valid Vietnamese landline formats (02x)", () => {
      // Hanoi (024) 8 digits, HCMC (028) 8 digits
      assert.strictEqual(normalizeVietnamesePhone("02838221234"), "02838221234");
      assert.strictEqual(normalizeVietnamesePhone("024 3974 4444"), "02439744444");
      assert.strictEqual(normalizeVietnamesePhone("+84 28 3822 1234"), "02838221234");
    });

    test("rejects invalid Vietnamese phone numbers", () => {
      const invalidPhones = [
        "",
        "   ",
        "12345",
        "090123", // too short
        "09012345678901", // too long (14 digits)
        "abcdefghij", // non-numeric
        "090abc1234", // letters inside
        "0123456789", // obsolete 01 prefix
        "0412345678", // invalid prefix 04
        "0612345678", // invalid prefix 06
        "+1 555 123 4567", // US number
        "+44 20 7946 0958", // UK number
        "1234567890", // missing leading 0
        "+84 0901 234 567", // invalid international format with leading 0
        "0084 0901 234 567", // invalid international format with leading 0
        "84 0901 234 567" // invalid international format with leading 0
      ];

      for (const phone of invalidPhones) {
        assert.strictEqual(
          normalizeVietnamesePhone(phone),
          null,
          `Expected phone ${phone} to be rejected`
        );
        assert.strictEqual(isValidVietnamesePhone(phone), false);
      }
    });
  });

  describe("3. Required Fields & Whitespace-Only Rejection", () => {
    const validBase: ConsultationInput = {
      fullName: "Nguyễn Văn A",
      phone: "0901234567",
      faculty: "Khoa Marketing",
      interest: "Marketing căn bản",
      need: "Tư vấn chọn tài liệu"
    };

    test("rejects missing fullName with structured error", () => {
      const result = validateConsultationInput({ ...validBase, fullName: undefined });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.fullName, "Vui lòng nhập họ và tên.");
      assert.strictEqual(result.error, "Vui lòng nhập họ và tên.");
    });

    test("rejects whitespace-only fullName", () => {
      const result = validateConsultationInput({ ...validBase, fullName: "     " });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.fullName, "Vui lòng nhập họ và tên.");
    });

    test("rejects missing phone with structured error", () => {
      const result = validateConsultationInput({ ...validBase, phone: undefined });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.phone, "Vui lòng nhập số điện thoại.");
    });

    test("rejects whitespace-only phone", () => {
      const result = validateConsultationInput({ ...validBase, phone: "   " });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.phone, "Vui lòng nhập số điện thoại.");
    });

    test("rejects missing faculty with structured error", () => {
      const result = validateConsultationInput({ ...validBase, faculty: undefined });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.faculty, "Vui lòng chọn khoa/viện.");
    });

    test("rejects whitespace-only faculty", () => {
      const result = validateConsultationInput({ ...validBase, faculty: "   " });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.faculty, "Vui lòng chọn khoa/viện.");
    });

    test("rejects missing interest with structured error", () => {
      const result = validateConsultationInput({ ...validBase, interest: undefined });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.interest, "Vui lòng chọn môn học quan tâm.");
    });

    test("rejects whitespace-only interest", () => {
      const result = validateConsultationInput({ ...validBase, interest: "   " });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.interest, "Vui lòng chọn môn học quan tâm.");
    });

    test("rejects missing need with structured error", () => {
      const result = validateConsultationInput({ ...validBase, need: undefined });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.need, "Vui lòng chọn nhu cầu tư vấn.");
    });

    test("rejects whitespace-only need", () => {
      const result = validateConsultationInput({ ...validBase, need: "   " });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.need, "Vui lòng chọn nhu cầu tư vấn.");
    });
  });

  describe("4. Maximum and Minimum Length Limits (0006_consultations.sql Alignment)", () => {
    const validBase: ConsultationInput = {
      fullName: "Nguyễn Văn A",
      phone: "0901234567",
      faculty: "Khoa Quản trị kinh doanh",
      interest: "Quản trị học",
      need: "Cần tư vấn đề cương ôn thi"
    };

    test("rejects fullName shorter than min length (2 chars)", () => {
      const result = validateConsultationInput({ ...validBase, fullName: "A" });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.fullName, "Họ và tên phải có ít nhất 2 ký tự.");
    });

    test("accepts fullName at boundary lengths (2 and 150 chars)", () => {
      const minName = "An";
      const maxName = "A".repeat(150);

      const resMin = validateConsultationInput({ ...validBase, fullName: minName });
      assert.strictEqual(resMin.isValid, true);
      assert.strictEqual(resMin.data?.fullName, minName);

      const resMax = validateConsultationInput({ ...validBase, fullName: maxName });
      assert.strictEqual(resMax.isValid, true);
      assert.strictEqual(resMax.data?.fullName, maxName);
    });

    test("rejects fullName exceeding 150 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        fullName: "A".repeat(151)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.fullName, "Họ và tên không được vượt quá 150 ký tự.");
    });

    test("rejects raw phone exceeding 30 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        phone: "0901234567".padEnd(31, "0")
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.phone, "Số điện thoại không được vượt quá 30 ký tự.");
    });

    test("rejects faculty exceeding 150 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        faculty: "F".repeat(151)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.faculty, "Khoa/Viện không được vượt quá 150 ký tự.");
    });

    test("rejects major exceeding 150 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        major: "M".repeat(151)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.major, "Ngành học không được vượt quá 150 ký tự.");
    });

    test("rejects interest exceeding 200 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        interest: "I".repeat(201)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.interest, "Môn học quan tâm không được vượt quá 200 ký tự.");
    });

    test("rejects need exceeding 2000 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        need: "N".repeat(2001)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.need, "Nhu cầu tư vấn không được vượt quá 2000 ký tự.");
    });

    test("rejects note exceeding 5000 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        note: "X".repeat(5001)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.note, "Ghi chú không được vượt quá 5000 ký tự.");
    });

    test("rejects sourcePath exceeding 500 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        sourcePath: "/".padEnd(501, "a")
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.sourcePath, "Đường dẫn nguồn không được vượt quá 500 ký tự.");
    });

    test("rejects selectedProductSlug exceeding 150 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        selectedProductSlug: "p".repeat(151)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.selectedProductSlug, "Slug sản phẩm không được vượt quá 150 ký tự.");
    });

    test("rejects selectedSubjectSlug exceeding 150 chars", () => {
      const result = validateConsultationInput({
        ...validBase,
        selectedSubjectSlug: "s".repeat(151)
      });
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.selectedSubjectSlug, "Slug môn học không được vượt quá 150 ký tự.");
    });
  });

  describe("5. Type Safety & Non-String Rejections", () => {
    const validBase: ConsultationInput = {
      fullName: "Nguyễn Văn A",
      phone: "0901234567",
      faculty: "Khoa CNTT",
      interest: "Tin học đại cương",
      need: "Khóa học trực tuyến"
    };

    test("rejects non-string values for required fields", () => {
      const fields = [
        { key: "fullName", value: 12345, errorKey: "fullName", expectedMsg: "Họ và tên phải là chuỗi ký tự." },
        { key: "phone", value: true, errorKey: "phone", expectedMsg: "Số điện thoại phải là chuỗi ký tự." },
        { key: "faculty", value: ["CNTT"], errorKey: "faculty", expectedMsg: "Khoa/Viện phải là chuỗi ký tự." },
        { key: "interest", value: { subject: "Tin học" }, errorKey: "interest", expectedMsg: "Môn học quan tâm phải là chuỗi ký tự." },
        { key: "need", value: 42, errorKey: "need", expectedMsg: "Nhu cầu tư vấn phải là chuỗi ký tự." }
      ];

      for (const { key, value, errorKey, expectedMsg } of fields) {
        const result = validateConsultationInput({ ...validBase, [key]: value });
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errors[errorKey], expectedMsg);
      }
    });

    test("rejects non-string values for optional fields", () => {
      const optionalFields = [
        { key: "major", value: 99, errorKey: "major", expectedMsg: "Ngành học phải là chuỗi ký tự." },
        { key: "note", value: { text: "hi" }, errorKey: "note", expectedMsg: "Ghi chú phải là chuỗi ký tự." },
        { key: "sourcePath", value: 123, errorKey: "sourcePath", expectedMsg: "Đường dẫn nguồn phải là chuỗi ký tự." },
        { key: "selectedProductSlug", value: false, errorKey: "selectedProductSlug", expectedMsg: "Slug sản phẩm phải là chuỗi ký tự." },
        { key: "selectedSubjectSlug", value: ["slug"], errorKey: "selectedSubjectSlug", expectedMsg: "Slug môn học phải là chuỗi ký tự." }
      ];

      for (const { key, value, errorKey, expectedMsg } of optionalFields) {
        const result = validateConsultationInput({ ...validBase, [key]: value });
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errors[errorKey], expectedMsg);
      }
    });

    test("rejects non-object root inputs (null, undefined, primitives, arrays)", () => {
      const invalidRoots = [null, undefined, "", "string", 123, true, [], [1, 2, 3]];

      for (const root of invalidRoots) {
        const result = validateConsultationInput(root);
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errors._root, "Dữ liệu yêu cầu tư vấn không hợp lệ.");
        assert.strictEqual(result.error, "Dữ liệu yêu cầu tư vấn không hợp lệ.");
      }
    });
  });

  describe("6. Unknown Fields Rejection", () => {
    const validBase: ConsultationInput = {
      fullName: "Nguyễn Văn A",
      phone: "0901234567",
      faculty: "Khoa CNTT",
      interest: "Tin học",
      need: "Tư vấn khóa học"
    };

    test("rejects unknown extra fields and reports field-level errors", () => {
      const input = {
        ...validBase,
        hackerField: "malicious_payload",
        isAdmin: true
      };

      const result = validateConsultationInput(input);
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.hackerField, 'Trường "hackerField" không được hỗ trợ.');
      assert.strictEqual(result.errors.isAdmin, 'Trường "isAdmin" không được hỗ trợ.');
    });

    test("rejects database-managed or backend-only fields sent from client", () => {
      const injectionPayloads = [
        { request_id: "req-123" },
        { id: "00000000-0000-0000-0000-000000000000" },
        { status: "qualified" },
        { created_at: "2026-01-01T00:00:00Z" },
        { updated_at: "2026-01-01T00:00:00Z" }
      ];

      for (const payload of injectionPayloads) {
        const result = validateConsultationInput({ ...validBase, ...payload });
        assert.strictEqual(result.isValid, false);
        const key = Object.keys(payload)[0];
        assert.strictEqual(result.errors[key], `Trường "${key}" không được hỗ trợ.`);
      }
    });
  });

  describe("7. Multiple Validation Errors Accumulation", () => {
    test("accumulates all field-level errors simultaneously", () => {
      const badInput = {
        fullName: "A", // too short (< 2)
        phone: "invalid-phone", // bad phone
        faculty: "", // empty
        interest: "", // empty
        need: "", // empty
        major: 123, // wrong type
        extraField: "bad" // unknown
      };

      const result = validateConsultationInput(badInput);
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.success, false);
      assert.ok(result.errors.fullName);
      assert.ok(result.errors.phone);
      assert.ok(result.errors.faculty);
      assert.ok(result.errors.interest);
      assert.ok(result.errors.need);
      assert.ok(result.errors.major);
      assert.ok(result.errors.extraField);
      assert.ok(result.error, "Primary error string must be populated");
    });
  });

  describe("8. Static & Security Contracts (No DB / No Network / Limits Consistency)", () => {
    test("lib/validation/consultation.ts contains no database, Supabase, or network imports", async () => {
      const filePath = path.resolve(process.cwd(), "lib/validation/consultation.ts");
      const fileContent = await fs.readFile(filePath, "utf-8");

      assert.ok(!fileContent.includes("next/server"), "Must not import next/server");
      assert.ok(!fileContent.includes("@supabase"), "Must not import @supabase");
      assert.ok(!fileContent.includes("supabase"), "Must not reference Supabase clients");
      assert.ok(!fileContent.includes("fetch("), "Must not call fetch()");
      assert.ok(!fileContent.includes("SUPABASE_SERVICE_ROLE_KEY"), "Must not reference service keys");
      assert.ok(!fileContent.includes("request_id"), "Must not generate request_id");
    });

    test("CONSULTATION_LIMITS constants match 0006_consultations.sql check constraints", async () => {
      const sqlPath = path.resolve(process.cwd(), "supabase/migrations/0006_consultations.sql");
      const sqlContent = await fs.readFile(sqlPath, "utf-8");

      // Verify limits match SQL CHECK constraints exactly
      assert.strictEqual(CONSULTATION_LIMITS.fullName.min, 2);
      assert.strictEqual(CONSULTATION_LIMITS.fullName.max, 150);
      assert.ok(sqlContent.includes("CHECK (char_length(full_name) BETWEEN 2 AND 150)"));

      assert.strictEqual(CONSULTATION_LIMITS.phone.min, 7);
      assert.strictEqual(CONSULTATION_LIMITS.phone.max, 30);
      assert.ok(sqlContent.includes("CHECK (char_length(phone) BETWEEN 7 AND 30)"));

      assert.strictEqual(CONSULTATION_LIMITS.faculty.min, 1);
      assert.strictEqual(CONSULTATION_LIMITS.faculty.max, 150);
      assert.ok(sqlContent.includes("CHECK (char_length(faculty) BETWEEN 1 AND 150)"));

      assert.strictEqual(CONSULTATION_LIMITS.interest.min, 1);
      assert.strictEqual(CONSULTATION_LIMITS.interest.max, 200);
      assert.ok(sqlContent.includes("CHECK (char_length(interest) BETWEEN 1 AND 200)"));

      assert.strictEqual(CONSULTATION_LIMITS.need.min, 1);
      assert.strictEqual(CONSULTATION_LIMITS.need.max, 2000);
      assert.ok(sqlContent.includes("CHECK (char_length(need) BETWEEN 1 AND 2000)"));

      assert.strictEqual(CONSULTATION_LIMITS.major.max, 150);
      assert.ok(sqlContent.includes("CHECK (major IS NULL OR char_length(major) <= 150)"));

      assert.strictEqual(CONSULTATION_LIMITS.note.max, 5000);
      assert.ok(sqlContent.includes("CHECK (note IS NULL OR char_length(note) <= 5000)"));

      assert.strictEqual(CONSULTATION_LIMITS.sourcePath.max, 500);
      assert.ok(sqlContent.includes("CHECK (source_path IS NULL OR char_length(source_path) <= 500)"));

      assert.strictEqual(CONSULTATION_LIMITS.selectedProductSlug.max, 150);
      assert.ok(sqlContent.includes("selected_product_slug IS NULL"));
      assert.ok(sqlContent.includes("char_length(selected_product_slug) <= 150"));

      assert.strictEqual(CONSULTATION_LIMITS.selectedSubjectSlug.max, 150);
      assert.ok(sqlContent.includes("selected_subject_slug IS NULL"));
      assert.ok(sqlContent.includes("char_length(selected_subject_slug) <= 150"));
    });

    test("KNOWN_CONSULTATION_FIELDS contains all 10 expected properties", () => {
      assert.strictEqual(KNOWN_CONSULTATION_FIELDS.size, 10);
      const expectedFields = [
        "fullName",
        "phone",
        "faculty",
        "major",
        "interest",
        "need",
        "note",
        "sourcePath",
        "selectedProductSlug",
        "selectedSubjectSlug"
      ];
      for (const field of expectedFields) {
        assert.ok(KNOWN_CONSULTATION_FIELDS.has(field), `Missing field in KNOWN_CONSULTATION_FIELDS: ${field}`);
      }
    });
  });
});
