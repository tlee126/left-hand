import "server-only";

import { getAccountAccess } from "@/lib/auth/session";
import { getCurrentMaterialAsset, getMaterialDownloadPermission } from "@/lib/repositories/material-asset-repository";
import { getMaterialDirectGrant, isActiveMaterialDirectGrant } from "@/lib/repositories/material-direct-access-repository";
import { getActiveProductEntitlement } from "@/lib/repositories/product-entitlement-repository";
import {
  fetchMaterialObjectForViewer,
  isValidMaterialStoragePathForProduct,
  isValidMaterialUuid
} from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, no-store";
const ACCESS_ERROR = "Material unavailable.";

function unavailable(status = 404): Response {
  return Response.json(
    { error: ACCESS_ERROR },
    { status, headers: { "Cache-Control": CACHE_CONTROL } }
  );
}

function normalizedUuid(value: unknown): string | null {
  return isValidMaterialUuid(value) ? value.toLowerCase() : null;
}

function isValidEntitlement(value: unknown, expectedUserId: string, expectedProductId: string): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const entitlement = value as { status?: unknown; revoked_at?: unknown; expires_at?: unknown; user_id?: unknown; product_id?: unknown };
  if (entitlement.status !== "active" || entitlement.revoked_at !== null) return false;
  if (normalizedUuid(entitlement.user_id) !== expectedUserId || normalizedUuid(entitlement.product_id) !== expectedProductId) return false;
  if (entitlement.expires_at === null) return true;
  if (typeof entitlement.expires_at !== "string") return false;
  const expiresAt = Date.parse(entitlement.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function isValidAsset(value: unknown, productId: string): value is { productId: string; storagePath: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as { productId?: unknown; storagePath?: unknown };
  return normalizedUuid(asset.productId) === productId
    && typeof asset.storagePath === "string"
    && isValidMaterialStoragePathForProduct(asset.storagePath, productId);
}

/** Streams a private material as an attachment only after server-side entitlement and policy checks. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  let access;
  try {
    access = await getAccountAccess();
  } catch {
    return unavailable(401);
  }
  if (access.status === "unauthenticated") return unavailable(401);

  const { id } = await context.params;
  if (!isValidMaterialUuid(id)) return unavailable();
  const productId = id.toLowerCase();
  if (access.status !== "approved" || !access.user || !isValidMaterialUuid(access.user.id)) return unavailable();
  const userId = access.user.id.toLowerCase();
  const isAdmin = access.profile?.role === "admin";

  if (!isAdmin) {
    if (access.profile?.role !== "student") return unavailable();
    try {
      const directGrant = await getMaterialDirectGrant(userId, productId);
      if (directGrant) {
        if (!isActiveMaterialDirectGrant(directGrant, userId, productId) || !directGrant.can_view || !directGrant.can_download) return unavailable();
      } else {
        if (!isValidEntitlement(await getActiveProductEntitlement(userId, productId), userId, productId)) return unavailable();
        if (await getMaterialDownloadPermission(productId) !== true) return unavailable();
      }
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
  if (!isValidAsset(asset, productId)) return unavailable();

  try {
    const upstream = await fetchMaterialObjectForViewer(asset.storagePath, productId, request.headers.get("range"));
    if (upstream.status === 416) return unavailable(416);
    const headers = new Headers({
      "Cache-Control": CACHE_CONTROL,
      "Content-Type": asset.mimeType,
      "Content-Disposition": "attachment",
      "Accept-Ranges": upstream.headers.get("Accept-Ranges") ?? "bytes"
    });
    for (const header of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
      const value = upstream.headers.get(header);
      if (value) headers.set(header, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return unavailable();
  }
}
