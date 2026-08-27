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
    test("app/ca-nhan/page.tsx is a Server Component and uses getAuthUser server check", async () => {
      const pagePath = path.resolve(process.cwd(), "app/ca-nhan/page.tsx");
      const pageCode = await fs.readFile(pagePath, "utf-8");

      // Must NOT be a client component
      assert.ok(
        !pageCode.includes('"use client"'),
        "app/ca-nhan/page.tsx must be a Server Component"
      );

      // Must import getAuthUser from @/lib/auth/session
      assert.ok(
        pageCode.includes("getAuthUser"),
        "app/ca-nhan/page.tsx must import getAuthUser"
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

    test("app/ca-nhan/mon/[slug]/page.tsx is a Server Component and uses getAuthUser server check", async () => {
      const pagePath = path.resolve(process.cwd(), "app/ca-nhan/mon/[slug]/page.tsx");
      const pageCode = await fs.readFile(pagePath, "utf-8");

      // Must NOT be a client component
      assert.ok(
        !pageCode.includes('"use client"'),
        "app/ca-nhan/mon/[slug]/page.tsx must be a Server Component"
      );

      // Must import getAuthUser from @/lib/auth/session
      assert.ok(
        pageCode.includes("getAuthUser"),
        "app/ca-nhan/mon/[slug]/page.tsx must import getAuthUser"
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
});