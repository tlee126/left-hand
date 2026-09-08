import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isValidElement } from "react";
import MaterialsCatalogPage, { loadMaterialsCatalogPage } from "../../app/tai-lieu/page";
import CoursesCatalogPage, { loadCoursesCatalogPage } from "../../app/khoa-hoc/page";
import TutorsCatalogPage, { loadTutorsCatalogPage } from "../../app/tutor/page";
import MaterialDetailPage from "../../app/tai-lieu/[slug]/page";
import CourseDetailPage from "../../app/khoa-hoc/[slug]/page";
import TutorDetailPage from "../../app/tutor/[slug]/page";
import MaterialsError from "../../app/tai-lieu/error";
import MaterialDetailError from "../../app/tai-lieu/[slug]/error";
import CoursesError from "../../app/khoa-hoc/error";
import CourseDetailError from "../../app/khoa-hoc/[slug]/error";
import TutorsError from "../../app/tutor/error";
import TutorDetailError from "../../app/tutor/[slug]/error";
import { materialFixture, courseFixture, tutorFixture } from "./catalog-fixtures";
import { buildCatalogFilterUrl, buildCatalogPageUrl } from "../../lib/domain/catalog-url";
import type { CatalogFilters, CatalogPage, PublishedCourse, PublishedMaterial, PublishedTutor } from "../../lib/domain/catalog";

const page = <T>(items: readonly T[]): CatalogPage<T> => ({
  items,
  total: items.length,
  limit: 12,
  offset: 0,
  page: 1,
  hasNext: false,
  hasPrevious: false
});

function propsOf<T extends object>(value: unknown): T {
  if (!isValidElement(value)) throw new Error("Expected a React element.");
  return value.props as T;
}

function catalogClientProps(value: unknown): {
  initialMaterials?: readonly PublishedMaterial[];
  initialCourses?: readonly PublishedCourse[];
  initialTutors?: readonly PublishedTutor[];
  pagination: CatalogPage<unknown>;
  initialFilters: CatalogFilters;
} {
  const shell = propsOf<{ children: unknown }>(value);
  const suspense = propsOf<{ children: unknown }>(shell.children);
  return castCatalogClientProps(suspense.children);
}

function castCatalogClientProps(value: unknown): {
  initialMaterials?: readonly PublishedMaterial[];
  initialCourses?: readonly PublishedCourse[];
  initialTutors?: readonly PublishedTutor[];
  pagination: CatalogPage<unknown>;
  initialFilters: CatalogFilters;
} {
  return propsOf<{
    initialMaterials?: readonly PublishedMaterial[];
    initialCourses?: readonly PublishedCourse[];
    initialTutors?: readonly PublishedTutor[];
    pagination: CatalogPage<unknown>;
    initialFilters: CatalogFilters;
  }>(value);
}

