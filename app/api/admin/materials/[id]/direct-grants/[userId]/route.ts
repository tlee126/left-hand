import "server-only";

import { getAccountAccess } from "@/lib/auth/session";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "@/lib/http/bounded-json";
import {
  MaterialDirectAccessInputError,
  MaterialDirectAccessRepositoryError,
  type UpdateMaterialDirectAccessInput,
  revokeMaterialDirectAccess,
  updateMaterialDirectAccess
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

async function ids(context: { params: Promise<{ id: string; userId: string }> }): Promise<{ materialId: string; userId: string } | null> {
  const params = await context.params;
  if (!isValidMaterialUuid(params.id) || !isValidMaterialUuid(params.userId)) return null;
  return { materialId: params.id.toLowerCase(), userId: params.userId.toLowerCase() };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; userId: string }> }): Promise<Response> {
  const admin = await requireApprovedAdmin();
  if (admin instanceof Response) return admin;
  const target = await ids(context);
  if (!target) return response({ error: "Invalid direct material access request." }, 400);

  try {
    const body = await readBoundedJson(request, MAX_JSON_BYTES);
    if (body === null || typeof body !== "object" || Array.isArray(body)) return response({ error: "Invalid direct material access request." }, 400);
    const raw = body as Record<string, unknown>;
    const allowedKeys = new Set(["can_view", "can_download", "expires_at"]);
    if (Reflect.ownKeys(raw).some((key) => typeof key !== "string" || !allowedKeys.has(key))) return response({ error: "Invalid direct material access request." }, 400);
    const input: Record<string, unknown> = { userId: target.userId, materialId: target.materialId };
    if (Object.prototype.hasOwnProperty.call(raw, "can_view")) input.canView = raw.can_view;
    if (Object.prototype.hasOwnProperty.call(raw, "can_download")) input.canDownload = raw.can_download;
    if (Object.prototype.hasOwnProperty.call(raw, "expires_at")) input.expiresAt = raw.expires_at;
    const grant = await updateMaterialDirectAccess(input as unknown as UpdateMaterialDirectAccessInput);
    return Response.json({ grant }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof BoundedJsonError) return response({ error: error.code === BoundedJsonErrorCode.TooLarge ? "Request body is too large." : "Invalid direct material access request." }, error.code === BoundedJsonErrorCode.TooLarge ? 413 : 400);
    if (error instanceof MaterialDirectAccessInputError) return response({ error: "Invalid direct material access request." }, 400);
    if (error instanceof MaterialDirectAccessRepositoryError) return response({ error: "Direct material access mutation failed." }, 500);
    return response({ error: "Direct material access mutation failed." }, 500);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; userId: string }> }): Promise<Response> {
  const admin = await requireApprovedAdmin();
  if (admin instanceof Response) return admin;
  const target = await ids(context);
  if (!target) return response({ error: "Invalid direct material access request." }, 400);

  try {
    const grant = await revokeMaterialDirectAccess(target.userId, target.materialId);
    return Response.json({ grant }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    if (error instanceof MaterialDirectAccessInputError) return response({ error: "Invalid direct material access request." }, 400);
    if (error instanceof MaterialDirectAccessRepositoryError) return response({ error: "Direct material access mutation failed." }, 500);
    return response({ error: "Direct material access mutation failed." }, 500);
  }
}
