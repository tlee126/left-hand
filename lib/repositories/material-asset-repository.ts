import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/server-admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupportedMaterialMimeType,
  isValidMaterialStoragePathForProduct,
  isValidMaterialStoragePathForProductAndVersion,
  isValidMaterialUuid,
  materialSizeLimit,
  sanitizeMaterialFilename
} from "@/lib/storage/material-storage";

type MaterialAssetRow = Database["public"]["Tables"]["material_assets"]["Row"];
type UserScopedSupabaseClient = SupabaseClient<Database>;

export const MATERIAL_ASSET_COLUMNS = [
  "id", "product_id", "uploaded_by", "upload_reservation_id", "upload_idempotency_key", "storage_path", "original_name", "mime_type", "byte_size", "version", "visibility", "created_at", "updated_at"
] as const;
export const MATERIAL_ASSET_SELECT = MATERIAL_ASSET_COLUMNS.join(", ");
export const CURRENT_MATERIAL_ASSET_SELECT = ["product_id", "storage_path", "version", "visibility"].join(", ");

export type MaterialAsset = MaterialAssetRow;

export class MaterialAssetInputError extends Error {
  constructor(message = "Invalid material asset input.") {
    super(message);
    this.name = "MaterialAssetInputError";
  }
}

export class MaterialAssetRepositoryError extends Error {
  constructor(message = "Material asset operation failed.") {
    super(message);
    this.name = "MaterialAssetRepositoryError";
  }
}

export class MaterialAssetUploadConflictError extends Error {
  constructor(message = "Material upload is not available.") {
    super(message);
    this.name = "MaterialAssetUploadConflictError";
  }
}

export interface MaterialAssetUploadReservation {
  reservationId: string;
  version: number;
  storagePath: string;
  status: "reserved" | "committed";
  isNew: boolean;
  retryable: boolean;
  cleanupPending: boolean;
}

export interface ReserveMaterialAssetUploadInput {
  productId: string;
  originalName: string;
  safeFilename: string;
  mimeType: string;
  byteSize: number;
  idempotencyKey: string;
}

export interface CurrentMaterialAsset {
  productId: string;
  storagePath: string;
}

export interface MaterialAssetUploadReservationDetails {
  reservationId: string;
  productId: string;
  uploadedBy: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  version: number;
  expiresAt: string;
  idempotencyKey: string | null;
  cancelledAt: string | null;
  retryableAt: string | null;
  cleanupPendingAt: string | null;
}

export interface ExpiredMaterialAssetUploadClaim {
  reservationId: string;
  storagePath: string;
  claimId: string;
}

function logMaterialUploadRpcArgumentDiagnostics(field: "p_original_name" | "p_safe_filename", value: string, correlationId?: string): void {
  const bytes = Buffer.from(value, "utf8");
  const databaseRegexValid = field === "p_original_name"
    ? value.length > 0 && value.length <= 200 && !/[/\\]/.test(value) && !/[\u0000-\u001f\u007f]/.test(value) && !/\.\./.test(value)
    : /^[a-z0-9][a-z0-9._-]{0,199}$/.test(value) && !/\.\./.test(value) && /\./.test(value);
  console.info({
    field,
    valueJson: JSON.stringify(value),
    characterLength: value.length,
    utf8ByteLength: bytes.length,
    utf8BytesHex: bytes.toString("hex"),
    databaseRegexValid,
    correlationId: correlationId ?? "unknown",
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown"
  });
}

function validateProductIds(productIds: readonly string[]): void {
  if (!Array.isArray(productIds) || productIds.some((productId) => !isValidMaterialUuid(productId))) throw new MaterialAssetInputError();
}

function asObject(value: Json | null): Record<string, Json | undefined> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new MaterialAssetRepositoryError();
  return value as Record<string, Json | undefined>;
}

function asString(value: Json | undefined): string {
  if (typeof value !== "string") throw new MaterialAssetRepositoryError();
  return value;
}

function asPositiveInteger(value: Json | undefined): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new MaterialAssetRepositoryError();
  return value;
}

function asBoolean(value: Json | undefined): boolean {
  if (typeof value !== "boolean") throw new MaterialAssetRepositoryError();
  return value;
}

