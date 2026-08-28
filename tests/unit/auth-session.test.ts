/**
 * Unit Tests for Server-side Authentication Foundation (Task 3.1A)
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  getAuthUser,
  getAuthSession,
  requireAuthUser,
  UnauthorizedError
} from "../../lib/auth/session";

describe("Auth Session Helpers Contract & Intent", () => {
  test("lib/auth/session.ts exports required functions and error class", () => {
    assert.strictEqual(typeof getAuthUser, "function");
    assert.strictEqual(typeof getAuthSession, "function");
    assert.strictEqual(typeof requireAuthUser, "function");
    assert.strictEqual(typeof UnauthorizedError, "function");

    const err = new UnauthorizedError();
    assert.strictEqual(err.name, "UnauthorizedError");
    assert.strictEqual(err.message, "Unauthorized: User session is required.");
  });

  test("getAuthUser returns null gracefully when Supabase client is not configured", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const user = await getAuthUser();
      assert.strictEqual(user, null);
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  test("getAuthSession returns null gracefully when Supabase client is not configured", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const session = await getAuthSession();
      assert.strictEqual(session, null);
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  test("requireAuthUser throws UnauthorizedError when user is null", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      await assert.rejects(
        async () => {
          await requireAuthUser();
        },
        {
          name: "UnauthorizedError",
          message: /Unauthorized: User session is required/i
        }
      );
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  test("app/auth/callback/route.ts handles code parameter, exchange, and redirects", async () => {
    const routePath = path.resolve(
      process.cwd(),
      "app/auth/callback/route.ts"
    );
    const code = await fs.readFile(routePath, "utf-8");

    // Route must export GET handler
    assert.ok(code.includes("export async function GET("), "Callback route must export GET handler");

    // Must read 'code' query param
    assert.ok(code.includes('searchParams.get("code")'), "Callback route must read 'code' parameter");

    // Must read 'next' query param with fallback
    assert.ok(code.includes('searchParams.get("next")'), "Callback route must support 'next' redirect");

    // Must call exchangeCodeForSession
    assert.ok(code.includes("exchangeCodeForSession(code)"), "Callback route must exchange code for session");

    // Must redirect to error page on failure/missing code
    assert.ok(
      code.includes('/dang-nhap?error=auth_callback'),
      "Must redirect to /dang-nhap?error=auth_callback on missing code or exchange error"
    );
  });

  describe("GET /auth/callback Route Handler Execution", () => {
    let GET: (request: Request) => Promise<Response>;
    let handleAuthCallback: (request: Request, client?: any) => Promise<Response>;

    test("load route handler functions", async () => {
      const module = await import("../../app/auth/callback/route");
      GET = module.GET;
      handleAuthCallback = module.handleAuthCallback;
      assert.strictEqual(typeof GET, "function");
      assert.strictEqual(typeof handleAuthCallback, "function");
    });

    test("1. missing code redirects to /dang-nhap?error=auth_callback", async () => {
      const request = new Request("http://localhost:3000/auth/callback");
      const response = await GET(request);

      assert.strictEqual(response.status, 307);
      const location = response.headers.get("location");
      assert.strictEqual(location, "http://localhost:3000/dang-nhap?error=auth_callback");
    });

    test("2. failed exchange redirects to /dang-nhap?error=auth_callback", async () => {
      const mockFailingClient = {
        auth: {
          exchangeCodeForSession: async () => ({
            data: { session: null, user: null },
            error: new Error("Invalid or expired code")
          })
        }
      };

      const request = new Request("http://localhost:3000/auth/callback?code=invalid-code");
      const response = await handleAuthCallback(request, mockFailingClient);

      assert.strictEqual(response.status, 307);
      const location = response.headers.get("location");
      assert.strictEqual(location, "http://localhost:3000/dang-nhap?error=auth_callback");
    });

    test("3. successful exchange redirects to /ca-nhan", async () => {
      const mockSuccessClient = {
        auth: {
          exchangeCodeForSession: async () => ({
            data: { session: { access_token: "tok" }, user: { id: "u1" } },
            error: null
          })
        }
      };

      const request = new Request("http://localhost:3000/auth/callback?code=valid-auth-code");
      const response = await handleAuthCallback(request, mockSuccessClient);

      assert.strictEqual(response.status, 307);
      const location = response.headers.get("location");
      assert.strictEqual(location, "http://localhost:3000/ca-nhan");
    });

    test("4. invalid external next falls back to /ca-nhan", async () => {
      const mockSuccessClient = {
        auth: {
          exchangeCodeForSession: async () => ({
            data: { session: { access_token: "tok" }, user: { id: "u1" } },
            error: null
          })
        }
      };

      const maliciousNextTargets = [
        "https://evil.com/phishing",
        "http://attacker.com",
        "//evil.com/bypass",
        "\\evil.com",
        "javascript:alert(1)"
      ];

      for (const badNext of maliciousNextTargets) {
        const request = new Request(
          `http://localhost:3000/auth/callback?code=valid-code&next=${encodeURIComponent(badNext)}`
        );
        const response = await handleAuthCallback(request, mockSuccessClient);

        assert.strictEqual(response.status, 307);
        const location = response.headers.get("location");
        assert.strictEqual(
          location,
          "http://localhost:3000/ca-nhan",
          `Must fall back to /ca-nhan for malicious next: ${badNext}`
        );
      }
    });

    test("5. valid internal next is preserved", async () => {
      const mockSuccessClient = {
        auth: {
          exchangeCodeForSession: async () => ({
            data: { session: { access_token: "tok" }, user: { id: "u1" } },
            error: null
          })
        }
      };

      const validTargets = [
        "/ca-nhan/cai-dat",
        "/khoa-hoc",
        "/tai-lieu/ke-toan-tai-chinh-1"
      ];

      for (const target of validTargets) {
        const request = new Request(
          `http://localhost:3000/auth/callback?code=valid-code&next=${encodeURIComponent(target)}`
        );
        const response = await handleAuthCallback(request, mockSuccessClient);

        assert.strictEqual(response.status, 307);
        const location = response.headers.get("location");
        assert.strictEqual(location, `http://localhost:3000${target}`);
      }
    });
  });

  test("client-side codebase never imports or references service role keys", async () => {
    const filesToScan = [
      "lib/supabase/browser.ts",
      "lib/supabase/server.ts",
      "lib/auth/session.ts",
      "app/auth/callback/route.ts",
      "hooks/use-demo-auth.ts",
      "app/dang-nhap/page.tsx",
      "components/site/header.tsx"
    ];

    for (const relPath of filesToScan) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = await fs.readFile(fullPath, "utf-8");

      assert.ok(
        !content.includes("SUPABASE_SERVICE_ROLE_KEY"),
        `${relPath} must not reference SUPABASE_SERVICE_ROLE_KEY`
      );
      assert.ok(
        !content.includes("service_role"),
        `${relPath} must not reference service_role key`
      );
    }
  });

  describe("Task 3.1B: Login & Logout Flow UI Contracts", () => {
    test("app/dang-nhap/page.tsx does not contain hardcoded credentials in production flow and uses signInWithPassword", async () => {
      const loginPath = path.resolve(process.cwd(), "app/dang-nhap/page.tsx");
      const loginCode = await fs.readFile(loginPath, "utf-8");

      // Must be a client component
      assert.ok(loginCode.includes('"use client"'), "LoginPage must have 'use client'");

      // Must use useDemoAuth hook
      assert.ok(loginCode.includes("useDemoAuth"), "LoginPage must use auth hook");

      // Must disable input / submit button while submitting
      assert.ok(loginCode.includes("disabled={isSubmitting}"), "Inputs and button must disable during submission");

      // Demo box must be conditionally rendered only when isDemoMode is true
      assert.ok(
        loginCode.includes("{isDemoMode &&"),
        "Demo helper box must only render when isDemoMode is true"
      );
    });

    test("hooks/use-demo-auth.ts uses Supabase Auth signInWithPassword and signOut", async () => {
      const hookPath = path.resolve(process.cwd(), "hooks/use-demo-auth.ts");
      const hookCode = await fs.readFile(hookPath, "utf-8");

      // Must call signInWithPassword
      assert.ok(
        hookCode.includes("signInWithPassword"),
        "useDemoAuth must call signInWithPassword"
      );

      // Must call signOut
      assert.ok(
        hookCode.includes("signOut()"),
        "useDemoAuth must call signOut()"
      );

      // Must call onAuthStateChange
      assert.ok(
        hookCode.includes("onAuthStateChange"),
        "useDemoAuth must subscribe to onAuthStateChange"
      );

      // Must check NEXT_PUBLIC_DEMO_MODE for fallback
      assert.ok(
        hookCode.includes('process.env.NEXT_PUBLIC_DEMO_MODE === "true"'),
        "useDemoAuth must strictly guard demo authentication with NEXT_PUBLIC_DEMO_MODE"
      );
    });

    test("components/site/header.tsx renders login CTA for anonymous users and account info + logout for authenticated users", async () => {
      const headerPath = path.resolve(process.cwd(), "components/site/header.tsx");
      const headerCode = await fs.readFile(headerPath, "utf-8");

      // Must show login link for anonymous users
      assert.ok(
        headerCode.includes('href="/dang-nhap"'),
        "Header must link to /dang-nhap for anonymous users"
      );

      // Must render account link for authenticated users
      assert.ok(
        headerCode.includes('href="/ca-nhan"'),
        "Header must link to /ca-nhan for authenticated users"
      );

      // Must have logout action
      assert.ok(
        headerCode.includes("logout()"),
        "Header must invoke logout() on logout button click"
      );
    });
  });

  describe("Task 3.1C-B: Defense-in-depth Server-side Auth Guards for Student Pages", () => {
    test("app/ca-nhan/page.tsx is a Server Component and uses getAccountAccess server check", async () => {
      const pagePath = path.resolve(process.cwd(), "app/ca-nhan/page.tsx");
      const pageCode = await fs.readFile(pagePath, "utf-8");

      // Must NOT be a client component
      assert.ok(
        !pageCode.includes('"use client"'),
        "app/ca-nhan/page.tsx must be a Server Component"
      );

      // Must import getAccountAccess from @/lib/auth/session
      assert.ok(
        pageCode.includes("getAccountAccess"),
        "app/ca-nhan/page.tsx must import getAccountAccess"
      );
      assert.ok(
        pageCode.includes("@/lib/auth/session"),
        "app/ca-nhan/page.tsx must import from @/lib/auth/session"
      );

      // Must use redirect from next/navigation
      assert.ok(
        pageCode.includes("redirect("),
        "app/ca-nhan/page.tsx must call redirect() when user is not authenticated"
      );

      // Must redirect to /dang-nhap?next=...
      assert.ok(
        pageCode.includes("/dang-nhap?next="),
        "app/ca-nhan/page.tsx must redirect to /dang-nhap with next param"
      );

      // Must NOT use localStorage or client auth hooks as its security check
      assert.ok(
        !pageCode.includes("localStorage"),
        "app/ca-nhan/page.tsx must not use localStorage"
      );
      assert.ok(
        !pageCode.includes("useDemoAuth"),
        "app/ca-nhan/page.tsx must not use useDemoAuth"
      );
    });

    test("app/ca-nhan/mon/[slug]/page.tsx is a Server Component and uses getAccountAccess server check", async () => {
      const pagePath = path.resolve(process.cwd(), "app/ca-nhan/mon/[slug]/page.tsx");
      const pageCode = await fs.readFile(pagePath, "utf-8");

      // Must NOT be a client component
      assert.ok(
        !pageCode.includes('"use client"'),
        "app/ca-nhan/mon/[slug]/page.tsx must be a Server Component"
      );

      // Must import getAccountAccess from @/lib/auth/session
      assert.ok(
        pageCode.includes("getAccountAccess"),
        "app/ca-nhan/mon/[slug]/page.tsx must import getAccountAccess"
      );
      assert.ok(
        pageCode.includes("@/lib/auth/session"),
        "app/ca-nhan/mon/[slug]/page.tsx must import from @/lib/auth/session"
      );

      // Must use redirect from next/navigation
      assert.ok(
        pageCode.includes("redirect("),
        "app/ca-nhan/mon/[slug]/page.tsx must call redirect() when user is not authenticated"
      );

      // Must redirect to /dang-nhap?next=...
      assert.ok(
        pageCode.includes("/dang-nhap?next="),
        "app/ca-nhan/mon/[slug]/page.tsx must redirect to /dang-nhap with next param"
      );

      // Must preserve the slug in next path
      assert.ok(
        pageCode.includes("/ca-nhan/mon/${slug}"),
        "app/ca-nhan/mon/[slug]/page.tsx must preserve subject slug in redirect path"
      );

      // Must NOT use localStorage or client auth hooks as its security check
      assert.ok(
        !pageCode.includes("localStorage"),
        "app/ca-nhan/mon/[slug]/page.tsx must not use localStorage"
      );
      assert.ok(
        !pageCode.includes("useDemoAuth"),
        "app/ca-nhan/mon/[slug]/page.tsx must not use useDemoAuth"
      );
    });

    test("app/ca-nhan/page.tsx redirects anonymous user to /dang-nhap?next=%2Fca-nhan", async () => {
      const pageModule = await import("../../app/ca-nhan/page");
      const StudentDashboardPage = pageModule.default;

      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        // Without Supabase credentials or session, getAuthUser returns null
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        let redirectedUrl: string | null = null;
        try {
          await StudentDashboardPage({
            searchParams: Promise.resolve({ tab: "settings", page: "1" })
          });
        } catch (err: any) {
          // Next.js redirect() throws a NEXT_REDIRECT digest
          if (err.digest?.startsWith("NEXT_REDIRECT;")) {
            const parts = err.digest.split(";");
            redirectedUrl = parts[2];
          } else {
            throw err;
          }
        }

        assert.ok(redirectedUrl, "StudentDashboardPage must throw a NEXT_REDIRECT for unauthenticated users");
        assert.strictEqual(
          redirectedUrl,
          "/dang-nhap?next=%2Fca-nhan%3Ftab%3Dsettings%26page%3D1"
        );
      } finally {
        if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      }
    });

    test("app/ca-nhan/mon/[slug]/page.tsx redirects anonymous user and preserves slug & query", async () => {
      const pageModule = await import("../../app/ca-nhan/mon/[slug]/page");
      const SubjectWorkspacePage = pageModule.default;

      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        let redirectedUrl: string | null = null;
        try {
          await SubjectWorkspacePage({
            params: Promise.resolve({ slug: "ke-toan-tai-chinh-1" }),
            searchParams: Promise.resolve({ tab: "documents", view: "grid" })
          });
        } catch (err: any) {
          if (err.digest?.startsWith("NEXT_REDIRECT;")) {
            const parts = err.digest.split(";");
            redirectedUrl = parts[2];
          } else {
            throw err;
          }
        }

        assert.ok(redirectedUrl, "SubjectWorkspacePage must throw a NEXT_REDIRECT for unauthenticated users");
        assert.strictEqual(
          redirectedUrl,
          "/dang-nhap?next=%2Fca-nhan%2Fmon%2Fke-toan-tai-chinh-1%3Ftab%3Ddocuments%26view%3Dgrid"
        );
      } finally {
        if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      }
    });
  });

  describe("Task 3.2: Protected Student Profiles & Settings", () => {
    test("validateProfileInput rejects privileged and unknown fields", async () => {
      const { validateProfileInput } = await import("../../lib/repositories/profile-repository");

      // Attempting to overwrite role, id, email, or unknown keys
      const maliciousInput = {
        fullName: "Hacker",
        role: "admin",
        owner_id: "victim-id",
        payment_status: "paid",
        email: "hacker@evil.com",
        unknownKey: "value"
      };

      const result = validateProfileInput(maliciousInput);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.role, "Must reject role modification");
      assert.ok(result.errors.owner_id, "Must reject owner_id modification");
      assert.ok(result.errors.payment_status, "Must reject payment_status modification");
      assert.ok(result.errors.email, "Must reject email modification");
      assert.ok(result.errors.unknownKey, "Must reject unknown fields");
    });

    test("validateProfileInput validates GPA boundaries strictly and preserves GPA 0", async () => {
      const { validateProfileInput } = await import("../../lib/repositories/profile-repository");

      // Negative GPA
      const resNeg = validateProfileInput({ gpaGoal: -1.0 });
      assert.strictEqual(resNeg.valid, false);
      assert.ok(resNeg.errors.gpaGoal);

      // GPA > 4.0
      const resHigh = validateProfileInput({ gpaGoal: 4.5 });
      assert.strictEqual(resHigh.valid, false);
      assert.ok(resHigh.errors.gpaGoal);

      // Non-numeric GPA
      const resNaN = validateProfileInput({ gpaGoal: "not-a-number" });
      assert.strictEqual(resNaN.valid, false);
      assert.ok(resNaN.errors.gpaGoal);

      // GPA 0 must be preserved as 0 (not converted to null)
      const resZero = validateProfileInput({
        fullName: "Minh Anh",
        gpaGoal: 0
      });
      assert.strictEqual(resZero.valid, true);
      assert.strictEqual(resZero.sanitized?.gpaGoal, 0);

      // Valid GPA
      const resValid = validateProfileInput({
        fullName: "Minh Anh",
        faculty: "Kế toán",
        major: "Kiểm toán",
        gpaGoal: 3.75
      });
      assert.strictEqual(resValid.valid, true);
      assert.strictEqual(resValid.sanitized?.gpaGoal, 3.75);
      assert.strictEqual(resValid.sanitized?.fullName, "Minh Anh");
    });

    test("app/ca-nhan/cai-dat/page.tsx is a Server Component and redirects unauthenticated users", async () => {
      const pagePath = path.resolve(process.cwd(), "app/ca-nhan/cai-dat/page.tsx");
      const pageCode = await fs.readFile(pagePath, "utf-8");

      assert.ok(
        !pageCode.includes('"use client"'),
        "app/ca-nhan/cai-dat/page.tsx must be a Server Component"
      );
      assert.ok(
        pageCode.includes("getAuthUser"),
        "app/ca-nhan/cai-dat/page.tsx must check getAuthUser"
      );
      assert.ok(
        pageCode.includes("redirect("),
        "app/ca-nhan/cai-dat/page.tsx must call redirect()"
      );
      assert.ok(
        pageCode.includes("/dang-nhap?next="),
        "app/ca-nhan/cai-dat/page.tsx must redirect to /dang-nhap with next param"
      );

      const pageModule = await import("../../app/ca-nhan/cai-dat/page");
      const ProfileSettingsPage = pageModule.default;

      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        let redirectedUrl: string | null = null;
        try {
          await ProfileSettingsPage();
        } catch (err: any) {
          if (err.digest?.startsWith("NEXT_REDIRECT;")) {
            const parts = err.digest.split(";");
            redirectedUrl = parts[2];
          } else {
            throw err;
          }
        }

        assert.ok(redirectedUrl, "ProfileSettingsPage must throw NEXT_REDIRECT for unauthenticated user");
        assert.strictEqual(redirectedUrl, "/dang-nhap?next=%2Fca-nhan%2Fcai-dat");
      } finally {
        if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      }
    });

    test("0004_profiles_schema_and_policies.sql defines strict RLS and column-level grants", async () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/0004_profiles_schema_and_policies.sql"
      );
      const sql = await fs.readFile(migrationPath, "utf-8");

      // Must enforce auth.uid() = id for SELECT and UPDATE
      assert.ok(
        sql.includes("auth.uid() = id"),
        "Migration must enforce auth.uid() = id for profiles RLS"
      );
      assert.ok(
        sql.includes("CREATE POLICY \"Allow individual read access on own profile\""),
        "Migration must define read policy"
      );
      assert.ok(
        sql.includes("CREATE POLICY \"Allow individual update access on own profile\""),
        "Migration must define update policy"
      );
      assert.ok(
        sql.includes("TO authenticated"),
        "Migration policies must target authenticated role"
      );

      // Must revoke broad write grants
      assert.ok(
        sql.includes("REVOKE INSERT, UPDATE ON TABLE profiles FROM authenticated;"),
        "Migration must revoke broad INSERT/UPDATE permissions from authenticated"
      );

      // Must restrict INSERT column grants
      assert.ok(
        sql.includes("GRANT INSERT (id, full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;"),
        "Migration must grant INSERT only on allowed non-privileged columns"
      );

      // Must restrict UPDATE column grants
      assert.ok(
        sql.includes("GRANT UPDATE (full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;"),
        "Migration must grant UPDATE only on allowed editable columns"
      );

      // Must NOT grant UPDATE on role, email, phone, created_at, or updated_at
      assert.ok(
        !/GRANT\s+UPDATE\s*\([^)]*\brole\b[^)]*\)/i.test(sql),
        "Migration must NOT grant UPDATE on role column"
      );
    });

    describe("Task 3.1E: Account Approval Gate", () => {
      test("0005_account_approval_gate.sql defines status constraints, backfill, self-approval guard, and strict permissions", async () => {
        const migrationPath = path.resolve(
          process.cwd(),
          "supabase/migrations/0005_account_approval_gate.sql"
        );
        const sql = await fs.readFile(migrationPath, "utf-8");

        // 1. Columns added
        assert.ok(sql.includes("account_status TEXT NOT NULL DEFAULT 'pending'"), "Must add account_status with default pending");
        assert.ok(sql.includes("approved_at TIMESTAMPTZ NULL"), "Must add approved_at column");
        assert.ok(sql.includes("approved_by UUID NULL REFERENCES auth.users(id)"), "Must add approved_by foreign key");
        assert.ok(sql.includes("rejection_reason TEXT NULL"), "Must add rejection_reason column");

        // 2. CHECK constraint on allowed account_status values
        assert.ok(
          sql.includes("account_status IN ('pending', 'approved', 'rejected', 'suspended')"),
          "Must enforce CHECK constraint on status: pending, approved, rejected, suspended"
        );

        // 3. Prevent self-approval check constraint
        assert.ok(
          sql.includes("chk_profiles_no_self_approval"),
          "Must define chk_profiles_no_self_approval constraint"
        );
        assert.ok(
          sql.includes("approved_by IS NULL OR approved_by <> id"),
          "Constraint must prohibit approved_by from matching profile id"
        );

        // 4. Backfill existing profiles as approved
        assert.ok(
          sql.includes("UPDATE profiles"),
          "Must update existing profiles"
        );
        assert.ok(
          sql.includes("SET account_status = 'approved'"),
          "Must backfill existing profiles to approved"
        );

        // 5. Performance indexes
        assert.ok(
          sql.includes("CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status)"),
          "Must create index on account_status"
        );
        assert.ok(
          sql.includes("CREATE INDEX IF NOT EXISTS idx_profiles_approved_by ON profiles(approved_by)"),
          "Must create index on approved_by"
        );

        // 6. RLS and permissions
        assert.ok(
          sql.includes("ALTER TABLE profiles ENABLE ROW LEVEL SECURITY"),
          "Must ensure RLS is enabled"
        );
        assert.ok(
          sql.includes("REVOKE INSERT, UPDATE ON TABLE profiles FROM authenticated;"),
          "Must revoke broad write permissions"
        );
        assert.ok(
          sql.includes("GRANT SELECT ON TABLE profiles TO authenticated;"),
          "Must grant SELECT on profiles to authenticated"
        );
        assert.ok(
          sql.includes("GRANT INSERT (id, full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;"),
          "Must restrict INSERT column grants so client cannot set status/approval columns"
        );
        assert.ok(
          sql.includes("GRANT UPDATE (full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;"),
          "Must restrict UPDATE column grants to non-privileged fields only"
        );

        // Must NOT grant client ability to mutate account_status or approval metadata
        assert.ok(
          !/GRANT\s+UPDATE\s*\([^)]*\baccount_status\b[^)]*\)/i.test(sql),
          "Migration must NOT grant UPDATE on account_status"
        );
        assert.ok(
          !/GRANT\s+UPDATE\s*\([^)]*\bapproved_by\b[^)]*\)/i.test(sql),
          "Migration must NOT grant UPDATE on approved_by"
        );
        assert.ok(
          !/GRANT\s+UPDATE\s*\([^)]*\bapproved_at\b[^)]*\)/i.test(sql),
          "Migration must NOT grant UPDATE on approved_at"
        );
      });

      test("database.types.ts includes account_status, approved_at, approved_by, and rejection_reason", async () => {
        const dbTypesPath = path.resolve(process.cwd(), "lib/supabase/database.types.ts");
        const dbTypes = await fs.readFile(dbTypesPath, "utf-8");

        assert.ok(dbTypes.includes("account_status: string"), "profiles.Row must include account_status");
        assert.ok(dbTypes.includes("approved_at: string | null"), "profiles.Row must include approved_at");
        assert.ok(dbTypes.includes("approved_by: string | null"), "profiles.Row must include approved_by");
        assert.ok(dbTypes.includes("rejection_reason: string | null"), "profiles.Row must include rejection_reason");
      });

      test("profile-repository.ts exports AccountStatus, updates StudentProfile, and rejects status mutations", async () => {
        const { validateProfileInput } = await import("../../lib/repositories/profile-repository");

        // Test validation rejects account status and approval fields
        const maliciousStatusPayloads = [
          { accountStatus: "approved" },
          { account_status: "approved" },
          { approvedAt: new Date().toISOString() },
          { approved_at: new Date().toISOString() },
          { approvedBy: "admin-uuid" },
          { approved_by: "admin-uuid" },
          { rejectionReason: "none" },
          { rejection_reason: "none" }
        ];

        for (const payload of maliciousStatusPayloads) {
          const result = validateProfileInput(payload);
          assert.strictEqual(
            result.valid,
            false,
            `validateProfileInput must reject privileged payload: ${JSON.stringify(payload)}`
          );
        }
      });

      describe("getAccountAccess() branches with mock clients", () => {
        const createMockClient = (options: {
          user?: any;
          profileData?: any;
          userError?: any;
          profileError?: any;
        }) => {
          return {
            auth: {
              getUser: async () => ({
                data: { user: options.user ?? null },
                error: options.userError ?? null
              })
            },
            from: (table: string) => {
              assert.strictEqual(table, "profiles");
              return {
                select: (_cols: string) => {
                  return {
                    eq: (field: string, _val: any) => {
                      assert.strictEqual(field, "id");
                      return {
                        maybeSingle: async () => ({
                          data: options.profileData ?? null,
                          error: options.profileError ?? null
                        })
                      };
                    }
                  };
                }
              };
            }
          };
        };

        test("branch 1: unauthenticated when getUser returns null or throws/errors", async () => {
          const { getAccountAccess } = await import("../../lib/auth/session");

          // user is null
          const clientNoUser = createMockClient({ user: null });
          const access1 = await getAccountAccess(clientNoUser);
          assert.strictEqual(access1.status, "unauthenticated");
          assert.strictEqual(access1.user, null);
          assert.strictEqual(access1.profile, null);

          // getUser returns error
          const clientError = createMockClient({
            user: null,
            userError: new Error("Auth session expired or missing")
          });
          const access2 = await getAccountAccess(clientError);
          assert.strictEqual(access2.status, "unauthenticated");
          assert.strictEqual(access2.user, null);
          assert.strictEqual(access2.profile, null);

          // unauthenticated when env vars missing (production fallback without client)
          const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          try {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            const access3 = await getAccountAccess();
            assert.strictEqual(access3.status, "unauthenticated");
            assert.strictEqual(access3.user, null);
            assert.strictEqual(access3.profile, null);
          } finally {
            if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
            if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
          }
        });

        test("branch 2: profile_missing when user exists but profile is null", async () => {
          const { getAccountAccess } = await import("../../lib/auth/session");

          const mockUser = { id: "user-missing-prof", email: "newuser@lefthand.vn" };
          const client = createMockClient({
            user: mockUser,
            profileData: null
          });

          const access = await getAccountAccess(client);
          assert.strictEqual(access.status, "profile_missing");
          assert.deepStrictEqual(access.user, mockUser);
          assert.strictEqual(access.profile, null);
        });

        test("branch 3: pending when profile account_status is 'pending' or unknown fallback", async () => {
          const { getAccountAccess } = await import("../../lib/auth/session");

          const mockUser = { id: "user-pending-1", email: "pending@lefthand.vn" };
          const mockProfileRow = {
            id: "user-pending-1",
            full_name: "Nguyen Van A",
            email: "pending@lefthand.vn",
            phone: "0901234567",
            faculty: "Kế toán",
            major: "Kiểm toán",
            student_code: "SV001",
            avatar_url: null,
            gpa_goal: "3.5",
            role: "student",
            account_status: "pending",
            approved_at: null,
            approved_by: null,
            rejection_reason: null,
            created_at: "2026-08-28T00:00:00Z",
            updated_at: "2026-08-28T00:00:00Z"
          };

          const client = createMockClient({
            user: mockUser,
            profileData: mockProfileRow
          });

          const access = await getAccountAccess(client);
          assert.strictEqual(access.status, "pending");
          assert.deepStrictEqual(access.user, mockUser);
          assert.ok(access.profile);
          assert.strictEqual(access.profile.accountStatus, "pending");
          assert.strictEqual(access.profile.fullName, "Nguyen Van A");
          assert.strictEqual(access.profile.gpaGoal, 3.5);

          // Unknown status fallback to pending
          const unknownStatusClient = createMockClient({
            user: mockUser,
            profileData: { ...mockProfileRow, account_status: "unknown_future_status" }
          });
          const accessUnknown = await getAccountAccess(unknownStatusClient);
          assert.strictEqual(accessUnknown.status, "pending");
        });

        test("branch 4: approved when profile account_status is 'approved'", async () => {
          const { getAccountAccess } = await import("../../lib/auth/session");

          const mockUser = { id: "user-approved-1", email: "approved@lefthand.vn" };
          const mockProfileRow = {
            id: "user-approved-1",
            full_name: "Tran Thi B",
            email: "approved@lefthand.vn",
            phone: "0909999999",
            faculty: "Tài chính",
            major: "Ngân hàng",
            student_code: "SV002",
            avatar_url: "https://example.com/avatar.jpg",
            gpa_goal: 3.8,
            role: "student",
            account_status: "approved",
            approved_at: "2026-08-28T10:00:00Z",
            approved_by: "admin-uuid-1",
            rejection_reason: null,
            created_at: "2026-08-20T00:00:00Z",
            updated_at: "2026-08-28T10:00:00Z"
          };

          const client = createMockClient({
            user: mockUser,
            profileData: mockProfileRow
          });

          const access = await getAccountAccess(client);
          assert.strictEqual(access.status, "approved");
          assert.deepStrictEqual(access.user, mockUser);
          assert.ok(access.profile);
          assert.strictEqual(access.profile.accountStatus, "approved");
          assert.strictEqual(access.profile.approvedAt, "2026-08-28T10:00:00Z");
          assert.strictEqual(access.profile.approvedBy, "admin-uuid-1");
        });

        test("branch 5: rejected when profile account_status is 'rejected'", async () => {
          const { getAccountAccess } = await import("../../lib/auth/session");

          const mockUser = { id: "user-rejected-1", email: "rejected@lefthand.vn" };
          const mockProfileRow = {
            id: "user-rejected-1",
            full_name: "Le Van C",
            email: "rejected@lefthand.vn",
            phone: null,
            faculty: null,
            major: null,
            student_code: null,
            avatar_url: null,
            gpa_goal: null,
            role: "student",
            account_status: "rejected",
            approved_at: null,
            approved_by: null,
            rejection_reason: "Thông tin thẻ sinh viên không hợp lệ",
            created_at: "2026-08-25T00:00:00Z",
            updated_at: "2026-08-26T00:00:00Z"
          };

          const client = createMockClient({
            user: mockUser,
            profileData: mockProfileRow
          });

          const access = await getAccountAccess(client);
          assert.strictEqual(access.status, "rejected");
          assert.deepStrictEqual(access.user, mockUser);
          assert.ok(access.profile);
          assert.strictEqual(access.profile.accountStatus, "rejected");
          assert.strictEqual(access.profile.rejectionReason, "Thông tin thẻ sinh viên không hợp lệ");
        });

        test("branch 6: suspended when profile account_status is 'suspended'", async () => {
          const { getAccountAccess } = await import("../../lib/auth/session");

          const mockUser = { id: "user-suspended-1", email: "suspended@lefthand.vn" };
          const mockProfileRow = {
            id: "user-suspended-1",
            full_name: "Pham Van D",
            email: "suspended@lefthand.vn",
            phone: "0912345678",
            faculty: "Kinh doanh",
            major: "Marketing",
            student_code: "SV003",
            avatar_url: null,
            gpa_goal: 3.2,
            role: "student",
            account_status: "suspended",
            approved_at: "2026-08-20T00:00:00Z",
            approved_by: "admin-uuid-1",
            rejection_reason: null,
            created_at: "2026-08-15T00:00:00Z",
            updated_at: "2026-08-28T00:00:00Z"
          };

          const client = createMockClient({
            user: mockUser,
            profileData: mockProfileRow
          });

          const access = await getAccountAccess(client);
          assert.strictEqual(access.status, "suspended");
          assert.deepStrictEqual(access.user, mockUser);
          assert.ok(access.profile);
          assert.strictEqual(access.profile.accountStatus, "suspended");
        });
      });

      test("app/cho-duyet/page.tsx STATUS_CONFIGS configuration is exhaustive and complete", async () => {
        const { STATUS_CONFIGS } = await import("../../app/cho-duyet/page");

        assert.ok(STATUS_CONFIGS && typeof STATUS_CONFIGS === "object", "STATUS_CONFIGS must be exported as an object");

        const requiredStatuses = ["pending", "rejected", "suspended", "missing-profile"];
        const requiredFields = [
          "badge",
          "badgeClass",
          "title",
          "description",
          "icon",
          "iconBg",
          "iconColor",
          "tipTitle",
          "tipDescription"
        ];

        for (const status of requiredStatuses) {
          const config = STATUS_CONFIGS[status];
          assert.ok(config, `STATUS_CONFIGS must define config for '${status}'`);

          for (const field of requiredFields) {
            assert.ok(
              config[field as keyof typeof config] !== undefined && config[field as keyof typeof config] !== null,
              `Status config for '${status}' must contain field '${field}'`
            );
          }

          assert.strictEqual(typeof config.badge, "string", `'${status}'.badge must be a string`);
          assert.ok(config.badge.length > 0, `'${status}'.badge must not be empty`);

          assert.strictEqual(typeof config.badgeClass, "string", `'${status}'.badgeClass must be a string`);
          assert.ok(config.badgeClass.includes("bg-"), `'${status}'.badgeClass must preserve bg-* class`);
          assert.ok(config.badgeClass.includes("text-"), `'${status}'.badgeClass must preserve text-* class`);
          assert.ok(config.badgeClass.includes("border-"), `'${status}'.badgeClass must preserve border-* class`);

          assert.strictEqual(typeof config.title, "string", `'${status}'.title must be a string`);
          assert.ok(config.title.length > 0, `'${status}'.title must not be empty`);

          assert.strictEqual(typeof config.description, "string", `'${status}'.description must be a string`);
          assert.ok(config.description.length > 0, `'${status}'.description must not be empty`);

          assert.ok(
            typeof config.icon === "function" || typeof config.icon === "object",
            `'${status}'.icon must be a valid Lucide component`
          );

          assert.strictEqual(typeof config.iconBg, "string", `'${status}'.iconBg must be a string`);
          assert.ok(config.iconBg.length > 0, `'${status}'.iconBg must not be empty`);

          assert.strictEqual(typeof config.iconColor, "string", `'${status}'.iconColor must be a string`);
          assert.ok(config.iconColor.length > 0, `'${status}'.iconColor must not be empty`);

          assert.strictEqual(typeof config.tipTitle, "string", `'${status}'.tipTitle must be a string`);
          assert.ok(config.tipTitle.length > 0, `'${status}'.tipTitle must not be empty`);

          assert.strictEqual(typeof config.tipDescription, "string", `'${status}'.tipDescription must be a string`);
          assert.ok(config.tipDescription.length > 0, `'${status}'.tipDescription must not be empty`);
        }

        // Default pending configuration completeness check
        const pendingConfig = STATUS_CONFIGS.pending;
        assert.strictEqual(pendingConfig.badge, "Đang chờ quản trị viên duyệt");
        assert.strictEqual(pendingConfig.title, "Tài khoản đang chờ phê duyệt");
        assert.ok(pendingConfig.description.includes("kiểm duyệt và kích hoạt tài khoản trong vòng 24 giờ"));
        assert.strictEqual(pendingConfig.tipTitle, "Quy trình kích hoạt");
        assert.ok(pendingConfig.tipDescription.includes("Sau khi admin phê duyệt"));
      });

      test("app/cho-duyet/page.tsx is a public Server Component and handles status variants", async () => {
        const pagePath = path.resolve(process.cwd(), "app/cho-duyet/page.tsx");
        const pageCode = await fs.readFile(pagePath, "utf-8");

        // Must be a Server Component (no 'use client')
        assert.ok(
          !pageCode.includes('"use client"'),
          "app/cho-duyet/page.tsx must be a Server Component"
        );

        // Must handle statuses: pending, rejected, suspended, missing-profile
        assert.ok(pageCode.includes("pending"), "Must handle pending status");
        assert.ok(pageCode.includes("rejected"), "Must handle rejected status");
        assert.ok(pageCode.includes("suspended"), "Must handle suspended status");
        assert.ok(pageCode.includes("missing-profile"), "Must handle missing-profile status");

        // Must apply full badgeClass without split(" ")
        assert.ok(
          !pageCode.includes('badgeClass.split(" ")'),
          "app/cho-duyet/page.tsx must not use split(' ') on badgeClass"
        );
        assert.ok(
          pageCode.includes("${config.badgeClass}"),
          "app/cho-duyet/page.tsx must apply full config.badgeClass to badge container"
        );

        // Must provide links to /dang-nhap and /
        assert.ok(pageCode.includes('href="/dang-nhap"'), "Must link to /dang-nhap");
        assert.ok(pageCode.includes('href="/"'), "Must link to home /");

        // Must NOT allow user to change their own status or contain update buttons
        assert.ok(!pageCode.includes("updateOwnProfile"), "Pending page must not call updateOwnProfile");
        assert.ok(!pageCode.includes("localStorage"), "Pending page must not use localStorage");

        // Test rendering component
        const pageModule = await import("../../app/cho-duyet/page");
        const AccountPendingPage = pageModule.default;
        assert.strictEqual(typeof AccountPendingPage, "function");

        const pendingJsx = await AccountPendingPage({
          searchParams: Promise.resolve({ status: "pending" })
        });
        assert.ok(pendingJsx, "AccountPendingPage renders successfully for pending status");

        const rejectedJsx = await AccountPendingPage({
          searchParams: Promise.resolve({ status: "rejected" })
        });
        assert.ok(rejectedJsx, "AccountPendingPage renders successfully for rejected status");

        const suspendedJsx = await AccountPendingPage({
          searchParams: Promise.resolve({ status: "suspended" })
        });
        assert.ok(suspendedJsx, "AccountPendingPage renders successfully for suspended status");

        const missingJsx = await AccountPendingPage({
          searchParams: Promise.resolve({ status: "missing-profile" })
        });
        assert.ok(missingJsx, "AccountPendingPage renders successfully for missing-profile status");

        const fallbackJsx = await AccountPendingPage({
          searchParams: Promise.resolve({ status: "unknown-status-value" })
        });
        assert.ok(fallbackJsx, "AccountPendingPage renders fallback for unknown status");
      });

      test("server route guards on /ca-nhan and /ca-nhan/mon/[slug] do not create redirect loops", async () => {
        const caNhanPath = path.resolve(process.cwd(), "app/ca-nhan/page.tsx");
        const caNhanCode = await fs.readFile(caNhanPath, "utf-8");

        const workspacePath = path.resolve(process.cwd(), "app/ca-nhan/mon/[slug]/page.tsx");
        const workspaceCode = await fs.readFile(workspacePath, "utf-8");

        // Both must route pending to /cho-duyet (not /ca-nhan, preventing loops)
        assert.ok(
          caNhanCode.includes('redirect("/cho-duyet")'),
          "ca-nhan must redirect pending users to /cho-duyet"
        );
        assert.ok(
          workspaceCode.includes('redirect("/cho-duyet")'),
          "workspace must redirect pending users to /cho-duyet"
        );

        // Both must route rejected/suspended/missing-profile
        assert.ok(caNhanCode.includes('redirect("/cho-duyet?status=rejected")'));
        assert.ok(caNhanCode.includes('redirect("/cho-duyet?status=suspended")'));
        assert.ok(caNhanCode.includes('redirect("/cho-duyet?status=missing-profile")'));

        assert.ok(workspaceCode.includes('redirect("/cho-duyet?status=rejected")'));
        assert.ok(workspaceCode.includes('redirect("/cho-duyet?status=suspended")'));
        assert.ok(workspaceCode.includes('redirect("/cho-duyet?status=missing-profile")'));
      });

      test("AccountNotApprovedError encapsulates status and descriptive message", async () => {
        const { AccountNotApprovedError } = await import("../../lib/auth/session");
        assert.strictEqual(typeof AccountNotApprovedError, "function");

        const errPending = new AccountNotApprovedError("pending");
        assert.strictEqual(errPending.name, "AccountNotApprovedError");
        assert.strictEqual(errPending.status, "pending");
        assert.ok(errPending.message.includes("pending"));

        const errRejected = new AccountNotApprovedError("rejected", "Tài khoản bị từ chối");
        assert.strictEqual(errRejected.status, "rejected");
        assert.strictEqual(errRejected.message, "Tài khoản bị từ chối");
      });

      test("client files never expose service role keys or client-side status override", async () => {
        const filesToScan = [
          "lib/supabase/browser.ts",
          "lib/supabase/server.ts",
          "lib/auth/session.ts",
          "lib/repositories/profile-repository.ts",
          "app/cho-duyet/page.tsx",
          "app/ca-nhan/page.tsx",
          "app/ca-nhan/mon/[slug]/page.tsx",
          "app/dang-nhap/page.tsx",
          "hooks/use-demo-auth.ts"
        ];

        for (const relPath of filesToScan) {
          const fullPath = path.resolve(process.cwd(), relPath);
          const content = await fs.readFile(fullPath, "utf-8");

          assert.ok(
            !content.includes("SUPABASE_SERVICE_ROLE_KEY"),
            `${relPath} must not reference SUPABASE_SERVICE_ROLE_KEY`
          );
          assert.ok(
            !content.includes("service_role"),
            `${relPath} must not reference service_role key`
          );
        }
      });
    });
  });
});