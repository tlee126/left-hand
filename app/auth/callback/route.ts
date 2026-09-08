import { NextResponse } from "next/server";
import { getCanonicalOrigin } from "@/lib/auth/canonical-origin";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function handleAuthCallback(
  request: Request,
  supabaseClientPromise?: Promise<any> | any
) {
  const { searchParams } = new URL(request.url);
  const origin = getCanonicalOrigin(request.url);
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

    return NextResponse.redirect(`${origin}${safeNext}`);
  } catch {
    return NextResponse.redirect(`${origin}/dang-nhap?error=auth_callback`);
  }
}

export async function GET(request: Request) {
  return handleAuthCallback(request);
}