function asOptionalTimestamp(value: Json | undefined): string | null {
  if (value === null) return null;
  if (value === undefined) throw new MaterialAssetRepositoryError();
  const timestamp = asString(value);
  if (!Number.isFinite(Date.parse(timestamp))) throw new MaterialAssetRepositoryError();
  return timestamp;
}

function asUploadStatus(value: Json | undefined): "reserved" | "committed" {
  if (value !== "reserved" && value !== "committed") throw new MaterialAssetRepositoryError();
  return value;
}

export async function isMaterialProduct(productId: string, client?: UserScopedSupabaseClient): Promise<boolean> {
  if (!isValidMaterialUuid(productId)) throw new MaterialAssetInputError();
  const canonicalProductId = productId.toLowerCase();
  try {
    const supabase = client ?? (await createClient());
    const { data, error } = await supabase.from("materials").select("product_id").eq("product_id", canonicalProductId).maybeSingle();
    if (error) throw new Error();
    return data !== null;
  } catch {
    throw new MaterialAssetRepositoryError();
  }
}

export async function reserveMaterialAssetUpload(input: ReserveMaterialAssetUploadInput, client?: UserScopedSupabaseClient, correlationId?: string): Promise<MaterialAssetUploadReservation> {
  if (!isValidMaterialUuid(input.productId) || !isValidMaterialUuid(input.idempotencyKey) || !isSupportedMaterialMimeType(input.mimeType) || !Number.isSafeInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > materialSizeLimit(input.mimeType)) throw new MaterialAssetInputError();
  if (sanitizeMaterialFilename(input.originalName) !== input.safeFilename) throw new MaterialAssetInputError();

  try {
    // This RPC is owner-bound: its SQL derives uploaded_by from auth.uid().
    // Never replace this with the service-role client, whose auth.uid() is NULL.
    const supabase = client ?? (await createClient());
    const rpcArgs = {
      p_product_id: input.productId.toLowerCase(),
      p_original_name: input.originalName,
      p_safe_filename: input.safeFilename,
      p_mime_type: input.mimeType,
      p_byte_size: input.byteSize,
      p_idempotency_key: input.idempotencyKey.toLowerCase()
    };
    logMaterialUploadRpcArgumentDiagnostics("p_original_name", rpcArgs.p_original_name, correlationId);
    logMaterialUploadRpcArgumentDiagnostics("p_safe_filename", rpcArgs.p_safe_filename, correlationId);
    const { data, error } = await supabase.rpc("reserve_material_asset_upload", rpcArgs);
    if (error) throw error;
    const row = asObject(data as Json | null);
    if (row.status === "conflict") throw new MaterialAssetUploadConflictError();
    const reservationId = asString(row.reservation_id);
    const version = asPositiveInteger(row.version);
    const storagePath = asString(row.storage_path);
    const status = asUploadStatus(row.status);
    const isNew = asBoolean(row.is_new);
    const retryable = asBoolean(row.retryable);
    const cleanupPending = asBoolean(row.cleanup_pending);
    if (!isValidMaterialUuid(reservationId) || !isValidMaterialStoragePathForProductAndVersion(storagePath, input.productId, version)) throw new Error();
    if (retryable && cleanupPending) throw new Error();
    return { reservationId, version, storagePath, status, isNew, retryable, cleanupPending };
  } catch (error) {
    if (error instanceof MaterialAssetInputError || error instanceof MaterialAssetUploadConflictError) throw error;
    if (isSupabaseInputContractError(error)) {
      console.error("Material upload RPC rejected input contract", { code: "22023", field: "rpc_input_contract" });
      throw new MaterialAssetInputError("Invalid material upload metadata.");
    }
    throw new MaterialAssetRepositoryError();
  }
}

function isSupabaseInputContractError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "22023";
}

