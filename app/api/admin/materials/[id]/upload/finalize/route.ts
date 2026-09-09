import { getAccountAccess } from "@/lib/auth/session";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "@/lib/http/bounded-json";
import {
  finalizeMaterialAssetUpload,
  getMaterialAssetByUploadReservation,
  getMaterialAssetUploadReservation,
  releaseMaterialAssetUpload,
  markMaterialAssetUploadCancelled
} from "@/lib/repositories/material-asset-repository";
import {
  inspectMaterialObject,
  isSupportedMaterialMimeType,
  isValidMaterialStoragePathForProductAndVersion,
  isValidMaterialUuid,
  materialSizeLimit,
  removeNewMaterialObject
} from "@/lib/storage/material-storage";

export const runtime = "nodejs";
const CACHE_CONTROL = "private, no-store";

function response(body: { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function requireApprovedAdmin(): Promise<Response | { userId: string }> {
  try {
    const access = await getAccountAccess();
    if (access.status === "unauthenticated") return response({ error: "Authentication required." }, 401);
    if (access.status !== "approved" || access.profile?.role !== "admin") return response({ error: "Upload is not permitted." }, 403);
    if (!access.user || !isValidMaterialUuid(access.user.id)) return response({ error: "Unable to finalize material upload." }, 500);
    return { userId: access.user.id.toLowerCase() };
  } catch {
    return response({ error: "Unable to finalize material upload." }, 500);
  }
}

async function readFinalizeInput(request: Request): Promise<{ reservationId: string; idempotencyKey: string } | null> {
  const body = await readBoundedJson(request, 8 * 1024);
  return isRecord(body) && Object.keys(body).length === 2 && typeof body.reservationId === "string" && isValidMaterialUuid(body.reservationId) && isValidMaterialUuid(body.idempotencyKey)
    ? { reservationId: body.reservationId.toLowerCase(), idempotencyKey: body.idempotencyKey.toLowerCase() }
    : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const admin = await requireApprovedAdmin();
  if (admin instanceof Response) return admin;

  let reservation: Awaited<ReturnType<typeof getMaterialAssetUploadReservation>> = null;
  let finalizeAttempted = false;
  try {
    const { id } = await context.params;
    if (!isValidMaterialUuid(id)) return response({ error: "Invalid material upload request." }, 400);
    const productId = id.toLowerCase();
    const input = await readFinalizeInput(request);
    if (!input) return response({ error: "Invalid material upload request." }, 400);
    const { reservationId, idempotencyKey } = input;

    reservation = await getMaterialAssetUploadReservation(reservationId);
    if (!reservation) {
      const existing = await getMaterialAssetByUploadReservation(reservationId, admin.userId);
      if (existing?.product_id === productId && existing.uploaded_by?.toLowerCase() === admin.userId && existing.upload_idempotency_key?.toLowerCase() === idempotencyKey) return Response.json({ success: true, version: existing.version }, { headers: { "Cache-Control": CACHE_CONTROL } });
      return response({ error: "Material upload is not available." }, 409);
    }
    if (reservation.productId !== productId || reservation.uploadedBy !== admin.userId || reservation.idempotencyKey !== idempotencyKey || !isSupportedMaterialMimeType(reservation.mimeType) || reservation.byteSize > materialSizeLimit(reservation.mimeType) || !isValidMaterialStoragePathForProductAndVersion(reservation.storagePath, productId, reservation.version) || Date.parse(reservation.expiresAt) <= Date.now()) throw new Error();

    const object = await inspectMaterialObject(reservation.storagePath, reservation.mimeType, reservation.byteSize);
    if (object.storagePath !== reservation.storagePath || object.mimeType !== reservation.mimeType || object.byteSize !== reservation.byteSize) throw new Error();
    finalizeAttempted = true;
    const asset = await finalizeMaterialAssetUpload(reservation.reservationId, idempotencyKey);
    if (asset.product_id !== productId || asset.upload_idempotency_key !== idempotencyKey || asset.storage_path !== reservation.storagePath || asset.mime_type !== reservation.mimeType || asset.byte_size !== reservation.byteSize || asset.version !== reservation.version) throw new Error();
    return Response.json({ success: true, version: asset.version }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof BoundedJsonError) return response({ error: error.code === BoundedJsonErrorCode.TooLarge ? "Request body is too large." : "Invalid material upload request." }, error.code === BoundedJsonErrorCode.TooLarge ? 413 : 400);
    if (reservation && !finalizeAttempted) {
      let objectRemoved = false;
      try { await removeNewMaterialObject(reservation.storagePath); objectRemoved = true; } catch { /* keep provider details private */ }
      if (objectRemoved) {
        try { await releaseMaterialAssetUpload(reservation.reservationId); } catch { /* cleanup route will retry */ }
      } else {
        try { await markMaterialAssetUploadCancelled(reservation.reservationId); } catch { /* cleanup route will retry */ }
      }
    }
    return response({ error: "Unable to finalize material upload." }, 500);
  }
}
