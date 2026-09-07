import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type LearningProgressRow = Database["public"]["Tables"]["learning_progress"]["Row"];
type LearningProgressInsert = Database["public"]["Tables"]["learning_progress"]["Insert"];

export type LearningProgressItemType = "material" | "lesson";
export type LearningProgressStatus = "not_started" | "in_progress" | "completed";

export type LearningProgress = Omit<LearningProgressRow, "item_type" | "status"> & {
  item_type: LearningProgressItemType;
  status: LearningProgressStatus;
};

export interface UpsertLearningProgressInput {
  productId: string;
  itemType: LearningProgressItemType;
  itemId: string;
  status: LearningProgressStatus;
  watchedPercent: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

const REQUIRED_INPUT_KEYS = new Set([
  "productId",
  "itemType",
  "itemId",
  "status",
  "watchedPercent"
]);
const OPTIONAL_INPUT_KEYS = new Set(["startedAt", "completedAt"]);
const ITEM_TYPES = new Set<LearningProgressItemType>(["material", "lesson"]);
const STATUSES = new Set<LearningProgressStatus>(["not_started", "in_progress", "completed"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROGRESS_ROWS = 500;

export const LEARNING_PROGRESS_COLUMNS = [
  "user_id",
  "product_id",
  "item_type",
  "item_id",
  "status",
  "watched_percent",
  "started_at",
  "completed_at",
  "created_at",
  "updated_at"
] as const;

export const LEARNING_PROGRESS_SELECT = LEARNING_PROGRESS_COLUMNS.join(", ");

export class LearningProgressInputError extends Error {
  constructor(message = "Invalid learning progress input.") {
    super(message);
    this.name = "LearningProgressInputError";
  }
}

export class LearningProgressRepositoryError extends Error {
  constructor(message = "Learning progress operation failed.") {
    super(message);
    this.name = "LearningProgressRepositoryError";
  }
}

function canonicalUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new LearningProgressInputError();
  }
  return value.toLowerCase();
}

function hasExactKeys(
  record: object,
  requiredKeys: ReadonlySet<string>,
  optionalKeys: ReadonlySet<string>
): boolean {
  const keys = Reflect.ownKeys(record);
  return [...requiredKeys].every((key) => Object.prototype.hasOwnProperty.call(record, key))
    && keys.every((key) => typeof key === "string" && (requiredKeys.has(key) || optionalKeys.has(key)));
}

function validateTimestamp(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new LearningProgressInputError();
  }
  return value;
}

export function validateLearningProgressInput(input: unknown): UpsertLearningProgressInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new LearningProgressInputError();
  }

  const record = input as Record<string, unknown>;
  if (!hasExactKeys(record, REQUIRED_INPUT_KEYS, OPTIONAL_INPUT_KEYS)) {
    throw new LearningProgressInputError();
  }

  const productId = canonicalUuid(record.productId);
  const itemId = canonicalUuid(record.itemId);
  if (typeof record.itemType !== "string" || !ITEM_TYPES.has(record.itemType as LearningProgressItemType)) {
    throw new LearningProgressInputError();
  }
  if (typeof record.status !== "string" || !STATUSES.has(record.status as LearningProgressStatus)) {
    throw new LearningProgressInputError();
  }
  if (typeof record.watchedPercent !== "number"
    || !Number.isFinite(record.watchedPercent)
    || record.watchedPercent < 0
    || record.watchedPercent > 100) {
    throw new LearningProgressInputError();
  }

  return {
    productId,
    itemType: record.itemType as LearningProgressItemType,
    itemId,
    status: record.status as LearningProgressStatus,
    watchedPercent: record.watchedPercent,
    startedAt: validateTimestamp(record.startedAt),
    completedAt: validateTimestamp(record.completedAt)
  };
}

function repositoryFailure(): never {
  throw new LearningProgressRepositoryError();
}

function isValidProgressRow(value: unknown): value is LearningProgress {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return UUID_PATTERN.test(String(row.user_id))
    && UUID_PATTERN.test(String(row.product_id))
    && UUID_PATTERN.test(String(row.item_id))
    && typeof row.item_type === "string"
    && ITEM_TYPES.has(row.item_type as LearningProgressItemType)
    && typeof row.status === "string"
    && STATUSES.has(row.status as LearningProgressStatus)
    && typeof row.watched_percent === "number"
    && Number.isFinite(row.watched_percent)
    && row.watched_percent >= 0
    && row.watched_percent <= 100
    && (typeof row.started_at === "string" || row.started_at === null)
    && (typeof row.completed_at === "string" || row.completed_at === null)
    && typeof row.created_at === "string"
    && typeof row.updated_at === "string";
}

