import "server-only";

import { randomUUID } from "node:crypto";
import { createServerAdminClient } from "@/lib/supabase/server-admin";
import {
  MATERIALS_BUCKET,
  MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS,
  MATERIAL_UPLOAD_EXPIRES_IN_SECONDS,
  MAX_PDF_BYTES,
  MAX_VIDEO_BYTES,
  SUPPORTED_MATERIAL_MIME_TYPES
} from "./material-upload-constants";

export {
  MATERIALS_BUCKET,
  MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS,
  MATERIAL_UPLOAD_EXPIRES_IN_SECONDS,
  MAX_PDF_BYTES,
  MAX_VIDEO_BYTES,
  SUPPORTED_MATERIAL_MIME_TYPES
} from "./material-upload-constants";


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
export const SAFE_MATERIAL_FILENAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,199}$/;
const UNSAFE_FILENAME_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\\/\u2215\u2044\u29f8\uff0f\uff3c]/;
const ALLOWED_MATERIAL_EXTENSIONS = new Set(["pdf", "mp4", "webm", "mov"]);
const ENCODED_TRAVERSAL_PATTERN = /%(?:2f|5c|2e)/i;
const MATERIAL_STORAGE_UUID = `[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}`;
const MATERIAL_STORAGE_PATH_PATTERN = new RegExp(
  `^${MATERIALS_BUCKET}/(${MATERIAL_STORAGE_UUID})/v[1-9][0-9]*/(${MATERIAL_STORAGE_UUID})-([a-z0-9][a-z0-9._-]*)$`,
  "i"
);

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

export function canonicalizeMaterialSafeFilename(value: unknown): string {
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
  const extensionMatch = /\.([a-z0-9]+)$/i.exec(normalized);
  const extension = extensionMatch?.[1] ?? "";
  let basename = extensionMatch ? normalized.slice(0, -(extension.length + 1)) : normalized;
  if (!ALLOWED_MATERIAL_EXTENSIONS.has(extension)) throw new MaterialStorageInputError();
  basename = basename.replace(/[^a-z0-9_-]+/g, "-").replace(/[-_]{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (!extension || !basename) throw new MaterialStorageInputError();
  const maxBasenameLength = 200 - extension.length - 1;
  basename = basename.slice(0, maxBasenameLength).replace(/[-_]+$/g, "");
  const sanitized = `${basename}.${extension}`;
  if (!SAFE_MATERIAL_FILENAME_PATTERN.test(sanitized) || sanitized.includes("..")) {
    throw new MaterialStorageInputError();
  }
  return sanitized;
}

/** Backwards-compatible name for the canonical server-side filename contract. */
export const sanitizeMaterialFilename = canonicalizeMaterialSafeFilename;

export function materialStoragePath(productId: unknown, version: unknown, originalName: unknown, id = randomUUID()): string {
  const canonicalProductId = canonicalMaterialUuid(productId);
  const canonicalId = canonicalMaterialUuid(id);
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    throw new MaterialStorageInputError();
  }
  return `${MATERIALS_BUCKET}/${canonicalProductId}/v${version}/${canonicalId}-${sanitizeMaterialFilename(originalName)}`;
}

function parseMaterialStoragePath(storagePath: unknown): { productId: string; version: number; filename: string } | null {
  if (typeof storagePath !== "string") return null;
  const match = MATERIAL_STORAGE_PATH_PATTERN.exec(storagePath);
  if (!match) return null;
  const [, productId, , filename] = match;
  if (filename !== filename.toLowerCase() || filename.includes("..")) return null;
  try {
    if (sanitizeMaterialFilename(filename) !== filename) return null;
  } catch {
    return null;
  }
  const versionMatch = /^v([1-9][0-9]*)$/i.exec(storagePath.split("/")[2] ?? "");
  if (!versionMatch) return null;
  const version = Number(versionMatch[1]);
  if (!Number.isSafeInteger(version) || version < 1) return null;
  return { productId: productId.toLowerCase(), version, filename };
}

export function isValidMaterialStoragePathForProduct(storagePath: unknown, expectedProductId: unknown): boolean {
  if (!isValidMaterialUuid(expectedProductId)) return false;
  const parsed = parseMaterialStoragePath(storagePath);
  return parsed !== null && parsed.productId === expectedProductId.toLowerCase();
}

export function isValidMaterialStoragePathForProductAndVersion(storagePath: unknown, expectedProductId: unknown, expectedVersion: unknown): boolean {
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 1 || !isValidMaterialUuid(expectedProductId)) return false;
  const parsed = parseMaterialStoragePath(storagePath);
  return parsed !== null && parsed.productId === expectedProductId.toLowerCase() && parsed.version === expectedVersion;
}

