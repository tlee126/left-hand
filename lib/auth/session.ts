import { createClient } from "@/lib/supabase/server";
import type { User, Session } from "@supabase/supabase-js";

/**
 * Custom error thrown when authentication is required but missing or invalid.
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: User session is required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Retrieves the current authenticated User from the Supabase server client.
 * Uses `supabase.auth.getUser()` which validates the token with Supabase auth servers.
 * Returns `null` if the user is not authenticated or if an error occurs.
 */
export async function getAuthUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current Session from the Supabase server client.
 * Returns `null` if no active session exists or if an error occurs.
 */
export async function getAuthSession(): Promise<Session | null> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Requires an authenticated user.
 * Returns the authenticated `User` object or throws an `UnauthorizedError`.
 */
export async function requireAuthUser(): Promise<User> {
  const user = await getAuthUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}