function containsText(value: unknown, expected: string): boolean {
  if (typeof value === "string") return value.includes(expected);
  if (Array.isArray(value)) return value.some((child) => containsText(child, expected));
  if (!isValidElement(value)) return false;
  return containsText(propsOf<{ children?: unknown }>(value).children, expected);
}

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

  test("executes each real list page and forwards the canonical DTO, filters, and metadata to its client", async () => {
    const material = materialFixture();
    const course = courseFixture();
    const tutor = tutorFixture();
    const materialPage = await MaterialsCatalogPage({ searchParams: Promise.resolve({ search: "Đặng", page: "2" }) }, async () => ({ ...page([material]), offset: 12, page: 2, hasPrevious: true }));
    const coursePage = await CoursesCatalogPage({ searchParams: Promise.resolve({ courseFormat: "zoom" }) }, async () => page([course]));
    const tutorPage = await TutorsCatalogPage({ searchParams: Promise.resolve({ tutorMode: "online" }) }, async () => page([tutor]));

    const materialProps = catalogClientProps(materialPage);
    const courseProps = catalogClientProps(coursePage);
    const tutorProps = catalogClientProps(tutorPage);
    assert.deepStrictEqual(materialProps.initialMaterials, [material]);
    assert.deepStrictEqual(courseProps.initialCourses, [course]);
    assert.deepStrictEqual(tutorProps.initialTutors, [tutor]);
    assert.strictEqual(materialProps.pagination.offset, 12);
    assert.strictEqual(materialProps.initialFilters.search, "Đặng");
    assert.strictEqual(courseProps.initialFilters.courseFormat, "zoom");
    assert.strictEqual(tutorProps.initialFilters.tutorMode, "online");
  });

  test("executes each real detail page, renders the loaded DTO, and calls notFound for missing records", async () => {
    const material = materialFixture();
    const course = courseFixture();
    const tutor = tutorFixture();
    let loadedSlugs: string[] = [];
    const materialPage = await MaterialDetailPage({ params: Promise.resolve({ slug: material.slug }) }, async (slug) => { loadedSlugs.push(slug); return material; });
    const coursePage = await CourseDetailPage({ params: Promise.resolve({ slug: course.slug }) }, async (slug) => { loadedSlugs.push(slug); return course; });
    const tutorPage = await TutorDetailPage({ params: Promise.resolve({ slug: tutor.slug }) }, async (slug) => { loadedSlugs.push(slug); return tutor; });

    assert.deepStrictEqual(loadedSlugs, [material.slug, course.slug, tutor.slug]);
    assert.ok(containsText(materialPage, material.title));
    assert.ok(containsText(coursePage, course.title));
    assert.ok(containsText(tutorPage, tutor.tutor.name));

    for (const detailPage of [MaterialDetailPage, CourseDetailPage, TutorDetailPage]) {
      await assert.rejects(
        () => detailPage({ params: Promise.resolve({ slug: "missing" }) }, async () => null),
        /NEXT_HTTP_ERROR_FALLBACK;404/
      );
    }
  });

  test("maps list and detail failures to the correct generic error contexts", () => {
    const reset = () => {};
    assert.strictEqual(propsOf<{ context: string }>(MaterialsError({ error: new Error("raw"), reset })).context, "materials");
    assert.strictEqual(propsOf<{ context: string }>(CoursesError({ error: new Error("raw"), reset })).context, "courses");
    assert.strictEqual(propsOf<{ context: string }>(TutorsError({ error: new Error("raw"), reset })).context, "tutors");
    assert.strictEqual(propsOf<{ context: string }>(MaterialDetailError({ error: new Error("raw"), reset })).context, "material-detail");
    assert.strictEqual(propsOf<{ context: string }>(CourseDetailError({ error: new Error("raw"), reset })).context, "course-detail");
    assert.strictEqual(propsOf<{ context: string }>(TutorDetailError({ error: new Error("raw"), reset })).context, "tutor-detail");
  });

  test("preserves deep-link filters while filter changes reset the page and pagination preserves filters", () => {
    const filterUrl = buildCatalogFilterUrl("/tai-lieu", "search=%C4%90%E1%BA%B7ng&page=4&subject=ke-toan&keep=1", [["category", "Kế toán"]]);
    const filterParams = new URL(filterUrl, "https://example.test").searchParams;
    assert.strictEqual(filterParams.get("search"), "Đặng");
    assert.strictEqual(filterParams.get("subject"), "ke-toan");
    assert.strictEqual(filterParams.get("category"), "Kế toán");
    assert.strictEqual(filterParams.get("keep"), "1");
    assert.strictEqual(filterParams.get("page"), null);

    const pageUrl = buildCatalogPageUrl("search=ke+toan&category=Marketing", 3);
    const pageParams = new URL(`https://example.test${pageUrl}`).searchParams;
    assert.strictEqual(pageParams.get("search"), "ke toan");
    assert.strictEqual(pageParams.get("category"), "Marketing");
    assert.strictEqual(pageParams.get("page"), "3");
  });
});
