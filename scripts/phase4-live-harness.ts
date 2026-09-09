import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../lib/supabase/database.types";
type LiveClient = SupabaseClient<Database>;

const url = process.env.PHASE4_TEST_SUPABASE_URL;
const anonKey = process.env.PHASE4_TEST_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.PHASE4_TEST_SUPABASE_SERVICE_ROLE_KEY;

async function main() {
if (!url || !anonKey || !serviceRoleKey || process.env.PHASE4_LIVE_SCHEMA_READY !== "true") {
  console.error("[BLOCKED] Live harness requires PHASE4_LIVE_SCHEMA_READY=true and test-only Supabase URL/anon/service-role credentials.");
  console.error("[BLOCKED] This command never mocks Supabase and never applies migrations automatically.");
  process.exitCode = 2;
} else {
  const anon: LiveClient = createClient(url, anonKey);
  const server: LiveClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const requestId = "phase4-live-" + randomUUID();
  const payload = {
    p_request_id: requestId,
    p_full_name: "Phase 4 Live Fixture",
    p_phone: "0901234567",
    p_faculty: "Khoa Tài chính",
    p_major: null,
    p_interest: "Toán",
    p_need: "Live boundary fixture",
    p_note: null,
    p_source_path: "/tai-lieu/ke-toan",
    p_selected_product_slug: null,
    p_selected_subject_slug: process.env.PHASE4_TEST_SUBJECT_SLUG ?? null
  };

  const directInsert = await anon.from("consultations").insert({
    request_id: requestId + "-direct",
    full_name: payload.p_full_name,
    phone: payload.p_phone,
    faculty: payload.p_faculty,
    interest: payload.p_interest,
    need: payload.p_need
  });
  if (!directInsert.error) throw new Error("anon direct table INSERT unexpectedly succeeded");

  const directRpc = await anon.rpc("submit_consultation_intake", payload);
  if (!directRpc.error) throw new Error("anon direct RPC unexpectedly succeeded");

  const created = await server.rpc("submit_consultation_intake", payload);
  if (created.error || (created.data as { outcome?: string } | null)?.outcome !== "created") {
    throw new Error("server-only RPC did not create the fixture");
  }
  const duplicate = await server.rpc("submit_consultation_intake", payload);
  if (duplicate.error || (duplicate.data as { outcome?: string } | null)?.outcome !== "duplicate") {
    throw new Error("server-only RPC is not idempotent");
  }

  const invalidSource = await server.rpc("submit_consultation_intake", {
    ...payload,
    p_request_id: requestId + "-invalid-source",
    p_source_path: "https://evil.example/"
  });
  if (!invalidSource.error) throw new Error("invalid source path unexpectedly succeeded");

  console.log("[PASS] live direct-DML denial, direct-RPC denial, server-only RPC, idempotency, and source validation.");
  console.log("[INFO] RLS role matrix, trigger rollback, real CAS concurrency, and browser checks require optional fixtures described in the deployment contract.");
}
}

main().catch((error: unknown) => {
  console.error("[FAIL] Phase 4 live harness failed without exposing provider details.");
  process.exitCode = 1;
});
