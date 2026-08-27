import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Validates and sanitizes redirect destination to prevent open redirect vulnerabilities.
 * Allows only internal absolute paths (starting with a single `/`).
 * Rejects protocol-relative URLs (`//`), URLs with schemes (`http:`, `https:`),
 * backslashes, or external targets.
 */
function getSafeRedirectPath(rawNext: string | null): string {
  if (!rawNext) {
    return "/ca-nhan";
  }

  const trimmed = rawNext.trim();

  // Must start with exactly one '/' and not contain backslashes or protocol specifiers
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\") &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return trimmed;
  }

  return "/ca-nhan";
}

export async function handleAuthCallback(
  request: Request,
  supabaseClientPromise?: Promise<any> | any
) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const safeNext = getSafeRedirectPath(rawNext);

  if (!code) {
    return NextResponse.redirect(`${origin}/dang-nhap?error=auth_callback`);
  }

  try {
    const supabase = supabaseClientPromise
      ? await supabaseClientPromise
      : await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/dang-nhap?error=auth_callback`);
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
    } else {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  } catch {
    return NextResponse.redirect(`${origin}/dang-nhap?error=auth_callback`);
  }
}

export async function GET(request: Request) {
  return handleAuthCallback(request);
}