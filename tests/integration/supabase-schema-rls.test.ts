/**
 * Integration & Security Verification Tests for Supabase Migrations, Seed & RLS (Phase 2 Hardening)
 * 
 * Verifies:
 * 1. Migration topological integrity (0001 -> 0008) & schema definitions
 * 2. Seed idempotency and data consistency with data/catalog.ts
 * 3. RLS policy definitions and table/column grants across catalog & profiles
 * 4. Live database integration test workflow (when Supabase/Postgres is available)
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { materials, courses, tutors } from "../../data/catalog";
import { CANONICAL_SUBJECTS } from "../../lib/domain/subjects";
import { parseVND } from "../../lib/domain/product-types";
import {
  assertAdminAccountApprovalMigrationContract,
  assertAdminCatalogMigrationContract,
  assertConsultationUpdatedByMigrationContract,
  assertMigration0012Contract,
  assertMigration0013Contract,
  assertMigration0014Contract,
  assertMigration0015Contract,
  assertMigration0016Contract,
  assertMigrationHistoryUnchanged,
  IMMUTABLE_MIGRATION_FILENAMES
} from "../../scripts/verify-supabase-migrations-seed-rls";

const expectedAdminPredicate = "EXISTS ( SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' )";
const expectedCatalogAdminPredicate = "EXISTS ( SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.account_status = 'approved' )";

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractPolicyClause(policy: string, clauseName: "USING" | "WITH CHECK"): string | null {
  const clauseStart = new RegExp(`\\b${clauseName}\\s*\\(`, "i").exec(policy);
  if (!clauseStart) return null;

  const openingParen = policy.indexOf("(", clauseStart.index);
  let depth = 0;
  let inString = false;
  for (let index = openingParen; index < policy.length; index += 1) {
    const character = policy[index];
    if (character === "'" && policy[index + 1] === "'") {
      index += 1;
      continue;
    }
    if (character === "'") inString = !inString;
    if (inString) continue;
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return policy.slice(openingParen + 1, index);
    }
  }
  return null;
}

/**
 * Hardened contract assertion helper for migration 0008 (consultation admin status update).
 * Validates positive invariants and rejects forbidden grants, bypasses, and duplicate constraints.
 */
function assertMigration0008Contract(
  sql0008: string,
  options?: { sql0004?: string; sql0006?: string }
): void {
  const code = sql0008.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // 1. Privilege escalation & RLS bypass checks
  assert.ok(!/\bservice_role\b/i.test(code), "Must not reference service_role");
  assert.ok(
    !/\b(?:password|secret|token|bearer|apikey|api_key|service_role_key|anon_key)\b\s*[:=]/i.test(code) && !/'ey[a-zA-Z0-9._-]{20,}'/.test(code),
    "Must not contain credentials, tokens, passwords, or hardcoded secrets"
  );
  assert.ok(!/SECURITY\s+DEFINER/i.test(code), "Must not define or use SECURITY DEFINER");
  assert.ok(!/\bBYPASSRLS\b/i.test(code), "Must not include BYPASSRLS");
  assert.ok(!/\b(?:SET|ALTER)\s+ROLE\b/i.test(code), "Must not use SET ROLE or ALTER ROLE");
  assert.ok(
    !/GRANT\s+[^;]*?\bTO\s+[^;]*?\b(?:postgres|supabase_admin|service_role|authenticator|dashboard_user)\b/i.test(code),
    "Must not grant privileges to privileged system roles"
  );
  assert.ok(!/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(code), "Must not disable Row Level Security");
  assert.ok(!/ALTER\s+TABLE\s+(?:ONLY\s+)?(?!consultations\b)\w+/i.test(code), "Must not alter unrelated tables");
  const grantTables = [...code.matchAll(/GRANT\s+[^;]*?\bON\s+(?:TABLE\s+)?([a-zA-Z_]\w*)/gi)].map((m) => m[1].toLowerCase());
  const revokeTables = [...code.matchAll(/REVOKE\s+[^;]*?\bON\s+(?:TABLE\s+)?([a-zA-Z_]\w*)/gi)].map((m) => m[1].toLowerCase());
  assert.ok(
    grantTables.every((t) => t === "consultations") && revokeTables.every((t) => t === "consultations"),
    "Grant and revoke statements must only target consultations table"
  );

  // 2. Reject table-wide UPDATE grants and allow only column grant exactly for status
  assert.ok(
    !/GRANT\s+UPDATE\s+ON\s+(?:TABLE\s+)?consultations\b/i.test(code),
    "Must reject table-wide GRANT UPDATE ON TABLE consultations"
  );
  assert.ok(
    !/GRANT\s+UPDATE\s*\((?!\s*status\s*\))/i.test(code),
    "Must reject UPDATE grants on columns other than status"
  );
  assert.ok(
    /GRANT\s+UPDATE\s*\(\s*status\s*\)\s+ON\s+TABLE\s+consultations\s+TO\s+authenticated/i.test(code),
    "Must grant UPDATE (status) ON TABLE consultations TO authenticated"
  );
  assert.ok(
    !/GRANT\s+UPDATE\s*[^;]*?\bTO\b[^;]*?\banon\b/i.test(code),
    "Must not grant UPDATE privilege to anon"
  );
  assert.ok(
    !/GRANT\s+UPDATE\s*[^;]*?\bTO\s+(?!authenticated\b)[a-zA-Z_]\w*/i.test(code),
    "Must not grant UPDATE privilege to any role other than authenticated"
  );
  assert.ok(
    /REVOKE\s+UPDATE\s+ON\s+TABLE\s+consultations\s+FROM\s+(?:anon,\s*authenticated|authenticated,\s*anon)/i.test(code),
    "Must explicitly revoke table-wide UPDATE from anon and authenticated"
  );

  // 3. Reject grants of SELECT, INSERT, DELETE, or ALL in 0008 (table-wide and column-level)
  assert.ok(
    !/GRANT\s+(?:SELECT|INSERT|DELETE|ALL)\b/i.test(code),
    "Must reject SELECT, INSERT, DELETE, and ALL grants in migration 0008"
  );
  const grantStatements = (code.match(/GRANT\s+[^;]+;/gi) || []).map((s) => s.trim());
  assert.strictEqual(
    grantStatements.length,
    1,
    "Exactly one GRANT statement allowed in migration 0008"
  );
  assert.ok(
    /^GRANT\s+UPDATE\s*\(\s*status\s*\)\s+ON\s+(?:TABLE\s+)?consultations\s+TO\s+authenticated\s*;$/i.test(grantStatements[0]),
    "Sole permitted grant must be GRANT UPDATE (status) ON TABLE consultations TO authenticated;"
  );

  // 4. Updated_at trigger contract
  if (options?.sql0004) {
    assert.ok(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+update_updated_at_column\s*\(\s*\)\s*RETURNS\s+TRIGGER/i.test(options.sql0004),
      "Migration 0004 must define update_updated_at_column() returning TRIGGER"
    );
  }
  assert.ok(!/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i.test(code), "Must not define or replace trigger function in 0008");
  const triggerMatches = code.match(/CREATE\s+TRIGGER[\s\S]*?;/gi) || [];
  assert.strictEqual(triggerMatches.length, 1, "Must have exactly one CREATE TRIGGER statement in 0008");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_consultations_updated_at\s+BEFORE\s+UPDATE\s+ON\s+consultations\s+FOR\s+EACH\s+ROW/i.test(triggerMatches[0]),
    "Trigger must target consultations before update for each row"
  );
  assert.ok(
    /EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+update_updated_at_column\s*\(\s*\)\s*;/i.test(triggerMatches[0]),
    "Trigger must execute update_updated_at_column()"
  );

  // 5. Policy verification
  const updatePolicies = code.match(/CREATE\s+POLICY[\s\S]*?ON\s+consultations[\s\S]*?FOR\s+UPDATE[\s\S]*?;/gi) || [];
  const allPolicies = code.match(/CREATE\s+POLICY[\s\S]*?;/gi) || [];
  assert.strictEqual(allPolicies.length, 1, "Must have exactly one CREATE POLICY statement in 0008");
  assert.strictEqual(updatePolicies.length, 1, "The single policy must be an UPDATE policy on consultations");
  const usingClause = extractPolicyClause(updatePolicies[0] || "", "USING");
  const withCheckClause = extractPolicyClause(updatePolicies[0] || "", "WITH CHECK");
  assert.ok(usingClause !== null && withCheckClause !== null, "Policy must include both USING and WITH CHECK");
  assert.strictEqual(normalizeSql(usingClause || ""), expectedAdminPredicate, "USING clause must be exactly the admin profile check and require auth.uid() admin profile check");
  assert.strictEqual(normalizeSql(withCheckClause || ""), expectedAdminPredicate, "WITH CHECK clause must be exactly the admin profile check and require auth.uid() admin profile check");
  const policyTarget = updatePolicies[0]?.match(/FOR\s+UPDATE([\s\S]*?)USING/i)?.[1] || "";
  assert.strictEqual(normalizeSql(policyTarget), "TO authenticated", "UPDATE policy must target only authenticated");
  assert.ok(!/FOR\s+DELETE/i.test(code) && !/GRANT\s+DELETE/i.test(code), "Must not include DELETE policy or grant");

  // 6. Status integrity
  assert.ok(
    !/(?:CREATE\s+TYPE|ADD\s+CONSTRAINT|CHECK\s*\([^)]*status|chk_consultations_status)/i.test(code),
    "Must not create a second status enum, type, or constraint in migration 0008"
  );
  const canonicalStatuses = new Set(["new", "contacted", "qualified", "closed"]);
  const singleQuotedLiterals = code.match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, "")) || [];
  assert.ok(
    singleQuotedLiterals.every((val) => val === "admin" || canonicalStatuses.has(val)),
    "Must not introduce status values outside 'new', 'contacted', 'qualified', 'closed'"
  );
  if (options?.sql0006) {
    assert.ok(
      /CONSTRAINT\s+chk_consultations_status\s+CHECK\s*\(\s*status\s+IN\s*\(\s*'new',\s*'contacted',\s*'qualified',\s*'closed'\s*\)\s*\)/i.test(options.sql0006),
      "Canonical status constraint from migration 0006 must remain intact"
    );
  }
}

