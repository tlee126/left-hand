/**
 * Unit Tests for Supabase Auth Session Refresh Middleware
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextRequest } from "next/server";
import {
  isProtectedRoute,
  isPublicRoute,
  getSafeRedirectPath,
  updateSession,
  type MiddlewareAuthClient
} from "../../lib/supabase/middleware";
import { middleware, config } from "../../middleware";

describe("Supabase Auth Session Refresh Middleware", () => {
  describe("1. Route Classification & Helper Contracts", () => {
    test("isProtectedRoute correctly identifies protected student routes and subpaths", () => {
      assert.strictEqual(isProtectedRoute("/ca-nhan"), true);
      assert.strictEqual(isProtectedRoute("/ca-nhan/cai-dat"), true);
      assert.strictEqual(isProtectedRoute("/ca-nhan/mon/ke-toan-tai-chinh-1"), true);
      assert.strictEqual(isProtectedRoute("/ca-nhan/mon/kinh-te-vi-mo"), true);
      assert.strictEqual(isProtectedRoute("/ca-nhan/anything/else"), true);

      // Non-protected routes
      assert.strictEqual(isProtectedRoute("/"), false);
      assert.strictEqual(isProtectedRoute("/dang-nhap"), false);
      assert.strictEqual(isProtectedRoute("/dang-ky"), false);
      assert.strictEqual(isProtectedRoute("/auth/callback"), false);
      assert.strictEqual(isProtectedRoute("/cho-duyet"), false);
      assert.strictEqual(isProtectedRoute("/khoa-hoc"), false);
      assert.strictEqual(isProtectedRoute("/khoa-hoc/khoa-1"), false);
      assert.strictEqual(isProtectedRoute("/tai-lieu"), false);
      assert.strictEqual(isProtectedRoute("/tai-lieu/tai-lieu-1"), false);
      assert.strictEqual(isProtectedRoute("/tutor"), false);
      assert.strictEqual(isProtectedRoute("/tutor/gia-su-1"), false);
    });

    test("isPublicRoute correctly identifies public pages", () => {
      assert.strictEqual(isPublicRoute("/"), true);
      assert.strictEqual(isPublicRoute("/dang-nhap"), true);
      assert.strictEqual(isPublicRoute("/dang-ky"), true);
      assert.strictEqual(isPublicRoute("/auth/callback"), true);
      assert.strictEqual(isPublicRoute("/cho-duyet"), true);
      assert.strictEqual(isPublicRoute("/khoa-hoc"), true);
      assert.strictEqual(isPublicRoute("/khoa-hoc/ke-toan"), true);
      assert.strictEqual(isPublicRoute("/tai-lieu"), true);
      assert.strictEqual(isPublicRoute("/tutor"), true);

      assert.strictEqual(isPublicRoute("/ca-nhan"), false);
      assert.strictEqual(isPublicRoute("/ca-nhan/cai-dat"), false);
    });

    test("getSafeRedirectPath preserves valid internal paths and query strings", () => {
      assert.strictEqual(getSafeRedirectPath("/ca-nhan"), "/ca-nhan");
      assert.strictEqual(getSafeRedirectPath("/ca-nhan/cai-dat"), "/ca-nhan/cai-dat");
      assert.strictEqual(
        getSafeRedirectPath("/ca-nhan/mon/ke-toan-tai-chinh-1?tab=docs&page=1"),
        "/ca-nhan/mon/ke-toan-tai-chinh-1?tab=docs&page=1"
      );
      assert.strictEqual(getSafeRedirectPath("/khoa-hoc/kinh-te"), "/khoa-hoc/kinh-te");
    });

    test("getSafeRedirectPath rejects open redirect attacks and falls back safely", () => {
      const maliciousTargets = [
        "https://evil.com",
        "http://attacker.com/phishing",
        "//evil.com",
        "//attacker.com/bypass",
        "///evil.com",
        "\\evil.com",
        "/\\evil.com",
        "javascript:alert(1)",
        "data:text/html,<h1>hacked</h1>",
        "ftp://files.evil.com",
        "",
        "   ",
        null,
        undefined
      ];

      for (const target of maliciousTargets) {
        const safe = getSafeRedirectPath(target);
        assert.strictEqual(
          safe,
          "/ca-nhan",
          `Malicious or invalid target '${target}' must resolve to fallback '/ca-nhan'`
        );
      }
    });

    test("getSafeRedirectPath respects custom fallback", () => {
      assert.strictEqual(getSafeRedirectPath("https://evil.com", "/custom-fallback"), "/custom-fallback");
      assert.strictEqual(getSafeRedirectPath(null, "/dang-nhap"), "/dang-nhap");
    });
  });

  describe("2. Middleware Runtime Behavior & Redirection", () => {
    const mockAnonClient: MiddlewareAuthClient = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: null
        })
      }
    };

    const mockAuthenticatedClient: MiddlewareAuthClient = {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "user-auth-123",
              email: "student@lefthand.vn",
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: "2026-08-28T00:00:00Z"
            }
          },
          error: null
        })
      }
    };

    test("public route '/' passes through for anonymous user without redirect", async () => {
      const request = new NextRequest("http://localhost:3000/");
      const response = await updateSession(request, mockAnonClient);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get("location"), null);
    });

    test("public routes '/khoa-hoc', '/tai-lieu', '/tutor' pass through without redirect", async () => {
      const publicPaths = [
        "/khoa-hoc",
        "/khoa-hoc/khoa-hoc-dau-tu",
        "/tai-lieu",
        "/tai-lieu/tai-lieu-on-thi",
        "/tutor",
        "/tutor/gia-su-kinh-te",
        "/dang-nhap",
        "/dang-ky",
        "/auth/callback"
      ];

      for (const path of publicPaths) {
        const request = new NextRequest(`http://localhost:3000${path}`);
        const response = await updateSession(request, mockAnonClient);

        assert.strictEqual(response.status, 200, `Expected 200 pass-through for public path: ${path}`);
        assert.strictEqual(response.headers.get("location"), null);
      }
    });

    test("approval route '/cho-duyet' is public and never causes a redirect loop", async () => {
      const request = new NextRequest("http://localhost:3000/cho-duyet");
      const response = await updateSession(request, mockAnonClient);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get("location"), null);

      // Authenticated user on /cho-duyet also passes through without loop
      const authRequest = new NextRequest("http://localhost:3000/cho-duyet?status=pending");
      const authResponse = await updateSession(authRequest, mockAuthenticatedClient);

      assert.strictEqual(authResponse.status, 200);
      assert.strictEqual(authResponse.headers.get("location"), null);
    });

    test("anonymous request to '/ca-nhan' redirects to /dang-nhap?next=%2Fca-nhan", async () => {
      const request = new NextRequest("http://localhost:3000/ca-nhan");
      const response = await updateSession(request, mockAnonClient);

      assert.strictEqual(response.status, 307);
      const location = response.headers.get("location");
      assert.strictEqual(location, "http://localhost:3000/dang-nhap?next=%2Fca-nhan");
    });

    test("anonymous request to nested '/ca-nhan/cai-dat' redirects to /dang-nhap?next=%2Fca-nhan%2Fcai-dat", async () => {
      const request = new NextRequest("http://localhost:3000/ca-nhan/cai-dat");
      const response = await updateSession(request, mockAnonClient);

      assert.strictEqual(response.status, 307);
      const location = response.headers.get("location");
      assert.strictEqual(location, "http://localhost:3000/dang-nhap?next=%2Fca-nhan%2Fcai-dat");
    });

    test("anonymous request to nested '/ca-nhan/mon/ke-toan-tai-chinh-1' preserves slug & query", async () => {
      const request = new NextRequest(
        "http://localhost:3000/ca-nhan/mon/ke-toan-tai-chinh-1?tab=workspace&view=grid"
      );
      const response = await updateSession(request, mockAnonClient);

      assert.strictEqual(response.status, 307);
      const location = response.headers.get("location");
      assert.strictEqual(
        location,
        "http://localhost:3000/dang-nhap?next=%2Fca-nhan%2Fmon%2Fke-toan-tai-chinh-1%3Ftab%3Dworkspace%26view%3Dgrid"
      );
    });

    test("authenticated user accessing '/ca-nhan' passes through without redirect", async () => {
      const request = new NextRequest("http://localhost:3000/ca-nhan");
      const response = await updateSession(request, mockAuthenticatedClient);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get("location"), null);
    });

    test("authenticated user accessing nested routes passes through without redirect", async () => {
      const paths = [
        "/ca-nhan/cai-dat",
        "/ca-nhan/mon/ke-toan-tai-chinh-1",
        "/ca-nhan/mon/kinh-te-vi-mo"
      ];

      for (const path of paths) {
        const request = new NextRequest(`http://localhost:3000${path}`);
        const response = await updateSession(request, mockAuthenticatedClient);

        assert.strictEqual(response.status, 200, `Expected 200 pass-through for authenticated path: ${path}`);
        assert.strictEqual(response.headers.get("location"), null);
      }
    });

    test("middleware() entry point calls updateSession and matches expected behavior", async () => {
      const request = new NextRequest("http://localhost:3000/ca-nhan");
      // Test default middleware function with missing env vars fallback
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const response = await middleware(request);
        assert.strictEqual(response.status, 307);
        assert.strictEqual(
          response.headers.get("location"),
          "http://localhost:3000/dang-nhap?next=%2Fca-nhan"
        );
      } finally {
        if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      }
    });

    test("middleware handles auth errors gracefully and treats failed auth as unauthenticated", async () => {
      const mockFailingClient: MiddlewareAuthClient = {
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: new Error("JWT expired")
          })
        }
      };

      const request = new NextRequest("http://localhost:3000/ca-nhan/cai-dat");
      const response = await updateSession(request, mockFailingClient);

      assert.strictEqual(response.status, 307);
      assert.strictEqual(
        response.headers.get("location"),
        "http://localhost:3000/dang-nhap?next=%2Fca-nhan%2Fcai-dat"
      );
    });
  });

  describe("3. Static Contracts & Security Checks", () => {
    test("middleware.ts exists and defines valid config.matcher", async () => {
      const middlewarePath = path.resolve(process.cwd(), "middleware.ts");
      const content = await fs.readFile(middlewarePath, "utf-8");

      assert.ok(content.includes("export async function middleware"), "Must export middleware function");
      assert.ok(content.includes("export const config"), "Must export config");
      assert.ok(Array.isArray(config.matcher), "config.matcher must be an array");

      // Verify matcher filters out static assets and Next internals
      const matcherPattern = config.matcher[0];
      assert.ok(matcherPattern.includes("_next/static"), "Matcher must exclude _next/static");
      assert.ok(matcherPattern.includes("_next/image"), "Matcher must exclude _next/image");
      assert.ok(matcherPattern.includes("favicon.ico"), "Matcher must exclude favicon.ico");
    });

    test("lib/supabase/middleware.ts exports updateSession and helpers", async () => {
      const helperPath = path.resolve(process.cwd(), "lib/supabase/middleware.ts");
      const content = await fs.readFile(helperPath, "utf-8");

      assert.ok(content.includes("export async function updateSession"), "Must export updateSession");
      assert.ok(content.includes("export function isProtectedRoute"), "Must export isProtectedRoute");
      assert.ok(content.includes("export function isPublicRoute"), "Must export isPublicRoute");
      assert.ok(content.includes("export function getSafeRedirectPath"), "Must export getSafeRedirectPath");

      // Must call auth.getUser()
      assert.ok(
        content.includes("auth.getUser()"),
        "Must use supabase.auth.getUser() to securely validate session tokens"
      );

      // Must NOT use getSession() for authorization decisions
      assert.ok(
        !content.includes("auth.getSession()"),
        "Must NOT use supabase.auth.getSession() in middleware"
      );

      // Must implement cookies getAll and setAll
      assert.ok(content.includes("getAll()"), "Must implement cookies.getAll()");
      assert.ok(content.includes("setAll("), "Must implement cookies.setAll()");
    });

    test("middleware and helper files never expose service role keys or hardcoded secrets", async () => {
      const filesToCheck = ["middleware.ts", "lib/supabase/middleware.ts"];

      for (const relPath of filesToCheck) {
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
