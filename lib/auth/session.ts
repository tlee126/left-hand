import { createClient } from "@/lib/supabase/server";
import {
  getProfileByUserId,
  StudentProfile,
  ProfileRepositoryClient,
} from "@/lib/repositories/profile-repository";
import type { User, Session } from "@supabase/supabase-js";

export type AccountAccessStatus =
  | "unauthenticated"
  | "profile_missing"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export interface AccountAccessDecision {
  status: AccountAccessStatus;
  user: User | null;
  profile: StudentProfile | null;
}

/**
 * Minimal structural interface representing server Supabase auth methods required for session/user validation.
 */
export interface AuthSessionClient {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: Error | null }>;
    getSession?(): Promise<{ data: { session: Session | null }; error: Error | null }>;
  };
}

/**
 * Combined client interface for full account access (auth + profile repository).
 */
export type AccountAccessClient = AuthSessionClient & ProfileRepositoryClient;

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: User session is required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Custom error thrown when account is authenticated but not in approved status.
 */
export class AccountNotApprovedError extends Error {
  readonly status: AccountAccessStatus;
  constructor(status: AccountAccessStatus, message?: string) {
    super(message || `Account access restricted: status is ${status}.`);
    this.name = "AccountNotApprovedError";
    this.status = status;
  }
}

/**
 * Retrieves the current authenticated User from the Supabase server client.
 * Uses `supabase.auth.getUser()` which validates the token with Supabase auth servers.
 * Returns `null` if the user is not authenticated or if an error occurs.
 */
export async function getAuthUser(client?: AuthSessionClient): Promise<User | null> {
  try {
    const supabase = client ?? (await createClient());
    if (!supabase.auth?.getUser) {
      return null;
    }
    const { data: { user }, error } = await supabase.auth.getUser();

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
export async function getAuthSession(client?: AuthSessionClient): Promise<Session | null> {
  try {
    const supabase = client ?? (await createClient());
    if (!supabase.auth?.getSession) {
      return null;
    }
    const { data: { session }, error } = await supabase.auth.getSession();

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
export async function requireAuthUser(client?: AuthSessionClient): Promise<User> {
  const user = await getAuthUser(client);
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * Evaluates the authenticated user's account approval status on the server.
 * Uses trusted server-side Supabase auth to get the user and loads the profile via getProfileByUserId().
 * Never relies on client-provided parameters, unvalidated cookies, or localStorage.
 */
export async function getAccountAccess(client?: AccountAccessClient): Promise<AccountAccessDecision> {
  const user = await getAuthUser(client);
  if (!user) {
    return {
      status: "unauthenticated",
      user: null,
      profile: null,
    };
  }

  const profile = await getProfileByUserId(user.id, client);
  if (!profile) {
    return {
      status: "profile_missing",
      user,
      profile: null,
    };
  }

  switch (profile.accountStatus) {
    case "approved":
      return { status: "approved", user, profile };
    case "rejected":
      return { status: "rejected", user, profile };
    case "suspended":
      return { status: "suspended", user, profile };
    case "pending":
    default:
      return { status: "pending", user, profile };
  }
}