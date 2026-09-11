import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/server-admin";
import type { Database, Json } from "@/lib/supabase/database.types";

type MaterialDirectGrantRow = Database["public"]["Tables"]["material_direct_grants"]["Row"];

export type MaterialDirectGrant = MaterialDirectGrantRow;

export interface GrantMaterialDirectAccessInput {
  userId: string;
  materialId: string;
  canView: boolean;
  canDownload: boolean;
  expiresAt?: string | null;
}

export interface UpdateMaterialDirectAccessInput {
  userId: string;
  materialId: string;
  canView?: boolean;
  canDownload?: boolean;
  expiresAt?: string | null;
}

export interface MaterialDirectAccessStudent {
  id: string;
  full_name: string;
  email: string | null;
  student_code: string | null;
  faculty: string | null;
  major: string | null;
}

export class MaterialDirectAccessInputError extends Error {
  constructor(message = "Invalid material direct access input.") {
    super(message);
    this.name = "MaterialDirectAccessInputError";
  }
}

export class MaterialDirectAccessRepositoryError extends Error {
  constructor(message = "Material direct access operation failed.") {
    super(message);
    this.name = "MaterialDirectAccessRepositoryError";
  }
}

export const MATERIAL_DIRECT_GRANT_COLUMNS = [
  "id",
  "user_id",
  "material_id",
  "can_view",
  "can_download",
  "expires_at",
  "revoked_at",
  "granted_by",
  "created_at",
  "updated_at"
] as const;

export const MATERIAL_DIRECT_GRANT_SELECT = MATERIAL_DIRECT_GRANT_COLUMNS.join(", ");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRANT_KEYS = new Set(["userId", "materialId", "canView", "canDownload", "expiresAt"]);
const UPDATE_KEYS = new Set(["userId", "materialId", "canView", "canDownload", "expiresAt"]);

function canonicalUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new MaterialDirectAccessInputError();
  return value.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Reflect.ownKeys(record).every((key) => typeof key === "string" && allowed.has(key));
}

function timestamp(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new MaterialDirectAccessInputError();
  return value;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new MaterialDirectAccessInputError();
  return value;
}

export function validateGrantMaterialDirectAccessInput(input: unknown): GrantMaterialDirectAccessInput {
  if (!isRecord(input) || !hasOnlyKeys(input, GRANT_KEYS)
    || !Object.prototype.hasOwnProperty.call(input, "userId")
    || !Object.prototype.hasOwnProperty.call(input, "materialId")
    || !Object.prototype.hasOwnProperty.call(input, "canView")
    || !Object.prototype.hasOwnProperty.call(input, "canDownload")) {
    throw new MaterialDirectAccessInputError();
  }

  const canView = requireBoolean(input.canView);
  const canDownload = requireBoolean(input.canDownload);
  if (canDownload && !canView) throw new MaterialDirectAccessInputError();
  return {
    userId: canonicalUuid(input.userId),
    materialId: canonicalUuid(input.materialId),
    canView,
    canDownload,
    expiresAt: timestamp(input.expiresAt)
  };
}

export function validateUpdateMaterialDirectAccessInput(input: unknown): UpdateMaterialDirectAccessInput {
  if (!isRecord(input) || !hasOnlyKeys(input, UPDATE_KEYS)
    || !Object.prototype.hasOwnProperty.call(input, "userId")
    || !Object.prototype.hasOwnProperty.call(input, "materialId")) {
    throw new MaterialDirectAccessInputError();
  }

  const hasCanView = Object.prototype.hasOwnProperty.call(input, "canView");
  const hasCanDownload = Object.prototype.hasOwnProperty.call(input, "canDownload");
  const hasExpiresAt = Object.prototype.hasOwnProperty.call(input, "expiresAt");
  if (!hasCanView && !hasCanDownload && !hasExpiresAt) throw new MaterialDirectAccessInputError();

  const canView = hasCanView ? requireBoolean(input.canView) : undefined;
  const canDownload = hasCanDownload ? requireBoolean(input.canDownload) : undefined;
  if (canView === false && canDownload === true) throw new MaterialDirectAccessInputError();
  return {
    userId: canonicalUuid(input.userId),
    materialId: canonicalUuid(input.materialId),
    ...(hasCanView ? { canView } : {}),
    ...(hasCanDownload ? { canDownload } : {}),
    ...(hasExpiresAt ? { expiresAt: timestamp(input.expiresAt) } : {})
  };
}

