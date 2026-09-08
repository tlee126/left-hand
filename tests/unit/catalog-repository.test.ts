import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CatalogDataError,
  getPublishedCourseBySlug,
  getPublishedMaterialBySlug,
  getPublishedProductBySlug,
  getPublishedTutorBySlug,
  listPublishedCourses,
  listPublishedMaterials,
  listPublishedProducts,
  listPublishedTutors,
  mapRowToCourseItem,
  mapRowToMaterialItem,
  mapRowToTutorItem,
  type CatalogClient
} from "../../lib/repositories/catalog-repository";

const timestamps = { created_at: "2026-08-25T00:00:00Z", updated_at: "2026-08-25T00:00:00Z" };

function subject(overrides: Record<string, unknown> = {}) {
  return {
    id: "subj-123", slug: "ke-toan-tai-chinh-1", name: "Kế toán tài chính 1",
    category: "Kế toán" as const, faculty_group: "Kế toán - Kiểm toán", color_theme: "accounting" as const,
    ...timestamps, ...overrides
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-123", slug: "ke-toan-tai-chinh-1", kind: "material" as const,
    title: "Tóm tắt Kế toán tài chính 1", description: "Mô tả tài liệu", subject_id: "subj-123",
    category: "Kế toán" as const, delivery_kind: "digital_download" as const,
    publication_status: "published" as const, price_vnd: 29000, old_price_vnd: 59000,
    is_contact_for_price: false, rating: 4.9, is_hot: true, color_theme: "accounting" as const,
    ...timestamps, ...overrides
  };
}

function materialRow(overrides: Record<string, unknown> = {}) {
  return {
    ...product(overrides),
    materials: { product_id: "prod-123", pages: 48, tags: ["Lý thuyết", "Bài tập"], includes: ["48 trang PDF"], suitable_for: ["Sinh viên UFM"], ...timestamps },
    subjects: subject(), ...overrides
  };
}

function courseRow(overrides: Record<string, unknown> = {}) {
  return {
    ...product({ id: "crs-123", slug: "lop-on-thi-cuoi-ky-marketing", kind: "course" as const, title: "Lớp ôn Marketing", description: "Mô tả khóa học", subject_id: "subj-mkt", category: "Marketing" as const, delivery_kind: "live_session" as const, color_theme: "marketing" as const, price_vnd: 129000, old_price_vnd: 250000, is_hot: false }),
    courses: { product_id: "crs-123", format: "zoom" as const, sessions: 4, duration: "8 giờ học", schedule: "Tối Thứ 4", enrollment_status: "open" as const, mentor: "Chị Minh Thư", tags: ["Live Zoom"], curriculum: ["Buổi 1"], suitable_for: ["Sinh viên UFM"], preparation: ["Đề cương"], ...timestamps },
    subjects: subject({ id: "subj-mkt", slug: "marketing-can-ban", name: "Marketing căn bản", category: "Marketing", color_theme: "marketing" }),
    ...overrides
  };
}

function tutorRow(overrides: Record<string, unknown> = {}) {
  const primary = subject();
  return {
    ...product({ id: "tut-123", slug: "tutor-ke-toan-tai-chinh-1", kind: "tutor" as const, title: "Tutor Minh Thư", description: "Giới thiệu tutor", delivery_kind: "one_on_one_tutoring" as const, is_hot: false }),
    tutors: { product_id: "tut-123", name: "Tutor Minh Thư", faculty: "Kế toán - Kiểm toán", format: "1:1 & Nhóm nhỏ (Online/Offline)", availability: "Còn slot tối Thứ 3", short_bio: "Giới thiệu tutor", strengths: ["Kiên nhẫn"], tags: ["GPA 9.2"], suitable_for: ["Sinh viên mất gốc"], support_methods: ["Zoom"], ...timestamps, tutor_subjects: [{ is_primary: true, subjects: primary }] },
    subjects: primary,
    tutor_subjects: [{ is_primary: true, subjects: primary }],
    ...overrides
  };
}

function mockClient(rows: Record<string, unknown[] | unknown> = {}, error: unknown = null): CatalogClient {
  return {
    from(table: string) {
      const data = rows[table] ?? [];
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; },
        then(resolve: (value: { data: unknown; error: unknown }) => unknown) { return Promise.resolve(resolve({ data, error })); },
        maybeSingle() { return Promise.resolve({ data, error }); }
      };
      return query;
    }
  } as unknown as CatalogClient;
}

