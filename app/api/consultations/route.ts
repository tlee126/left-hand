import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateConsultationInput } from "@/lib/validation/consultation";

// Best-effort in-memory rate limiting.
// Note: This is NOT a distributed production rate limiter.
// It will only limit per instance/isolate and reset on restarts.
interface RateLimitEntry {
  count: number;
  expiresAt: number;
}
const RATE_LIMIT_MAP = new Map<string, RateLimitEntry>();
const MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(ip);
  if (!entry || entry.expiresAt < now) {
    RATE_LIMIT_MAP.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function resetRateLimit() {
  RATE_LIMIT_MAP.clear();
}

/**
 * Abstraction for the POST handler to allow dependency injection in tests.
 */
export async function handleConsultationPost(
  req: Request,
  supabase: any,
  ip: string
) {
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (
    !idempotencyKey ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0 ||
    idempotencyKey.length > 100
  ) {
    return NextResponse.json(
      { error: "Missing or invalid Idempotency-Key header" },
      { status: 400 }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validation = validateConsultationInput(body);
  if (!validation.isValid) {
    return NextResponse.json(
      { error: "Invalid consultation data", details: validation.errors },
      { status: 400 }
    );
  }

  const { data } = validation;

  // Insert only approved form columns plus server-provided request_id.
  // Never use .select() after insert.
  const insertPayload = {
    request_id: idempotencyKey,
    full_name: data.fullName,
    phone: data.phone,
    faculty: data.faculty,
    major: data.major,
    interest: data.interest,
    need: data.need,
    note: data.note,
    source_path: data.sourcePath,
    selected_product_slug: data.selectedProductSlug,
    selected_subject_slug: data.selectedSubjectSlug
  };

  const { error } = await supabase.from("consultations").insert(insertPayload);

  if (error) {
    // 23505 is the PostgreSQL error code for unique_violation
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Request already processed" },
        { status: 409 }
      );
    }

    // Do not log full phone, note, request body, or secrets.
    console.error("Database insert failed for consultation", {
      code: error.code,
      message: error.message
    });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function POST(req: NextRequest) {
  let supabase;
  try {
    // Use the existing server Supabase client
    supabase = await createClient();
  } catch (e) {
    console.error("Failed to create Supabase client");
    return NextResponse.json(
      { error: "Service Unavailable" },
      { status: 503 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for") ||
    (req as any).ip ||
    "unknown";

  return handleConsultationPost(req, supabase, ip);
}
