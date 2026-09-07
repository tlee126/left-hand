import "server-only";

import { getAccountAccess } from "@/lib/auth/session";
import { getActiveProductEntitlement } from "@/lib/repositories/product-entitlement-repository";
import {
  isLearningProgressItemForProduct,
  LearningProgressInputError,
  LearningProgressRepositoryError,
  upsertLearningProgress,
  validateLearningProgressInput
} from "@/lib/repositories/learning-progress-repository";
import { isValidMaterialUuid } from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, no-store";

function response(body: { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

function success(): Response {
  return Response.json({ success: true }, { headers: { "Cache-Control": CACHE_CONTROL } });
}

function matchingActiveEntitlement(value: unknown, userId: string, productId: string): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const entitlement = value as Record<string, unknown>;
  if (entitlement.status !== "active" || entitlement.revoked_at !== null) return false;
  if (!isValidMaterialUuid(entitlement.user_id) || !isValidMaterialUuid(entitlement.product_id)) return false;
  if (entitlement.user_id.toLowerCase() !== userId || entitlement.product_id.toLowerCase() !== productId) return false;
  if (entitlement.expires_at === null) return true;
  return typeof entitlement.expires_at === "string"
    && Number.isFinite(Date.parse(entitlement.expires_at))
    && Date.parse(entitlement.expires_at) > Date.now();
}

export async function POST(request: Request): Promise<Response> {
  let access;
  try {
    access = await getAccountAccess();
  } catch {
    return response({ error: "Unable to verify access." }, 500);
  }

  if (access.status === "unauthenticated" || !access.user) return response({ error: "Authentication required." }, 401);
  if (access.status !== "approved") return response({ error: "Workspace access is unavailable." }, 403);
  if (access.profile?.role === "admin") return response({ error: "Workspace access is unavailable." }, 403);
  if (!isValidMaterialUuid(access.user.id)) return response({ error: "Workspace access is unavailable." }, 403);
  const userId = access.user.id.toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: "Invalid progress data." }, 400);
  }

  let input;
  try {
    input = validateLearningProgressInput(body);
  } catch (error) {
    if (error instanceof LearningProgressInputError) return response({ error: "Invalid progress data." }, 400);
    return response({ error: "Invalid progress data." }, 400);
  }

  try {
    if (!await isLearningProgressItemForProduct(input.productId, input.itemType, input.itemId)) {
      return response({ error: "Progress is unavailable." }, 404);
    }
  } catch (error) {
    if (error instanceof LearningProgressInputError) return response({ error: "Invalid progress data." }, 400);
    if (error instanceof LearningProgressRepositoryError) return response({ error: "Progress is unavailable." }, 500);
    return response({ error: "Progress is unavailable." }, 500);
  }

  let entitlement;
  try {
    entitlement = await getActiveProductEntitlement(userId, input.productId);
  } catch {
    return response({ error: "Progress is unavailable." }, 500);
  }
  if (!matchingActiveEntitlement(entitlement, userId, input.productId)) {
    return response({ error: "Progress is unavailable." }, 404);
  }

  try {
    await upsertLearningProgress(userId, input);
    return success();
  } catch (error) {
    if (error instanceof LearningProgressInputError) return response({ error: "Invalid progress data." }, 400);
    if (error instanceof LearningProgressRepositoryError) return response({ error: "Progress is unavailable." }, 500);
    return response({ error: "Progress is unavailable." }, 500);
  }
}