function validateReservationRow(row: Record<string, Json | undefined>): MaterialAssetUploadReservationDetails {
  const reservationId = asString(row.id);
  const productId = asString(row.product_id);
  const uploadedBy = asString(row.uploaded_by);
  const storagePath = asString(row.storage_path);
  const originalName = asString(row.original_name);
  const mimeType = asString(row.mime_type);
  const byteSize = asPositiveInteger(row.byte_size);
  const version = asPositiveInteger(row.version);
  const expiresAt = asString(row.expires_at);
  const idempotencyKey = row.upload_idempotency_key === null || row.upload_idempotency_key === undefined ? null : asString(row.upload_idempotency_key);
  const cancelledAt = asOptionalTimestamp(row.cancelled_at);
  const retryableAt = asOptionalTimestamp(row.retryable_at);
  const cleanupPendingAt = asOptionalTimestamp(row.cleanup_pending_at);
  if (!isValidMaterialUuid(reservationId) || !isValidMaterialUuid(productId) || !isValidMaterialUuid(uploadedBy) || (idempotencyKey !== null && !isValidMaterialUuid(idempotencyKey)) || !isSupportedMaterialMimeType(mimeType) || byteSize > materialSizeLimit(mimeType) || !isValidMaterialStoragePathForProductAndVersion(storagePath, productId, version) || !Number.isFinite(Date.parse(expiresAt)) || (retryableAt !== null && cleanupPendingAt !== null)) throw new Error();
  return { reservationId, productId: productId.toLowerCase(), uploadedBy: uploadedBy.toLowerCase(), storagePath, originalName, mimeType, byteSize, version, expiresAt, idempotencyKey: idempotencyKey?.toLowerCase() ?? null, cancelledAt, retryableAt, cleanupPendingAt };
}

