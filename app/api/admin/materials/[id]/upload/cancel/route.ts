import { getAccountAccess } from "@/lib/auth/session";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "@/lib/http/bounded-json";
import { getMaterialAssetByUploadReservation, getMaterialAssetUploadReservation, markMaterialAssetUploadCancelled } from "@/lib/repositories/material-asset-repository";
import { isValidMaterialUuid, removeNewMaterialObject } from "@/lib/storage/material-storage";

export const runtime = "nodejs";

function response(body: { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const access = await getAccountAccess();
    if (access.status === "unauthenticated") return response({ error: "Authentication required." }, 401);
    if (access.status !== "approved" || access.profile?.role !== "admin") return response({ error: "Upload is not permitted." }, 403);
    const { id } = await context.params;
    if (!isValidMaterialUuid(id)) return response({ error: "Invalid material upload request." }, 400);
    const body: unknown = await readBoundedJson(request, 8 * 1024);
    if (body === null || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as { reservationId?: unknown }).reservationId !== "string" || !isValidMaterialUuid((body as { reservationId: string }).reservationId)) return response({ error: "Invalid material upload request." }, 400);
    const reservationId = (body as { reservationId: string }).reservationId.toLowerCase();
    const userId = access.user && isValidMaterialUuid(access.user.id) ? access.user.id.toLowerCase() : null;
    const reservation = await getMaterialAssetUploadReservation(reservationId);
    const productId = id.toLowerCase();
    if (!reservation) {
      const committed = userId ? await getMaterialAssetByUploadReservation(reservationId, userId) : null;
      return response({ error: "Material upload is not available." }, committed?.product_id === productId ? 409 : 404);
    }
    if (!userId || reservation.productId !== productId || reservation.uploadedBy !== userId) return response({ error: "Material upload is not available." }, 404);
    if (reservation.cancelledAt !== null) return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
    if (reservation.cleanupPendingAt !== null) return response({ error: "Material upload is not available." }, 409);
    {
      try {
        const cancelled = await markMaterialAssetUploadCancelled(reservationId);
        if (!cancelled) return response({ error: "Material upload is not available." }, 409);
        await removeNewMaterialObject(reservation.storagePath);
      } catch {
        try { await markMaterialAssetUploadCancelled(reservationId); } catch { /* cleanup route will retry */ }
        return response({ error: "Unable to cancel material upload." }, 500);
      }
    }
    return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof BoundedJsonError) return response({ error: error.code === BoundedJsonErrorCode.TooLarge ? "Request body is too large." : "Invalid material upload request." }, error.code === BoundedJsonErrorCode.TooLarge ? 413 : 400);
    return response({ error: "Unable to cancel material upload." }, 500);
  }
}
