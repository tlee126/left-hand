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

export interface CreateMaterialAssetInput {
  productId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  version: number;
}

export interface CurrentMaterialAsset {
  productId: string;
  storagePath: string;
}

function validateCreateInput(input: CreateMaterialAssetInput): void {
  if (!isValidMaterialUuid(input.productId)) throw new MaterialAssetInputError();
  const productId = input.productId.toLowerCase();
  const pathSegments = typeof input.storagePath === "string" ? input.storagePath.split("/") : [];
  const pathPart = pathSegments[3];
  const generatedId = pathPart?.slice(0, 36);
  const expectedPathPattern = new RegExp(`^materials/${productId}/v[1-9][0-9]*/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-[a-z0-9][a-z0-9._-]*$`);
  if (typeof input.storagePath !== "string" || pathSegments.length !== 4 || !expectedPathPattern.test(input.storagePath) || input.storagePath.includes("..") || !generatedId || !isValidMaterialUuid(generatedId) || sanitizeMaterialFilename(input.originalName) !== pathPart?.slice(37) || !isSupportedMaterialMimeType(input.mimeType) || !Number.isSafeInteger(input.byteSize) || input.byteSize <= 0 || !Number.isSafeInteger(input.version) || input.version < 1 || !input.storagePath.startsWith(`materials/${productId}/v${input.version}/`)) {
    throw new MaterialAssetInputError();
  }
}

function validateProductIds(productIds: readonly string[]): void {
  if (!Array.isArray(productIds) || productIds.some((productId) => !isValidMaterialUuid(productId))) throw new MaterialAssetInputError();
}

export async function getNextMaterialAssetVersion(productId: string): Promise<number> {
  if (!isValidMaterialUuid(productId)) throw new MaterialAssetInputError();
  const canonicalProductId = productId.toLowerCase();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("material_assets").select("version").eq("product_id", canonicalProductId).order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error();
    return (data?.version ?? 0) + 1;
  } catch {
    throw new MaterialAssetRepositoryError();
  }
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

export async function createMaterialAsset(input: CreateMaterialAssetInput): Promise<MaterialAsset> {
  validateCreateInput(input);
  const productId = input.productId.toLowerCase();
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user || !isValidMaterialUuid(authData.user.id)) throw new Error();
    const payload: MaterialAssetInsert = {
      product_id: productId,
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

/** Returns the newest valid private asset for one material product. */
export async function getCurrentMaterialAsset(productId: string): Promise<CurrentMaterialAsset | null> {
  if (!isValidMaterialUuid(productId)) throw new MaterialAssetInputError();
  const canonicalProductId = productId.toLowerCase();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("material_assets")
      .select(CURRENT_MATERIAL_ASSET_SELECT)
      .eq("product_id", canonicalProductId)
      .eq("visibility", "private")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error();
    if (!data) return null;
    const row = data as unknown as Pick<MaterialAssetRow, "product_id" | "storage_path" | "version" | "visibility">;
    if (!isValidMaterialUuid(row.product_id) || row.product_id.toLowerCase() !== canonicalProductId || row.visibility !== "private" || !Number.isSafeInteger(row.version) || row.version < 1 || typeof row.storage_path !== "string") return null;
    return { productId: row.product_id.toLowerCase(), storagePath: row.storage_path };
  } catch (error) {
    if (error instanceof MaterialAssetInputError) throw error;
    throw new MaterialAssetRepositoryError();
  }
}
