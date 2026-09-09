// Next.js bundles this marker as server-only; the internal empty entry keeps
// direct Node-based route tests importable while preserving the server module
// boundary in the Next build.
import "next/dist/compiled/server-only/empty.js";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Server-only client for controlled database mutations. */
export function createServerAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server-only credentials are not configured");
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