function validateGrantRow(value: unknown): MaterialDirectGrant {
  if (!isRecord(value)
    || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)
    || typeof value.user_id !== "string" || !UUID_PATTERN.test(value.user_id)
    || typeof value.material_id !== "string" || !UUID_PATTERN.test(value.material_id)
    || typeof value.can_view !== "boolean"
    || typeof value.can_download !== "boolean"
    || (value.can_download && !value.can_view)
    || (value.expires_at !== null && (typeof value.expires_at !== "string" || !Number.isFinite(Date.parse(value.expires_at))))
    || (value.revoked_at !== null && (typeof value.revoked_at !== "string" || !Number.isFinite(Date.parse(value.revoked_at))))
    || typeof value.granted_by !== "string" || !UUID_PATTERN.test(value.granted_by)
    || typeof value.created_at !== "string" || !Number.isFinite(Date.parse(value.created_at))
    || typeof value.updated_at !== "string" || !Number.isFinite(Date.parse(value.updated_at))) {
    throw new MaterialDirectAccessRepositoryError();
  }
  return {
    id: value.id.toLowerCase(),
    user_id: value.user_id.toLowerCase(),
    material_id: value.material_id.toLowerCase(),
    can_view: value.can_view,
    can_download: value.can_download,
    expires_at: value.expires_at,
    revoked_at: value.revoked_at,
    granted_by: value.granted_by.toLowerCase(),
    created_at: value.created_at,
    updated_at: value.updated_at
  };
}

function jsonObject(value: Json | null): Record<string, Json | undefined> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new MaterialDirectAccessRepositoryError();
  return value as Record<string, Json | undefined>;
}

export function isActiveMaterialDirectGrant(grant: MaterialDirectGrant, userId: string, materialId: string): boolean {
  const canonicalUserId = canonicalUuid(userId);
  const canonicalMaterialId = canonicalUuid(materialId);
  if (grant.user_id !== canonicalUserId || grant.material_id !== canonicalMaterialId || grant.revoked_at !== null) return false;
  return grant.expires_at === null || Date.parse(grant.expires_at) > Date.now();
}

/** Reads the grant row, including inactive rows, so expired/revoked grants cannot fall back to entitlements. */
export async function getMaterialDirectGrant(userId: string, materialId: string): Promise<MaterialDirectGrant | null> {
  const canonicalUserId = canonicalUuid(userId);
  const canonicalMaterialId = canonicalUuid(materialId);
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase
      .from("material_direct_grants")
      .select(MATERIAL_DIRECT_GRANT_SELECT)
      .eq("user_id", canonicalUserId)
      .eq("material_id", canonicalMaterialId)
      .maybeSingle();
    if (error) throw new Error();
    return data ? validateGrantRow(data) : null;
  } catch (error) {
    if (error instanceof MaterialDirectAccessInputError) throw error;
    if (error instanceof MaterialDirectAccessRepositoryError) throw error;
    throw new MaterialDirectAccessRepositoryError();
  }
}

/** Returns null when the material does not exist; an empty array means it exists without grants. */
export async function getMaterialDirectGrants(materialId: string): Promise<MaterialDirectGrant[] | null> {
  const canonicalMaterialId = canonicalUuid(materialId);
  try {
    const supabase = createServerAdminClient();
    const { data: material, error: materialError } = await supabase
      .from("materials")
      .select("product_id")
      .eq("product_id", canonicalMaterialId)
      .maybeSingle();
    if (materialError) throw new Error();
    if (!material) return null;

    const { data, error } = await supabase
      .from("material_direct_grants")
      .select(MATERIAL_DIRECT_GRANT_SELECT)
      .eq("material_id", canonicalMaterialId)
      .order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) throw new Error();
    return data.map(validateGrantRow);
  } catch (error) {
    if (error instanceof MaterialDirectAccessInputError || error instanceof MaterialDirectAccessRepositoryError) throw error;
    throw new MaterialDirectAccessRepositoryError();
  }
}