export async function getMaterialAssetUploadReservation(reservationId: string): Promise<MaterialAssetUploadReservationDetails | null> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("material_asset_upload_reservations")
      .select("id, product_id, uploaded_by, upload_idempotency_key, storage_path, original_name, mime_type, byte_size, version, expires_at, cancelled_at, retryable_at, cleanup_pending_at")
      .eq("id", reservationId.toLowerCase())
      .maybeSingle();
    if (error) throw new Error();
    return data ? validateReservationRow(data as unknown as Record<string, Json | undefined>) : null;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function getMaterialAssetByUploadReservation(reservationId: string, uploadedBy: string): Promise<MaterialAsset | null> {
  if (!isValidMaterialUuid(reservationId) || !isValidMaterialUuid(uploadedBy)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("material_assets")
      .select(MATERIAL_ASSET_SELECT)
      .eq("upload_reservation_id", reservationId.toLowerCase())
      .eq("uploaded_by", uploadedBy.toLowerCase())
      .maybeSingle();
    if (error) throw new Error();
    if (!data) return null;
    return validateMaterialAssetRow(data as unknown as MaterialAsset);
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

function validateCleanupClaim(row: unknown): ExpiredMaterialAssetUploadClaim {
  if (typeof row !== "object" || row === null || Array.isArray(row)) throw new Error();
  const value = row as Record<string, Json | undefined>;
  const reservationId = asString(value.reservation_id);
  const storagePath = asString(value.storage_path);
  const claimId = asString(value.claim_id);
  if (!isValidMaterialUuid(reservationId) || !isValidMaterialUuid(claimId) || !isValidMaterialStoragePathForProduct(storagePath, storagePath.split("/")[1])) throw new Error();
  return { reservationId, storagePath, claimId };
}

export async function markMaterialAssetUploadCancelled(reservationId: string): Promise<boolean> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_material_asset_upload", { p_reservation_id: reservationId.toLowerCase() });
    if (error || typeof data !== "boolean") throw new Error();
    return data;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function markMaterialAssetUploadRetryable(reservationId: string, client?: UserScopedSupabaseClient): Promise<boolean> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = client ?? (await createClient());
    const { data, error } = await supabase.rpc("mark_material_asset_upload_retryable", { p_reservation_id: reservationId.toLowerCase() });
    if (error || typeof data !== "boolean") throw new Error();
    return data;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function beginMaterialAssetUploadRetryCleanup(reservationId: string): Promise<boolean> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("begin_material_asset_upload_retry_cleanup", { p_reservation_id: reservationId.toLowerCase() });
    if (error || typeof data !== "boolean") throw new Error();
    return data;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function completeMaterialAssetUploadRetryCleanup(reservationId: string): Promise<boolean> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("complete_material_asset_upload_retry_cleanup", { p_reservation_id: reservationId.toLowerCase() });
    if (error || typeof data !== "boolean") throw new Error();
    return data;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function claimExpiredMaterialAssetUploads(limit: number): Promise<ExpiredMaterialAssetUploadClaim[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new MaterialAssetInputError();
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase.rpc("claim_expired_material_asset_uploads", { p_limit: limit });
    if (error || !Array.isArray(data)) throw new Error();
    return data.map(validateCleanupClaim);
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function completeExpiredMaterialAssetUploadCleanup(reservationId: string, claimId: string): Promise<boolean> {
  if (!isValidMaterialUuid(reservationId) || !isValidMaterialUuid(claimId)) throw new MaterialAssetInputError();
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase.rpc("complete_expired_material_asset_upload_cleanup", { p_reservation_id: reservationId.toLowerCase(), p_claim_id: claimId.toLowerCase() });
    if (error || typeof data !== "boolean") throw new Error();
    return data;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function releaseExpiredMaterialAssetUploadCleanup(reservationId: string, claimId: string): Promise<boolean> {
  if (!isValidMaterialUuid(reservationId) || !isValidMaterialUuid(claimId)) throw new MaterialAssetInputError();
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase.rpc("release_expired_material_asset_upload_cleanup", { p_reservation_id: reservationId.toLowerCase(), p_claim_id: claimId.toLowerCase() });
    if (error || typeof data !== "boolean") throw new Error();
    return data;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

function validateMaterialAssetRow(row: MaterialAsset): MaterialAsset {
  if (!isValidMaterialUuid(row.id) || !isValidMaterialUuid(row.product_id) || (row.uploaded_by !== null && !isValidMaterialUuid(row.uploaded_by)) || (row.upload_idempotency_key !== null && !isValidMaterialUuid(row.upload_idempotency_key)) || typeof row.storage_path !== "string" || !isSupportedMaterialMimeType(row.mime_type) || !Number.isSafeInteger(row.byte_size) || row.byte_size <= 0 || row.byte_size > materialSizeLimit(row.mime_type) || !Number.isSafeInteger(row.version) || row.version < 1 || row.visibility !== "private" || !isValidMaterialStoragePathForProductAndVersion(row.storage_path, row.product_id, row.version)) throw new Error();
  return row;
}

export async function finalizeMaterialAssetUpload(reservationId: string, idempotencyKey: string): Promise<MaterialAsset> {
  if (!isValidMaterialUuid(reservationId) || !isValidMaterialUuid(idempotencyKey)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("finalize_material_asset_upload", { p_reservation_id: reservationId.toLowerCase(), p_idempotency_key: idempotencyKey.toLowerCase() });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return validateMaterialAssetRow(data as unknown as MaterialAsset);
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function releaseMaterialAssetUpload(reservationId: string): Promise<void> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("release_material_asset_upload", { p_reservation_id: reservationId.toLowerCase() });
    if (error) throw new Error();
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function listCurrentMaterialAssetVersions(productIds: readonly string[]): Promise<Record<string, number>> {
  validateProductIds(productIds);
  if (productIds.length === 0) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("material_assets").select("product_id, version").in("product_id", [...productIds]).order("version", { ascending: false });
    if (error) throw new Error();
    return (data ?? []).reduce<Record<string, number>>((result, row) => {
      if (result[row.product_id] === undefined) result[row.product_id] = row.version;
      return result;
    }, {});
  } catch {
    throw new MaterialAssetRepositoryError();
  }
}

/** Returns the newest valid private asset for one material product after route authorization. */
export async function getCurrentMaterialAsset(productId: string): Promise<CurrentMaterialAsset | null> {
  if (!isValidMaterialUuid(productId)) throw new MaterialAssetInputError();
  const canonicalProductId = productId.toLowerCase();
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase
      .from("material_assets")
      .select("product_id, storage_path, version, visibility")
      .eq("product_id", canonicalProductId)
      .eq("visibility", "private")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error();
    if (!data) return null;
    const row = data as unknown as Pick<MaterialAssetRow, "product_id" | "storage_path" | "version" | "visibility">;
    if (!isValidMaterialUuid(row.product_id) || row.product_id.toLowerCase() !== canonicalProductId || row.visibility !== "private" || !Number.isSafeInteger(row.version) || row.version < 1 || typeof row.storage_path !== "string" || !isValidMaterialStoragePathForProductAndVersion(row.storage_path, canonicalProductId, row.version)) return null;
    return { productId: row.product_id.toLowerCase(), storagePath: row.storage_path };
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}
