import "server-only";
import { randomUUID } from "node:crypto";

import { getAccountAccess } from "@/lib/auth/session";
import { getCurrentMaterialAsset } from "@/lib/repositories/material-asset-repository";
import { getActiveProductEntitlement } from "@/lib/repositories/product-entitlement-repository";
import {
  createMaterialSignedUrl,
  isValidMaterialStoragePathForProduct,
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

function normalizedUuid(value: unknown): string | null {
  return isValidMaterialUuid(value) ? value.toLowerCase() : null;
}

function diagnosticError(error: unknown): { code: string | null; message: string | null } {
  const value = error as { code?: unknown; message?: unknown } | null;
  const redact = (input: unknown): string | null => {
    if (typeof input !== "string") return null;
    return input
      .replace(/https?:\/\/\S+/gi, "[REDACTED_URL]")
      .replace(/\b(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
      .replace(/\b(service_role|anon|access_token|refresh_token|authorization|token|secret|key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
      .slice(0, 500);
  };
  return {
    code: redact(value?.code),
    message: redact(value?.message)
  };
}

function isValidEntitlement(value: unknown, expectedUserId: string, expectedProductId: string): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const entitlement = value as {
    status?: unknown;
    revoked_at?: unknown;
    expires_at?: unknown;
    user_id?: unknown;
    product_id?: unknown;
  };
  if (entitlement.status !== "active" || entitlement.revoked_at !== null) return false;
  const entitlementUserId = normalizedUuid(entitlement.user_id);
  const entitlementProductId = normalizedUuid(entitlement.product_id);
  if (entitlementUserId !== expectedUserId || entitlementProductId !== expectedProductId) return false;
  if (entitlement.expires_at === null) return true;
  if (typeof entitlement.expires_at !== "string") return false;
  const expiresAt = Date.parse(entitlement.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function isValidAssetForProduct(value: unknown, productId: string): value is { productId: string; storagePath: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as { productId?: unknown; storagePath?: unknown };
  return normalizedUuid(asset.productId) === productId
    && typeof asset.storagePath === "string"
    && isValidMaterialStoragePathForProduct(asset.storagePath, productId);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const correlationId = randomUUID();
  let access;
  try {
    access = await getAccountAccess();
  } catch {
    console.info("MATERIAL_SIGNED_URL_ACCESS_V1", {
      correlationId,
      access: { status: "error" },
      profile: { role: null },
      userId: { exists: false }
    });
    return errorResponse(401);
  }
  console.info("MATERIAL_SIGNED_URL_ACCESS_V1", {
    correlationId,
    access: { status: access.status },
    profile: { role: access.profile?.role ?? null },
    userId: { exists: Boolean(access.user?.id) }
  });
  if (access.status === "unauthenticated") return errorResponse(401);

  const { id } = await context.params;
  if (!isValidMaterialUuid(id)) return unavailable();
  const productId = id.toLowerCase();

  if (access.status !== "approved" || !access.user || !isValidMaterialUuid(access.user.id)) return unavailable();
  const userId = access.user.id.toLowerCase();

  if (access.profile?.role !== "admin") {
    try {
      if (!isValidEntitlement(await getActiveProductEntitlement(userId, productId), userId, productId)) return unavailable();
    } catch {
      return unavailable();
    }
  }

  let asset;
  try {
    asset = await getCurrentMaterialAsset(productId);
  } catch (error) {
    console.info("MATERIAL_SIGNED_URL_ASSET_V1", {
      correlationId,
      asset: { exists: false },
      productId,
      storagePath: null,
      repositoryError: diagnosticError(error)
    });
    return unavailable();
  }
  console.info("MATERIAL_SIGNED_URL_ASSET_V1", {
    correlationId,
    asset: { exists: asset !== null && asset !== undefined },
    productId: typeof asset === "object" && asset !== null && "productId" in asset ? asset.productId : null,
    storagePath: typeof asset === "object" && asset !== null && "storagePath" in asset ? asset.storagePath : null,
    repositoryError: null
  });
  if (!isValidAssetForProduct(asset, productId)) return unavailable();

  try {
    const url = await createMaterialSignedUrl(asset.storagePath, productId);
    console.info("MATERIAL_SIGNED_URL_STORAGE_V1", {
      correlationId,
      storagePath: asset.storagePath,
      signedUrl: { exists: Boolean(url) },
      storageError: null
    });
    return Response.json(
      { url, expiresIn: MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch (error) {
    console.info("MATERIAL_SIGNED_URL_STORAGE_V1", {
      correlationId,
      storagePath: asset.storagePath,
      signedUrl: { exists: false },
      storageError: diagnosticError(error)
    });
    return unavailable();
  }
}
