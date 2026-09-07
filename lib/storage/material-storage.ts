import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const MATERIALS_BUCKET = "materials";
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const SUPPORTED_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime"
] as const;

export type SupportedMaterialMimeType = (typeof SUPPORTED_MATERIAL_MIME_TYPES)[number];

export class MaterialStorageInputError extends Error {
  constructor(message = "Invalid material storage input.") {
    super(message);
    this.name = "MaterialStorageInputError";
  }
}

export class MaterialStorageError extends Error {
  constructor(message = "Material storage operation failed.") {
    super(message);
    this.name = "MaterialStorageError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_FILENAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,199}$/;
const UNSAFE_FILENAME_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\\/:\u2215\u2044\u29f8\uff0f\uff3c]/;
const ENCODED_TRAVERSAL_PATTERN = /%(?:2f|5c|2e)/i;

export function isSupportedMaterialMimeType(value: unknown): value is SupportedMaterialMimeType {
  return typeof value === "string" && (SUPPORTED_MATERIAL_MIME_TYPES as readonly string[]).includes(value);
}

export function isValidMaterialUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function canonicalMaterialUuid(value: unknown): string {
  if (!isValidMaterialUuid(value)) throw new MaterialStorageInputError();
  return value.toLowerCase();
}

export function sanitizeMaterialFilename(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) {
    throw new MaterialStorageInputError();
  }
  if (
    UNSAFE_FILENAME_CHARACTER_PATTERN.test(value)
    || value.includes("..")
    || ENCODED_TRAVERSAL_PATTERN.test(value)
    || value.toLowerCase().includes("%2e")
  ) {
    throw new MaterialStorageInputError();
  }
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (UNSAFE_FILENAME_CHARACTER_PATTERN.test(normalized) || normalized.includes("..")) {
    throw new MaterialStorageInputError();
  }
  const sanitized = normalized.replace(/[^a-z0-9._-]+/g, "-").replace(/[-.]{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (!SAFE_FILENAME_PATTERN.test(sanitized) || sanitized.includes("..") || !sanitized.includes(".")) {
    throw new MaterialStorageInputError();
  }
  return sanitized;
}

export function materialStoragePath(productId: unknown, version: unknown, originalName: unknown, id = randomUUID()): string {
  const canonicalProductId = canonicalMaterialUuid(productId);
  const canonicalId = canonicalMaterialUuid(id);
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    throw new MaterialStorageInputError();
  }
  return `${MATERIALS_BUCKET}/${canonicalProductId}/v${version}/${canonicalId}-${sanitizeMaterialFilename(originalName)}`;
}

export interface MaterialUploadInput {
  productId: string;
  version: number;
  originalName: string;
  mimeType: SupportedMaterialMimeType;
  file: Blob;
}

export interface StoredMaterialObject {
  bucket: typeof MATERIALS_BUCKET;
  storagePath: string;
}

export async function uploadMaterialObject(input: MaterialUploadInput): Promise<StoredMaterialObject> {
  const productId = canonicalMaterialUuid(input.productId);
  if (!Number.isSafeInteger(input.version) || input.version < 1 || !isSupportedMaterialMimeType(input.mimeType) || !(input.file instanceof Blob) || input.file.size <= 0 || input.file.size > materialSizeLimit(input.mimeType)) {
    throw new MaterialStorageInputError();
  }
  const storagePath = materialStoragePath(productId, input.version, input.originalName);
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(MATERIALS_BUCKET).upload(storagePath, input.file, {
      contentType: input.mimeType,
      upsert: false
    });
    if (error) throw new Error();
    return { bucket: MATERIALS_BUCKET, storagePath };
  } catch {
    throw new MaterialStorageError();
  }
}

export async function removeNewMaterialObject(storagePath: unknown): Promise<void> {
  if (
    typeof storagePath !== "string"
    || !new RegExp(`^${MATERIALS_BUCKET}/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/v[1-9][0-9]*/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-[a-z0-9][a-z0-9._-]*$`).test(storagePath)
  ) {
    throw new MaterialStorageInputError();
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(MATERIALS_BUCKET).remove([storagePath]);
    if (error) throw new Error();
  } catch {
    throw new MaterialStorageError();
  }
}

export function materialSizeLimit(mimeType: SupportedMaterialMimeType): number {
  return mimeType === "application/pdf" ? MAX_PDF_BYTES : MAX_VIDEO_BYTES;
}
