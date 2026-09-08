import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadMaterialsCatalogPage } from "../../app/tai-lieu/page";
import { loadCoursesCatalogPage } from "../../app/khoa-hoc/page";
import { loadTutorsCatalogPage } from "../../app/tutor/page";
import { materialFixture, courseFixture, tutorFixture } from "./catalog-fixtures";
import type { CatalogFilters } from "../../lib/domain/catalog";

const page = <T>(items: readonly T[]) => ({
  items,
  total: items.length,
  limit: 12,
  offset: 0,
  page: 1,
  hasNext: false,
  hasPrevious: false
});

describe("Public catalog server page flow", () => {
  test("passes canonical filters to the material repository and forwards exact DTO props", async () => {
    const item = materialFixture();
    let received: CatalogFilters | undefined;
    const loaded = await loadMaterialsCatalogPage(
      { search: "  Kế toán  ", category: "Kế toán", page: "2", sort: "price-asc" },
      async (filters) => { received = filters; return { ...page([item]), offset: 12, page: 2, hasPrevious: true }; }
    );
    assert.deepStrictEqual(received, {
      search: "Kế toán",
      category: "Kế toán",
      subject: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: "price-asc",
      limit: undefined,
      page: 2,
      courseFormat: undefined,
      courseFormats: undefined,
      enrollmentStatus: undefined,
      tutorMode: undefined
    });
    assert.deepStrictEqual(loaded.page.items, [item]);
    assert.strictEqual(loaded.filters.category, "Kế toán");
  });

  test("keeps course and tutor query-string filters on the server boundary", async () => {
    const course = courseFixture();
    const tutor = tutorFixture();
    let courseFilters: CatalogFilters | undefined;
    let tutorFilters: CatalogFilters | undefined;
    const courseResult = await loadCoursesCatalogPage(
      { search: "ke toan", courseFormat: "video", enrollmentStatus: "open" },
      async (filters) => { courseFilters = filters; return page([course]); }
    );
    const tutorResult = await loadTutorsCatalogPage(
      { search: "Đặng", tutorMode: "online", sort: "rating-desc" },
      async (filters) => { tutorFilters = filters; return page([tutor]); }
    );
    assert.strictEqual(courseFilters?.courseFormat, "video");
    assert.strictEqual(courseFilters?.enrollmentStatus, "open");
    assert.strictEqual(tutorFilters?.tutorMode, "online");
    assert.deepStrictEqual(courseResult.page.items, [course]);
    assert.deepStrictEqual(tutorResult.page.items, [tutor]);
  });
});
