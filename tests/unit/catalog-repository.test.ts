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
  listMaterials,
  listCourses,
  listTutors,
  getProductBySlug,
  type CatalogFilters,
  mapRowToCourseItem,
  mapRowToMaterialItem,
  mapRowToTutorItem,
  type CatalogClient,
  type CatalogQuery,
  type CatalogQueryResult
} from "../../lib/repositories/catalog-repository";
import { normalizeCatalogSearch } from "../../lib/domain/catalog";

const timestamps = { created_at: "2026-08-25T00:00:00Z", updated_at: "2026-08-25T00:00:00Z" };

function subject(overrides: object = {}) {
  return {
    id: "subj-123", slug: "ke-toan-tai-chinh-1", name: "Kế toán tài chính 1",
    category: "Kế toán" as const, faculty_group: "Kế toán - Kiểm toán", color_theme: "accounting" as const,
    ...timestamps, ...overrides
  };
}

function product(overrides: object = {}) {
  return {
    id: "prod-123", slug: "ke-toan-tai-chinh-1", kind: "material" as const,
    title: "Tóm tắt Kế toán tài chính 1", description: "Mô tả tài liệu", subject_id: "subj-123",
    category: "Kế toán" as const, delivery_kind: "digital_download" as const,
    publication_status: "published" as const, price_vnd: 29000, old_price_vnd: 59000,
    is_contact_for_price: false, rating: 4.9, is_hot: true, color_theme: "accounting" as const,
    ...timestamps, ...overrides
  };
}

function materialRow(overrides: object = {}) {
  return {
    ...product(overrides),
    materials: { product_id: "prod-123", pages: 48, tags: ["Lý thuyết", "Bài tập"], includes: ["48 trang PDF"], suitable_for: ["Sinh viên UFM"], ...timestamps },
    subjects: subject(), ...overrides
  };
}

function courseRow(overrides: object = {}) {
  return {
    ...product({ id: "crs-123", slug: "lop-on-thi-cuoi-ky-marketing", kind: "course" as const, title: "Lớp ôn Marketing", description: "Mô tả khóa học", subject_id: "subj-mkt", category: "Marketing" as const, delivery_kind: "live_session" as const, color_theme: "marketing" as const, price_vnd: 129000, old_price_vnd: 250000, is_hot: false }),
    courses: { product_id: "crs-123", format: "zoom" as const, sessions: 4, duration: "8 giờ học", schedule: "Tối Thứ 4", enrollment_status: "open" as const, mentor: "Chị Minh Thư", tags: ["Live Zoom"], curriculum: ["Buổi 1"], suitable_for: ["Sinh viên UFM"], preparation: ["Đề cương"], ...timestamps },
    subjects: subject({ id: "subj-mkt", slug: "marketing-can-ban", name: "Marketing căn bản", category: "Marketing", color_theme: "marketing" }),
    ...overrides
  };
}

function tutorRow(overrides: object = {}) {
  const primary = subject();
  return {
    ...product({ id: "tut-123", slug: "tutor-ke-toan-tai-chinh-1", kind: "tutor" as const, title: "Tutor Minh Thư", description: "Giới thiệu tutor", delivery_kind: "one_on_one_tutoring" as const, is_hot: false }),
    tutors: { product_id: "tut-123", name: "Tutor Minh Thư", faculty: "Kế toán - Kiểm toán", format: "1:1 & Nhóm nhỏ (Online/Offline)", availability: "Còn slot tối Thứ 3", short_bio: "Giới thiệu tutor", strengths: ["Kiên nhẫn"], tags: ["GPA 9.2"], suitable_for: ["Sinh viên mất gốc"], support_methods: ["Zoom"], ...timestamps, tutor_subjects: [{ is_primary: true, subjects: primary }] },
    subjects: primary,
    tutor_subjects: [{ is_primary: true, subjects: primary }],
    ...overrides
  };
}

interface MockRows { products?: unknown[] | unknown; }

