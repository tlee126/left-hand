import "server-only";

import { getAccountAccess } from "@/lib/auth/session";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "@/lib/http/bounded-json";
import {
  getMaterialDirectGrants,
  grantMaterialDirectAccess,
  MaterialDirectAccessInputError,
  MaterialDirectAccessRepositoryError,
  validateGrantMaterialDirectAccessInput
} from "@/lib/repositories/material-direct-access-repository";
import { isValidMaterialUuid } from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, no-store";
const MAX_JSON_BYTES = 16 * 1024;

function response(body: { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

async function requireApprovedAdmin(): Promise<Response | true> {
  try {
    const access = await getAccountAccess();
    if (access.status === "unauthenticated") return response({ error: "Authentication required." }, 401);
    if (access.status !== "approved" || access.profile?.role !== "admin") return response({ error: "Direct material access is not permitted." }, 403);
    return true;
  } catch {
    return response({ error: "Direct material access is unavailable." }, 500);
  }
}

function materialIdFromParams(params: { id: string }): string | null {
  return isValidMaterialUuid(params.id) ? params.id.toLowerCase() : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const admin = await requireApprovedAdmin();
  if (admin instanceof Response) return admin;
  const materialId = materialIdFromParams(await context.params);
  if (!materialId) return response({ error: "Invalid direct material access request." }, 400);

  try {
    const grants = await getMaterialDirectGrants(materialId);
    if (!grants) return response({ error: "Material direct access is unavailable." }, 404);
    return Response.json({ grants }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof MaterialDirectAccessInputError) return response({ error: "Invalid direct material access request." }, 400);
    return response({ error: "Material direct access is unavailable." }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const admin = await requireApprovedAdmin();
  if (admin instanceof Response) return admin;
  const materialId = materialIdFromParams(await context.params);
  if (!materialId) return response({ error: "Invalid direct material access request." }, 400);

  try {
    const body = await readBoundedJson(request, MAX_JSON_BYTES);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return response({ error: "Invalid direct material access request." }, 400);
    const raw = body as Record<string, unknown>;
    const allowedKeys = new Set(["user_id", "can_view", "can_download", "expires_at"]);
    if (Reflect.ownKeys(raw).some((key) => typeof key !== "string" || !allowedKeys.has(key))
      || !Object.prototype.hasOwnProperty.call(raw, "user_id")
      || !Object.prototype.hasOwnProperty.call(raw, "can_view")
      || !Object.prototype.hasOwnProperty.call(raw, "can_download")) {
      return response({ error: "Invalid direct material access request." }, 400);
    }
    const input = validateGrantMaterialDirectAccessInput({
      userId: raw.user_id,
      materialId,
      canView: raw.can_view,
      canDownload: raw.can_download,
      ...(Object.prototype.hasOwnProperty.call(raw, "expires_at") ? { expiresAt: raw.expires_at } : {})
    });
    const grant = await grantMaterialDirectAccess(input);
    return Response.json({ grant }, { status: 201, headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof BoundedJsonError) return response({ error: error.code === BoundedJsonErrorCode.TooLarge ? "Request body is too large." : "Invalid direct material access request." }, error.code === BoundedJsonErrorCode.TooLarge ? 413 : 400);
    if (error instanceof MaterialDirectAccessInputError) return response({ error: "Invalid direct material access request." }, 400);
    if (error instanceof MaterialDirectAccessRepositoryError) return response({ error: "Direct material access mutation failed." }, 500);
    return response({ error: "Direct material access mutation failed." }, 500);
  }
}
