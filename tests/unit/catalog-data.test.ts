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

  describe("SQL Schema & Migration Integrity", () => {
    test("every application table in 0001_core_schema.sql enables row level security", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      const schemaPath = path.resolve(process.cwd(), "supabase/migrations/0001_core_schema.sql");
      const schemaContent = await fs.readFile(schemaPath, "utf-8");

      const expectedTables = [
        "profiles",
        "subjects",
        "products",
        "materials",
        "courses",
        "course_lessons",
        "tutors",
        "tutor_subjects"
      ];

      for (const table of expectedTables) {
        const rlsPattern = new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, "i");
        assert.ok(
          rlsPattern.test(schemaContent),
          `Table "${table}" must have an ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; statement`
        );
      }
    });

    test("profiles table references auth.users(id) with ON DELETE CASCADE", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      const schemaPath = path.resolve(process.cwd(), "supabase/migrations/0001_core_schema.sql");
      const schemaContent = await fs.readFile(schemaPath, "utf-8");

      assert.ok(
        /id\s+UUID\s+PRIMARY\s+KEY\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(schemaContent),
        "profiles.id must reference auth.users(id) ON DELETE CASCADE"
      );
    });

    test("0002_public_catalog_read_policies.sql defines valid SELECT policies with publication_status checks", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      const policyPath = path.resolve(process.cwd(), "supabase/migrations/0002_public_catalog_read_policies.sql");
      const policyContent = await fs.readFile(policyPath, "utf-8");

      // Verify policy exists for each catalog table
      const catalogTables = [
        "subjects",
        "products",
        "materials",
        "courses",
        "course_lessons",
        "tutors",
        "tutor_subjects"
      ];

      for (const table of catalogTables) {
        const policyPattern = new RegExp(`CREATE\\s+POLICY\\s+["'][^"']+["']\\s+ON\\s+${table}\\s+FOR\\s+SELECT\\s+TO\\s+anon,\\s*authenticated`, "i");
        assert.ok(
          policyPattern.test(policyContent),
          `Table "${table}" must have a SELECT policy for anon and authenticated users`
        );
      }

      // Verify no mutation policies (INSERT, UPDATE, DELETE)
      assert.ok(!/FOR\s+(INSERT|UPDATE|DELETE)/i.test(policyContent), "Policy file must not grant write/mutation permissions");

      // Verify published condition is enforced for products and dependent tables
      assert.ok(
        /ON\s+products[\s\S]*?USING\s*\(\s*publication_status\s*=\s*'published'\s*\)/i.test(policyContent),
        "products policy must enforce publication_status = 'published'"
      );
      assert.ok(
        /ON\s+materials[\s\S]*?publication_status\s*=\s*'published'/i.test(policyContent),
        "materials policy must check parent product publication_status"
      );
      assert.ok(
        /ON\s+courses[\s\S]*?publication_status\s*=\s*'published'/i.test(policyContent),
        "courses policy must check parent product publication_status"
      );
      assert.ok(
        /ON\s+course_lessons[\s\S]*?publication_status\s*=\s*'published'/i.test(policyContent),
        "course_lessons policy must check parent course product publication_status"
      );
      assert.ok(
        /ON\s+tutors[\s\S]*?publication_status\s*=\s*'published'/i.test(policyContent),
        "tutors policy must check parent product publication_status"
      );
      assert.ok(
        /ON\s+tutor_subjects[\s\S]*?publication_status\s*=\s*'published'/i.test(policyContent),
        "tutor_subjects policy must check parent tutor product publication_status"
      );
    });

    test("database.types.ts has valid UTF-8 encoding without mojibake characters", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      const typesPath = path.resolve(process.cwd(), "lib/supabase/database.types.ts");
      const typesContent = await fs.readFile(typesPath, "utf-8");

      // Mojibake marker characters commonly introduced by CP1252/Windows-1252 double-encoding
      const mojibakeMarkers = ["ß", "├", "╗", "┬", "Ã", "Â", "â"];
      for (const marker of mojibakeMarkers) {
        assert.ok(
          !typesContent.includes(marker),
          `database.types.ts must not contain mojibake marker "${marker}"`
        );
      }

      // Verify exact canonical Vietnamese category enum values are present
      const expectedCategories = [
        "Kế toán",
        "Kinh tế",
        "Thống kê",
        "Marketing",
        "Quản trị",
        "Tài chính",
        "MIS",
        "Luật",
        "Ngoại ngữ"
      ];

      for (const cat of expectedCategories) {
        assert.ok(
          typesContent.includes(`"${cat}"`),
          `database.types.ts must contain exact UTF-8 category "${cat}"`
        );
      }
    });
  });

  describe("SQL Seed Integrity", () => {
    test("every v_sub_* variable referenced in supabase/seed.sql is declared and loaded", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");

      const seedPath = path.resolve(process.cwd(), "supabase/seed.sql");
      const seedContent = await fs.readFile(seedPath, "utf-8");

      // Extract all DO $$ ... END $$; blocks
      const doBlocks = seedContent.match(/DO \$\$[\s\S]*?END \$\$;/g) || [];
      assert.ok(doBlocks.length > 0, "seed.sql must contain at least one DO block");

      for (const block of doBlocks) {
        // Find DECLARE section
        const declareMatch = block.match(/DECLARE([\s\S]*?)BEGIN/);
        assert.ok(declareMatch, "DO block must have a DECLARE section");
        const declareSection = declareMatch[1];

        const declaredVars = new Set<string>();
        for (const line of declareSection.split("\n")) {
          const varMatch = line.trim().match(/^(v_[a-zA-Z0-9_]+)\s+UUID;/);
          if (varMatch) {
            declaredVars.add(varMatch[1]);
          }
        }

        // Find BEGIN...END section
        const bodyMatch = block.match(/BEGIN([\s\S]*?)END \$\$;/);
        assert.ok(bodyMatch, "DO block must have a BEGIN body");
        const bodySection = bodyMatch[1];

        // Find all v_sub_* usages in the body
        const usedVars = new Set<string>(bodySection.match(/\bv_sub_[a-zA-Z0-9_]+\b/g) || []);

        for (const usedVar of usedVars) {
          assert.ok(
            declaredVars.has(usedVar),
            `Variable ${usedVar} is used in seed body but not declared in DECLARE block`
          );

          // Verify it is assigned via SELECT ... INTO
          const selectPattern = new RegExp(`SELECT\\s+id\\s+INTO\\s+${usedVar}\\s+FROM\\s+subjects`, "i");
          assert.ok(
            selectPattern.test(bodySection),
            `Variable ${usedVar} is declared but not loaded via SELECT id INTO ${usedVar} FROM subjects`
          );
        }
      }
    });
  });
});

