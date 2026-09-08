import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { createClient } from "@/lib/supabase/server";
import {
  validateConsultationInput,
  type ValidatedConsultationData
} from "@/lib/validation/consultation";
import {
  ConsultationInputError,
  ConsultationRepositoryError,
  resolvePublishedConsultationSelection
} from "@/lib/repositories/consultation-repository";

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
export const MAX_MAP_ENTRIES = 1000;
export const MAX_CONSULTATION_BODY_BYTES = 32 * 1024;

class ConsultationBodyTooLargeError extends Error {}

function normalizeRuntimeIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && isIP(normalized) !== 0 ? normalized.toLowerCase() : null;
}

export function getClientIp(req: NextRequest | Request): string | null {
  // Only use the platform-provided identity. Forwarded headers are not trusted
  // because this deployment does not declare a trusted proxy chain.
  if ("ip" in req) {
    return normalizeRuntimeIp((req as any).ip);
  }
  return null;
}

function cleanupRateLimitMap(now: number) {
  for (const [key, val] of RATE_LIMIT_MAP.entries()) {
    if (val.expiresAt < now) {
      RATE_LIMIT_MAP.delete(key);
    }
  }
}

export function checkRateLimit(ip: string): boolean {
  const normalizedIp = normalizeRuntimeIp(ip);
  if (!normalizedIp) return true;

  const now = Date.now();
  let entry = RATE_LIMIT_MAP.get(normalizedIp);

  if (entry && entry.expiresAt < now) {
    RATE_LIMIT_MAP.delete(normalizedIp);
    entry = undefined;
  }

  if (!entry) {
    if (RATE_LIMIT_MAP.size >= MAX_MAP_ENTRIES) {
      cleanupRateLimitMap(now);

      // If still full after cleanup, evict deterministically (oldest inserted)
      if (RATE_LIMIT_MAP.size >= MAX_MAP_ENTRIES) {
        const firstKey = RATE_LIMIT_MAP.keys().next().value;
        if (firstKey !== undefined) {
          RATE_LIMIT_MAP.delete(firstKey);
        }
      }
    }
    RATE_LIMIT_MAP.set(normalizedIp, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
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

function getDeclaredBodyLength(req: Request): number | null | undefined {
  const raw = req.headers.get("content-length");
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) return null;
  const length = Number(raw);
  return Number.isSafeInteger(length) ? length : null;
}

async function readBodyWithinLimit(req: Request): Promise<string> {
  const declaredLength = getDeclaredBodyLength(req);
  if (declaredLength === null) {
    throw new SyntaxError("Invalid Content-Length");
  }
  if (declaredLength !== undefined && declaredLength > MAX_CONSULTATION_BODY_BYTES) {
    throw new ConsultationBodyTooLargeError();
  }

  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value instanceof Uint8Array
        ? result.value
        : new Uint8Array(result.value);
      total += chunk.byteLength;
      if (total > MAX_CONSULTATION_BODY_BYTES) {
        await reader.cancel();
        throw new ConsultationBodyTooLargeError();
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SyntaxError("Invalid UTF-8 body");
  }
}

/**
 * Abstraction for the POST handler to allow dependency injection in tests.
 */
export async function handleConsultationPost(
  req: Request,
  supabase: any,
  ip: string | null
) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    const bodyText = await readBodyWithinLimit(req);
    body = JSON.parse(bodyText);
  } catch (error) {
    if (error instanceof ConsultationBodyTooLargeError) {
      return NextResponse.json(
        { error: "Request entity too large" },
        { status: 413 }
      );
    }
    if (error instanceof SyntaxError && error.message === "Invalid Content-Length") {
      return NextResponse.json(
        { error: "Invalid Content-Length" },
        { status: 400 }
      );
    }
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

  if (!ip) {
    return NextResponse.json(
      { error: "Service Unavailable" },
      { status: 503 }
    );
  }

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const rawIdempotencyKey = req.headers.get("Idempotency-Key");
  const idempotencyKey = rawIdempotencyKey?.trim();
  if (!idempotencyKey || idempotencyKey.length > 100) {
    return NextResponse.json(
      { error: "Missing or invalid Idempotency-Key header" },
      { status: 400 }
    );
  }

  const { data } = validation;
  let selection: Pick<ValidatedConsultationData, "selectedProductSlug" | "selectedSubjectSlug">;
  try {
    selection = await resolvePublishedConsultationSelection(
      data.selectedProductSlug,
      data.selectedSubjectSlug,
      supabase
    );
  } catch (error) {
    if (error instanceof ConsultationInputError) {
      return NextResponse.json(
        { error: "Invalid consultation catalog selection" },
        { status: 400 }
      );
    }
    if (error instanceof ConsultationRepositoryError) {
      console.error("Consultation catalog lookup failed");
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
    console.error("Consultation catalog lookup failed");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  try {
    // Keep the remaining insert construction below so only server-verified
    // catalog values enter persistence.
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
      selected_product_slug: selection.selectedProductSlug,
      selected_subject_slug: selection.selectedSubjectSlug
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
      console.error("Database insert failed for consultation");
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error("Database insert failed for consultation");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
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

  const ip = getClientIp(req);

  return handleConsultationPost(req, supabase, ip);
}
