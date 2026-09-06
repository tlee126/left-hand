import "server-only";

import { redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import {
  createMaterialAsset,
  getNextMaterialAssetVersion,
  isMaterialProduct
} from "@/lib/repositories/material-asset-repository";
import {
  isSupportedMaterialMimeType,
  isValidMaterialUuid,
  materialSizeLimit,
  removeNewMaterialObject,
  uploadMaterialObject
} from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const LOGIN_PATH = "/dang-nhap?next=/quan-tri/catalog";
const CATALOG_SUCCESS_PATH = "/quan-tri/catalog?upload=success";
const CATALOG_ERROR_PATH = "/quan-tri/catalog?upload=error";
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const EBML_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3];

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function hasFtyp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

function hasQuickTimeBrand(bytes: Uint8Array): boolean {
  return hasFtyp(bytes) && bytes[8] === 0x71 && bytes[9] === 0x74 && bytes[10] === 0x20 && bytes[11] === 0x20;
}

function matchesFileSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "application/pdf") return startsWith(bytes, PDF_SIGNATURE);
  if (mimeType === "video/webm") return startsWith(bytes, EBML_SIGNATURE);
  if (mimeType === "video/quicktime") return hasQuickTimeBrand(bytes);
  return hasFtyp(bytes);
}

function isRedirectControlFlow(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && typeof (error as { digest?: unknown }).digest === "string" && (error as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const access = await getAccountAccess();
  if (access.status === "unauthenticated") redirect(LOGIN_PATH);
  if (access.status !== "approved" || access.profile?.role !== "admin") redirect(CATALOG_ERROR_PATH);

  let uploadedPath: string | null = null;
  try {
    const { id: productId } = await context.params;
    if (!isValidMaterialUuid(productId)) redirect(CATALOG_ERROR_PATH);

    const formData = await request.formData();
    const keys = [...formData.keys()];
    const files = formData.getAll("file");
    if (keys.length !== 1 || keys[0] !== "file" || files.length !== 1 || !(files[0] instanceof File)) redirect(CATALOG_ERROR_PATH);
    const file = files[0];
    if (file.size <= 0 || !isSupportedMaterialMimeType(file.type) || file.size > materialSizeLimit(file.type)) redirect(CATALOG_ERROR_PATH);

    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!matchesFileSignature(file.type, bytes)) redirect(CATALOG_ERROR_PATH);

    if (!(await isMaterialProduct(productId))) redirect(CATALOG_ERROR_PATH);
    const version = await getNextMaterialAssetVersion(productId);
    const stored = await uploadMaterialObject({
      productId,
      version,
      originalName: file.name,
      mimeType: file.type,
      file
    });
    uploadedPath = stored.storagePath;
    await createMaterialAsset({
      productId,
      storagePath: stored.storagePath,
      originalName: file.name,
      mimeType: file.type,
      byteSize: file.size,
      version
    });
  } catch (error) {
    if (isRedirectControlFlow(error)) throw error;
    if (uploadedPath) {
      try {
        await removeNewMaterialObject(uploadedPath);
      } catch {
        // The route intentionally does not disclose cleanup or storage details.
      }
    }
    redirect(CATALOG_ERROR_PATH);
  }
  redirect(CATALOG_SUCCESS_PATH);
}
