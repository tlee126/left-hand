import { getAccountAccess, type AccountAccessClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "@/lib/http/bounded-json";
import {
  isMaterialProduct,
  markMaterialAssetUploadRetryable,
  reserveMaterialAssetUpload,
  MaterialAssetUploadConflictError
} from "@/lib/repositories/material-asset-repository";
import {
  createMaterialUploadCapability,
  MATERIALS_BUCKET,
  MATERIAL_UPLOAD_EXPIRES_IN_SECONDS,
  isSupportedMaterialMimeType,
  isValidMaterialUuid,
  materialSizeLimit,
  sanitizeMaterialFilename
} from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, no-store";
const MAX_JSON_BYTES = 32 * 1024;

function response(body: { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type UserScopedSupabaseClient = SupabaseClient<Database>;

class MaterialUploadMetadataError extends Error {
  constructor(readonly fields: readonly string[], readonly reason: string) {
    super("Invalid material upload metadata.");
    this.name = "MaterialUploadMetadataError";
  }
}

function logMetadataFailure(fields: readonly string[], reason: string): void {
  console.error("Material upload metadata rejected", { fields, reason });
}

async function requireApprovedAdmin(supabase: UserScopedSupabaseClient): Promise<Response | { client: UserScopedSupabaseClient }> {
  try {
    const access = await getAccountAccess(supabase as unknown as AccountAccessClient);
    if (access.status === "unauthenticated") return response({ error: "Authentication required." }, 401);
    if (access.status !== "approved" || access.profile?.role !== "admin") return response({ error: "Upload is not permitted." }, 403);
    return { client: supabase };
  } catch {
    return response({ error: "Unable to prepare material upload." }, 500);
  }
}

async function readPrepareBody(request: Request): Promise<{ originalName: string; mimeType: string; byteSize: number; idempotencyKey: string } | null> {
  const body = await readBoundedJson(request, MAX_JSON_BYTES);
  if (!isRecord(body) || Object.keys(body).length !== 4) throw new MaterialUploadMetadataError(["body"], "expected exactly four metadata fields");
  if (typeof body.originalName !== "string" || body.originalName.length === 0 || body.originalName.length > 200) throw new MaterialUploadMetadataError(["originalName"], "must be 1-200 characters");
  if (typeof body.mimeType !== "string" || !isSupportedMaterialMimeType(body.mimeType)) throw new MaterialUploadMetadataError(["mimeType"], "unsupported MIME type");
  if (typeof body.byteSize !== "number" || !Number.isSafeInteger(body.byteSize) || body.byteSize <= 0) throw new MaterialUploadMetadataError(["byteSize"], "must be a positive safe integer");
  if (body.byteSize > materialSizeLimit(body.mimeType)) throw new MaterialUploadMetadataError(["byteSize"], "exceeds the MIME-specific limit");
  if (!isValidMaterialUuid(body.idempotencyKey)) throw new MaterialUploadMetadataError(["idempotencyKey"], "must be a UUID");
  return { originalName: body.originalName, mimeType: body.mimeType, byteSize: body.byteSize, idempotencyKey: body.idempotencyKey.toLowerCase() };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  let supabase: UserScopedSupabaseClient;
  try {
    // createClient() is the existing SSR client: it carries the request's
    // authenticated session JWT into every downstream database call.
    supabase = await createClient();
  } catch {
    return response({ error: "Unable to prepare material upload." }, 500);
  }
  const admin = await requireApprovedAdmin(supabase);
  if (admin instanceof Response) return admin;

  let reservationId: string | null = null;
  let reservationCreated = false;
  try {
    const { id } = await context.params;
    if (!isValidMaterialUuid(id)) return response({ error: "Invalid material upload request." }, 400);
    const productId = id.toLowerCase();
    const input = await readPrepareBody(request);
    if (!input) throw new MaterialUploadMetadataError(["body"], "missing metadata");
    if (!isSupportedMaterialMimeType(input.mimeType) || input.byteSize > materialSizeLimit(input.mimeType)) {
      throw new MaterialUploadMetadataError(["mimeType", "byteSize"], "unsupported MIME or size limit");
    }
    let safeFilename: string;
    try {
      safeFilename = sanitizeMaterialFilename(input.originalName);
    } catch {
      throw new MaterialUploadMetadataError(["originalName"], "cannot produce a database-compatible filename");
    }
    // The RPC payload is intentionally explicit: originalName is retained for display,
    // while safeFilename is the canonical storage-path component.
    if (!(await isMaterialProduct(productId, admin.client))) return response({ error: "Material upload is not permitted." }, 404);

    const reservation = await reserveMaterialAssetUpload({ productId, originalName: input.originalName, safeFilename, mimeType: input.mimeType, byteSize: input.byteSize, idempotencyKey: input.idempotencyKey }, admin.client);
    reservationId = reservation.reservationId;
    reservationCreated = reservation.isNew;
    if (reservation.status === "committed") {
      return Response.json({ reservationId, version: reservation.version, status: "committed" }, { headers: { "Cache-Control": CACHE_CONTROL } });
    }
    if (reservation.cleanupPending) return response({ error: "Material upload is not available." }, 409);
    const capability = await createMaterialUploadCapability(reservation.storagePath);
    return Response.json({ reservationId, version: reservation.version, status: "reserved", upload: { bucket: MATERIALS_BUCKET, path: capability.storagePath, token: capability.token }, expiresIn: MATERIAL_UPLOAD_EXPIRES_IN_SECONDS }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof BoundedJsonError) return response({ error: error.code === BoundedJsonErrorCode.TooLarge ? "Request body is too large." : "Invalid material upload request." }, error.code === BoundedJsonErrorCode.TooLarge ? 413 : 400);
    if (error instanceof MaterialUploadMetadataError) {
      logMetadataFailure(error.fields, error.reason);
      return response({ error: "Invalid material upload metadata." }, 400);
    }
    if (error instanceof Error && error.name === "MaterialAssetInputError") return response({ error: "Invalid material upload metadata." }, 400);
    if (error instanceof MaterialAssetUploadConflictError) return response({ error: "Material upload is not available." }, 409);
    if (reservationId && reservationCreated) {
      try { await markMaterialAssetUploadRetryable(reservationId, admin.client); } catch { /* retain the reservation for cleanup/reconciliation */ }
    }
    return response({ error: "Unable to prepare material upload." }, 500);
  }
}
