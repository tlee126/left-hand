import "server-only";

import { getAccountAccess } from "@/lib/auth/session";
import { getCurrentMaterialAsset } from "@/lib/repositories/material-asset-repository";
import { getActiveProductEntitlement } from "@/lib/repositories/product-entitlement-repository";
import {
  createMaterialSignedUrl,
  isValidMaterialUuid,
  MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS
} from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, no-store";
const ACCESS_ERROR = "Material unavailable.";

function errorResponse(status: number): Response {
  return Response.json(
    { error: ACCESS_ERROR },
    { status, headers: { "Cache-Control": CACHE_CONTROL } }
  );
}

function unavailable(): Response {
  return errorResponse(404);
}

function isValidEntitlement(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const entitlement = value as { status?: unknown; revoked_at?: unknown; expires_at?: unknown };
  if (entitlement.status !== "active" || entitlement.revoked_at !== null) return false;
  if (entitlement.expires_at === null) return true;
  return typeof entitlement.expires_at === "string"
    && Number.isFinite(Date.parse(entitlement.expires_at))
    && Date.parse(entitlement.expires_at) > Date.now();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  let access;
  try {
    access = await getAccountAccess();
  } catch {
    return errorResponse(401);
  }
  if (access.status === "unauthenticated") return errorResponse(401);

  const { id } = await context.params;
  if (!isValidMaterialUuid(id)) return unavailable();
  const productId = id.toLowerCase();

  if (access.status !== "approved" || !access.user || !isValidMaterialUuid(access.user.id)) return unavailable();

  if (access.profile?.role !== "admin") {
    try {
      if (!isValidEntitlement(await getActiveProductEntitlement(access.user.id, productId))) return unavailable();
    } catch {
      return unavailable();
    }
  }

  let asset;
  try {
    asset = await getCurrentMaterialAsset(productId);
  } catch {
    return unavailable();
  }
  if (!asset) return unavailable();

  try {
    const url = await createMaterialSignedUrl(asset.storagePath);
    return Response.json(
      { url, expiresIn: MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch {
    return unavailable();
  }
}
