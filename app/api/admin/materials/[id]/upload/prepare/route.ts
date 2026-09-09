import { getAccountAccess } from "@/lib/auth/session";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "@/lib/http/bounded-json";
import {
  isMaterialProduct,
  releaseMaterialAssetUpload,
  reserveMaterialAssetUpload
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

async function requireApprovedAdmin(): Promise<Response | null> {
  try {
    const access = await getAccountAccess();
    if (access.status === "unauthenticated") return response({ error: "Authentication required." }, 401);
    if (access.status !== "approved" || access.profile?.role !== "admin") return response({ error: "Upload is not permitted." }, 403);
    return null;
  } catch {
    return response({ error: "Unable to prepare material upload." }, 500);
  }
}

async function readPrepareBody(request: Request): Promise<{ originalName: string; mimeType: string; byteSize: number } | null> {
  const body = await readBoundedJson(request, MAX_JSON_BYTES);
  if (!isRecord(body) || Object.keys(body).length !== 3 || typeof body.originalName !== "string" || typeof body.mimeType !== "string" || typeof body.byteSize !== "number") return null;
  if (!Number.isSafeInteger(body.byteSize) || body.byteSize <= 0) return null;
  return { originalName: body.originalName, mimeType: body.mimeType, byteSize: body.byteSize };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireApprovedAdmin();
  if (denied) return denied;

  let reservationId: string | null = null;
  try {
    const { id } = await context.params;
    if (!isValidMaterialUuid(id)) return response({ error: "Invalid material upload request." }, 400);
    const productId = id.toLowerCase();
    const input = await readPrepareBody(request);
    if (!input || !isSupportedMaterialMimeType(input.mimeType) || input.byteSize > materialSizeLimit(input.mimeType)) return response({ error: "Invalid material upload request." }, 400);
    const safeFilename = sanitizeMaterialFilename(input.originalName);
    if (!(await isMaterialProduct(productId))) return response({ error: "Material upload is not permitted." }, 404);

    const reservation = await reserveMaterialAssetUpload({ productId, originalName: input.originalName, safeFilename, mimeType: input.mimeType, byteSize: input.byteSize });
    reservationId = reservation.reservationId;
    const capability = await createMaterialUploadCapability(reservation.storagePath);
    return Response.json({ reservationId, version: reservation.version, upload: { bucket: MATERIALS_BUCKET, path: capability.storagePath, token: capability.token }, expiresIn: MATERIAL_UPLOAD_EXPIRES_IN_SECONDS }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof BoundedJsonError) return response({ error: error.code === BoundedJsonErrorCode.TooLarge ? "Request body is too large." : "Invalid material upload request." }, error.code === BoundedJsonErrorCode.TooLarge ? 413 : 400);
    if (reservationId) {
      try { await releaseMaterialAssetUpload(reservationId); } catch { /* keep provider details private */ }
    }
    return response({ error: "Unable to prepare material upload." }, 500);
  }
}