export async function searchApprovedStudents(query: string, limit = 20): Promise<MaterialDirectAccessStudent[]> {
  if (typeof query !== "string" || query.trim().length < 1 || query.trim().length > 100 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new MaterialDirectAccessInputError();
  const term = query.trim().replace(/[^\p{L}\p{N}@._+\-\s]/gu, " ").trim();
  if (!term) throw new MaterialDirectAccessInputError();
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, student_code, faculty, major")
      .eq("role", "student")
      .eq("account_status", "approved")
      .or(`full_name.ilike.*${term}*,email.ilike.*${term}*,student_code.ilike.*${term}*`)
      .order("full_name", { ascending: true })
      .limit(limit);
    if (error || !Array.isArray(data)) throw new Error();
    return data.map((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || !UUID_PATTERN.test(row.id) || typeof row.full_name !== "string"
        || (row.email !== null && typeof row.email !== "string")
        || (row.student_code !== null && typeof row.student_code !== "string")
        || (row.faculty !== null && typeof row.faculty !== "string")
        || (row.major !== null && typeof row.major !== "string")) throw new MaterialDirectAccessRepositoryError();
      return {
        id: row.id.toLowerCase(),
        full_name: row.full_name,
        email: row.email,
        student_code: row.student_code,
        faculty: row.faculty,
        major: row.major
      };
    });
  } catch (error) {
    if (error instanceof MaterialDirectAccessInputError || error instanceof MaterialDirectAccessRepositoryError) throw error;
    throw new MaterialDirectAccessRepositoryError();
  }
}

async function callRpc<T extends Json | null>(name: string, args: Record<string, unknown>): Promise<MaterialDirectGrant> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ data: T; error: unknown }>)(name, args);
    if (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "22023") {
        throw new MaterialDirectAccessInputError();
      }
      throw new Error();
    }
    return validateGrantRow(jsonObject(data));
  } catch (error) {
    if (error instanceof MaterialDirectAccessInputError || error instanceof MaterialDirectAccessRepositoryError) throw error;
    throw new MaterialDirectAccessRepositoryError();
  }
}

export async function grantMaterialDirectAccess(input: GrantMaterialDirectAccessInput): Promise<MaterialDirectGrant> {
  const value = validateGrantMaterialDirectAccessInput(input);
  return callRpc("admin_material_direct_grant_upsert", {
    p_material_id: value.materialId,
    p_user_id: value.userId,
    p_can_view: value.canView,
    p_can_download: value.canDownload,
    p_expires_at: value.expiresAt
  });
}

export async function updateMaterialDirectAccess(input: UpdateMaterialDirectAccessInput): Promise<MaterialDirectGrant> {
  const value = validateUpdateMaterialDirectAccessInput(input);
  return callRpc("admin_material_direct_grant_update", {
    p_material_id: value.materialId,
    p_user_id: value.userId,
    p_can_view: value.canView ?? null,
    p_can_download: value.canDownload ?? null,
    p_expires_at: value.expiresAt ?? null,
    p_set_expires_at: Object.prototype.hasOwnProperty.call(value, "expiresAt")
  });
}

export async function revokeMaterialDirectAccess(userId: string, materialId: string): Promise<MaterialDirectGrant> {
  const canonicalUserId = canonicalUuid(userId);
  const canonicalMaterialId = canonicalUuid(materialId);
  return callRpc("admin_material_direct_grant_revoke", {
    p_material_id: canonicalMaterialId,
    p_user_id: canonicalUserId
  });
}
