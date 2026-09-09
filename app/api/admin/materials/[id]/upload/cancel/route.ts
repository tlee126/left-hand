import { getAccountAccess } from "@/lib/auth/session";
import { getMaterialAssetUploadReservation, releaseMaterialAssetUpload } from "@/lib/repositories/material-asset-repository";
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
    const body: unknown = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as { reservationId?: unknown }).reservationId !== "string" || !isValidMaterialUuid((body as { reservationId: string }).reservationId)) return response({ error: "Invalid material upload request." }, 400);
    const reservationId = (body as { reservationId: string }).reservationId.toLowerCase();
    const reservation = await getMaterialAssetUploadReservation(reservationId);
    if (reservation && reservation.productId === id.toLowerCase()) {
      try { await removeNewMaterialObject(reservation.storagePath); } catch { /* release still prevents metadata commit */ }
      await releaseMaterialAssetUpload(reservationId);
    }
    return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return response({ error: "Unable to cancel material upload." }, 500);
  }
}
