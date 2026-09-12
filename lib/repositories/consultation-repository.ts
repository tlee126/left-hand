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

/**
 * State machine for the admin consultation workflow.
 * A same-state submission is an idempotent no-op; reopening/backward moves
 * are intentionally not part of the contract.
 */
export const CONSULTATION_STATUS_TRANSITIONS: Readonly<
  Record<ConsultationStatus, readonly ConsultationStatus[]>
> = {
  new: ["new", "contacted"],
  contacted: ["contacted", "qualified"],
  qualified: ["qualified", "closed"],
  closed: ["closed"]
};

export function isValidConsultationStatusTransition(
  currentStatus: unknown,
  nextStatus: unknown
): nextStatus is ConsultationStatus {
  if (
    typeof currentStatus !== "string" ||
    !VALID_CONSULTATION_STATUSES.includes(currentStatus as ConsultationStatus) ||
    typeof nextStatus !== "string" ||
    !VALID_CONSULTATION_STATUSES.includes(nextStatus as ConsultationStatus)
  ) {
    return false;
  }

  return CONSULTATION_STATUS_TRANSITIONS[currentStatus as ConsultationStatus].includes(
    nextStatus as ConsultationStatus
  );
}

export const DEFAULT_CONSULTATION_PAGE_LIMIT = 20;
export const MAX_CONSULTATION_PAGE_LIMIT = 100;
export const MAX_SEARCH_LENGTH = 100;

export const CONSULTATION_LIST_COLUMNS = [
  "id",
  "status",
  "created_at"
] as const;

export const CONSULTATION_LIST_SELECT_COLUMNS = CONSULTATION_LIST_COLUMNS.join(", ");

export const CONSULTATION_DETAIL_COLUMNS = [
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
  "updated_at",
  "updated_by",
  "version"
] as const;

export const CONSULTATION_DETAIL_SELECT_COLUMNS = CONSULTATION_DETAIL_COLUMNS.join(", ");

/** @deprecated Use the explicit list/detail projections. */
export const CONSULTATION_COLUMNS = CONSULTATION_DETAIL_COLUMNS;
/** @deprecated Use CONSULTATION_DETAIL_SELECT_COLUMNS. */
export const CONSULTATION_SELECT_COLUMNS = CONSULTATION_DETAIL_SELECT_COLUMNS;

export const CONSULTATION_STATUS_UPDATE_COLUMNS = [
  "id",
  "status",
  "updated_at",
  "updated_by",
  "version"
] as const;

export const CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS =
  CONSULTATION_STATUS_UPDATE_COLUMNS.join(", ");

export const CONSULTATION_STATUS_HISTORY_COLUMNS = [
  "id",
  "consultation_id",
  "old_status",
  "new_status",
  "changed_at",
  "changed_by",
  "version"
] as const;

export const CONSULTATION_STATUS_HISTORY_SELECT_COLUMNS =
  CONSULTATION_STATUS_HISTORY_COLUMNS.join(", ");

export const MAX_CONSULTATION_HISTORY = 100;

const CONSULTATION_CATALOG_SELECT_COLUMNS = "slug, subject_slug:subjects->>slug";

export interface UpdatedConsultationStatus {
  id: string;
  status: ConsultationStatus;
  updated_at: string;
  updated_by: string | null;
  version: number;
}

export interface ConsultationStatusHistoryEntry {
  id: string;
  consultation_id: string;
  old_status: ConsultationStatus;
  new_status: ConsultationStatus;
  changed_at: string;
  version: number;
  actor_name: string | null;
}

export type ConsultationListItem = Pick<
  Consultation,
  (typeof CONSULTATION_LIST_COLUMNS)[number]
>;

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

function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function readNullableString(value: unknown): string | null {
  return value === null ? null : typeof value === "string" ? value : null;
}

function parseConsultationRow(value: unknown): Consultation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConsultationRepositoryError("Failed to retrieve consultation from database.");
  }
  const row = value as Record<string, unknown>;
  const version = readInteger(row.version);
  if (
    typeof row.id !== "string" ||
    typeof row.request_id !== "string" ||
    typeof row.full_name !== "string" ||
    typeof row.phone !== "string" ||
    typeof row.faculty !== "string" ||
    typeof row.interest !== "string" ||
    typeof row.need !== "string" ||
    typeof row.status !== "string" ||
    !VALID_CONSULTATION_STATUSES.includes(row.status as ConsultationStatus) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string" ||
    version === null ||
    version < 0 ||
    ![row.major, row.note, row.source_path, row.selected_product_slug, row.selected_subject_slug, row.updated_by]
      .every((field) => field === null || typeof field === "string")
  ) {
    throw new ConsultationRepositoryError("Failed to retrieve consultation from database.");
  }

  return {
    id: row.id,
    request_id: row.request_id,
    full_name: row.full_name,
    phone: row.phone,
    faculty: row.faculty,
    interest: row.interest,
    need: row.need,
    major: readNullableString(row.major),
    note: readNullableString(row.note),
    source_path: readNullableString(row.source_path),
    selected_product_slug: readNullableString(row.selected_product_slug),
    selected_subject_slug: readNullableString(row.selected_subject_slug),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    updated_by: readNullableString(row.updated_by),
    version
  };
}

