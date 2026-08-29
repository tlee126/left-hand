import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import type { User } from "@supabase/supabase-js";

/**
 * Checks if a requested path is a protected student route.
 * Matches `/ca-nhan` and all subpaths (e.g. `/ca-nhan/mon/*`, `/ca-nhan/cai-dat`).
 */
export function isProtectedRoute(pathname: string): boolean {
  return pathname === "/ca-nhan" || pathname.startsWith("/ca-nhan/");
}

/**
 * Checks if a requested path is a public route.
 */
export function isPublicRoute(pathname: string): boolean {
  return !isProtectedRoute(pathname);
}

/**
 * Validates and sanitizes internal redirect target path to prevent open redirect vulnerabilities.
 * Allows only internal absolute paths (starting with a single `/`).
 * Rejects protocol-relative URLs (`//`), backslashes (`\`), or explicit URL schemes (`http:`, `javascript:`, etc.).
 */
export function getSafeRedirectPath(
  rawPath: string | null | undefined,
  fallback: string = "/ca-nhan"
): string {
  if (!rawPath) {
    return fallback;
  }

  const trimmed = rawPath.trim();

  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\") &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return trimmed;
  }

  return fallback;
}

/**
 * Minimal structural client interface for middleware session checks.
 */
export interface MiddlewareAuthClient {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: Error | null }>;
  };
}

/**
 * Refreshes Supabase SSR session tokens and guards protected routes.
 * Uses `auth.getUser()` to validate user session against Supabase Auth servers.
 *
 * @param request The incoming NextRequest
 * @param clientOverride Optional client override for testing purposes
 * @returns NextResponse with refreshed cookies or redirect to login for unauthenticated users
 */
export async function updateSession(
  request: NextRequest,
  clientOverride?: MiddlewareAuthClient
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user: User | null = null;

  if (clientOverride) {
    try {
      const { data, error } = await clientOverride.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    } catch {
      user = null;
    }
  } else if (!supabaseUrl || !supabaseAnonKey) {
    // Missing Supabase config; treat user as unauthenticated
    user = null;
  } else {
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // IMPORTANT: Avoid writing any logic between createServerClient and supabase.auth.getUser()
    // auth.getUser() guarantees token authenticity with Supabase auth servers and triggers token refresh
    try {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (!error && authUser) {
        user = authUser;
      }
    } catch {
      user = null;
    }
  }

  const pathname = request.nextUrl.pathname;

  // Protect /ca-nhan and all subpaths from anonymous access
  if (!user && isProtectedRoute(pathname)) {
    const originalPath = `${pathname}${request.nextUrl.search}`;
    const safeNext = getSafeRedirectPath(originalPath);
    const redirectUrl = new URL(
      `/dang-nhap?next=${encodeURIComponent(safeNext)}`,
      request.url
    );

    const redirectResponse = NextResponse.redirect(redirectUrl);

    // Forward any cookie updates (such as expired cookie cleanup) to the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
