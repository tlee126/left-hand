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
      "app/auth/callback/route.ts"
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