function field(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function mockClient(rows: MockRows = {}, error: unknown = null, calls: string[] = [], countOverride?: number | null): CatalogClient {
  return {
    products() {
      let data = rows.products ?? [];
      const allRows = Array.isArray(data) ? data : data === null ? [] : [data];
      const count = countOverride === undefined ? (Array.isArray(data) ? data.length : data ? 1 : 0) : countOverride;
      const query: CatalogQuery = {
        select() { calls.push("select"); return query; },
        eq(column: string, value: unknown) {
          calls.push(`eq:${column}=${String(value)}`);
          if (Array.isArray(data)) data = data.filter((row) => field(row, column) === value);
          else if (data && typeof data === "object" && field(data, column) !== value) data = [];
          return query;
        },
        gte(column: string, value: unknown) { calls.push(`gte:${column}=${String(value)}`); return query; },
        lte(column: string, value: unknown) { calls.push(`lte:${column}=${String(value)}`); return query; },
        in(column: string, values: readonly unknown[]) { calls.push(`in:${column}=${values.join(",")}`); return query; },
        ilike(column: string, value: unknown) { calls.push(`ilike:${column}=${String(value)}`); return query; },
        or(value: string) { calls.push(`or:${value}`); return query; },
        order(column: string, options: { ascending: boolean }) { calls.push(`order:${column}:${options.ascending ? "asc" : "desc"}`); return query; },
        range(from: number, to: number) { calls.push(`range:${from}-${to}`); data = (Array.isArray(data) ? data : allRows).slice(from, to + 1); return query; },
        then<TResult1 = CatalogQueryResult, TResult2 = never>(
          onfulfilled?: ((value: CatalogQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ): PromiseLike<TResult1 | TResult2> {
          return Promise.resolve({ data, error, count }).then(onfulfilled, onrejected);
        },
        maybeSingle() {
          const values = Array.isArray(data) ? data : data ? [data] : [];
          if (values.length > 1) return Promise.resolve({ data: null, error: { code: "PGRST116" } });
          return Promise.resolve({ data: values[0] ?? null, error });
        }
      };
      return query;
    }
  };
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
  test("normalizes accented, unaccented, case-insensitive and excess-whitespace search once", () => {
    assert.strictEqual(normalizeCatalogSearch("  KẾ toán   "), "ke toan");
    assert.strictEqual(normalizeCatalogSearch("Đặng"), "dang");
    assert.strictEqual(normalizeCatalogSearch("!!!"), "");
    assert.strictEqual(normalizeCatalogSearch(""), "");
  });

  test("uses the same normalized database search document for materials, courses, and tutors", async () => {
    for (const list of [listMaterials, listCourses, listTutors]) {
      const calls: string[] = [];
      await list({ search: "  ĐẶNG   KẾ toán  " }, mockClient({ products: [] }, null, calls));
      assert.ok(calls.includes("ilike:search_document=%dang ke toan%"));
    }
  });

  test("runs filters, bounded range, and deterministic secondary ordering in the repository", async () => {
    const calls: string[] = [];
    const filters: CatalogFilters = {
      search: "Kế toán",
      category: "Kế toán",
      subject: "ke-toan-tai-chinh-1",
      minPrice: 0,
      maxPrice: 100000,
      sort: "price-asc",
      limit: 100,
      page: 2
    };
    const result = await listMaterials(filters, mockClient({ products: [materialRow()] }, null, calls));
    assert.strictEqual(result.limit, 48);
    assert.strictEqual(result.offset, 48);
    assert.ok(calls.includes("eq:publication_status=published"));
    assert.ok(calls.includes("eq:category=Kế toán"));
    assert.ok(calls.includes("eq:subjects.slug=ke-toan-tai-chinh-1"));
    assert.ok(calls.includes("gte:price_vnd=0"));
    assert.ok(calls.includes("lte:price_vnd=100000"));
    assert.ok(calls.some((call) => call.startsWith("ilike:search_document=%ke toan%")));
    assert.deepStrictEqual(calls.slice(-4), ["order:price_vnd:asc", "order:created_at:desc", "order:id:asc", "range:48-95"]);
    assert.deepStrictEqual(result.items, []);
  });

  test("keeps exact pagination metadata for normal counts, zero counts, null counts, and final pages", async () => {
    const normal = await listMaterials({ limit: 2, offset: 1 }, mockClient({ products: [materialRow(), materialRow({ id: "prod-2", slug: "ke-toan-2", materials: { ...materialRow().materials, product_id: "prod-2" } }), materialRow({ id: "prod-3", slug: "ke-toan-3", materials: { ...materialRow().materials, product_id: "prod-3" } })] }, null, [], 3));
    assert.deepStrictEqual({ total: normal.total, page: normal.page, hasNext: normal.hasNext }, { total: 3, page: 1, hasNext: false });

    const empty = await listMaterials({ limit: 12 }, mockClient({ products: [] }, null, [], 0));
    assert.deepStrictEqual({ total: empty.total, hasNext: empty.hasNext }, { total: 0, hasNext: false });

    const unknown = await listMaterials({ limit: 12 }, mockClient({ products: [] }, null, [], null));
    assert.deepStrictEqual({ total: unknown.total, hasNext: unknown.hasNext }, { total: null, hasNext: null });

    await assert.rejects(() => listMaterials({}, mockClient({ products: [] }, new Error("count query failed"))), { message: "Failed to list published materials." });
  });

  test("fails closed for duplicate detail rows and malformed child joins", async () => {
    await assert.rejects(
      () => getProductBySlug("material", "ke-toan-tai-chinh-1", mockClient({ products: [materialRow(), materialRow({ id: "prod-duplicate" })] })),
      { message: "Failed to get published catalog product." }
    );
    await assert.rejects(
      () => getProductBySlug("material", "ke-toan-tai-chinh-1", mockClient({ products: materialRow({ materials: null }) })),
      { message: "Failed to get published catalog product." }
    );
  });

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

  test("maps a catalog client factory failure to the same generic repository error", async () => {
    await assert.rejects(
      () => listMaterials({}, undefined, async () => { throw new Error("SUPABASE_URL=secret PII@example.test"); }),
      { message: "Failed to list published materials." }
    );
  });

  test("rejects an invalid kind before client creation or query", async () => {
    let factoryOrQueryCalled = false;
    const client: CatalogClient = { products() { factoryOrQueryCalled = true; throw new Error("must not query"); } };
    await assert.rejects(() => getProductBySlug("invalid" as never, "ke-toan-tai-chinh-1", client), CatalogDataError);
    assert.equal(factoryOrQueryCalled, false);
  });

  test("resolves slug input canonically and uses detail joins", async () => {
    const result = await getPublishedMaterialBySlug("  Kế toán tài chính 1 ", mockClient({ products: materialRow() }));
    assert.strictEqual(result?.slug, "ke-toan-tai-chinh-1");
    assert.strictEqual(await getPublishedMaterialBySlug("not a valid / slug", mockClient({ products: null })), null);
  });

  test("all public repositories return their discriminated DTOs", async () => {
    assert.strictEqual((await listPublishedCourses(mockClient({ products: [courseRow()] })))[0].kind, "course");
    assert.strictEqual((await listPublishedTutors(mockClient({ products: [tutorRow()] })))[0].kind, "tutor");
    assert.strictEqual((await getPublishedProductBySlug("ke-toan-tai-chinh-1", mockClient({ products: materialRow() })))?.publicationStatus, "published");
    assert.strictEqual(await getPublishedCourseBySlug("missing", mockClient({ products: null })), null);
    assert.strictEqual(await getPublishedTutorBySlug("missing", mockClient({ products: null })), null);
  });
});

test("repository implementation keeps canonical mapping and no formatted-price logic", async () => {
  const source = await fs.readFile(path.resolve(process.cwd(), "lib/repositories/catalog-repository.ts"), "utf8");
  assert.match(source, /PublishedMaterial|PublishedCourse|PublishedTutor/);
  assert.match(source, /const MATERIAL_COLUMNS = "product_id, pages, tags, includes, suitable_for/);
  assert.match(source, /const TUTOR_COLUMNS = "product_id, name, faculty, format, availability/);
  assert.doesNotMatch(source, /select\(\s*["'`]\*|!inner\(\*/);
  assert.doesNotMatch(source, /formatVND|parseFloat|price:\s*string/);
});
