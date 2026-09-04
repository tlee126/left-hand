import { createClient } from "@/lib/supabase/server";

export type AccountApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type AccountStatus = AccountApprovalStatus;

export const ACCOUNT_APPROVAL_STATUSES: readonly AccountApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "suspended"
] as const;

export const DEFAULT_ACCOUNT_APPROVAL_PAGE_LIMIT = 20;
export const MAX_ACCOUNT_APPROVAL_PAGE_LIMIT = 100;
export const MAX_ACCOUNT_APPROVAL_SEARCH_LENGTH = 100;

export const ACCOUNT_APPROVAL_COLUMNS = [
  "id",
  "full_name",
  "email",
  "phone",
  "faculty",
  "major",
  "student_code",
  "avatar_url",
  "gpa_goal",
  "role",
  "account_status",
  "approved_at",
  "approved_by",
  "rejection_reason",
  "created_at",
  "updated_at"
] as const;

export const ACCOUNT_APPROVAL_SELECT_COLUMNS = ACCOUNT_APPROVAL_COLUMNS.join(
  ", "
);

export interface AccountForApproval {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  faculty: string | null;
  major: string | null;
  student_code: string | null;
  avatar_url: string | null;
  gpa_goal: number | null;
  role: string;
  account_status: AccountApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListAccountsForApprovalOptions {
  status?: AccountApprovalStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateAccountApprovalInput {
  account_status: AccountApprovalStatus;
  rejection_reason?: string | null;
}

export class AccountApprovalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountApprovalInputError";
  }
}

export class AccountApprovalRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountApprovalRepositoryError";
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns?: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  or(filters: string): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  update(payload: Record<string, unknown>): QueryBuilder;
  maybeSingle(): Promise<QueryResult>;
}

interface AccountApprovalClient {
  from(table: string): QueryBuilder;
}

function assertOptionsObject(options: unknown): asserts options is Record<string, unknown> {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new AccountApprovalInputError(
      "Invalid options: options must be an object."
    );
  }
}

function validateListOptions(
  options: ListAccountsForApprovalOptions | undefined
): { status?: AccountApprovalStatus; search?: string; limit: number; offset: number } {
  if (options === undefined) {
    return {
      limit: DEFAULT_ACCOUNT_APPROVAL_PAGE_LIMIT,
      offset: 0
    };
  }

  assertOptionsObject(options);
  const rawOptions = options as Record<string, unknown>;
  const allowedKeys = new Set(["status", "search", "limit", "offset"]);
  for (const key of Object.keys(rawOptions)) {
    if (!allowedKeys.has(key)) {
      throw new AccountApprovalInputError(
        `Invalid options field: ${key} is not permitted.`
      );
    }
  }

  let status: AccountApprovalStatus | undefined;
  if (rawOptions.status !== undefined) {
    if (
      typeof rawOptions.status !== "string" ||
      !ACCOUNT_APPROVAL_STATUSES.includes(
        rawOptions.status as AccountApprovalStatus
      )
    ) {
      throw new AccountApprovalInputError("Invalid account approval status.");
    }
    status = rawOptions.status as AccountApprovalStatus;
  }

  let limit = DEFAULT_ACCOUNT_APPROVAL_PAGE_LIMIT;
  if (rawOptions.limit !== undefined) {
    if (
      typeof rawOptions.limit !== "number" ||
      !Number.isInteger(rawOptions.limit) ||
      rawOptions.limit < 1 ||
      rawOptions.limit > MAX_ACCOUNT_APPROVAL_PAGE_LIMIT
    ) {
      throw new AccountApprovalInputError(
        `Invalid limit: limit must be an integer between 1 and ${MAX_ACCOUNT_APPROVAL_PAGE_LIMIT}.`
      );
    }
    limit = rawOptions.limit;
  }

  let offset = 0;
  if (rawOptions.offset !== undefined) {
    if (
      typeof rawOptions.offset !== "number" ||
      !Number.isInteger(rawOptions.offset) ||
      rawOptions.offset < 0
    ) {
      throw new AccountApprovalInputError(
        "Invalid offset: offset must be a non-negative integer."
      );
    }
    offset = rawOptions.offset;
  }

  let search: string | undefined;
  if (rawOptions.search !== undefined) {
    if (typeof rawOptions.search !== "string") {
      throw new AccountApprovalInputError(
        "Invalid search parameter: search query must be a string."
      );
    }

    const trimmed = rawOptions.search
      .trim()
      .slice(0, MAX_ACCOUNT_APPROVAL_SEARCH_LENGTH);
    const sanitized = trimmed.replace(/[,()"\\%_*]/g, " ").trim();
    if (sanitized.length > 0) {
      search = sanitized;
    }
  }

  return { status, search, limit, offset };
}

function validateUpdateInput(input: unknown): UpdateAccountApprovalInput {
  assertOptionsObject(input);
  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["account_status", "rejection_reason"]);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new AccountApprovalInputError(
        `Invalid approval input field: ${key} is not permitted.`
      );
    }
  }

  if (
    typeof record.account_status !== "string" ||
    !ACCOUNT_APPROVAL_STATUSES.includes(
      record.account_status as AccountApprovalStatus
    )
  ) {
    throw new AccountApprovalInputError("Invalid account approval status.");
  }

  if (
    record.rejection_reason !== undefined &&
    record.rejection_reason !== null &&
    typeof record.rejection_reason !== "string"
  ) {
    throw new AccountApprovalInputError(
      "Invalid rejection reason: expected a string or null."
    );
  }

  const validated: UpdateAccountApprovalInput = {
    account_status: record.account_status as AccountApprovalStatus
  };
  if ("rejection_reason" in record) {
    validated.rejection_reason = record.rejection_reason as string | null;
  }
  return validated;
}

