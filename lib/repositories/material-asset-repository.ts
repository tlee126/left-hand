import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { isSupportedMaterialMimeType, isValidMaterialUuid, sanitizeMaterialFilename } from "@/lib/storage/material-storage";

type MaterialAssetRow = Database["public"]["Tables"]["material_assets"]["Row"];
type MaterialAssetInsert = Database["public"]["Tables"]["material_assets"]["Insert"];

export const MATERIAL_ASSET_COLUMNS = [
  "id", "product_id", "uploaded_by", "storage_path", "original_name", "mime_type", "byte_size", "version", "visibility", "created_at", "updated_at"
] as const;
export const MATERIAL_ASSET_SELECT = MATERIAL_ASSET_COLUMNS.join(", ");

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

export interface CreateMaterialAssetInput {
  productId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  version: number;
}

function validateCreateInput(input: CreateMaterialAssetInput): void {
  if (!isValidMaterialUuid(input.productId) || typeof input.storagePath !== "string" || !input.storagePath.startsWith(`materials/${input.productId}/v${input.version}/`) || input.storagePath.includes("..") || !isValidMaterialUuid(input.storagePath.split("/")[3]?.slice(0, 36)) || sanitizeMaterialFilename(input.originalName) !== input.storagePath.split("/")[3]?.slice(37) || !isSupportedMaterialMimeType(input.mimeType) || !Number.isSafeInteger(input.byteSize) || input.byteSize <= 0 || !Number.isSafeInteger(input.version) || input.version < 1) {
    throw new MaterialAssetInputError();
  }
}

function validateProductIds(productIds: readonly string[]): void {
  if (!Array.isArray(productIds) || productIds.some((productId) => !isValidMaterialUuid(productId))) throw new MaterialAssetInputError();
}

export async function getNextMaterialAssetVersion(productId: string): Promise<number> {
  if (!isValidMaterialUuid(productId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("material_assets").select("version").eq("product_id", productId).order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error();
    return (data?.version ?? 0) + 1;
  } catch {
    throw new MaterialAssetRepositoryError();
  }
}

export async function isMaterialProduct(productId: string): Promise<boolean> {
  if (!isValidMaterialUuid(productId)) throw new MaterialAssetInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("materials").select("product_id").eq("product_id", productId).maybeSingle();
    if (error) throw new Error();
    return data !== null;
  } catch {
    throw new MaterialAssetRepositoryError();
  }
}

export async function createMaterialAsset(input: CreateMaterialAssetInput): Promise<MaterialAsset> {
  validateCreateInput(input);
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user || !isValidMaterialUuid(authData.user.id)) throw new Error();
    const payload: MaterialAssetInsert = {
      product_id: input.productId,
      uploaded_by: authData.user.id,
      storage_path: input.storagePath,
      original_name: input.originalName,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      version: input.version,
      visibility: "private"
    };
    const { data, error } = await supabase.from("material_assets").insert(payload).select(MATERIAL_ASSET_SELECT).single();
    if (error || !data) throw new Error();
    return data as unknown as MaterialAsset;
  } catch {
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
