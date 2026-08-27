import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Validates and sanitizes internal next parameter for redirects.
 */
function getSafeInternalPath(pathname: string, search: string): string {
  const fullPath = `${pathname}${search}`;
  if (
    fullPath.startsWith("/") &&
    !fullPath.startsWith("//") &&
    !fullPath.includes("\\") &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(fullPath)
  ) {
    return fullPath;
  }
  return "/ca-nhan";
}

/**
 * Middleware handling:
 * 1. Supabase session refresh via updateSession helper.
 * 2. Server-side route protection for /ca-nhan and /ca-nhan/:path*.
 * 3. Redirecting unauthenticated users to /dang-nhap?next=<internal-path>.
 */
export async function handleMiddleware(
  request: NextRequest,
  customUpdateSession?: typeof updateSession
) {
  const sessionUpdater = customUpdateSession ?? updateSession;
  const { response, user } = await sessionUpdater(request);

  const pathname = request.nextUrl.pathname;

  // Protect private student workspace: /ca-nhan and subpaths
  const isProtectedRoute =
    pathname === "/ca-nhan" || pathname.startsWith("/ca-nhan/");

  if (isProtectedRoute && !user) {
    const safeNext = getSafeInternalPath(
      pathname,
      request.nextUrl.search
    );

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dang-nhap";
    redirectUrl.search = `?next=${encodeURIComponent(safeNext)}`;

    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  return handleMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets/ (public assets)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