function repositoryError(message: string): AccountApprovalRepositoryError {
  return new AccountApprovalRepositoryError(message);
}

export async function listAccountsForApproval(
  options?: ListAccountsForApprovalOptions
): Promise<AccountForApproval[]> {
  const validated = validateListOptions(options);

  try {
    const supabase = (await createClient()) as unknown as AccountApprovalClient;
    let query = supabase
      .from("profiles")
      .select(ACCOUNT_APPROVAL_SELECT_COLUMNS);

    if (validated.status !== undefined) {
      query = query.eq("account_status", validated.status);
    }
    if (validated.search !== undefined) {
      query = query.or(
        `full_name.ilike.%${validated.search}%,email.ilike.%${validated.search}%,phone.ilike.%${validated.search}%`
      );
    }

    const result = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(validated.offset, validated.offset + validated.limit - 1);

    if (result.error) {
      throw repositoryError("Failed to list accounts for approval.");
    }
    return (result.data as AccountForApproval[] | null) ?? [];
  } catch (error) {
    if (error instanceof AccountApprovalRepositoryError) {
      throw error;
    }
    throw repositoryError("Failed to list accounts for approval.");
  }
}

export async function getAccountForApprovalById(
  id: string
): Promise<AccountForApproval | null> {
  if (!isValidUuid(id)) {
    throw new AccountApprovalInputError(
      "Invalid account ID: must be a valid UUID."
    );
  }

  try {
    const supabase = (await createClient()) as unknown as AccountApprovalClient;
    const result = await supabase
      .from("profiles")
      .select(ACCOUNT_APPROVAL_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (result.error) {
      throw repositoryError("Failed to retrieve account for approval.");
    }
    return (result.data as AccountForApproval | null) ?? null;
  } catch (error) {
    if (error instanceof AccountApprovalRepositoryError) {
      throw error;
    }
    throw repositoryError("Failed to retrieve account for approval.");
  }
}

export async function updateAccountApproval(
  id: string,
  input: UpdateAccountApprovalInput
): Promise<AccountForApproval | null> {
  if (!isValidUuid(id)) {
    throw new AccountApprovalInputError(
      "Invalid account ID: must be a valid UUID."
    );
  }

  const validated = validateUpdateInput(input);
  const payload: Record<string, unknown> = {
    account_status: validated.account_status
  };
  if ("rejection_reason" in validated) {
    payload.rejection_reason = validated.rejection_reason;
  }

  try {
    const supabase = (await createClient()) as unknown as AccountApprovalClient;
    const result = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", id)
      .select(ACCOUNT_APPROVAL_SELECT_COLUMNS)
      .maybeSingle();

    if (result.error) {
      throw repositoryError("Failed to update account approval.");
    }
    return (result.data as AccountForApproval | null) ?? null;
  } catch (error) {
    if (error instanceof AccountApprovalRepositoryError) {
      throw error;
    }
    throw repositoryError("Failed to update account approval.");
  }
}
