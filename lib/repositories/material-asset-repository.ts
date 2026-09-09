import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/server-admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  isSupportedMaterialMimeType,
  isValidMaterialStoragePathForProductAndVersion,
  isValidMaterialUuid,
  materialSizeLimit,
  sanitizeMaterialFilename
} from "@/lib/storage/material-storage";

type MaterialAssetRow = Database["public"]["Tables"]["material_assets"]["Row"];

export const MATERIAL_ASSET_COLUMNS = [
  "id", "product_id", "uploaded_by", "upload_reservation_id", "storage_path", "original_name", "mime_type", "byte_size", "version", "visibility", "created_at", "updated_at"
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

export interface MaterialAssetUploadReservation {
  reservationId: string;
  version: number;
  storagePath: string;
}

export interface ReserveMaterialAssetUploadInput {
  productId: string;
  originalName: string;
  safeFilename: string;
  mimeType: string;
  byteSize: number;
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

export async function isMaterialProduct(productId: string): Promise<boolean> {
  if (!isValidMaterialUuid(productId)) throw new MaterialAssetInputError();
  const canonicalProductId = productId.toLowerCase();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("materials").select("product_id").eq("product_id", canonicalProductId).maybeSingle();
    if (error) throw new Error();
    return data !== null;
  } catch {
    throw new MaterialAssetRepositoryError();
  }
}

export async function reserveMaterialAssetUpload(input: ReserveMaterialAssetUploadInput): Promise<MaterialAssetUploadReservation> {
  if (!isValidMaterialUuid(input.productId) || !isSupportedMaterialMimeType(input.mimeType) || !Number.isSafeInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > materialSizeLimit(input.mimeType)) throw new MaterialAssetInputError();
  if (sanitizeMaterialFilename(input.originalName) !== input.safeFilename) throw new MaterialAssetInputError();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reserve_material_asset_upload", {
      p_product_id: input.productId.toLowerCase(),
      p_original_name: input.originalName,
      p_safe_filename: input.safeFilename,
      p_mime_type: input.mimeType,
      p_byte_size: input.byteSize
    });
    if (error) throw new Error();
    const row = asObject(data as Json | null);
    const reservationId = asString(row.reservation_id);
    const version = asPositiveInteger(row.version);
    const storagePath = asString(row.storage_path);
    if (!isValidMaterialUuid(reservationId) || !isValidMaterialStoragePathForProductAndVersion(storagePath, input.productId, version)) throw new Error();
    return { reservationId, version, storagePath };
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
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
  if (!isValidMaterialUuid(reservationId) || !isValidMaterialUuid(productId) || !isValidMaterialUuid(uploadedBy) || !isSupportedMaterialMimeType(mimeType) || byteSize > materialSizeLimit(mimeType) || !isValidMaterialStoragePathForProductAndVersion(storagePath, productId, version) || !Number.isFinite(Date.parse(expiresAt))) throw new Error();
  return { reservationId, productId: productId.toLowerCase(), uploadedBy: uploadedBy.toLowerCase(), storagePath, originalName, mimeType, byteSize, version, expiresAt };
}

export async function getMaterialAssetUploadReservation(reservationId: string): Promise<MaterialAssetUploadReservationDetails | null> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("material_asset_upload_reservations")
      .select("id, product_id, uploaded_by, storage_path, original_name, mime_type, byte_size, version, expires_at")
      .eq("id", reservationId.toLowerCase())
      .maybeSingle();
    if (error) throw new Error();
    return data ? validateReservationRow(data as unknown as Record<string, Json | undefined>) : null;
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

export async function getMaterialAssetByUploadReservation(reservationId: string): Promise<MaterialAsset | null> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("material_assets")
      .select(MATERIAL_ASSET_SELECT)
      .eq("upload_reservation_id", reservationId.toLowerCase())
      .maybeSingle();
    if (error) throw new Error();
    if (!data) return null;
    return validateMaterialAssetRow(data as unknown as MaterialAsset);
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}

function validateMaterialAssetRow(row: MaterialAsset): MaterialAsset {
  if (!isValidMaterialUuid(row.id) || !isValidMaterialUuid(row.product_id) || (row.uploaded_by !== null && !isValidMaterialUuid(row.uploaded_by)) || typeof row.storage_path !== "string" || !isSupportedMaterialMimeType(row.mime_type) || !Number.isSafeInteger(row.byte_size) || row.byte_size <= 0 || row.byte_size > materialSizeLimit(row.mime_type) || !Number.isSafeInteger(row.version) || row.version < 1 || row.visibility !== "private" || !isValidMaterialStoragePathForProductAndVersion(row.storage_path, row.product_id, row.version)) throw new Error();
  return row;
}

export async function finalizeMaterialAssetUpload(reservationId: string): Promise<MaterialAsset> {
  if (!isValidMaterialUuid(reservationId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("finalize_material_asset_upload", { p_reservation_id: reservationId.toLowerCase() });
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
