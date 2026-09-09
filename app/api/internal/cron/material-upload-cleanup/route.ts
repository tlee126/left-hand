import { completeExpiredMaterialAssetUploadCleanup, claimExpiredMaterialAssetUploads, releaseExpiredMaterialAssetUploadCleanup } from "@/lib/repositories/material-asset-repository";
import { removeNewMaterialObject } from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const BATCH_SIZE = 25;

function unauthorized(): Response {
  return Response.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

function failure(): Response {
  return Response.json({ error: "Cleanup failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

function hasCronSecret(request: Request): boolean {
  const configured = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  return typeof configured === "string" && configured.length > 0 && authorization === `Bearer ${configured}`;
}

async function cleanup(request: Request): Promise<Response> {
  if (!hasCronSecret(request)) return unauthorized();
  try {
    const claims = await claimExpiredMaterialAssetUploads(BATCH_SIZE);
    let cleaned = 0;
    let failed = 0;
    for (const claim of claims) {
      try {
        await removeNewMaterialObject(claim.storagePath);
        const completed = await completeExpiredMaterialAssetUploadCleanup(claim.reservationId, claim.claimId);
        if (completed !== true) throw new Error();
        cleaned += 1;
      } catch {
        failed += 1;
        try { await releaseExpiredMaterialAssetUploadCleanup(claim.reservationId, claim.claimId); } catch { /* lease expiry permits retry */ }
      }
    }
    if (failed > 0) return Response.json({ success: false, cleaned, failed }, { status: 500, headers: { "Cache-Control": "no-store" } });
    return Response.json({ success: true, cleaned, failed: 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure();
  }
}

export async function POST(request: Request): Promise<Response> {
  return cleanup(request);
}

export async function GET(request: Request): Promise<Response> {
  return cleanup(request);
}
