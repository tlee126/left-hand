import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Consultation = Database["public"]["Tables"]["consultations"]["Row"];
export type ConsultationStatus = "new" | "contacted" | "qualified" | "closed";

export const VALID_CONSULTATION_STATUSES: readonly ConsultationStatus[] = [
  "new",
  "contacted",
  "qualified",
  "closed"
] as const;

export const DEFAULT_CONSULTATION_PAGE_LIMIT = 20;
export const MAX_CONSULTATION_PAGE_LIMIT = 100;
export const MAX_SEARCH_LENGTH = 100;

export const CONSULTATION_COLUMNS = [
  "id",
  "request_id",
  "full_name",
  "phone",
  "faculty",
  "interest",
  "need",
  "major",
  "note",
  "source_path",
  "selected_product_slug",
  "selected_subject_slug",
  "status",
  "created_at",
  "updated_at"
] as const;

export const CONSULTATION_SELECT_COLUMNS = CONSULTATION_COLUMNS.join(", ");

export const CONSULTATION_STATUS_UPDATE_COLUMNS = [
  "id",
  "status",
  "updated_at",
  "updated_by"
] as const;

export const CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS =
  CONSULTATION_STATUS_UPDATE_COLUMNS.join(", ");

export interface UpdatedConsultationStatus {
  id: string;
  status: ConsultationStatus;
  updated_at: string;
  updated_by: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export class ConsultationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsultationInputError";
  }
}

export class ConsultationRepositoryError extends Error {
  constructor(message = "Failed to perform consultation repository operation.") {
    super(message);
    this.name = "ConsultationRepositoryError";
  }
}

export interface ListConsultationsOptions {
  status?: ConsultationStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Lists consultations with optional status filter, search query, and bounded pagination.
 *
 * Query requirements:
 * - Queries Supabase through the existing server client.
 * - Authorization is enforced exclusively by database RLS; client-supplied roles/user IDs are rejected.
 * - Bounded pagination: defaults to 20, hard maximum of 100 rows.
 * - Search is bounded (max 100 chars) and queries only full_name and phone.
 * - Deterministic ordering: created_at DESC, with id DESC as tie-breaker.
 * - Database errors are safely mapped without leaking raw Postgres details or PII.
 */
export async function listConsultations(
  options?: ListConsultationsOptions
): Promise<Consultation[]> {
  if (options !== undefined && options !== null) {
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new ConsultationInputError("Invalid options: options must be an object.");
    }

    const rawOptions = options as Record<string, unknown>;
    // Reject any client-supplied role or user ID
    if ("role" in rawOptions || "userId" in rawOptions || "user_id" in rawOptions) {
      throw new ConsultationInputError(
        "Client-supplied role or user ID is not permitted."
      );
    }
  }

  // Validate status
  if (options?.status !== undefined) {
    if (
      typeof options.status !== "string" ||
      !VALID_CONSULTATION_STATUSES.includes(options.status as ConsultationStatus)
    ) {
      throw new ConsultationInputError(
        `Invalid status: "${String(options.status)}". Allowed values: ${VALID_CONSULTATION_STATUSES.join(", ")}.`
      );
    }
  }

  // Validate limit
  let effectiveLimit = DEFAULT_CONSULTATION_PAGE_LIMIT;
  if (options?.limit !== undefined) {
    if (
      typeof options.limit !== "number" ||
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > MAX_CONSULTATION_PAGE_LIMIT
    ) {
      throw new ConsultationInputError(
        `Invalid limit: limit must be an integer between 1 and ${MAX_CONSULTATION_PAGE_LIMIT}.`
      );
    }
    effectiveLimit = options.limit;
  }

  // Validate offset
  let effectiveOffset = 0;
  if (options?.offset !== undefined) {
    if (
      typeof options.offset !== "number" ||
      !Number.isInteger(options.offset) ||
      options.offset < 0
    ) {
      throw new ConsultationInputError(
        "Invalid offset: offset must be a non-negative integer."
      );
    }
    effectiveOffset = options.offset;
  }