export interface MaterialUploadCapability {
  bucket: typeof MATERIALS_BUCKET;
  storagePath: string;
  token: string;
  signedUrl: string;
}

export interface MaterialObjectInfo {
  storagePath: string;
  byteSize: number;
  mimeType: string;
}

export const MATERIAL_CONTENT_PREFIX_BYTES = 4096;

function hasBytesAt(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  return offset >= 0 && offset + signature.length <= bytes.length && signature.every((value, index) => bytes[offset + index] === value);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = "";
  for (let index = start; index < end; index += 1) value += String.fromCharCode(bytes[index]);
  return value;
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return hasBytesAt(bytes, 0, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

function hasWebmSignature(bytes: Uint8Array): boolean {
  return hasBytesAt(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3]);
}

function hasBmffSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (bytes.length < 16) return false;
  const boxSize = readUint32(bytes, 0);
  if (boxSize < 16 || boxSize > bytes.length || ascii(bytes, 4, 8) !== "ftyp") return false;
  const brands = [ascii(bytes, 8, 12)];
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(ascii(bytes, offset, offset + 4));
  if (mimeType === "video/quicktime") return brands.includes("qt  ");
  return ["isom", "iso2", "mp41", "mp42", "avc1", "dash", "M4V "].some((brand) => brands.includes(brand));
}

/** Validates the bounded content prefix for the formats accepted by the upload flow. */
export function validateMaterialContentPrefix(mimeType: unknown, bytes: Uint8Array): boolean {
  if (!isSupportedMaterialMimeType(mimeType) || !(bytes instanceof Uint8Array) || bytes.byteLength === 0) return false;
  if (mimeType === "application/pdf") return hasPdfSignature(bytes);
  if (mimeType === "video/webm") return hasWebmSignature(bytes);
  return hasBmffSignature(bytes, mimeType);
}

async function readBoundedPrefix(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new MaterialStorageError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (!Number.isSafeInteger(total) || total > maxBytes) {
        await reader.cancel();
        throw new MaterialStorageError();
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Creates a one-object, non-upsert upload capability for a server-generated path. */
export async function createMaterialUploadCapability(storagePath: unknown): Promise<MaterialUploadCapability> {
  if (typeof storagePath !== "string" || !MATERIAL_STORAGE_PATH_PATTERN.test(storagePath)) {
    throw new MaterialStorageInputError();
  }
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.token || data.path !== storagePath || !data.signedUrl) throw new Error();
    return { bucket: MATERIALS_BUCKET, storagePath, token: data.token, signedUrl: data.signedUrl };
  } catch (error) {
    if (error instanceof MaterialStorageInputError) throw error;
    throw new MaterialStorageError();
  }
}

/** Reads provider metadata for the exact private object without downloading its bytes. */
export async function getMaterialObjectInfo(storagePath: unknown): Promise<MaterialObjectInfo> {
  if (typeof storagePath !== "string" || !MATERIAL_STORAGE_PATH_PATTERN.test(storagePath)) {
    throw new MaterialStorageInputError();
  }
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase.storage.from(MATERIALS_BUCKET).info(storagePath);
    if (error || !data || data.size === undefined || typeof data.contentType !== "string") throw new Error();
    if (!Number.isSafeInteger(data.size) || data.size <= 0) throw new Error();
    return { storagePath, byteSize: data.size, mimeType: data.contentType };
  } catch (error) {
    if (error instanceof MaterialStorageInputError) throw error;
    throw new MaterialStorageError();
  }
}