describe("Canonical catalog repository DTO mapper", () => {
  test("maps a material to exact numeric canonical DTO", () => {
    const mapped = mapRowToMaterialItem(materialRow());
    assert.deepStrictEqual(mapped.pricing, { amountVND: 29000, originalAmountVND: 59000, isContactForPrice: false });
    assert.deepStrictEqual(mapped.subject, { id: "subj-123", slug: "ke-toan-tai-chinh-1", name: "Kế toán tài chính 1", category: "Kế toán", facultyGroup: "Kế toán - Kiểm toán", colorTheme: "accounting" });
    assert.deepStrictEqual(mapped.material, { pages: 48, tags: ["Lý thuyết", "Bài tập"], includes: ["48 trang PDF"], suitableFor: ["Sinh viên UFM"] });
    assert.strictEqual(mapped.kind, "material");
  });

  test("rejects malformed material category, theme, delivery, status and pricing", () => {
    assert.throws(() => mapRowToMaterialItem(materialRow({ category: "Marketing" })), CatalogDataError);
    assert.throws(() => mapRowToMaterialItem(materialRow({ color_theme: "marketing" })), CatalogDataError);
    assert.throws(() => mapRowToMaterialItem(materialRow({ delivery_kind: "live_session" })), CatalogDataError);
    assert.throws(() => mapRowToMaterialItem(materialRow({ publication_status: "draft" })), CatalogDataError);
    assert.throws(() => mapRowToMaterialItem(materialRow({ old_price_vnd: 0 })), CatalogDataError);
  });

  test("maps course metadata and preserves contact pricing", () => {
    const mapped = mapRowToCourseItem(courseRow({ price_vnd: null, old_price_vnd: null, is_contact_for_price: true }));
    assert.strictEqual(mapped.kind, "course");
    assert.strictEqual(mapped.course.format, "zoom");
    assert.strictEqual(mapped.course.enrollmentStatus, "open");
    assert.deepStrictEqual(mapped.pricing, { amountVND: null, originalAmountVND: null, isContactForPrice: true });
  });

  test("preserves zero as a valid current and original VND amount", () => {
    const mapped = mapRowToMaterialItem(materialRow({ price_vnd: 0, old_price_vnd: 0 }));
    assert.deepStrictEqual(mapped.pricing, { amountVND: 0, originalAmountVND: 0, isContactForPrice: false });
  });

  test("rejects course delivery mismatch and invalid child metadata", () => {
    assert.throws(() => mapRowToCourseItem(courseRow({ delivery_kind: "recorded_video" })), CatalogDataError);
    assert.throws(() => mapRowToCourseItem(courseRow({ courses: { ...courseRow().courses, format: "invalid" } })), CatalogDataError);
    assert.throws(() => mapRowToCourseItem(courseRow({ courses: { ...courseRow().courses, enrollment_status: "archived" } })), CatalogDataError);
  });

  test("maps tutor format and subject identity without fallback values", () => {
    const mapped = mapRowToTutorItem(tutorRow());
    assert.strictEqual(mapped.kind, "tutor");
    assert.strictEqual(mapped.tutor.name, "Tutor Minh Thư");
    assert.strictEqual(mapped.tutor.format, "1:1 & Nhóm nhỏ (Online/Offline)");
    assert.deepStrictEqual(mapped.tutor.subjects.map((item) => item.slug), ["ke-toan-tai-chinh-1"]);
    assert.strictEqual(mapped.pricing.amountVND, 29000);
  });

  test("rejects invalid tutor format and duplicate/missing primary subject", () => {
    assert.throws(() => mapRowToTutorItem(tutorRow({ tutors: { ...tutorRow().tutors, format: "1:1 & Online" } })), CatalogDataError);
    assert.throws(() => mapRowToTutorItem(tutorRow({ tutors: { ...tutorRow().tutors, tutor_subjects: [] }, tutor_subjects: [] })), CatalogDataError);
    const duplicatePrimary = [{ is_primary: true, subjects: subject() }, { is_primary: true, subjects: subject({ id: "subj-2", slug: "nguyen-ly-ke-toan", name: "Nguyên lý kế toán" }) }];
    assert.throws(() => mapRowToTutorItem(tutorRow({ tutors: { ...tutorRow().tutors, tutor_subjects: duplicatePrimary }, tutor_subjects: duplicatePrimary })), CatalogDataError);
  });
});

describe("Catalog repository runtime data flow", () => {
  test("uses database rows, filters draft/archived and handles empty result", async () => {
    const client = mockClient({ products: [materialRow(), materialRow({ id: "draft", slug: "draft", publication_status: "draft" })] });
    const materials = await listPublishedMaterials(client);
    assert.strictEqual(materials.length, 1);
    assert.strictEqual(materials[0].id, "prod-123");
    assert.deepStrictEqual(await listPublishedMaterials(mockClient({ products: [] })), []);
  });

  test("returns generic errors and never stale static data on repository failure", async () => {
    await assert.rejects(() => listPublishedMaterials(mockClient({}, new Error("secret db detail"))), { message: "Failed to list published materials." });
    await assert.rejects(() => listPublishedProducts(mockClient({}, new Error("secret db detail"))), { message: "Failed to list published products." });
    assert.strictEqual(await getPublishedMaterialBySlug("missing", mockClient({ products: null })), null);
  });

  test("resolves slug input canonically and uses detail joins", async () => {
    const result = await getPublishedMaterialBySlug("  Kế toán tài chính 1 ", mockClient({ products: materialRow() }));
    assert.strictEqual(result?.slug, "ke-toan-tai-chinh-1");
    assert.strictEqual(await getPublishedMaterialBySlug("not a valid / slug", mockClient({ products: null })), null);
  });

  test("all public repositories return their discriminated DTOs", async () => {
    assert.strictEqual((await listPublishedCourses(mockClient({ products: [courseRow()] })))[0].kind, "course");
    assert.strictEqual((await listPublishedTutors(mockClient({ products: [tutorRow()] })))[0].kind, "tutor");
    assert.strictEqual((await getPublishedProductBySlug("ke-toan-tai-chinh-1", mockClient({ products: materialRow() })))?.publication_status, "published");
    assert.strictEqual(await getPublishedCourseBySlug("missing", mockClient({ products: null })), null);
    assert.strictEqual(await getPublishedTutorBySlug("missing", mockClient({ products: null })), null);
  });
});

test("repository implementation keeps canonical mapping and no formatted-price logic", async () => {
  const source = await fs.readFile(path.resolve(process.cwd(), "lib/repositories/catalog-repository.ts"), "utf8");
  assert.match(source, /PublishedMaterial|PublishedCourse|PublishedTutor/);
  assert.match(source, /materials!inner\(\*\), subjects\(\*\)/);
  assert.match(source, /tutors!inner\(\*, tutor_subjects\(is_primary, subjects\(\*\)\)\), subjects\(\*\)/);
  assert.doesNotMatch(source, /formatVND|parseFloat|price:\s*string/);
});