  // Validate and sanitize search
  let sanitizedSearch: string | undefined;
  if (options?.search !== undefined) {
    if (typeof options.search !== "string") {
      throw new ConsultationInputError(
        "Invalid search parameter: search query must be a string."
      );
    }
    const trimmed = options.search.trim().slice(0, MAX_SEARCH_LENGTH);
    if (trimmed.length > 0) {
      // Remove PostgREST delimiter characters (, () " \) and SQL ILIKE wildcards (% _) to prevent syntax/wildcard injection
      const cleaned = trimmed.replace(/[,()"\\%_*]/g, " ").trim();
      if (cleaned.length > 0) {
        sanitizedSearch = cleaned;
      }
    }
  }

  const supabase = await createClient();

  let query = supabase
    .from("consultations")
    .select(CONSULTATION_SELECT_COLUMNS);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (sanitizedSearch) {
    query = query.or(
      `full_name.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%`
    );
  }

  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(effectiveOffset, effectiveOffset + effectiveLimit - 1);

  let data: unknown;
  let error: unknown;

  try {
    const result = await query;
    data = result.data;
    error = result.error;
  } catch {
    throw new ConsultationRepositoryError(
      "Failed to list consultations from database."
    );
  }

  if (error) {
    throw new ConsultationRepositoryError(
      "Failed to list consultations from database."
    );
  }

  return (data as unknown as Consultation[]) ?? [];
}

/**
 * Retrieves a single consultation record by its UUID.
 *
 * Requirements:
 * - Validates that id is a valid UUID format before querying.
 * - Uses the server Supabase client; database RLS remains authorization authority.
 * - Returns the consultation record or null if not found.
 * - Database failures are safely mapped without leaking raw Postgres details or PII.
 */
export async function getConsultationById(
  id: string
): Promise<Consultation | null> {
  if (!isValidUuid(id)) {
    throw new ConsultationInputError("Invalid consultation ID: must be a valid UUID.");
  }

  const supabase = await createClient();

  let data: unknown;
  let error: unknown;

  try {
    const result = await supabase
      .from("consultations")
      .select(CONSULTATION_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    data = result.data;
    error = result.error;
  } catch {
    throw new ConsultationRepositoryError(
      "Failed to retrieve consultation from database."
    );
  }

  if (error) {
    throw new ConsultationRepositoryError(
      "Failed to retrieve consultation from database."
    );
  }

  return (data as unknown as Consultation) ?? null;
}

/**
 * Updates a consultation record's status.
 *
 * Requirements:
 * - Validates id with the existing strict UUID helper before any database call.
 * - Validates status against the existing canonical list ('new', 'contacted', 'qualified', 'closed').
 * - Invalid UUID/status throws ConsultationInputError without querying the database.
 * - Uses server Supabase client (createClient()), with optional positional mock client for testing.
 * - Update payload is strictly { status } - never accepts arbitrary objects or updates other columns.
 * - Queries only consultations, filters by validated UUID, and selects minimal fields (id, status, updated_at, updated_by).
 * - Returns null when no matching row is returned.
 * - Maps all database/network exceptions to ConsultationRepositoryError without exposing raw DB errors or PII.
 */
export async function updateConsultationStatus(
  id: string,
  status: ConsultationStatus,
  client?: any
): Promise<UpdatedConsultationStatus | null> {
  if (!isValidUuid(id)) {
    throw new ConsultationInputError("Invalid consultation ID: must be a valid UUID.");
  }

  if (
    typeof status !== "string" ||
    !VALID_CONSULTATION_STATUSES.includes(status as ConsultationStatus)
  ) {
    throw new ConsultationInputError(
      `Invalid status: "${String(status)}". Allowed values: ${VALID_CONSULTATION_STATUSES.join(", ")}.`
    );
  }

  let data: unknown;
  let error: unknown;

  try {
    const supabase = client ?? (await createClient());
    const result = await supabase
      .from("consultations")
      .update({ status })
      .eq("id", id)
      .select(CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS)
      .maybeSingle();
    data = result.data;
    error = result.error;
  } catch {
    throw new ConsultationRepositoryError(
      "Failed to update consultation status in database."
    );
  }

  if (error) {
    throw new ConsultationRepositoryError(
      "Failed to update consultation status in database."
    );
  }

  if (!data) {
    return null;
  }

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    status: row.status as ConsultationStatus,
    updated_at: String(row.updated_at),
    updated_by: row.updated_by == null ? null : String(row.updated_by)
  };
}
