/**
 * Unit Tests for Catalog Seed Normalization & Validation (Task 1.2)
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  materials,
  courses,
  tutors,
  MaterialItem,
  CourseItem,
  TutorItem,
  TUTOR_FORMATS
} from "../../data/catalog";
import {
  CATEGORIES,
  COLOR_THEMES,
  CANONICAL_SUBJECTS,
  isValidSlug,
  findSubjectByName
} from "../../lib/domain/subjects";
import { ENROLLMENT_STATUSES } from "../../lib/domain/product-types";

describe("Catalog Seed Integrity & Normalization", () => {
  describe("Materials Catalog", () => {
    test("every material has required valid fields", () => {
      assert.ok(materials.length > 0, "Materials must not be empty");

      const seenIds = new Set<string>();
      const seenSlugs = new Set<string>();

      for (const item of materials) {
        // Unique ID & Slug
        assert.ok(item.id && item.id.trim() !== "", "Material must have a non-empty id");
        assert.ok(!seenIds.has(item.id), `Duplicate material id found: ${item.id}`);
        seenIds.add(item.id);

        assert.ok(item.slug && item.slug.trim() !== "", `Material ${item.id} must have a non-empty slug`);
        assert.ok(isValidSlug(item.slug), `Material slug "${item.slug}" must be valid kebab-case`);
        assert.ok(!seenSlugs.has(item.slug), `Duplicate material slug found: ${item.slug}`);
        seenSlugs.add(item.slug);

        // Required text fields
        assert.ok(item.title && item.title.trim() !== "", `Material ${item.id} must have a title`);
        assert.ok(item.description && item.description.trim() !== "", `Material ${item.id} must have description`);
        assert.strictEqual(item.type, "TÀI LIỆU");

        // Canonical Subject & Category & Theme
        assert.ok(
          CATEGORIES.includes(item.category as any),
          `Material ${item.id} category "${item.category}" must be canonical`
        );
        assert.ok(
          COLOR_THEMES.includes(item.colorTheme),
          `Material ${item.id} colorTheme "${item.colorTheme}" must be canonical`
        );

        const canonicalSubject = findSubjectByName(item.subject);
        assert.ok(
          canonicalSubject !== undefined,
          `Material ${item.id} subject "${item.subject}" must exist in CANONICAL_SUBJECTS`
        );

        // Numbers & Ranges
        assert.ok(item.pages > 0 && Number.isInteger(item.pages), `Material ${item.id} pages must be a positive integer`);
        assert.ok(
          item.rating >= 1.0 && item.rating <= 5.0,
          `Material ${item.id} rating ${item.rating} must be between 1.0 and 5.0`
        );

        // UI Price Format
        assert.match(item.price, /^\d{1,3}(?:\.\d{3})*đ$/, `Material ${item.id} price format invalid: ${item.price}`);
        if (item.oldPrice) {
          assert.match(item.oldPrice, /^\d{1,3}(?:\.\d{3})*đ$/, `Material ${item.id} oldPrice format invalid: ${item.oldPrice}`);
        }
      }
    });
  });

  describe("Courses Catalog", () => {
    test("every course has required valid fields and valid enrollment status", () => {
      assert.ok(courses.length > 0, "Courses must not be empty");

      const seenIds = new Set<string>();
      const seenSlugs = new Set<string>();

      for (const item of courses) {
        // Unique ID & Slug
        assert.ok(item.id && item.id.trim() !== "", "Course must have a non-empty id");
        assert.ok(!seenIds.has(item.id), `Duplicate course id found: ${item.id}`);
        seenIds.add(item.id);

        assert.ok(item.slug && item.slug.trim() !== "", `Course ${item.id} must have a non-empty slug`);
        assert.ok(isValidSlug(item.slug), `Course slug "${item.slug}" must be valid kebab-case`);
        assert.ok(!seenSlugs.has(item.slug), `Duplicate course slug found: ${item.slug}`);
        seenSlugs.add(item.slug);

        // Required text fields
        assert.ok(item.title && item.title.trim() !== "", `Course ${item.id} must have a title`);
        assert.ok(item.description && item.description.trim() !== "", `Course ${item.id} must have description`);
        assert.ok(item.mentor && item.mentor.trim() !== "", `Course ${item.id} must have mentor info`);

        // Canonical Subject & Category & Theme
        assert.ok(
          CATEGORIES.includes(item.category as any),
          `Course ${item.id} category "${item.category}" must be canonical`
        );
        assert.ok(
          COLOR_THEMES.includes(item.colorTheme),
          `Course ${item.id} colorTheme "${item.colorTheme}" must be canonical`
        );

        const canonicalSubject = findSubjectByName(item.subject);
        assert.ok(
          canonicalSubject !== undefined,
          `Course ${item.id} subject "${item.subject}" must exist in CANONICAL_SUBJECTS`
        );

        // Status & Format
        assert.ok(
          (ENROLLMENT_STATUSES as readonly string[]).includes(item.status),
          `Course ${item.id} status "${item.status}" must be one of ${ENROLLMENT_STATUSES.join(", ")}`
        );
        assert.ok(
          ["online", "offline", "video", "zoom"].includes(item.format),
          `Course ${item.id} format "${item.format}" is invalid`
        );

        // Numbers & Ranges
        assert.ok(item.sessions > 0 && Number.isInteger(item.sessions), `Course ${item.id} sessions must be positive integer`);
        assert.ok(
          item.rating >= 1.0 && item.rating <= 5.0,
          `Course ${item.id} rating ${item.rating} must be between 1.0 and 5.0`
        );

        // UI Price Format
        assert.match(item.price, /^\d{1,3}(?:\.\d{3})*đ$/, `Course ${item.id} price format invalid: ${item.price}`);
        if (item.oldPrice) {
          assert.match(item.oldPrice, /^\d{1,3}(?:\.\d{3})*đ$/, `Course ${item.id} oldPrice format invalid: ${item.oldPrice}`);
        }
      }
    });
  });

  describe("Tutors Catalog", () => {
    test("every tutor has required valid fields, formats, and subjects", () => {
      assert.ok(tutors.length > 0, "Tutors must not be empty");

      const seenIds = new Set<string>();
      const seenSlugs = new Set<string>();

      for (const item of tutors) {
        // Unique ID & Slug
        assert.ok(item.id && item.id.trim() !== "", "Tutor must have a non-empty id");
        assert.ok(!seenIds.has(item.id), `Duplicate tutor id found: ${item.id}`);
        seenIds.add(item.id);

        assert.ok(item.slug && item.slug.trim() !== "", `Tutor ${item.id} must have a non-empty slug`);
        assert.ok(isValidSlug(item.slug), `Tutor slug "${item.slug}" must be valid kebab-case`);
        assert.ok(!seenSlugs.has(item.slug), `Duplicate tutor slug found: ${item.slug}`);
        seenSlugs.add(item.slug);

        // Name and bio
        assert.ok(item.name && item.name.trim() !== "", `Tutor ${item.id} must have a name`);
        assert.ok(item.shortBio && item.shortBio.trim() !== "", `Tutor ${item.id} must have shortBio`);

        // Canonical Themes & Subjects
        assert.ok(
          COLOR_THEMES.includes(item.colorTheme),
          `Tutor ${item.id} colorTheme "${item.colorTheme}" must be canonical`
        );
        assert.ok(item.subjects.length > 0, `Tutor ${item.id} must teach at least one subject`);
        for (const subj of item.subjects) {
          const canonical = findSubjectByName(subj);
          assert.ok(
            canonical !== undefined,
            `Tutor ${item.id} subject "${subj}" must resolve to a canonical subject`
          );
        }

        // Numbers & Ranges
        assert.ok(
          item.rating >= 1.0 && item.rating <= 5.0,
          `Tutor ${item.id} rating ${item.rating} must be between 1.0 and 5.0`
        );

        // Price format e.g. "120.000đ / giờ"
        assert.match(
          item.price,
          /^\d{1,3}(?:\.\d{3})*đ\s*\/\s*giờ$/,
          `Tutor ${item.id} price format invalid: ${item.price}`
        );

        // Format belongs to canonical TUTOR_FORMATS union
        assert.ok(
          (TUTOR_FORMATS as readonly string[]).includes(item.format),
          `Tutor ${item.id} format "${item.format}" must be one of ${TUTOR_FORMATS.join(", ")}`
        );
      }
    });
  });
});

