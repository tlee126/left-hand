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
class ConsultationInvalidBodyLengthError extends Error {}

/**
 * RFC 5952-style IPv6 canonicalization, including the IPv4-mapped form.
 * `node:net.isIP` validates the address; this code only serializes that
 * validated address into one stable rate-limit key.
 */
function canonicalizeIpv4(value: string): string | null {
  if (isIP(value) !== 4) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) return null;
    const octet = Number(part);
    return Number.isInteger(octet) && octet >= 0 && octet <= 255 ? octet : null;
  });
  return octets.every((octet): octet is number => octet !== null)
    ? octets.join(".")
    : null;
}

function canonicalizeIpv6(value: string): string | null {
  if (isIP(value) !== 6 || value.includes("%")) return null;
  const halves = value.toLowerCase().split("::");
  if (halves.length > 2) return null;
  const parseSide = (side: string): string[] | null => {
    if (side === "") return [];
    const groups = side.split(":");
    const last = groups.at(-1);
    if (last?.includes(".")) {
      const ipv4 = canonicalizeIpv4(last);
      if (!ipv4) return null;
      const [first, second, third, fourth] = ipv4.split(".").map(Number);
      groups.splice(-1, 1, ((first << 8) | second).toString(16), ((third << 8) | fourth).toString(16));
    }
    return groups.every((group) => /^[0-9a-f]{1,4}$/.test(group)) ? groups : null;
  };
  const left = parseSide(halves[0]);
  const right = parseSide(halves.length === 2 ? halves[1] : "");
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right].map((group) => Number.parseInt(group, 16));
  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) return null;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return `::ffff:${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
  }
  const words = groups.map((group) => group.toString(16));
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < words.length;) {
    if (words[index] !== "0") { index += 1; continue; }
    const start = index;
    while (index < words.length && words[index] === "0") index += 1;
    if (index - start > bestLength && index - start >= 2) {
      bestStart = start;
      bestLength = index - start;
    }
  }
  if (bestStart === -1) return words.join(":");
  const before = words.slice(0, bestStart).join(":");
  const after = words.slice(bestStart + bestLength).join(":");
  return before === "" ? `::${after}` : after === "" ? `${before}::` : `${before}::${after}`;
}

export function normalizeRuntimeIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (candidate.length === 0) return null;
  return canonicalizeIpv4(candidate) ?? canonicalizeIpv6(candidate);
}

function getTrustedProxyHops(): number | null {
  if (process.env.CONSULTATION_TRUSTED_PROXY !== "true") return null;
  const raw = process.env.CONSULTATION_TRUSTED_PROXY_HOPS;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const hops = Number(raw);
  return Number.isSafeInteger(hops) && hops <= 5 ? hops : null;
}

function resolveTrustedForwardedIp(req: Request): string | null {
  // This opt-in is a deployment contract: the configured edge/proxy must
  // overwrite the header before forwarding it to Next.js. A browser cannot
  // enable this contract because it cannot change server configuration.
  const trustedProxyHops = getTrustedProxyHops();
  if (trustedProxyHops === null) return null;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const hops = forwarded.split(",").map((value) => normalizeRuntimeIp(value));
    // A malformed hop makes the whole chain unusable; never fall through to
    // another client-controlled header or silently share a global bucket.
    return hops.length > trustedProxyHops && hops.every((value): value is string => value !== null)
      ? hops[hops.length - trustedProxyHops - 1]
      : null;
  }

  return trustedProxyHops === 1 ? normalizeRuntimeIp(req.headers.get("x-real-ip")) : null;
}

/**
 * Resolves the consultation rate-limit identity.
 *
 * The target Next.js runtime does not expose `NextRequest.ip`. Deployments
 * must either provide that platform metadata or explicitly configure both
 * CONSULTATION_TRUSTED_PROXY=true and CONSULTATION_TRUSTED_PROXY_HOPS for a
 * proxy that strips and overwrites forwarding headers. Without either source
 * this returns null; it never uses a shared "unknown" bucket.
 */
export function resolveClientIp(request: NextRequest | Request): string | null {
  const runtimeIp = normalizeRuntimeIp(
    "ip" in request ? (request as NextRequest & { ip?: unknown }).ip : undefined
  );
  return runtimeIp ?? resolveTrustedForwardedIp(request);
}

/** @deprecated Use resolveClientIp. */
export const getClientIp = resolveClientIp;

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

function getDeclaredBodyLength(req: Request): number | undefined {
  const raw = req.headers.get("content-length");
  if (raw === null) return undefined;
  // Never coerce unbounded decimal input through Number: it rounds beyond
  // MAX_SAFE_INTEGER and could turn an oversized body into a chunked read.
  if (!/^(?:0|[1-9]\d*)$/.test(raw)) throw new ConsultationInvalidBodyLengthError();
  const length = BigInt(raw);
  if (length > BigInt(MAX_CONSULTATION_BODY_BYTES)) throw new ConsultationBodyTooLargeError();
  return Number(length);
}

async function readBodyWithinLimit(req: Request): Promise<string> {
  getDeclaredBodyLength(req);
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
  supabaseOrFactory: any,
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
    if (error instanceof ConsultationInvalidBodyLengthError) {
      return NextResponse.json({ error: "Invalid Content-Length" }, { status: 400 });
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
      { error: "Request identity unavailable" },
      { status: 400 }
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

  let supabase: any;
  try {
    supabase = typeof supabaseOrFactory === "function"
      ? await supabaseOrFactory()
      : supabaseOrFactory;
  } catch {
    console.error("Failed to create Supabase client");
    return NextResponse.json(
      { error: "Service Unavailable" },
      { status: 503 }
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
    // 0026 revokes direct table INSERT. Its fixed-signature RPC repeats the
    // source/catalog checks in PostgreSQL so API validation cannot be bypassed.
    const { data: rpcData, error } = await supabase.rpc("submit_consultation_intake", {
      p_request_id: idempotencyKey,
      p_full_name: data.fullName,
      p_phone: data.phone,
      p_faculty: data.faculty,
      p_major: data.major,
      p_interest: data.interest,
      p_need: data.need,
      p_note: data.note,
      p_source_path: data.sourcePath,
      p_selected_product_slug: selection.selectedProductSlug,
      p_selected_subject_slug: selection.selectedSubjectSlug
    });

    if (error) {
      console.error("Consultation intake RPC failed");
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }

    if (rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
      const outcome = Object.getOwnPropertyDescriptor(rpcData, "outcome")?.value;
      if (outcome === "duplicate") {
        return NextResponse.json({ error: "Request already processed" }, { status: 409 });
      }
      if (outcome === "created") return NextResponse.json({ success: true }, { status: 201 });
    }

    console.error("Consultation intake RPC returned an invalid response");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } catch (e) {
    console.error("Consultation intake RPC failed");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = resolveClientIp(req);
  // Defer client creation until after content-size, JSON, validation, rate
  // limit, and idempotency guards have passed.
  return handleConsultationPost(req, createClient, ip);
}