/** Verifies provider metadata and a bounded content prefix without downloading the complete object. */
export async function inspectMaterialObject(storagePath: unknown, expectedMimeType: unknown, expectedByteSize: unknown): Promise<MaterialObjectInfo> {
  if (!MATERIAL_STORAGE_PATH_PATTERN.test(typeof storagePath === "string" ? storagePath : "") || !isSupportedMaterialMimeType(expectedMimeType) || !Number.isSafeInteger(expectedByteSize) || (expectedByteSize as number) <= 0) {
    throw new MaterialStorageInputError();
  }
  const info = await getMaterialObjectInfo(storagePath);
  if (info.mimeType !== expectedMimeType || info.byteSize !== expectedByteSize || info.byteSize > materialSizeLimit(expectedMimeType)) throw new MaterialStorageError();
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase.storage.from(MATERIALS_BUCKET).createSignedUrl(storagePath as string, 60);
    if (error || !data?.signedUrl) throw new Error();
    const response = await fetch(data.signedUrl, {
      cache: "no-store",
      headers: { Range: `bytes=0-${MATERIAL_CONTENT_PREFIX_BYTES - 1}` }
    });
    const prefix = await readBoundedPrefix(response, MATERIAL_CONTENT_PREFIX_BYTES);
    if (!validateMaterialContentPrefix(expectedMimeType, prefix)) throw new Error();
    return info;
  } catch (error) {
    if (error instanceof MaterialStorageInputError || error instanceof MaterialStorageError) throw error;
    throw new MaterialStorageError();
  }
}

export async function removeNewMaterialObject(storagePath: unknown): Promise<void> {
  if (typeof storagePath !== "string" || !MATERIAL_STORAGE_PATH_PATTERN.test(storagePath)) {
    throw new MaterialStorageInputError();
  }
  try {
    const supabase = createServerAdminClient();
    const { error } = await supabase.storage.from(MATERIALS_BUCKET).remove([storagePath]);
    if (error) throw new Error();
  } catch {
    throw new MaterialStorageError();
  }
}

/** Creates a short-lived URL for a validated private material object. */
export async function createMaterialSignedUrl(storagePath: unknown, expectedProductId: unknown): Promise<string> {
  if (typeof storagePath !== "string" || !isValidMaterialStoragePathForProduct(storagePath, expectedProductId)) {
    throw new MaterialStorageInputError();
  }
  try {
    const supabase = createServerAdminClient();
    const { data, error } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .createSignedUrl(storagePath, MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS);
    if (error || !data?.signedUrl) throw new Error();
    return data.signedUrl;
  } catch (error) {
    if (error instanceof MaterialStorageInputError) throw error;
    throw new MaterialStorageError();
  }
}

/** Proxies a private object for an authorized application viewer without returning its provider URL. */
export async function fetchMaterialObjectForViewer(storagePath: unknown, expectedProductId: unknown, rangeHeader?: string | null): Promise<Response> {
  if (typeof rangeHeader === "string" && rangeHeader !== "" && !/^bytes=\d*-\d*$/.test(rangeHeader)) {
    throw new MaterialStorageInputError();
  }
  const signedUrl = await createMaterialSignedUrl(storagePath, expectedProductId);
  try {
    const response = await fetch(signedUrl, {
      cache: "no-store",
      headers: rangeHeader ? { Range: rangeHeader } : undefined
    });
    if (response.status === 416) return response;
    if (!response.ok || !response.body) throw new Error();
    return response;
  } catch (error) {
    if (error instanceof MaterialStorageInputError) throw error;
    throw new MaterialStorageError();
  }
}

export function materialSizeLimit(mimeType: SupportedMaterialMimeType): number {
  return mimeType === "application/pdf" ? MAX_PDF_BYTES : MAX_VIDEO_BYTES;
}
