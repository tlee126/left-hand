/**
 * Unit Tests for Domain Types & Helpers
 *
 * Can be executed via node's built-in test runner or standard test frameworks:
 *   node --test --import tsx/esm tests/unit/domain-types.test.ts (or equivalent runner)
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
  PUBLICATION_STATUSES
} from "../../lib/domain/product-types";

describe("Domain Models: Subjects and Slugs", () => {
  test("canonical subjects have valid slugs and matching categories", () => {
    assert.ok(CANONICAL_SUBJECTS.length > 0);

    for (const sub of CANONICAL_SUBJECTS) {
      assert.ok(isValidSlug(sub.slug), `Subject slug must be valid kebab-case: ${sub.slug}`);
      assert.ok(CATEGORIES.includes(sub.category), `Subject category must be canonical: ${sub.category}`);
      assert.strictEqual(sub.slug, normalizeSlug(sub.slug), "Slug should already be normalized");
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

  test("findSubjectBySlug and findSubjectByName lookup subjects accurately", () => {
    const bySlug = findSubjectBySlug("ke-toan-tai-chinh-1");
    assert.ok(bySlug);
    assert.strictEqual(bySlug?.name, "Kế toán tài chính 1");

    const byName = findSubjectByName("Kế toán tài chính 1");
    assert.ok(byName);
    assert.strictEqual(byName?.slug, "ke-toan-tai-chinh-1");

    assert.strictEqual(findSubjectBySlug("non-existent-slug"), undefined);
    assert.strictEqual(findSubjectByName("Môn học không tồn tại"), undefined);
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
  });

  test("parseVND returns null for contact-for-price and empty strings", () => {
    assert.strictEqual(parseVND("Liên hệ"), null);
    assert.strictEqual(parseVND("lien he"), null);
    assert.strictEqual(parseVND("Contact"), null);
    assert.strictEqual(parseVND(""), null);
    assert.strictEqual(parseVND(null), null);
    assert.strictEqual(parseVND(undefined), null);
  });

  test("parseVND rejects invalid amounts and negative values", () => {
    assert.throws(() => parseVND("-29.000đ"), /Cannot parse VND amount/);
    assert.throws(() => parseVND(-1000), /must be a non-negative integer/);
    assert.throws(() => parseVND(29.5), /must be a non-negative integer/);
    assert.throws(() => parseVND("abc"), /Cannot parse VND amount/);
  });

  test("formatVND formats integers to standard Vietnamese VND display strings", () => {
    assert.strictEqual(formatVND(29000), "29.000đ");
    assert.strictEqual(formatVND(199000), "199.000đ");
    assert.strictEqual(formatVND(1500000), "1.500.000đ");
    assert.strictEqual(formatVND(0), "0đ");
    assert.strictEqual(formatVND(null), "Liên hệ");
    assert.strictEqual(formatVND(undefined), "Liên hệ");
  });

  test("isValidVND returns true only for non-negative safe integers", () => {
    assert.strictEqual(isValidVND(29000), true);
    assert.strictEqual(isValidVND(0), true);
    assert.strictEqual(isValidVND(-500), false);
    assert.strictEqual(isValidVND(29.99), false);
    assert.strictEqual(isValidVND("29000"), false);
    assert.strictEqual(isValidVND(null), false);
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
      "archived",
      "coming_soon",
      "full"
    ]);
  });
});

