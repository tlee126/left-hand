/**
 * Unit Tests for Domain Types & Helpers
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  CATEGORIES,
  CANONICAL_SUBJECTS,
  normalizeSlug,
  isValidSlug,
  findSubjectBySlug,
  findSubjectByName
} from "../../lib/domain/subjects";
import {
  parseVND,
  formatVND,
  isValidVND,
  PRODUCT_KINDS,
  DELIVERY_KINDS,
  PUBLICATION_STATUSES,
  ENROLLMENT_STATUSES
} from "../../lib/domain/product-types";
import { materials, courses, tutors } from "../../data/catalog";

describe("Domain Models: Subjects and Slugs", () => {
  test("canonical subjects have valid slugs and matching categories", () => {
    assert.ok(CANONICAL_SUBJECTS.length > 0);

    for (const sub of CANONICAL_SUBJECTS) {
      assert.ok(isValidSlug(sub.slug), `Subject slug must be valid kebab-case: ${sub.slug}`);
      assert.ok(CATEGORIES.includes(sub.category), `Subject category must be canonical: ${sub.category}`);
      assert.strictEqual(sub.slug, normalizeSlug(sub.slug), "Slug should already be normalized");
    }
  });

  test("all subject, category, and colorTheme entries in data/catalog.ts match canonical domain", () => {
    const catalogSubjects = new Set<string>();
    const catalogCategories = new Set<string>();
    const catalogThemes = new Set<string>();

    for (const m of materials) {
      catalogSubjects.add(m.subject);
      catalogCategories.add(m.category);
      catalogThemes.add(m.colorTheme);
    }

    for (const c of courses) {
      catalogSubjects.add(c.subject);
      catalogCategories.add(c.category);
      catalogThemes.add(c.colorTheme);
    }

    for (const t of tutors) {
      for (const s of t.subjects) {
        catalogSubjects.add(s);
      }
      catalogThemes.add(t.colorTheme);
    }

    for (const cat of catalogCategories) {
      assert.ok(
        (CATEGORIES as readonly string[]).includes(cat),
        `Catalog category "${cat}" must exist in canonical CATEGORIES`
      );
    }

    for (const subjName of catalogSubjects) {
      const found = findSubjectByName(subjName);
      assert.ok(
        found !== undefined,
        `Catalog subject "${subjName}" must resolve to a canonical subject in CANONICAL_SUBJECTS`
      );
    }
  });

  test("normalizeSlug converts Vietnamese diacritics and special characters", () => {
    assert.strictEqual(normalizeSlug("Kế toán tài chính 1"), "ke-toan-tai-chinh-1");
    assert.strictEqual(normalizeSlug("Nguyên lý kế toán"), "nguyen-ly-ke-toan");
    assert.strictEqual(normalizeSlug("Kinh tế vi mô (UFM)"), "kinh-te-vi-mo-ufm");
    assert.strictEqual(normalizeSlug("  Đề Cương & Bài Tập -- Final!  "), "de-cuong-bai-tap-final");
    assert.strictEqual(normalizeSlug(""), "");
  });

  test("isValidSlug correctly validates slug formats", () => {
    assert.strictEqual(isValidSlug("ke-toan-tai-chinh-1"), true);
    assert.strictEqual(isValidSlug("marketing-can-ban"), true);
    assert.strictEqual(isValidSlug("ke_toan"), false);
    assert.strictEqual(isValidSlug("Ke-Toan"), false);
    assert.strictEqual(isValidSlug("-ke-toan-"), false);
    assert.strictEqual(isValidSlug(""), false);
  });

  test("findSubjectBySlug and findSubjectByName lookup subjects accurately with accents and case insensitivity", () => {
    const bySlug = findSubjectBySlug("ke-toan-tai-chinh-1");
    assert.ok(bySlug);
    assert.strictEqual(bySlug?.name, "Kế toán tài chính 1");

    // Exact name
    const byExact = findSubjectByName("Kế toán tài chính 1");
    assert.ok(byExact);
    assert.strictEqual(byExact?.slug, "ke-toan-tai-chinh-1");

    // Case and extra whitespace tolerance
    const byCaseWhitespace = findSubjectByName("   kế toán TÀI CHÍNH 1   ");
    assert.ok(byCaseWhitespace);
    assert.strictEqual(byCaseWhitespace?.slug, "ke-toan-tai-chinh-1");

    // Unaccented search
    const byUnaccented = findSubjectByName("ke toan tai chinh 1");
    assert.ok(byUnaccented);
    assert.strictEqual(byUnaccented?.slug, "ke-toan-tai-chinh-1");

    assert.strictEqual(findSubjectBySlug("non-existent-slug"), undefined);
    assert.strictEqual(findSubjectByName("Môn học không tồn tại"), undefined);
    assert.strictEqual(findSubjectByName(""), undefined);
  });
});

describe("Domain Models: VND Currency Pricing & Product Kinds", () => {
  test("parseVND accurately converts formatted strings to integer VND amounts", () => {
    assert.strictEqual(parseVND("29.000đ"), 29000);
    assert.strictEqual(parseVND("29.000"), 29000);
    assert.strictEqual(parseVND("199.000₫"), 199000);
    assert.strictEqual(parseVND("1,500,000đ"), 1500000);
    assert.strictEqual(parseVND("0đ"), 0);
    assert.strictEqual(parseVND(29000), 29000);
    assert.strictEqual(parseVND(0), 0);
  });

  test("parseVND returns null for contact-for-price and empty strings", () => {
    assert.strictEqual(parseVND("Liên hệ"), null);
    assert.strictEqual(parseVND("liên hệ"), null);
    assert.strictEqual(parseVND("lien he"), null);
    assert.strictEqual(parseVND("LIEN HE"), null);
    assert.strictEqual(parseVND("Contact"), null);
    assert.strictEqual(parseVND(""), null);
    assert.strictEqual(parseVND("   "), null);
    assert.strictEqual(parseVND(null), null);
    assert.strictEqual(parseVND(undefined), null);
  });

  test("parseVND rejects invalid amounts, decimals, NaN, Infinity, and negative values", () => {
    assert.throws(() => parseVND("-29.000đ"), /Cannot parse VND amount/);
    assert.throws(() => parseVND(-1000), /cannot be negative/);
    assert.throws(() => parseVND(29.5), /does not have decimal cents/);
    assert.throws(() => parseVND("29.5đ"), /decimals are not allowed in VND/);
    assert.throws(() => parseVND("29,5"), /decimals are not allowed in VND/);
    assert.throws(() => parseVND("abc"), /Cannot parse VND amount/);
    assert.throws(() => parseVND(NaN), /not finite/);
    assert.throws(() => parseVND(Infinity), /not finite/);
    assert.throws(() => parseVND(Number.MAX_SAFE_INTEGER + 1000), /exceeds safe integer limit/);
  });

  test("formatVND formats integers to standard Vietnamese VND display strings", () => {
    assert.strictEqual(formatVND(29000), "29.000đ");
    assert.strictEqual(formatVND(199000), "199.000đ");
    assert.strictEqual(formatVND(1500000), "1.500.000đ");
    assert.strictEqual(formatVND(0), "0đ");
    assert.strictEqual(formatVND(null), "Liên hệ");
    assert.strictEqual(formatVND(undefined), "Liên hệ");
  });

  test("formatVND throws for invalid inputs", () => {
    assert.throws(() => formatVND(-500), /must be a non-negative safe integer/);
    assert.throws(() => formatVND(12.5), /must be a non-negative safe integer/);
    assert.throws(() => formatVND(NaN), /must be a non-negative safe integer/);
  });

  test("isValidVND returns true only for non-negative safe integers", () => {
    assert.strictEqual(isValidVND(29000), true);
    assert.strictEqual(isValidVND(0), true);
    assert.strictEqual(isValidVND(-500), false);
    assert.strictEqual(isValidVND(29.99), false);
    assert.strictEqual(isValidVND("29000"), false);
    assert.strictEqual(isValidVND(null), false);
    assert.strictEqual(isValidVND(NaN), false);
  });

  test("domain enums contain expected values", () => {
    assert.deepStrictEqual([...PRODUCT_KINDS], ["material", "course", "tutor"]);
    assert.deepStrictEqual([...DELIVERY_KINDS], [
      "digital_download",
      "live_session",
      "recorded_video",
      "one_on_one_tutoring"
    ]);
    assert.deepStrictEqual([...PUBLICATION_STATUSES], [
      "draft",
      "published",
      "archived"
    ]);
    assert.deepStrictEqual([...ENROLLMENT_STATUSES], [
      "open",
      "coming-soon",
      "full"
    ]);
  });
});

