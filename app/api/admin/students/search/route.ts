import "server-only";

import { getAccountAccess } from "@/lib/auth/session";
import {
  MaterialDirectAccessInputError,
  MaterialDirectAccessRepositoryError,
  searchApprovedStudents
} from "@/lib/repositories/material-direct-access-repository";

export const runtime = "nodejs";

function response(body: { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function isValidStudentSearchQuery(query: unknown): query is string {
  if (typeof query !== "string" || query.trim().length < 1 || query.trim().length > 100) return false;
  return Boolean(query.trim().replace(/[^\p{L}\p{N}@._+\-\s]/gu, " ").trim());
}

export async function GET(request: Request): Promise<Response> {
  try {
    const access = await getAccountAccess();
    if (access.status === "unauthenticated") return response({ error: "Authentication required." }, 401);
    if (access.status !== "approved" || access.profile?.role !== "admin") return response({ error: "Student search is not permitted." }, 403);
  } catch {
    return response({ error: "Student search is unavailable." }, 500);
  }

  const query = new URL(request.url).searchParams.get("q");
  if (!isValidStudentSearchQuery(query ?? "")) return response({ error: "Invalid student search request." }, 400);
  try {
    const students = await searchApprovedStudents(query ?? "");
    return Response.json({ students }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MaterialDirectAccessInputError) return response({ error: "Invalid student search request." }, 400);
    if (error instanceof MaterialDirectAccessRepositoryError) return response({ error: "Student search is unavailable." }, 500);
    return response({ error: "Student search is unavailable." }, 500);
  }
}