function compareProgressRows(left: LearningProgress, right: LearningProgress): number {
  return left.item_type.localeCompare(right.item_type)
    || left.item_id.localeCompare(right.item_id)
    || left.updated_at.localeCompare(right.updated_at);
}

/** Reads only the authenticated user's bounded, deterministic progress for one product workspace. */
export async function getLearningProgressForWorkspace(
  userId: string,
  productId: string
): Promise<LearningProgress[]> {
  if (arguments.length !== 2) throw new LearningProgressInputError();
  const canonicalUserId = canonicalUuid(userId);
  const canonicalProductId = canonicalUuid(productId);

  try {
    const supabase = await createClient();
    const query = supabase
      .from("learning_progress")
      .select(LEARNING_PROGRESS_SELECT)
      .eq("user_id", canonicalUserId)
      .eq("product_id", canonicalProductId);

    const { data, error } = await query
      .order("item_type", { ascending: true })
      .order("item_id", { ascending: true })
      .limit(MAX_PROGRESS_ROWS);
    if (error || !Array.isArray(data) || data.length > MAX_PROGRESS_ROWS) return repositoryFailure();
    const rows = data as unknown[];
    if (!rows.every(isValidProgressRow)) return repositoryFailure();
    if (!rows.every((row) => canonicalUuid(row.user_id) === canonicalUserId && canonicalUuid(row.product_id) === canonicalProductId)) {
      return repositoryFailure();
    }
    return rows.slice().sort(compareProgressRows);
  } catch (error) {
    if (error instanceof LearningProgressInputError || error instanceof LearningProgressRepositoryError) throw error;
    return repositoryFailure();
  }
}

export const getLearningProgress = getLearningProgressForWorkspace;

/** Confirms that a progress item is a real item under the entitled product. */
export async function isLearningProgressItemForProduct(
  productId: string,
  itemType: LearningProgressItemType,
  itemId: string
): Promise<boolean> {
  if (arguments.length !== 3) throw new LearningProgressInputError();
  const canonicalProductId = canonicalUuid(productId);
  const canonicalItemId = canonicalUuid(itemId);
  if (!ITEM_TYPES.has(itemType)) throw new LearningProgressInputError();

  try {
    const supabase = await createClient();
    if (itemType === "material") {
      if (canonicalItemId !== canonicalProductId) return false;
      const { data, error } = await supabase
        .from("materials")
        .select("product_id")
        .eq("product_id", canonicalProductId)
        .maybeSingle();
      if (error) return repositoryFailure();
      return !!data && canonicalUuid((data as { product_id?: unknown }).product_id) === canonicalProductId;
    }

    const { data, error } = await supabase
      .from("course_lessons")
      .select("id, course_id")
      .eq("id", canonicalItemId)
      .maybeSingle();
    if (error) return repositoryFailure();
    return !!data
      && canonicalUuid((data as { id?: unknown }).id) === canonicalItemId
      && canonicalUuid((data as { course_id?: unknown }).course_id) === canonicalProductId;
  } catch (error) {
    if (error instanceof LearningProgressInputError || error instanceof LearningProgressRepositoryError) throw error;
    return repositoryFailure();
  }
}

/** Upserts only progress fields; the caller supplies the authenticated session user separately. */
export async function upsertLearningProgress(
  userId: string,
  input: UpsertLearningProgressInput
): Promise<LearningProgress> {
  if (arguments.length !== 2) throw new LearningProgressInputError();
  const canonicalUserId = canonicalUuid(userId);
  const validated = validateLearningProgressInput(input);

  try {
    const supabase = await createClient();
    const payload: LearningProgressInsert = {
      user_id: canonicalUserId,
      product_id: validated.productId,
      item_type: validated.itemType,
      item_id: validated.itemId,
      status: validated.status,
      watched_percent: validated.watchedPercent,
      started_at: validated.startedAt,
      completed_at: validated.completedAt
    };
    const { data, error } = await supabase
      .from("learning_progress")
      .upsert(payload, { onConflict: "user_id,product_id,item_type,item_id" })
      .select(LEARNING_PROGRESS_SELECT)
      .single();

    if (error || !isValidProgressRow(data)) return repositoryFailure();
    if (canonicalUuid(data.user_id) !== canonicalUserId || canonicalUuid(data.product_id) !== validated.productId) return repositoryFailure();
    if (data.item_type !== validated.itemType || canonicalUuid(data.item_id) !== validated.itemId) return repositoryFailure();
    return data;
  } catch (error) {
    if (error instanceof LearningProgressInputError || error instanceof LearningProgressRepositoryError) throw error;
    return repositoryFailure();
  }
}

export const saveLearningProgress = upsertLearningProgress;