function readActorName(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const name = Object.getOwnPropertyDescriptor(value, "full_name")?.value;
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
}

type ConsultationCatalogSelection = {
  selectedProductSlug: string | null;
  selectedSubjectSlug: string | null;
};

/**
 * Resolves optional consultation catalog references against the public,
 * published catalog. Client-provided slugs are never returned directly.
 */
export async function resolvePublishedConsultationSelection(
  selectedProductSlug: string | null,
  selectedSubjectSlug: string | null,
  client?: any
): Promise<ConsultationCatalogSelection> {
  if (selectedProductSlug === null && selectedSubjectSlug === null) {
    return { selectedProductSlug: null, selectedSubjectSlug: null };
  }

  try {
    const supabase = client ?? (await createClient());

    if (selectedProductSlug !== null) {
      const result = await supabase
        .from("public_catalog_read_surface")
        .select(CONSULTATION_CATALOG_SELECT_COLUMNS)
        .eq("slug", selectedProductSlug)
        .eq("publication_status", "published")
        .maybeSingle();

      if (result.error) {
        throw new ConsultationRepositoryError(
          "Failed to resolve consultation catalog selection."
        );
      }

      const row = result.data;
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        throw new ConsultationInputError("Invalid consultation catalog selection.");
      }

      const resolvedProductSlug = Object.getOwnPropertyDescriptor(row, "slug")?.value;
      const resolvedSubjectSlug = Object.getOwnPropertyDescriptor(row, "subject_slug")?.value;
      if (
        typeof resolvedProductSlug !== "string" ||
        resolvedSubjectSlug === null ||
        (selectedSubjectSlug !== null && selectedSubjectSlug !== resolvedSubjectSlug)
      ) {
        throw new ConsultationInputError("Invalid consultation catalog selection.");
      }

      return {
        selectedProductSlug: resolvedProductSlug,
        selectedSubjectSlug: resolvedSubjectSlug
      };
    }

    const result = await supabase
      .from("subjects")
      .select("slug")
      .eq("slug", selectedSubjectSlug)
      .maybeSingle();

    if (result.error) {
      throw new ConsultationRepositoryError(
        "Failed to resolve consultation catalog selection."
      );
    }

    const row = result.data;
    const resolvedSubjectSlug = row && typeof row === "object" && !Array.isArray(row)
      ? Object.getOwnPropertyDescriptor(row, "slug")?.value
      : null;
    if (typeof resolvedSubjectSlug !== "string" || resolvedSubjectSlug !== selectedSubjectSlug) {
      throw new ConsultationInputError("Invalid consultation catalog selection.");
    }

    return { selectedProductSlug: null, selectedSubjectSlug: resolvedSubjectSlug };
  } catch (error) {
    if (error instanceof ConsultationInputError || error instanceof ConsultationRepositoryError) {
      throw error;
    }
    throw new ConsultationRepositoryError(
      "Failed to resolve consultation catalog selection."
    );
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
): Promise<ConsultationListItem[]> {
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

  let data: unknown;
  let error: unknown;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("consultations")
      .select(CONSULTATION_LIST_SELECT_COLUMNS);

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

  const rows = Array.isArray(data) ? data : [];
  return rows.map((value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new ConsultationRepositoryError("Failed to list consultations from database.");
    }
    const row = value as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.status !== "string" ||
      !VALID_CONSULTATION_STATUSES.includes(row.status as ConsultationStatus) ||
      typeof row.created_at !== "string"
    ) {
      throw new ConsultationRepositoryError("Failed to list consultations from database.");
    }
    return {
      id: row.id,
      status: row.status as Consultation["status"],
      created_at: row.created_at
    } as ConsultationListItem;
  });
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

  let data: unknown;
  let error: unknown;

  try {
    const supabase = await createClient();
    const result = await supabase
      .from("consultations")
      .select(CONSULTATION_DETAIL_SELECT_COLUMNS)
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

  return data === null ? null : parseConsultationRow(data);
}

/**
 * Reads the append-only status history for one consultation. The database
 * RLS policy remains the authority for approved-admin access.
 */
