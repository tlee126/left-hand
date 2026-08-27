import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

/**
 * Updates session in Next.js middleware by reading cookies from NextRequest,
 * validating the user with `auth.getUser()`, and setting refreshed cookies on NextResponse.
 */
export async function updateSession(
  request: NextRequest,
  customSupabaseClient?: any
) {
  let supabaseResponse = NextResponse.next({
    request
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: supabaseResponse,
      user: null
    };
  }

  const supabase =
    customSupabaseClient ??
    createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        }
      }
    });

  // IMPORTANT: Avoid using supabase.auth.getSession() which doesn't validate
  // the authentication token against the database/Supabase Auth server.
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return {
    response: supabaseResponse,
    user
  };
}
