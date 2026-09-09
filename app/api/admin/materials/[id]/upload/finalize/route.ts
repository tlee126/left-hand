import { getAccountAccess } from "@/lib/auth/session";
import {
  finalizeMaterialAssetUpload,
  getMaterialAssetByUploadReservation,
  getMaterialAssetUploadReservation,
  releaseMaterialAssetUpload
} from "@/lib/repositories/material-asset-repository";
import {
  getMaterialObjectInfo,
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

async function readReservationId(request: Request): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > 8 * 1024)) return null;
  const body: unknown = await request.json();
  return isRecord(body) && Object.keys(body).length === 1 && typeof body.reservationId === "string" && isValidMaterialUuid(body.reservationId) ? body.reservationId.toLowerCase() : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const admin = await requireApprovedAdmin();
  if (admin instanceof Response) return admin;

  let reservation: Awaited<ReturnType<typeof getMaterialAssetUploadReservation>> = null;
  try {
    const { id } = await context.params;
    if (!isValidMaterialUuid(id)) return response({ error: "Invalid material upload request." }, 400);
    const productId = id.toLowerCase();
    const reservationId = await readReservationId(request);
    if (!reservationId) return response({ error: "Invalid material upload request." }, 400);

    reservation = await getMaterialAssetUploadReservation(reservationId);
    if (!reservation) {
      const existing = await getMaterialAssetByUploadReservation(reservationId);
      if (existing?.product_id === productId) return Response.json({ success: true, version: existing.version }, { headers: { "Cache-Control": CACHE_CONTROL } });
      return response({ error: "Material upload is not available." }, 409);
    }
    if (reservation.productId !== productId || reservation.uploadedBy !== admin.userId || !isSupportedMaterialMimeType(reservation.mimeType) || reservation.byteSize > materialSizeLimit(reservation.mimeType) || !isValidMaterialStoragePathForProductAndVersion(reservation.storagePath, productId, reservation.version) || Date.parse(reservation.expiresAt) <= Date.now()) throw new Error();

    const object = await getMaterialObjectInfo(reservation.storagePath);
    if (object.storagePath !== reservation.storagePath || object.mimeType !== reservation.mimeType || object.byteSize !== reservation.byteSize) throw new Error();
    const asset = await finalizeMaterialAssetUpload(reservation.reservationId);
    if (asset.product_id !== productId || asset.storage_path !== reservation.storagePath || asset.mime_type !== reservation.mimeType || asset.byte_size !== reservation.byteSize || asset.version !== reservation.version) throw new Error();
    return Response.json({ success: true, version: asset.version }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch {
    if (reservation) {
      try { await removeNewMaterialObject(reservation.storagePath); } catch { /* keep provider details private */ }
      try { await releaseMaterialAssetUpload(reservation.reservationId); } catch { /* keep provider details private */ }
    }
    return response({ error: "Unable to finalize material upload." }, 500);
  }
}