export async function getConsultationStatusHistory(
  id: string,
  client?: any
): Promise<ConsultationStatusHistoryEntry[]> {
  if (!isValidUuid(id)) {
    throw new ConsultationInputError("Invalid consultation ID: must be a valid UUID.");
  }

  try {
    const supabase = client ?? (await createClient());
    const result = await supabase
      .from("consultation_status_history")
      .select(CONSULTATION_STATUS_HISTORY_SELECT_COLUMNS)
      .eq("consultation_id", id)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, MAX_CONSULTATION_HISTORY - 1);

    if (result.error) {
      throw new ConsultationRepositoryError(
        "Failed to retrieve consultation status history from database."
      );
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    const parsedRows: Array<{
      id: string;
      consultation_id: string;
      old_status: ConsultationStatus;
      new_status: ConsultationStatus;
      changed_at: string;
      version: number;
      actor_id: string;
      actor_name: string | null;
    }> = rows.map((value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new ConsultationRepositoryError(
          "Failed to retrieve consultation status history from database."
        );
      }
      const row = value as Record<string, unknown>;
      const idValue = row.id;
      const consultationId = row.consultation_id;
      const oldStatus = row.old_status;
      const newStatus = row.new_status;
      const changedAt = row.changed_at;
      const changedBy = row.changed_by;
      const version = readInteger(row.version);
      if (
        typeof idValue !== "string" ||
        typeof consultationId !== "string" ||
        typeof oldStatus !== "string" ||
        typeof newStatus !== "string" ||
        typeof changedBy !== "string" ||
        !isValidConsultationStatusTransition(oldStatus, newStatus) ||
        oldStatus === newStatus ||
        typeof changedAt !== "string" ||
        version === null
      ) {
        throw new ConsultationRepositoryError(
          "Failed to retrieve consultation status history from database."
        );
      }

      return {
        id: idValue,
        consultation_id: consultationId,
        old_status: oldStatus as ConsultationStatus,
        new_status: newStatus as ConsultationStatus,
        changed_at: changedAt,
        version,
        actor_id: changedBy,
        actor_name: null
      };
    });

    const actorIds = [...new Set(parsedRows.map((row) => row.actor_id))];
    const actorNames = new Map<string, string>();
    if (actorIds.length > 0) {
      const actorResult = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      if (actorResult.error) {
        throw new ConsultationRepositoryError(
          "Failed to retrieve consultation status history from database."
        );
      }
      const actorRows = Array.isArray(actorResult.data) ? actorResult.data : [];
      for (const value of actorRows) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
        const row = value as Record<string, unknown>;
        if (typeof row.id === "string") {
          const name = readActorName(row);
          if (name !== null) actorNames.set(row.id, name);
        }
      }
    }

    return parsedRows.map(({ actor_id: _actorId, ...row }) => ({
      ...row,
      actor_name: actorNames.get(_actorId) ?? null
    }));
  } catch (error) {
    if (error instanceof ConsultationRepositoryError) throw error;
    throw new ConsultationRepositoryError(
      "Failed to retrieve consultation status history from database."
    );
  }
}

/**
 * Updates a consultation record's status.
 *
 * Requirements:
 * - Validates id with the existing strict UUID helper before any database call.
 * - Validates status against the existing canonical list ('new', 'contacted', 'qualified', 'closed').
 * - Invalid UUID/status throws ConsultationInputError without querying the database.
 * - Uses server Supabase client (createClient()), with optional positional mock client for testing.
 * - Update payload is strictly { status, version } - never accepts arbitrary objects or updates other columns.
 * - Queries only consultations, filters by validated UUID, expected version, and expected current status.
 * - Returns only database-managed status/audit fields needed by the action.
 * - Returns null when no matching row is returned.
 * - Maps all database/network exceptions to ConsultationRepositoryError without exposing raw DB errors or PII.
 */
export async function updateConsultationStatus(
  id: string,
  status: ConsultationStatus,
  expectedVersion: number,
  expectedStatus: ConsultationStatus,
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

  if (
    typeof expectedVersion !== "number" ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new ConsultationInputError("Invalid consultation version.");
  }

  if (
    typeof expectedStatus !== "string" ||
    !VALID_CONSULTATION_STATUSES.includes(expectedStatus as ConsultationStatus)
  ) {
    throw new ConsultationInputError("Invalid current consultation status.");
  }

  if (!isValidConsultationStatusTransition(expectedStatus, status)) {
    throw new ConsultationInputError("Invalid consultation status transition.");
  }

  let data: unknown;
  let error: unknown;

  try {
    const supabase = client ?? (await createClient());
    // A same-state retry is a read-only CAS check. Avoiding UPDATE entirely
    // prevents legacy/third-party triggers from turning an idempotent retry
    // into an audit mutation, while the DB trigger remains the authority for
    // every direct SQL update.
    const result = status === expectedStatus
      ? await supabase
        .from("consultations")
        .select(CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS)
        .eq("id", id)
        .eq("version", expectedVersion)
        .eq("status", expectedStatus)
        .maybeSingle()
      : await supabase
        .from("consultations")
        .update({ status, version: expectedVersion + 1 })
        .eq("id", id)
        .eq("version", expectedVersion)
        .eq("status", expectedStatus)
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
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    version: Number(row.version)
  };
}