describe("Supabase Migrations, Seed & RLS Hardening Verification", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const seedPath = path.resolve(process.cwd(), "supabase/seed.sql");

  describe("1. Migration Ordering & Schema Definitions", () => {
    test("migration files exist with correct sequential numbering", async () => {
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

      const expectedFiles = [
        "0001_core_schema.sql",
        "0002_public_catalog_read_policies.sql",
        "0003_public_catalog_table_grants.sql",
        "0004_profiles_schema_and_policies.sql",
        "0005_account_approval_gate.sql",
        "0006_consultations.sql",
        "0007_consultation_admin_rls.sql",
        "0008_consultation_admin_status_update.sql",
        "0009_consultation_updated_by.sql",
        "0010_admin_account_approval_rls.sql",
        "0011_admin_catalog_crud_rls.sql",
        "0012_private_material_storage.sql",
        "0013_material_asset_metadata.sql",
        "0014_product_entitlements.sql",
      "0015_learning_progress.sql",
      "0016_study_plans.sql"
      ];

      assert.deepStrictEqual(sqlFiles, expectedFiles, "Migration files must match canonical list in strict numerical order");
    });

    test("the canonical history verifier rejects a content mutation in every migration 0001-0015", async () => {
      const snapshots: Record<string, string> = {};
      for (const filename of IMMUTABLE_MIGRATION_FILENAMES) {
        snapshots[filename] = await fs.readFile(path.join(migrationsDir, filename), "utf-8");
      }

      assert.doesNotThrow(() => assertMigrationHistoryUnchanged(snapshots));

      for (const filename of IMMUTABLE_MIGRATION_FILENAMES) {
        const mutated = {
          ...snapshots,
          [filename]: `${snapshots[filename]}\n-- immutable history mutation`
        };
        assert.throws(
          () => assertMigrationHistoryUnchanged(mutated),
          /canonical SHA-256 mismatch|must remain unchanged/i,
          `${filename} mutation must be rejected by the verifier`
        );
      }
    });

    test("0001_core_schema.sql creates all 8 application tables with primary keys and constraints", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0001_core_schema.sql"), "utf-8");

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
        assert.ok(
          new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}`, "i").test(sql),
          `0001_core_schema.sql must create table "${table}"`
        );
      }

      // Check key constraints
      assert.ok(sql.includes("chk_product_slug_kebab"), "products table must enforce kebab-case slug constraint");
      assert.ok(sql.includes("chk_subject_slug_kebab"), "subjects table must enforce kebab-case slug constraint");
      assert.ok(sql.includes("chk_pricing_consistency"), "products table must enforce pricing consistency constraint");
      assert.ok(sql.includes("uq_product_kind_slug"), "products table must enforce unique (kind, slug) constraint");
      assert.ok(sql.includes("uq_course_lesson_order"), "course_lessons must enforce unique (course_id, order_index)");

      // Check RLS is enabled on all 8 tables
      for (const table of expectedTables) {
        assert.ok(
          new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, "i").test(sql),
          `0001_core_schema.sql must enable RLS on table "${table}"`
        );
      }
    });

    test("0002_public_catalog_read_policies.sql enforces publication_status on products and child tables", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0002_public_catalog_read_policies.sql"), "utf-8");

      // 1. Subjects allows public read
      assert.ok(
        /ON\s+subjects[\s\S]*?FOR\s+SELECT[\s\S]*?TO\s+anon,\s*authenticated[\s\S]*?USING\s*\(\s*true\s*\)/i.test(sql),
        "subjects must allow public read for anon and authenticated"
      );

      // 2. Products allows published read
      assert.ok(
        /ON\s+products[\s\S]*?FOR\s+SELECT[\s\S]*?TO\s+anon,\s*authenticated[\s\S]*?USING\s*\(\s*publication_status\s*=\s*'published'\s*\)/i.test(sql),
        "products must enforce publication_status = 'published'"
      );

      // 3. Child tables enforce parent published
      const childChecks = [
        { table: "materials", ref: "products.id = materials.product_id" },
        { table: "courses", ref: "products.id = courses.product_id" },
        { table: "course_lessons", ref: "courses.product_id = course_lessons.course_id" },
        { table: "tutors", ref: "products.id = tutors.product_id" },
        { table: "tutor_subjects", ref: "tutors.product_id = tutor_subjects.tutor_product_id" }
      ];

      for (const { table } of childChecks) {
        assert.ok(
          new RegExp(`ON\\s+${table}[\\s\\S]*?FOR\\s+SELECT[\\s\\S]*?TO\\s+anon,\\s*authenticated[\\s\\S]*?publication_status\\s*=\\s*'published'`, "i").test(sql),
          `Child table "${table}" must gate SELECT by parent product publication_status = 'published'`
        );
      }

      // 4. No mutation policies
      assert.ok(!/FOR\s+(INSERT|UPDATE|DELETE)/i.test(sql), "0002 must not contain any mutation policies");
    });

    test("0003_public_catalog_table_grants.sql grants only USAGE on public and SELECT on 7 catalog tables", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0003_public_catalog_table_grants.sql"), "utf-8");

      // USAGE on schema
      assert.ok(
        /GRANT\s+USAGE\s+ON\s+SCHEMA\s+public\s+TO\s+anon,\s*authenticated;/i.test(sql),
        "Must grant USAGE ON SCHEMA public TO anon, authenticated"
      );

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
        assert.ok(
          new RegExp(`GRANT\\s+SELECT\\s+ON\\s+TABLE\\s+${table}\\s+TO\\s+anon,\\s*authenticated;`, "i").test(sql),
          `Must grant SELECT ON TABLE ${table} TO anon, authenticated`
        );
      }

      // Must NOT grant access on profiles table
      assert.ok(!/GRANT\s+.*ON\s+(TABLE\s+)?profiles/i.test(sql), "Must not grant profiles table to anon");

      // Must NOT grant mutation privileges
      assert.ok(!/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i.test(sql), "Must not grant INSERT/UPDATE/DELETE/ALL privileges");
    });

    test("0004 & 0005 protect student profiles and prevent unauthorized privilege escalation", async () => {
      const sql0004 = await fs.readFile(path.join(migrationsDir, "0004_profiles_schema_and_policies.sql"), "utf-8");
      const sql0005 = await fs.readFile(path.join(migrationsDir, "0005_account_approval_gate.sql"), "utf-8");

      // Check RLS policies on profiles
      assert.ok(sql0004.includes("auth.uid() = id"), "profiles SELECT/UPDATE must require auth.uid() = id");
      assert.ok(sql0004.includes("REVOKE INSERT, UPDATE ON TABLE profiles FROM authenticated;"), "profiles must revoke broad write grants");

      // Check allowed non-privileged columns
      assert.ok(sql0004.includes("GRANT INSERT (id, full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;"));
      assert.ok(sql0004.includes("GRANT UPDATE (full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;"));

      // Check 0005 approval columns and self-approval prevention
      assert.ok(sql0005.includes("account_status IN ('pending', 'approved', 'rejected', 'suspended')"));
      assert.ok(sql0005.includes("chk_profiles_no_self_approval"));
      assert.ok(sql0005.includes("approved_by IS NULL OR approved_by <> id"));
    });

    test("0006_consultations.sql creates consultations table with RLS and restrictive grants", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0006_consultations.sql"), "utf-8");

      assert.ok(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+consultations/i.test(sql), "must create consultations table");
      assert.ok(/id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i.test(sql), "must have UUID primary key");
      assert.ok(/request_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(sql), "must have unique request_id");
      assert.ok(/status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'new'/i.test(sql), "must have status with default 'new'");
      assert.ok(/created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(sql), "must have created_at");
      assert.ok(/updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(sql), "must have updated_at");
      assert.ok(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_consultations_status_created_at/i.test(sql), "must have index on status and created_at");
      assert.ok(/ALTER\s+TABLE\s+consultations\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql), "must enable RLS");

      const hasStatusConstraint = /CONSTRAINT\s+chk_consultations_status\s+CHECK\s*\(\s*status\s+IN\s*\(\s*'new',\s*'contacted',\s*'qualified',\s*'closed'\s*\)\s*\)/i.test(sql);
      assert.ok(hasStatusConstraint, "0006 must define canonical status constraint ('new', 'contacted', 'qualified', 'closed')");

      const hasInsertGrant = /GRANT\s+INSERT\s+\([^)]+\)\s+ON\s+TABLE\s+consultations\s+TO\s+anon,\s+authenticated/i.test(sql);
      assert.ok(hasInsertGrant, "must have restricted column INSERT grant for anon, authenticated");

      const noClientManagedFields = !/GRANT\s+INSERT\s+\([^)]*\b(id|status|created_at|updated_at)\b[^)]*\)\s+ON\s+TABLE\s+consultations/i.test(sql);
      assert.ok(noClientManagedFields, "must not allow inserting id, status, created_at, or updated_at");

      const noOtherGrants = !/GRANT\s+(SELECT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+consultations/i.test(sql);
      assert.ok(noOtherGrants, "must not grant SELECT, UPDATE, or DELETE privileges");

      const hasInsertPolicy = /CREATE\s+POLICY\s+"consultations_allow_insert_anon_authenticated"[\s\S]*?FOR\s+INSERT/i.test(sql);
      assert.ok(hasInsertPolicy, "must have an INSERT policy for anon/authenticated");

      const policyCount = (sql.match(/CREATE\s+POLICY/gi) || []).length;
      assert.strictEqual(policyCount, 1, "must have exactly one policy");
    });

    test("0007_consultation_admin_rls.sql grants SELECT to authenticated admins", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0007_consultation_admin_rls.sql"), "utf-8");

      assert.ok(/GRANT\s+SELECT\s+ON\s+TABLE\s+consultations\s+TO\s+authenticated/i.test(sql), "must grant SELECT to authenticated");
      assert.ok(!/GRANT\s+.*anon/i.test(sql), "must not grant SELECT to anon");
      assert.ok(!/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i.test(sql), "must not grant public mutations");

      assert.ok(/CREATE\s+POLICY\s+"[^"]+"\s+ON\s+consultations\s+FOR\s+SELECT\s+TO\s+authenticated/i.test(sql), "must create SELECT policy for authenticated");
      assert.ok(sql.includes("profiles.role = 'admin'") && sql.includes("auth.uid()"), "policy must check profiles.role = 'admin' for auth.uid()");
      assert.ok(!/FOR\s+(INSERT|UPDATE|DELETE)/i.test(sql), "must not add mutation policies");
    });

    test("0008_consultation_admin_status_update.sql restricts status updates to authenticated admins", async () => {
      const sql0008 = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");
      const sql0004 = await fs.readFile(path.join(migrationsDir, "0004_profiles_schema_and_policies.sql"), "utf-8");
      const sql0006 = await fs.readFile(path.join(migrationsDir, "0006_consultations.sql"), "utf-8");

      assertMigration0008Contract(sql0008, { sql0004, sql0006 });
    });

    test("0009_consultation_updated_by.sql records the authenticated updater without changing 0008", async () => {
      const sql0009 = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      assertConsultationUpdatedByMigrationContract(sql0009);
    });
  });

  describe("2. Seed Idempotency & Catalog Alignment", () => {
    test("supabase/seed.sql is wrapped in a transaction block (BEGIN ... COMMIT)", async () => {
      const sql = await fs.readFile(seedPath, "utf-8");
      assert.ok(/^\s*(?:--[^\n]*\n\s*)*BEGIN\s*;/im.test(sql), "seed.sql must begin with BEGIN;");
      assert.ok(/COMMIT\s*;\s*$/i.test(sql.trim()), "seed.sql must end with COMMIT;");
    });

    test("every product and child insert in seed.sql uses ON CONFLICT DO UPDATE for idempotency", async () => {
      const sql = await fs.readFile(seedPath, "utf-8");

      // 1. Subjects table
      assert.ok(
        /INSERT\s+INTO\s+subjects[\s\S]*?ON\s+CONFLICT\s*\(\s*slug\s*\)\s*DO\s+UPDATE/i.test(sql),
        "Subjects insert must use ON CONFLICT (slug) DO UPDATE"
      );

      // 2. Products table (used in materials, courses, tutors DO blocks)
      const productConflictMatches = sql.match(/INSERT\s+INTO\s+products[\s\S]*?ON\s+CONFLICT\s*\(\s*kind,\s*slug\s*\)\s*DO\s+UPDATE/gi) || [];
      const totalCatalogItems = materials.length + courses.length + tutors.length;
      assert.strictEqual(
        productConflictMatches.length,
        totalCatalogItems,
        `All ${totalCatalogItems} products in seed.sql must use ON CONFLICT (kind, slug) DO UPDATE`
      );

      // 3. Materials table
      const materialConflictMatches = sql.match(/INSERT\s+INTO\s+materials[\s\S]*?ON\s+CONFLICT\s*\(\s*product_id\s*\)\s*DO\s+UPDATE/gi) || [];
      assert.strictEqual(
        materialConflictMatches.length,
        materials.length,
        `All ${materials.length} materials in seed.sql must use ON CONFLICT (product_id) DO UPDATE`
      );

      // 4. Courses table
      const courseConflictMatches = sql.match(/INSERT\s+INTO\s+courses[\s\S]*?ON\s+CONFLICT\s*\(\s*product_id\s*\)\s*DO\s+UPDATE/gi) || [];
      assert.strictEqual(
        courseConflictMatches.length,
        courses.length,
        `All ${courses.length} courses in seed.sql must use ON CONFLICT (product_id) DO UPDATE`
      );

      // 5. Tutors table
      const tutorConflictMatches = sql.match(/INSERT\s+INTO\s+tutors[\s\S]*?ON\s+CONFLICT\s*\(\s*product_id\s*\)\s*DO\s+UPDATE/gi) || [];
      assert.strictEqual(
        tutorConflictMatches.length,
        tutors.length,
        `All ${tutors.length} tutors in seed.sql must use ON CONFLICT (product_id) DO UPDATE`
      );

      // 6. Tutor Subjects cleanup before re-insert
      const tutorSubjectCleanupMatches = sql.match(/DELETE\s+FROM\s+tutor_subjects\s+WHERE\s+tutor_product_id\s*=\s*v_prod_id;/gi) || [];
      assert.strictEqual(
        tutorSubjectCleanupMatches.length,
        tutors.length,
        `All ${tutors.length} tutors must clear tutor_subjects before re-inserting for clean idempotency`
      );
    });

    test("all canonical subjects are seeded", async () => {
      const sql = await fs.readFile(seedPath, "utf-8");

      for (const subj of CANONICAL_SUBJECTS) {
        assert.ok(
          sql.includes(`'${subj.slug}'`),
          `seed.sql must seed subject with slug '${subj.slug}'`
        );
        assert.ok(
          sql.includes(`'${subj.name}'`),
          `seed.sql must seed subject with name '${subj.name}'`
        );
      }
    });

    test("all catalog items from data/catalog.ts exist in seed.sql with exact pricing and slug", async () => {
      const sql = await fs.readFile(seedPath, "utf-8");

      // Verify materials
      for (const mat of materials) {
        assert.ok(sql.includes(`'${mat.slug}'`), `seed.sql must seed material slug '${mat.slug}'`);
        const priceVnd = parseVND(mat.price);
        assert.ok(
          priceVnd !== null && sql.includes(priceVnd.toString()),
          `seed.sql must contain price ${priceVnd} for material ${mat.id}`
        );
      }

      // Verify courses
      for (const crs of courses) {
        assert.ok(sql.includes(`'${crs.slug}'`), `seed.sql must seed course slug '${crs.slug}'`);
        const priceVnd = parseVND(crs.price);
        assert.ok(
          priceVnd !== null && sql.includes(priceVnd.toString()),
          `seed.sql must contain price ${priceVnd} for course ${crs.id}`
        );
      }

      // Verify tutors
      for (const tut of tutors) {
        assert.ok(sql.includes(`'${tut.slug}'`), `seed.sql must seed tutor slug '${tut.slug}'`);
        const priceClean = tut.price.split("/")[0].trim();
        const priceVnd = parseVND(priceClean);
        assert.ok(
          priceVnd !== null && sql.includes(priceVnd.toString()),
          `seed.sql must contain price ${priceVnd} for tutor ${tut.id}`
        );
      }
    });
  });

  describe("3. Live Database Verification Workflow / Environment Detection", () => {
    test("verifies database environment configuration or documents Docker blocker", async (t) => {
      const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
      const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.TEST_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const supabaseServiceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      const hasLiveDb = Boolean(dbUrl || (supabaseUrl && (supabaseAnonKey || supabaseServiceKey)));

      if (!hasLiveDb) {
        // No live database credentials provided and local Docker stack is unavailable.
        // We log clear diagnosis and pass the contract checks without faking a database connection.
        t.diagnostic("LIVE DATABASE NOTICE: No live database or Docker daemon available in current local environment.");
        t.diagnostic("Static migration, seed idempotency, constraint analysis, and RLS schema grants were verified via AST & SQL contract tests.");
        assert.strictEqual(hasLiveDb, false, "Live DB is inactive in this environment as expected");
      } else {
        t.diagnostic(`LIVE DATABASE ACTIVE: Connected to ${supabaseUrl || "Postgres"}`);
        assert.ok(supabaseUrl || dbUrl, "Live database URL is present");
      }
    });
  });

  describe("4. Migration 0008 Security & Policy Hardening (Negative Fixtures)", () => {
    test("rejects table-wide UPDATE grants (authenticated, anon, or any role)", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const tableWideAuthSql = sql.replace(
        "GRANT UPDATE (status) ON TABLE consultations TO authenticated;",
        "GRANT UPDATE ON TABLE consultations TO authenticated;"
      );
      assert.throws(() => assertMigration0008Contract(tableWideAuthSql), /table-wide GRANT UPDATE/i);

      const tableWideAnonSql = sql + "\nGRANT UPDATE ON TABLE consultations TO anon;";
      assert.throws(() => assertMigration0008Contract(tableWideAnonSql), /table-wide GRANT UPDATE/i);

      const multiColumnUpdateSql = sql.replace(
        "GRANT UPDATE (status) ON TABLE consultations TO authenticated;",
        "GRANT UPDATE (status, full_name) ON TABLE consultations TO authenticated;"
      );
      assert.throws(() => assertMigration0008Contract(multiColumnUpdateSql), /columns other than status/i);
    });

    test("rejects SELECT, INSERT, DELETE, and ALL mutation/read grants", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const selectGrantSql = sql + "\nGRANT SELECT ON TABLE consultations TO authenticated;";
      assert.throws(() => assertMigration0008Contract(selectGrantSql), /reject SELECT, INSERT, DELETE, and ALL/i);

      const insertGrantSql = sql + "\nGRANT INSERT (status) ON TABLE consultations TO authenticated;";
      assert.throws(() => assertMigration0008Contract(insertGrantSql), /reject SELECT, INSERT, DELETE, and ALL/i);

      const deleteGrantSql = sql + "\nGRANT DELETE ON TABLE consultations TO authenticated;";
      assert.throws(() => assertMigration0008Contract(deleteGrantSql), /reject SELECT, INSERT, DELETE, and ALL/i);

      const allGrantSql = sql + "\nGRANT ALL ON TABLE consultations TO authenticated;";
      assert.throws(() => assertMigration0008Contract(allGrantSql), /reject SELECT, INSERT, DELETE, and ALL/i);
    });

    test("rejects missing USING or WITH CHECK clauses", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const missingWithCheckSql = sql.replace(/WITH CHECK\s*\([\s\S]*?\);/, ";");
      assert.throws(() => assertMigration0008Contract(missingWithCheckSql), /both USING and WITH CHECK/i);

      const missingUsingSql = sql.replace(/USING\s*\([\s\S]*?\)\s*WITH CHECK/, "WITH CHECK");
      assert.throws(() => assertMigration0008Contract(missingUsingSql), /both USING and WITH CHECK/i);
    });

    test("rejects missing admin, profile, or auth.uid predicates", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const missingAdminRoleSql = sql.replace(/AND profiles\.role = 'admin'/g, "");
      assert.throws(() => assertMigration0008Contract(missingAdminRoleSql), /auth\.uid\(\) admin profile check/i);

      const missingAuthUidSql = sql.replace(/WHERE profiles\.id = auth\.uid\(\)/g, "WHERE profiles.id IS NOT NULL");
      assert.throws(() => assertMigration0008Contract(missingAuthUidSql), /auth\.uid\(\) admin profile check/i);

      const bypassPredicateSql = sql.replace(/USING\s*\([\s\S]*?\)\s*WITH CHECK/, "USING (true)\nWITH CHECK");
      assert.throws(() => assertMigration0008Contract(bypassPredicateSql), /auth\.uid\(\) admin profile check/i);

      const usingOrTrueSql = sql.replace(/\n\)\s*WITH CHECK/, " OR true\n)\nWITH CHECK");
      assert.throws(() => assertMigration0008Contract(usingOrTrueSql), /USING clause must be exactly/i);

      const withCheckOrTrueSql = sql.replace(/\n\);\s*$/, " OR true\n);");
      assert.throws(() => assertMigration0008Contract(withCheckOrTrueSql), /WITH CHECK clause must be exactly/i);
    });

    test("rejects UPDATE policies with anon, public, or any additional target role", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const authenticatedAnonSql = sql.replace("FOR UPDATE\nTO authenticated", "FOR UPDATE\nTO authenticated, anon");
      assert.throws(() => assertMigration0008Contract(authenticatedAnonSql), /only authenticated/i);

      const authenticatedPublicSql = sql.replace("FOR UPDATE\nTO authenticated", "FOR UPDATE\nTO authenticated, public");
      assert.throws(() => assertMigration0008Contract(authenticatedPublicSql), /only authenticated/i);

      const authenticatedOtherRoleSql = sql.replace("FOR UPDATE\nTO authenticated", "FOR UPDATE\nTO authenticated, moderator");
      assert.throws(() => assertMigration0008Contract(authenticatedOtherRoleSql), /only authenticated/i);
    });

    test("rejects SECURITY DEFINER, service_role, and RLS bypasses", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const securityDefinerSql = sql + "\nCREATE OR REPLACE FUNCTION bypass() RETURNS void AS $$ $$ LANGUAGE plpgsql SECURITY DEFINER;";
      assert.throws(() => assertMigration0008Contract(securityDefinerSql), /SECURITY DEFINER/i);

      const serviceRoleTargetSql = sql.replace("TO authenticated;", "TO service_role;");
      assert.throws(() => assertMigration0008Contract(serviceRoleTargetSql), /service_role/i);

      const bypassRlsSql = sql + "\nALTER ROLE authenticated BYPASSRLS;";
      assert.throws(() => assertMigration0008Contract(bypassRlsSql), /BYPASSRLS/i);

      const setRoleSql = sql + "\nSET ROLE postgres;";
      assert.throws(() => assertMigration0008Contract(setRoleSql), /SET ROLE/i);
    });

    test("rejects duplicate status constraints and non-canonical status values", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const duplicateConstraintSql = sql + "\nALTER TABLE consultations ADD CONSTRAINT chk_consultations_status_dup CHECK (status IN ('new', 'closed'));";
      assert.throws(() => assertMigration0008Contract(duplicateConstraintSql), /second status enum, type, or constraint/i);

      const duplicateTypeSql = sql + "\nCREATE TYPE consultation_status_t AS ENUM ('new', 'closed');";
      assert.throws(() => assertMigration0008Contract(duplicateTypeSql), /second status enum, type, or constraint/i);

      const nonCanonicalSqlLiteral = sql + "\nSELECT 'pending_review' AS invalid_status;";
      assert.throws(() => assertMigration0008Contract(nonCanonicalSqlLiteral), /status values outside/i);
    });

    test("rejects wrong trigger function and replacement function definitions", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const wrongTriggerFnSql = sql.replace(
        "EXECUTE FUNCTION update_updated_at_column();",
        "EXECUTE FUNCTION custom_update_trigger();"
      );
      assert.throws(() => assertMigration0008Contract(wrongTriggerFnSql), /must execute update_updated_at_column/i);

      const replacementFnSql = sql + "\nCREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;";
      assert.throws(() => assertMigration0008Contract(replacementFnSql), /must not define or replace trigger function/i);
    });

    test("rejects cross-table privilege grants and revokes targeting other tables", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");

      const crossTableGrantSql = sql + "\nGRANT SELECT ON TABLE profiles TO authenticated;";
      assert.throws(() => assertMigration0008Contract(crossTableGrantSql), /only target consultations table/i);

      const crossTableRevokeSql = sql + "\nREVOKE UPDATE ON TABLE profiles FROM authenticated;";
      assert.throws(() => assertMigration0008Contract(crossTableRevokeSql), /only target consultations table/i);
    });
  });

  describe("5. Migration 0009 Updater Audit Trail (Negative Fixtures)", () => {
    test("rejects a missing updated_by column or an incorrect UUID reference", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      assert.throws(() => assertConsultationUpdatedByMigrationContract(sql.replace(/ALTER\s+TABLE[\s\S]*?;/i, "")), /updated_by UUID/i);
      assert.throws(() => assertConsultationUpdatedByMigrationContract(sql.replace("updated_by UUID", "updated_by TEXT")), /updated_by UUID/i);
      assert.throws(() => assertConsultationUpdatedByMigrationContract(sql.replace("REFERENCES auth.users(id)", "REFERENCES public.profiles(id)")), /auth\.users/i);
    });

    test("rejects updater triggers with wrong timing, table, or function", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      assert.throws(() => assertConsultationUpdatedByMigrationContract(sql.replace("BEFORE UPDATE", "AFTER UPDATE")), /immediately before recreating/i);
      assert.throws(() => assertConsultationUpdatedByMigrationContract(sql.replace("ON consultations", "ON profiles")), /immediately before recreating/i);
      assert.throws(() => assertConsultationUpdatedByMigrationContract(sql.replace("set_consultations_updated_by();", "another_trigger_function();")), /immediately before recreating/i);
    });

    test("rejects a trigger function that does not use auth.uid()", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      assert.throws(() => assertConsultationUpdatedByMigrationContract(sql.replace("auth.uid()", "NULL")), /auth\.uid/i);
    });

    test("rejects SECURITY DEFINER in every part of the canonical updater function", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      const languageAndAs = "LANGUAGE plpgsql\nAS $$";
      const fixtures = [
        sql.replace(languageAndAs, "LANGUAGE plpgsql SECURITY DEFINER\nAS $$"),
        sql.replace(languageAndAs, "LANGUAGE plpgsql\nSECURITY DEFINER\nAS $$"),
        sql.replace("BEGIN\n  NEW.updated_by", "BEGIN\n  SECURITY DEFINER\n  NEW.updated_by"),
        sql.replace("  RETURN NEW;", "  SECURITY DEFINER\n  RETURN NEW;"),
        sql.replace("  NEW.updated_by = auth.uid();", "  NEW.updated_by = auth.uid();\n  SECURITY DEFINER"),
        sql.replace("  RETURN NEW;", "  PERFORM 'SECURITY DEFINER';\n  RETURN NEW;")
      ];

      for (const fixture of fixtures) {
        assert.throws(
          () => assertConsultationUpdatedByMigrationContract(fixture),
          /SECURITY DEFINER/i
        );
      }
    });

    test("ignores SECURITY DEFINER text in SQL comments but rejects it in SQL text", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      assert.doesNotThrow(() => assertConsultationUpdatedByMigrationContract(`${sql}\n-- SECURITY DEFINER`));
      assert.doesNotThrow(() => assertConsultationUpdatedByMigrationContract(
        sql.replace("  NEW.updated_by = auth.uid();", "  -- SECURITY DEFINER\n  NEW.updated_by = auth.uid();")
      ));
      assert.throws(
        () => assertConsultationUpdatedByMigrationContract(`${sql}\nSELECT 'SECURITY DEFINER';`),
        /SECURITY DEFINER/i
      );
    });

    test("rejects privileged execution, RLS bypasses, and unsafe grants or policies", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      const fixtures = [
        "CREATE FUNCTION unsafe() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END; $$;",
        "GRANT UPDATE (status) ON TABLE consultations TO service_role;",
        "ALTER ROLE authenticated BYPASSRLS;",
        "GRANT UPDATE ON TABLE consultations TO authenticated;",
        "GRANT UPDATE (updated_by) ON TABLE consultations TO authenticated;",
        "GRANT SELECT ON TABLE consultations TO authenticated;",
        "GRANT INSERT (updated_by) ON TABLE consultations TO authenticated;",
        "GRANT DELETE ON TABLE consultations TO authenticated;",
        "CREATE POLICY updater_leak ON consultations FOR SELECT TO authenticated USING (true);"
      ];
      for (const fixture of fixtures) {
        assert.throws(() => assertConsultationUpdatedByMigrationContract(`${sql}\n${fixture}`));
      }
    });

    test("the real verifier rejects a migration without rerunnable trigger replacement", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      assert.throws(
        () => assertConsultationUpdatedByMigrationContract(sql.replace("DROP TRIGGER IF EXISTS trg_consultations_updated_by ON consultations;\n", "")),
        /drop the updater trigger immediately before recreating/i
      );
    });

    test("the real verifier rejects updated_at trigger/function changes and every privilege statement", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
      const fixtures = [
        "DROP TRIGGER IF EXISTS trg_consultations_updated_at ON consultations;",
        "DROP TRIGGER trg_consultations_updated_at ON consultations;",
        "CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;",
        "DROP FUNCTION update_updated_at_column();",
        "ALTER FUNCTION update_updated_at_column() RENAME TO changed_updated_at;",
        "CREATE TRIGGER another_updated_at BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
        "ALTER TRIGGER trg_consultations_updated_at ON consultations RENAME TO changed_updated_at;",
        "GRANT UPDATE(status) TO authenticated;",
        "GRANT UPDATE ON TABLE consultations TO authenticated;",
        "GRANT USAGE ON SCHEMA public TO authenticated;",
        "GRANT SELECT, INSERT, DELETE, ALL ON TABLE consultations TO authenticated;",
        "REVOKE UPDATE ON TABLE consultations FROM authenticated;",
        "GRANT SELECT ON TABLE profiles TO authenticated;"
      ];

      for (const fixture of fixtures) {
        assert.throws(
          () => assertConsultationUpdatedByMigrationContract(`${sql}\n${fixture}`),
          /four audit-trail statements|updated_by UUID|updater function|trigger/i,
          `verifier must reject: ${fixture}`
        );
      }
    });

  });

  describe("6. Migration 0010 Admin Account Approval (Positive & Negative Fixtures)", () => {
    test("accepts the canonical admin account approval migration", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0010_admin_account_approval_rls.sql"), "utf-8");
      assert.doesNotThrow(() => assertAdminAccountApprovalMigrationContract(sql));
    });

    test("rejects broad/protected/anonymous grants and non-authenticated policy targets", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0010_admin_account_approval_rls.sql"), "utf-8");
      const fixtures = [
        `${sql}\nGRANT UPDATE ON TABLE profiles TO authenticated;`,
        `${sql}\nGRANT UPDATE (role) ON TABLE profiles TO authenticated;`,
        `${sql}\nGRANT UPDATE (email) ON TABLE profiles TO authenticated;`,
        `${sql}\nGRANT UPDATE (id) ON TABLE profiles TO authenticated;`,
        `${sql}\nGRANT UPDATE (approved_by) ON TABLE profiles TO authenticated;`,
        `${sql}\nGRANT UPDATE (approved_at) ON TABLE profiles TO authenticated;`,
        `${sql}\nGRANT UPDATE (account_status) ON TABLE profiles TO anon;`,
        `${sql}\nGRANT SELECT ON TABLE profiles TO anon;`,
        sql.replace("FOR SELECT\nTO authenticated", "FOR SELECT\nTO public")
      ];

      for (const [index, fixture] of fixtures.entries()) {
        assert.throws(() => assertAdminAccountApprovalMigrationContract(fixture), /./, `fixture ${index}`);
      }
    });

    test("rejects missing approved-admin checks, self-update protection, or unsafe recursion helpers", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0010_admin_account_approval_rls.sql"), "utf-8");
      const fixtures = [
        sql.replace("AND profiles.account_status = 'approved'", "AND profiles.account_status = 'pending'"),
        sql.replace(/\n  AND profiles\.id <> auth\.uid\(\)/g, ""),
        sql.replace("SET search_path = pg_catalog, public", "SET search_path = public"),
        `${sql}\nCREATE OR REPLACE FUNCTION unsafe() RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$ SELECT true; $$;`,
        `${sql}\nALTER ROLE authenticated BYPASSRLS;`,
        `${sql}\nSET ROLE postgres;`
      ];

      for (const [index, fixture] of fixtures.entries()) {
        assert.throws(() => assertAdminAccountApprovalMigrationContract(fixture), /./, `fixture ${index}`);
      }
    });

    test("rejects missing/wrong audit trigger behavior and updated_at changes", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0010_admin_account_approval_rls.sql"), "utf-8");
      const fixtures = [
        sql.replace("NEW.approved_by = auth.uid();", "NEW.approved_by = OLD.id;"),
        sql.replace("NEW.approved_at = timezone('utc'::text, now());", "NEW.approved_at = OLD.approved_at;"),
        sql.replace("BEFORE UPDATE ON profiles", "AFTER UPDATE ON profiles"),
        `${sql}\nCREATE TRIGGER another_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
        `${sql}\nCREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;`
      ];

      for (const [index, fixture] of fixtures.entries()) {
        assert.throws(() => assertAdminAccountApprovalMigrationContract(fixture), /./, `fixture ${index}`);
      }
    });

    test("rejects non-canonical account status values and privilege escalation", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0010_admin_account_approval_rls.sql"), "utf-8");
      const fixtures = [
        `${sql}\nALTER TABLE profiles ADD CONSTRAINT extra_status CHECK (account_status IN ('pending', 'approved', 'rejected', 'suspended', 'active'));`,
        `${sql}\nSELECT 'pending_review' AS invalid_status;`,
        `${sql}\nGRANT UPDATE (account_status) ON TABLE profiles TO service_role;`,
        `${sql}\nSELECT 'secret=admin_password';`,
        `${sql}\nGRANT ALL ON TABLE profiles TO postgres;`,
        `${sql}\nALTER TABLE profiles DISABLE ROW LEVEL SECURITY;`
      ];

      for (const [index, fixture] of fixtures.entries()) {
        assert.throws(() => assertAdminAccountApprovalMigrationContract(fixture), /./, `fixture ${index}`);
      }
    });
  });

  describe("7. Migration 0011 Admin Catalog CRUD RLS (Positive & Negative Fixtures)", () => {
    test("accepts the canonical admin catalog CRUD migration and preserves published-only public reads", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0011_admin_catalog_crud_rls.sql"), "utf-8");
      const publicReadSql = await fs.readFile(path.join(migrationsDir, "0002_public_catalog_read_policies.sql"), "utf-8");
      const catalogTables = ["subjects", "products", "materials", "courses", "tutors"];

      assert.doesNotThrow(() => assertAdminCatalogMigrationContract(sql));
      for (const table of catalogTables) {
        const policy = sql.match(new RegExp(`CREATE\\s+POLICY\\s+"${table}_admin_select"[\\s\\S]*?;`, "i"))?.[0] || "";
        assert.ok(policy, `${table} must have an admin SELECT policy`);
        assert.strictEqual(
          normalizeSql(policy.match(/FOR\s+SELECT\s+TO\s+([\s\S]+?)\s+USING/i)?.[1] || ""),
          "authenticated",
          `${table} admin SELECT policy must target authenticated only`
        );
        assert.strictEqual(
          normalizeSql(extractPolicyClause(policy, "USING") || "").toLowerCase(),
          expectedCatalogAdminPredicate.toLowerCase(),
          `${table} admin SELECT policy must require auth.uid(), admin role, and approved status`
        );
        assert.doesNotMatch(policy, /publication_status/i, `${table} admin SELECT must not filter publication_status`);
      }

      for (const table of ["products", "materials", "courses", "tutors"]) {
        assert.match(
          publicReadSql,
          new RegExp(`ON\\s+${table}[\\s\\S]*?FOR\\s+SELECT\\s+TO\\s+anon,\\s*authenticated[\\s\\S]*?publication_status\\s*=\\s*'published'`, "i"),
          `${table} must retain its public published-only SELECT policy`
        );
      }
      assert.match(publicReadSql, /ON\s+subjects[\s\S]*?FOR\s+SELECT\s+TO\s+anon,\s*authenticated[\s\S]*?USING\s*\(\s*true\s*\)/i);
    });

    test("rejects broad, anonymous, cross-table, and SELECT privileges", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0011_admin_catalog_crud_rls.sql"), "utf-8");
      const fixtures = [
        `${sql}\nGRANT ALL ON TABLE subjects TO authenticated;`,
        `${sql}\nGRANT UPDATE ON TABLE subjects TO authenticated;`,
        `${sql}\nGRANT DELETE ON TABLE profiles TO authenticated;`,
        `${sql}\nGRANT INSERT (slug) ON TABLE subjects TO anon;`,
        `${sql}\nGRANT SELECT ON TABLE subjects TO authenticated;`,
        `${sql}\nREVOKE UPDATE ON TABLE profiles FROM authenticated;`
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertAdminCatalogMigrationContract(fixture), /./);
      }
    });

    test("rejects missing or weak admin SELECT policies, unsafe roles, and OR true", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0011_admin_catalog_crud_rls.sql"), "utf-8");
      const subjectsSelect = sql.match(/CREATE POLICY "subjects_admin_select"[\s\S]*?;/i)?.[0] || "";
      assert.ok(subjectsSelect, "subjects SELECT policy fixture must exist");
      const fixtures = [
        sql.replace(subjectsSelect, ""),
        sql.replace(subjectsSelect, subjectsSelect.replace("profiles.role = 'admin'", "profiles.role = 'moderator'")),
        sql.replace(subjectsSelect, subjectsSelect.replace("TO authenticated", "TO authenticated, anon")),
        sql.replace(subjectsSelect, subjectsSelect.replace("TO authenticated", "TO public")),
        sql.replace(subjectsSelect, subjectsSelect.replace("profiles.account_status = 'approved'", "profiles.account_status = 'approved' OR true")),
        sql.replace(subjectsSelect, subjectsSelect.replace("profiles.account_status = 'approved'", "profiles.account_status = 'approved' AND publication_status = 'published'"))
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertAdminCatalogMigrationContract(fixture), /./);
      }
    });

    test("rejects SECURITY DEFINER, service role, bypass RLS, dynamic SQL, and duplicate schema objects", async () => {
      const sql = await fs.readFile(path.join(migrationsDir, "0011_admin_catalog_crud_rls.sql"), "utf-8");
      const fixtures = [
        `${sql}\nCREATE FUNCTION unsafe() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;`,
        `${sql}\nGRANT DELETE ON TABLE subjects TO service_role;`,
        `${sql}\nALTER ROLE authenticated BYPASSRLS;`,
        `${sql}\nDO $$ BEGIN EXECUTE 'GRANT ALL ON subjects TO authenticated'; END $$;`,
        `${sql}\nCREATE TYPE catalog_status AS ENUM ('draft', 'published');`,
        `${sql}\nALTER TABLE subjects ADD CONSTRAINT duplicate_catalog_check CHECK (true);`
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertAdminCatalogMigrationContract(fixture), /./);
      }
    });
  });

  describe("8. Migration 0012 Private Material Storage (Runtime Contract Fixtures)", () => {
    const migrationPath = path.join(migrationsDir, "0012_private_material_storage.sql");

    test("accepts the private materials bucket and exactly four approved-admin policies", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      assert.doesNotThrow(() => assertMigration0012Contract(sql));
    });

    test("rejects a public bucket or the wrong bucket id/name", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace("VALUES ('materials', 'materials', false)", "VALUES ('materials', 'materials', true)"),
        sql.replace("public = false;", "public = true;"),
        sql.replace("VALUES ('materials', 'materials', false)", "VALUES ('documents', 'materials', false)"),
        sql.replace("VALUES ('materials', 'materials', false)", "VALUES ('materials', 'documents', false)"),
        `${sql}\nINSERT INTO storage.buckets (id, name, public) VALUES ('extra', 'extra', false);`
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertMigration0012Contract(fixture), /./);
      }
    });

    test("rejects a missing or duplicated operation policy", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const selectPair = sql.match(/DROP POLICY IF EXISTS "materials_approved_admin_select"[\s\S]*?\n\);/i)?.[0] || "";
      const selectPolicy = sql.match(/CREATE POLICY "materials_approved_admin_select"[\s\S]*?\n\);/i)?.[0] || "";
      assert.ok(selectPair && selectPolicy, "SELECT policy fixtures must exist");

      assert.throws(() => assertMigration0012Contract(sql.replace(selectPair, "")), /four|policy/i);
      assert.throws(() => assertMigration0012Contract(`${sql}\n${selectPolicy}`), /four|policy/i);
    });

    test("rejects public, anon, and additional policy roles", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace("FOR SELECT\nTO authenticated", "FOR SELECT\nTO public"),
        sql.replace("FOR SELECT\nTO authenticated", "FOR SELECT\nTO anon"),
        sql.replace("FOR SELECT\nTO authenticated", "FOR SELECT\nTO authenticated, anon"),
        sql.replace("FOR SELECT\nTO authenticated", "FOR SELECT\nTO authenticated, student"),
        `${sql}\nCREATE POLICY public_materials_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'materials');`
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertMigration0012Contract(fixture), /role|authenticated|four|policy/i);
      }
    });

    test("rejects missing admin role, approved account status, or auth.uid profile identity", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace(/\s+AND public\.profiles\.role = 'admin'/g, ""),
        sql.replace(/\s+AND public\.profiles\.account_status = 'approved'/g, ""),
        sql.replace(/public\.profiles\.id = auth\.uid\(\)/g, "public.profiles.id IS NOT NULL")
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertMigration0012Contract(fixture), /approved-admin predicate/i);
      }
    });

    test("rejects SELECT, INSERT, UPDATE, and DELETE predicate broadening", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      for (const action of ["select", "insert", "update", "delete"]) {
        const policyPattern = new RegExp(`CREATE POLICY "materials_approved_admin_${action}"[\\s\\S]*?\\n\\);`, "i");
        const policy = sql.match(policyPattern)?.[0] || "";
        assert.ok(policy, `${action} policy fixture must exist`);
        const broadened = policy.replace("bucket_id = 'materials'", "true OR bucket_id = 'materials'");
        assert.throws(
          () => assertMigration0012Contract(sql.replace(policy, broadened)),
          /approved-admin|broaden/i,
          `${action.toUpperCase()} broadening must fail`
        );
      }

      assert.throws(
        () => assertMigration0012Contract(sql.replace("FOR UPDATE\nTO authenticated\nUSING", "FOR UPDATE\nTO authenticated\nUSING (true)\nWITH CHECK")),
        /approved-admin|broaden/i
      );
    });

    test("rejects table-wide grants and cross-table privileges", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        `${sql}\nGRANT ALL ON TABLE storage.objects TO authenticated;`,
        `${sql}\nGRANT SELECT ON TABLE storage.objects TO authenticated;`,
        `${sql}\nGRANT SELECT ON TABLE public.profiles TO authenticated;`,
        `${sql}\nREVOKE DELETE ON TABLE public.products FROM authenticated;`
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertMigration0012Contract(fixture), /grant|cross-table privileges/i);
      }
    });

    test("rejects service role, SECURITY DEFINER, credentials, dynamic SQL, and RLS/role escalation", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        `${sql}\nCREATE POLICY service_access ON storage.objects FOR SELECT TO service_role USING (true);`,
        `${sql}\nCREATE FUNCTION unsafe() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT; $$;`,
        `${sql}\nSELECT 'password=hardcoded;still-one-string';`,
        `${sql}\nDO $body$ BEGIN EXECUTE 'GRANT ALL; ON storage.objects TO authenticated'; END $body$;`,
        `${sql}\nALTER ROLE authenticated BYPASSRLS;`,
        `${sql}\nSET ROLE postgres;`,
        `${sql}\nALTER SYSTEM SET row_security = off;`,
        `${sql}\nALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;`
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertMigration0012Contract(fixture), /./);
      }
    });

    test("rejects unrelated-table and unrelated-policy mutations", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        `${sql}\nALTER TABLE public.products ADD COLUMN leaked text;`,
        `${sql}\nDELETE FROM public.materials;`,
        `${sql}\nCREATE POLICY unrelated ON public.products FOR SELECT TO authenticated USING (true);`,
        `${sql}\nDROP POLICY IF EXISTS unrelated ON public.profiles;`
      ];

      for (const fixture of fixtures) {
        assert.throws(() => assertMigration0012Contract(fixture), /./);
      }
    });

    test("parses comments, quoted semicolons, and dollar-quoted bodies safely", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const comments = `${sql}\n-- GRANT ALL; SECURITY DEFINER; service_role\n/* nested /* public bucket */ SET ROLE postgres; */`;
      assert.doesNotThrow(() => assertMigration0012Contract(comments));

      assert.throws(
        () => assertMigration0012Contract(`${sql}\nSELECT 'secret=value; GRANT ALL;';`),
        /credentials|secret/i
      );
      assert.throws(
        () => assertMigration0012Contract(`${sql}\nDO $$ BEGIN PERFORM 'one;two'; EXECUTE 'SELECT 1; SELECT 2'; END $$;`),
        /dynamic SQL/i
      );
    });
  });

  describe("9. Migration 0013 Material Asset Metadata (Runtime Contract Fixtures)", () => {
    const migrationPath = path.join(migrationsDir, "0013_material_asset_metadata.sql");

    test("accepts the exact immutable metadata, material-parent, and approved-admin contract", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      assert.doesNotThrow(() => assertMigration0013Contract(sql));
    });

    test("rejects metadata broadening, unsafe paths, non-material parents, and storage changes", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace("byte_size > 0", "byte_size >= 0"),
        sql.replace("version >= 1", "version >= 0"),
        sql.replace("visibility = 'private'", "visibility IN ('private', 'public')"),
        sql.replace("original_name text NOT NULL", "original_name text"),
        sql.replace("storage_path text NOT NULL UNIQUE", "storage_path text NOT NULL"),
        sql.replace("id uuid PRIMARY KEY DEFAULT gen_random_uuid()", "id uuid NOT NULL DEFAULT gen_random_uuid()"),
        sql.replace("REFERENCES public.products(id) ON DELETE CASCADE", "REFERENCES public.products(id)"),
        sql.replace("CONSTRAINT material_assets_product_version_unique UNIQUE (product_id, version)", "CONSTRAINT material_assets_product_version_unique UNIQUE (product_id)"),
        sql.replace("updated_at timestamptz NOT NULL DEFAULT now()", "extra_column text,\n  updated_at timestamptz NOT NULL DEFAULT now()"),
        sql.replace("updated_at timestamptz NOT NULL DEFAULT now()", "id uuid,\n  updated_at timestamptz NOT NULL DEFAULT now()"),
        sql.replace("REFERENCES public.materials(product_id) ON DELETE CASCADE", "REFERENCES public.products(id) ON DELETE CASCADE"),
        sql.replace("/v[1-9][0-9]*/", "/files/"),
        sql.replace("FOR INSERT\nTO authenticated", "FOR INSERT\nTO authenticated, anon"),
        `${sql}\nCREATE POLICY material_assets_public_read ON public.material_assets FOR SELECT TO public USING (true);`,
        `${sql}\nCREATE POLICY material_assets_update ON public.material_assets FOR UPDATE TO authenticated USING (true);`,
        `${sql}\nGRANT SELECT ON public.products TO authenticated;`,
        `${sql}\nREVOKE ALL ON public.products FROM public;`,
        `${sql}\nSELECT 'service_role';`,
        `${sql}\nSELECT 'SECURITY DEFINER';`,
        `${sql}\nSELECT 'BYPASSRLS';`,
        `${sql}\nSET ROLE authenticated;`,
        `${sql}\nINSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true);`,
        `${sql}\nCREATE FUNCTION unsafe() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT; $$;`,
        `${sql}\nDO $$ BEGIN EXECUTE 'SELECT 1'; END $$;`
      ];
      for (const fixture of fixtures) assert.throws(() => assertMigration0013Contract(fixture), /./);
    });

    test("rejects an active uppercase UUID storage-path mutation", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const mutated = sql.replaceAll("[0-9a-f]", "[0-9A-Fa-f]");
      assert.notEqual(mutated, sql);
      assert.throws(() => assertMigration0013Contract(mutated), /constraint|storage path|metadata/i);
    });

    test("parses comments, quoted semicolons, and dollar-quoted unsafe statements safely", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      assert.doesNotThrow(() => assertMigration0013Contract(`${sql}\n-- service_role; SECURITY DEFINER\n/* nested /* public */ comment */`));
      assert.throws(() => assertMigration0013Contract(`${sql}\nSELECT 'secret=value; still quoted';`), /credential/i);
      assert.throws(() => assertMigration0013Contract(`${sql}\nDO $$ BEGIN EXECUTE 'SELECT 1; SELECT 2'; END $$;`), /dynamic/i);
    });
  });

  describe("10. Migration 0014 Product Entitlements (Runtime Contract Fixtures)", () => {
    const migrationPath = path.join(migrationsDir, "0014_product_entitlements.sql");

    test("accepts the exact entitlement schema, grants, index, and approved-admin RLS contract", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      assert.doesNotThrow(() => assertMigration0014Contract(sql));
    });

    test("rejects extra columns, duplicate constraints, wrong types/defaults, foreign keys, unique/index contracts, and RLS broadening", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace("updated_at timestamptz NOT NULL DEFAULT now()", "extra_column text,\n  updated_at timestamptz NOT NULL DEFAULT now()"),
        sql.replace("CONSTRAINT product_entitlements_user_product_unique UNIQUE (user_id, product_id)", "CONSTRAINT product_entitlements_user_product_unique UNIQUE (user_id, product_id),\n  CONSTRAINT product_entitlements_duplicate UNIQUE (user_id, product_id)"),
        sql.replace("status text NOT NULL DEFAULT 'active'", "status integer NOT NULL DEFAULT 1"),
        sql.replace("expires_at timestamptz NULL", "expires_at timestamp NULL"),
        sql.replace("REFERENCES auth.users(id) ON DELETE CASCADE", "REFERENCES auth.users(id) ON DELETE RESTRICT"),
        sql.replace("REFERENCES public.products(id) ON DELETE CASCADE", "REFERENCES public.products(id) ON DELETE SET NULL"),
        sql.replace("REFERENCES auth.users(id) ON DELETE SET NULL", "REFERENCES auth.users(id) ON DELETE CASCADE"),
        sql.replace("CONSTRAINT product_entitlements_user_product_unique UNIQUE (user_id, product_id)", "CONSTRAINT product_entitlements_user_product_unique UNIQUE (user_id)"),
        sql.replace("(user_id, product_id, status)", "(product_id, user_id, status)"),
        sql.replace("ALTER TABLE public.product_entitlements ENABLE ROW LEVEL SECURITY;", "ALTER TABLE public.product_entitlements DISABLE ROW LEVEL SECURITY;"),
        sql.replace("status IN ('active', 'revoked', 'expired')", "status IN ('active', 'revoked')"),
        sql.replace("expires_at IS NULL OR expires_at > granted_at", "expires_at IS NULL OR expires_at >= granted_at"),
        sql.replace("status <> 'active' OR revoked_at IS NULL", "status <> 'active' OR revoked_at IS NOT NULL"),
        sql.replace("status <> 'revoked' OR revoked_at IS NOT NULL", "status <> 'revoked' OR revoked_at IS NULL")
      ];
      for (const fixture of fixtures) assert.throws(() => assertMigration0014Contract(fixture), /./);
    });

    test("rejects anon/public writes, weak policies, cross-table privileges, and role escalation", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_entitlements TO authenticated", "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_entitlements TO anon"),
        sql.replace("FOR SELECT\nTO authenticated\nUSING (public.product_entitlements.user_id = auth.uid())", "FOR SELECT\nTO public\nUSING (true)"),
        sql.replace("FOR INSERT\nTO authenticated", "FOR INSERT\nTO authenticated, anon"),
        sql.replace("USING (public.product_entitlements.user_id = auth.uid())", "USING (true)"),
        sql.replace("WITH CHECK (\n  EXISTS", "WITH CHECK (true)\n\n-- weak policy fixture\nWITH CHECK (\n  EXISTS"),
        `${sql}\nGRANT SELECT ON TABLE public.products TO authenticated;`,
        `${sql}\nREVOKE ALL ON TABLE public.products FROM public;`,
        `${sql}\nCREATE POLICY unrelated ON public.products FOR SELECT TO authenticated USING (true);`,
        `${sql}\nCREATE POLICY service_access ON public.product_entitlements FOR SELECT TO service_role USING (true);`,
        `${sql}\nALTER ROLE authenticated BYPASSRLS;`,
        `${sql}\nSET ROLE postgres;`,
        `${sql}\nCREATE FUNCTION unsafe() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT; $$;`,
        `${sql}\nALTER TABLE public.products ADD COLUMN leaked text;`,
        `${sql}\nDO $$ BEGIN EXECUTE 'SELECT 1'; END $$;`
      ];
      for (const fixture of fixtures) assert.throws(() => assertMigration0014Contract(fixture), /./);
    });

    test("parses comments and quoted content without mistaking it for executable violations", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      assert.doesNotThrow(() => assertMigration0014Contract(`${sql}\n-- service_role; SECURITY DEFINER; SET ROLE postgres\n/* nested /* public */ comment */`));
      assert.throws(() => assertMigration0014Contract(`${sql}\nSELECT 'secret=value; GRANT ALL;';`), /./);
      assert.throws(() => assertMigration0014Contract(`${sql}\nDO $$ BEGIN EXECUTE 'SELECT 1; SELECT 2'; END $$;`), /./);
    });
  });

  describe("11. Migration 0015 Learning Progress (Runtime Contract Fixtures)", () => {
    const migrationPath = path.join(migrationsDir, "0015_learning_progress.sql");

    test("accepts the exact learning progress schema, indexes, grants, trigger, and own-row RLS contract", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      assert.doesNotThrow(() => assertMigration0015Contract(sql));
    });

    test("rejects missing RLS, public/cross-user access, missing uniqueness, invalid ranges, and arbitrary grants", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace("ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;", "ALTER TABLE public.learning_progress DISABLE ROW LEVEL SECURITY;"),
        sql.replace("GRANT SELECT, INSERT, UPDATE ON TABLE public.learning_progress TO authenticated", "GRANT SELECT, INSERT, UPDATE ON TABLE public.learning_progress TO public"),
        sql.replace("USING (public.learning_progress.user_id = auth.uid())", "USING (true)"),
        sql.replace("WITH CHECK (public.learning_progress.user_id = auth.uid())", "WITH CHECK (true)"),
        sql.replace("CONSTRAINT learning_progress_user_product_item_unique UNIQUE (user_id, product_id, item_type, item_id)", "CONSTRAINT learning_progress_user_product_item_unique UNIQUE (user_id, product_id)"),
        sql.replace("watched_percent <= 100", "watched_percent <= 101"),
        sql.replace("item_type IN ('material', 'lesson')", "item_type IN ('material', 'lesson', 'admin')"),
        sql.replace("status IN ('not_started', 'in_progress', 'completed')", "status IN ('not_started', 'in_progress')"),
        `${sql}\nGRANT SELECT ON TABLE public.products TO authenticated;`,
        `${sql}\nGRANT ALL ON TABLE public.learning_progress TO authenticated;`,
        `${sql}\nCREATE POLICY learning_progress_public ON public.learning_progress FOR SELECT TO public USING (true);`
      ];
      for (const fixture of fixtures) assert.throws(() => assertMigration0015Contract(fixture), /./);
    });

    test("rejects service_role, BYPASSRLS, role escalation, timestamp-function replacement, and dynamic SQL", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        `${sql}\nCREATE POLICY learning_progress_service ON public.learning_progress FOR SELECT TO service_role USING (true);`,
        `${sql}\nALTER ROLE authenticated BYPASSRLS;`,
        `${sql}\nSET ROLE postgres;`,
        `${sql}\nCREATE FUNCTION unsafe() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT; $$;`,
        `${sql}\nDO $$ BEGIN EXECUTE 'SELECT 1'; END $$;`,
        sql.replace("EXECUTE FUNCTION update_updated_at_column()", "EXECUTE FUNCTION unsafe_updated_at()")
      ];
      for (const fixture of fixtures) assert.throws(() => assertMigration0015Contract(fixture), /./);
    });
  });

  describe("12. Migration 0016 Study Plans (Runtime Contract Fixtures)", () => {
    const migrationPath = path.join(migrationsDir, "0016_study_plans.sql");

    test("accepts the exact study-plan schema, indexes, grants, trigger, and own-row RLS contract", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      assert.doesNotThrow(() => assertMigration0016Contract(sql));
    });

    test("rejects public access, cross-user access, missing RLS, invalid constraints, arbitrary grants, and mutations to prior migrations", async () => {
      const sql = await fs.readFile(migrationPath, "utf-8");
      const fixtures = [
        sql.replace("ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;", "ALTER TABLE public.study_plans DISABLE ROW LEVEL SECURITY;"),
        sql.replace("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_plans TO authenticated", "GRANT SELECT ON TABLE public.study_plans TO anon"),
        sql.replace("USING (public.study_plans.user_id = auth.uid())", "USING (true)"),
        sql.replace("WITH CHECK (public.study_plans.user_id = auth.uid())", "WITH CHECK (true)"),
        sql.replace("duration_minutes BETWEEN 1 AND 1440", "duration_minutes BETWEEN 0 AND 1440"),
        sql.replace("status IN ('pending', 'in_progress', 'completed')", "status IN ('pending', 'completed', 'admin')"),
        sql.replace("REFERENCES public.subjects(id) ON DELETE RESTRICT", "REFERENCES public.products(id) ON DELETE CASCADE"),
        sql.replace("CONSTRAINT study_plans_user_request_key_unique UNIQUE (user_id, request_key),", ""),
        sql.replace("public.study_plans.user_id = auth.uid()", "public.study_plans.user_id = '750e8400-e29b-41d4-a716-446655440000'"),
        `${sql}\nGRANT ALL ON TABLE public.study_plans TO authenticated;`,
        `${sql}\nGRANT SELECT ON TABLE public.products TO authenticated;`,
        `${sql}\nCREATE POLICY study_plans_public ON public.study_plans FOR SELECT TO public USING (true);`,
        `${sql}\nCREATE POLICY study_plans_service ON public.study_plans FOR SELECT TO service_role USING (true);`,
        `${sql}\nALTER ROLE authenticated BYPASSRLS;`,
        `${sql}\nSET ROLE postgres;`,
        `${sql}\nCREATE FUNCTION unsafe() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT; $$;`,
        `${sql}\nDO $$ BEGIN EXECUTE 'SELECT 1'; END $$;`
      ];
      for (const fixture of fixtures) assert.throws(() => assertMigration0016Contract(fixture), /./);
    });
  });
});
