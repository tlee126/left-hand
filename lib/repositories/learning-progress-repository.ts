import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type LearningProgressRow = Database["public"]["Tables"]["learning_progress"]["Row"];

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
  expectedVersion: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

const REQUIRED_INPUT_KEYS = new Set([
  "productId",
  "itemType",
  "itemId",
  "status",
  "watchedPercent",
  "expectedVersion"
]);
const OPTIONAL_INPUT_KEYS = new Set(["startedAt", "completedAt"]);
const ITEM_TYPES = new Set<LearningProgressItemType>(["material", "lesson"]);
const STATUSES = new Set<LearningProgressStatus>(["not_started", "in_progress", "completed"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROGRESS_ROWS = 500;
export const LEARNING_PROGRESS_PRODUCT_CHUNK_SIZE = 100;
export const LEARNING_PROGRESS_MAX_PRODUCTS = 500;

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
  "updated_at",
  "version"
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

export class LearningProgressConflictError extends Error {
  constructor(message = "Learning progress conflict.") {
    super(message);
    this.name = "LearningProgressConflictError";
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
  if (typeof record.expectedVersion !== "number" || !Number.isSafeInteger(record.expectedVersion) || record.expectedVersion < 0) {
    throw new LearningProgressInputError();
  }

  return {
    productId,
    itemType: record.itemType as LearningProgressItemType,
    itemId,
    status: record.status as LearningProgressStatus,
    watchedPercent: record.watchedPercent,
    expectedVersion: record.expectedVersion,
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
    && typeof row.updated_at === "string"
    && Number.isSafeInteger(row.version)
    && Number(row.version) >= 1;
}

function compareProgressRows(left: LearningProgress, right: LearningProgress): number {
  return left.item_type.localeCompare(right.item_type)
    || left.item_id.localeCompare(right.item_id)
    || left.updated_at.localeCompare(right.updated_at);
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function progressKey(row: LearningProgress): string {
  return `${canonicalUuid(row.user_id)}:${canonicalUuid(row.product_id)}:${row.item_type}:${canonicalUuid(row.item_id)}`;
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

/** Reads all progress for a bounded workspace through deterministic product-ID and row pages. */
export async function getLearningProgressForProducts(
  userId: string,
  productIds: readonly string[]
): Promise<LearningProgress[]> {
  if (arguments.length !== 2 || !Array.isArray(productIds)) throw new LearningProgressInputError();
  const canonicalUserId = canonicalUuid(userId);
  const canonicalProductIds = [...new Set(productIds.map((productId) => canonicalUuid(productId)))];
  if (canonicalProductIds.length > LEARNING_PROGRESS_MAX_PRODUCTS) throw new LearningProgressInputError();
  if (canonicalProductIds.length === 0) return [];

  try {
    const supabase = await createClient();
    const results = new Map<string, LearningProgress>();
    for (const productIdChunk of chunks(canonicalProductIds, LEARNING_PROGRESS_PRODUCT_CHUNK_SIZE)) {
      for (let offset = 0; ; offset += MAX_PROGRESS_ROWS) {
        const { data, error } = await supabase
          .from("learning_progress")
          .select(LEARNING_PROGRESS_SELECT)
          .eq("user_id", canonicalUserId)
          .in("product_id", productIdChunk)
          .order("product_id", { ascending: true })
          .order("item_type", { ascending: true })
          .order("item_id", { ascending: true })
          .range(offset, offset + MAX_PROGRESS_ROWS - 1);
        if (error || !Array.isArray(data) || data.length > MAX_PROGRESS_ROWS) return repositoryFailure();
        const rows = data as unknown[];
        if (!rows.every(isValidProgressRow)) return repositoryFailure();
        if (!rows.every((row) => canonicalUuid(row.user_id) === canonicalUserId && productIdChunk.includes(canonicalUuid(row.product_id)))) return repositoryFailure();
        for (const row of rows) results.set(progressKey(row), row);
        if (data.length < MAX_PROGRESS_ROWS) break;
      }
    }
    return [...results.values()].sort((left, right) => canonicalUuid(left.product_id).localeCompare(canonicalUuid(right.product_id)) || compareProgressRows(left, right));
  } catch (error) {
    if (error instanceof LearningProgressInputError || error instanceof LearningProgressRepositoryError) throw error;
    return repositoryFailure();
  }
}

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

/** Writes only through the database entitlement boundary; user identity comes from auth.uid(). */
export async function upsertLearningProgress(
  userId: string,
  input: UpsertLearningProgressInput
): Promise<LearningProgress> {
  if (arguments.length !== 2) throw new LearningProgressInputError();
  const canonicalUserId = canonicalUuid(userId);
  const validated = validateLearningProgressInput(input);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_learning_progress", {
      p_product_id: validated.productId,
      p_item_type: validated.itemType,
      p_item_id: validated.itemId,
      p_status: validated.status,
      p_watched_percent: validated.watchedPercent,
      p_started_at: validated.startedAt ?? null,
      p_completed_at: validated.completedAt ?? null,
      p_expected_version: validated.expectedVersion
    });

    if (error) {
      if ((error as { code?: string }).code === "P0002") throw new LearningProgressConflictError();
      return repositoryFailure();
    }
    const row = (Array.isArray(data) ? data[0] : data) as unknown;
    if (!isValidProgressRow(row)) return repositoryFailure();
    if (canonicalUuid(row.user_id) !== canonicalUserId || canonicalUuid(row.product_id) !== validated.productId) return repositoryFailure();
    if (row.item_type !== validated.itemType || canonicalUuid(row.item_id) !== validated.itemId) return repositoryFailure();
    return row;
  } catch (error) {
    if (error instanceof LearningProgressInputError || error instanceof LearningProgressRepositoryError || error instanceof LearningProgressConflictError) throw error;
    return repositoryFailure();
  }
}

export const saveLearningProgress = upsertLearningProgress;
