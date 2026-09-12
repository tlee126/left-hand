import "server-only";

import { getAccountAccess } from "@/lib/auth/session";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "@/lib/http/bounded-json";
import {
  hasLearningProgressAccessForProducts,
  getLearningProgressForProducts,
  isLearningProgressItemForProduct,
  LearningProgressInputError,
  LearningProgressConflictError,
  LearningProgressRepositoryError,
  upsertLearningProgress,
  validateLearningProgressInput
} from "@/lib/repositories/learning-progress-repository";
import { isValidMaterialUuid } from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, no-store";
const MAX_PROGRESS_JSON_BYTES = 8 * 1024;

function progressResponse(progress: unknown): Response {
  return Response.json({ progress }, { headers: { "Cache-Control": CACHE_CONTROL } });
}

function response(body: { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}

function success(): Response {
  return Response.json({ success: true }, { headers: { "Cache-Control": CACHE_CONTROL } });
}

export async function GET(request: Request): Promise<Response> {
  let access;
  try {
    access = await getAccountAccess();
  } catch {
    return response({ error: "Progress is unavailable." }, 401);
  }
  if (access.status === "unauthenticated") return response({ error: "Progress is unavailable." }, 401);
  if (access.status !== "approved" || access.profile?.role !== "student" || !access.user || !isValidMaterialUuid(access.user.id)) {
    return response({ error: "Progress is unavailable." }, 404);
  }

  const productIds = requestUrlProductIds(request);
  if (!productIds || productIds.length === 0) return response({ error: "Progress is unavailable." }, 400);
  try {
    if (!await hasLearningProgressAccessForProducts(access.user.id, productIds)) {
      return response({ error: "Progress is unavailable." }, 404);
    }
    const progress = await getLearningProgressForProducts(access.user.id, productIds);
    return progressResponse(progress);
  } catch {
    return response({ error: "Progress is unavailable." }, 500);
  }
}

function requestUrlProductIds(request: Request): string[] | null {
  const values = [...new URL(request.url).searchParams.getAll("productId")];
  if (values.length === 0 || values.length > 100 || values.some((value) => !isValidMaterialUuid(value))) return null;
  return [...new Set(values.map((value) => value.toLowerCase()))];
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
  if (access.profile?.role !== "student") return response({ error: "Workspace access is unavailable." }, 403);
  if (!isValidMaterialUuid(access.user.id)) return response({ error: "Workspace access is unavailable." }, 403);
  const userId = access.user.id.toLowerCase();

  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_PROGRESS_JSON_BYTES);
  } catch (error) {
    if (error instanceof BoundedJsonError && error.code === BoundedJsonErrorCode.TooLarge) {
      return response({ error: "Progress request is too large." }, 413);
    }
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

  try {
    if (!await hasLearningProgressAccessForProducts(userId, [input.productId], input.itemType)) {
      return response({ error: "Progress is unavailable." }, 404);
    }
  } catch {
    return response({ error: "Progress is unavailable." }, 500);
  }

  try {
    await upsertLearningProgress(userId, input);
    return success();
  } catch (error) {
    if (error instanceof LearningProgressInputError) return response({ error: "Invalid progress data." }, 400);
    if (error instanceof LearningProgressConflictError) return response({ error: "Progress conflict." }, 409);
    if (error instanceof LearningProgressRepositoryError) return response({ error: "Progress is unavailable." }, 500);
    return response({ error: "Progress is unavailable." }, 500);
  }
}
