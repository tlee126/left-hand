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
  sanitizeMaterialFilename,
  uploadMaterialObject
} from "@/lib/storage/material-storage";

export const runtime = "nodejs";

const LOGIN_PATH = "/dang-nhap?next=/quan-tri/catalog";
const CATALOG_SUCCESS_PATH = "/quan-tri/catalog?upload=success";
const CATALOG_ERROR_PATH = "/quan-tri/catalog?upload=error";
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const EBML_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3];

function hasBytesAt(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  return offset >= 0 && offset + signature.length <= bytes.length && signature.every((value, index) => bytes[offset + index] === value);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
}

function readUint64(bytes: Uint8Array, offset: number): number | null {
  let value = 0;
  for (let index = 0; index < 8; index += 1) {
    value = value * 256 + bytes[offset + index];
    if (!Number.isSafeInteger(value)) return null;
  }
  return value;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = "";
  for (let index = start; index < end; index += 1) value += String.fromCharCode(bytes[index]);
  return value;
}

function hasPdfStructure(bytes: Uint8Array): boolean {
  if (!hasBytesAt(bytes, 0, PDF_SIGNATURE) || bytes.length < 32) return false;
  const text = new TextDecoder().decode(bytes);
  const eof = text.lastIndexOf("%%EOF");
  if (eof < 0 || bytes.length - (eof + 5) > 1024 || /[^\x00\x09\x0a\x0c\x0d\x20]/.test(text.slice(eof + 5))) return false;
  const body = text.slice(PDF_SIGNATURE.length, eof);
  return body.replace(/[\x00\x09\x0a\x0c\x0d\x20]/g, "").length >= 12
    && /(?:\d+\s+\d+\s+obj\b|\bxref\b|\bstream\b)/.test(body);
}

interface BmffBox { type: string; start: number; end: number; size: number; payloadStart: number; }

function readBmffBox(bytes: Uint8Array, offset: number): BmffBox | null {
  if (offset + 8 > bytes.length) return null;
  const declared = readUint32(bytes, offset);
  const type = ascii(bytes, offset + 4, offset + 8);
  let headerSize = 8;
  let size = declared;
  if (declared === 1) {
    if (offset + 16 > bytes.length) return null;
    const extended = readUint64(bytes, offset + 8);
    if (extended === null) return null;
    size = extended;
    headerSize = 16;
  }
  if (declared === 0) size = bytes.length - offset;
  if (size < headerSize || size > bytes.length - offset) return null;
  return { type, start: offset, end: offset + size, size, payloadStart: offset + headerSize };
}

function bmffChildren(bytes: Uint8Array, parent: BmffBox): BmffBox[] | null {
  const children: BmffBox[] = [];
  for (let offset = parent.payloadStart; offset < parent.end;) {
    const child = readBmffBox(bytes, offset);
    if (!child || child.end > parent.end) return null;
    children.push(child);
    offset = child.end;
  }
  return children;
}

function bmffChild(bytes: Uint8Array, parent: BmffBox, type: string): BmffBox | null {
  return bmffChildren(bytes, parent)?.find((box) => box.type === type) || null;
}

function hasNonEmptyTrack(bytes: Uint8Array, trak: BmffBox, mediaRanges: Array<{ start: number; end: number }>): boolean {
  const tkhd = bmffChild(bytes, trak, "tkhd");
  const mdia = bmffChild(bytes, trak, "mdia");
  if (!tkhd || tkhd.size < 24 || !mdia) return false;
  const mdhd = bmffChild(bytes, mdia, "mdhd");
  const hdlr = bmffChild(bytes, mdia, "hdlr");
  const minf = bmffChild(bytes, mdia, "minf");
  if (!mdhd || mdhd.size < 28 || !hdlr || hdlr.size < 20 || !minf) return false;
  const timescale = readUint32(bytes, mdhd.payloadStart + 12);
  const duration = readUint32(bytes, mdhd.payloadStart + 16);
  const handler = ascii(bytes, hdlr.payloadStart + 8, hdlr.payloadStart + 12);
  if (timescale === 0 || duration === 0 || !["vide", "soun", "text", "subt"].includes(handler)) return false;
  const stbl = bmffChild(bytes, minf, "stbl");
  if (!stbl) return false;
  const stsd = bmffChild(bytes, stbl, "stsd");
  const stts = bmffChild(bytes, stbl, "stts");
  const stsc = bmffChild(bytes, stbl, "stsc");
  const stsz = bmffChild(bytes, stbl, "stsz");
  const offsets = bmffChild(bytes, stbl, "stco") || bmffChild(bytes, stbl, "co64");
  if (!stsd || stsd.size < 24 || !stts || stts.size < 24 || !stsc || stsc.size < 28 || !stsz || stsz.size < 20 || !offsets || offsets.size < 20) return false;
  if (readUint32(bytes, stsd.payloadStart + 4) === 0 || readUint32(bytes, stts.payloadStart + 4) === 0 || readUint32(bytes, stts.payloadStart + 8) === 0 || readUint32(bytes, stsc.payloadStart + 4) === 0 || readUint32(bytes, stsz.payloadStart + 8) === 0 || readUint32(bytes, offsets.payloadStart + 4) === 0) return false;
  const firstOffset = offsets.type === "stco" ? readUint32(bytes, offsets.payloadStart + 8) : readUint64(bytes, offsets.payloadStart + 8);
  return firstOffset !== null && mediaRanges.some((range) => firstOffset >= range.start && firstOffset < range.end);
}

function hasBmffStructure(bytes: Uint8Array, mimeType: string): boolean {
  const ftyp = readBmffBox(bytes, 0);
  if (!ftyp || ftyp.type !== "ftyp" || ftyp.size < 20 || (ftyp.size - 16) % 4 !== 0) return false;
  const majorBrand = ascii(bytes, ftyp.payloadStart, ftyp.payloadStart + 4);
  const compatibleBrands = [majorBrand];
  for (let offset = ftyp.payloadStart + 8; offset < ftyp.end; offset += 4) compatibleBrands.push(ascii(bytes, offset, offset + 4));
  const mp4Brands = new Set(["isom", "iso2", "mp41", "mp42", "avc1", "dash", "M4V "]);
  if (mimeType === "video/quicktime" ? !compatibleBrands.includes("qt  ") : !compatibleBrands.some((brand) => mp4Brands.has(brand))) return false;
  let offset = ftyp.end;
  let moov: BmffBox | null = null;
  const mediaRanges: Array<{ start: number; end: number }> = [];
  while (offset < bytes.length) {
    const box = readBmffBox(bytes, offset);
    if (!box) return false;
    if (box.type === "moov") { if (moov) return false; moov = box; }
    if (box.type === "mdat" && box.size > box.payloadStart - box.start) mediaRanges.push({ start: box.payloadStart, end: box.end });
    offset = box.end;
  }
  if (offset !== bytes.length || !moov || mediaRanges.length === 0) return false;
  const mvhd = bmffChild(bytes, moov, "mvhd");
  const tracks = bmffChildren(bytes, moov)?.filter((box) => box.type === "trak") || [];
  if (!mvhd || mvhd.size < 28 || readUint32(bytes, mvhd.payloadStart + 12) === 0 || readUint32(bytes, mvhd.payloadStart + 16) === 0 || tracks.length === 0) return false;
  return tracks.some((track) => hasNonEmptyTrack(bytes, track, mediaRanges));
}

function readEbmlVint(bytes: Uint8Array, offset: number, preserveMarker = false): { length: number; value: number } | null {
  if (offset >= bytes.length) return null;
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && (bytes[offset] & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > bytes.length) return null;
  let value = preserveMarker ? bytes[offset] : bytes[offset] & (mask - 1);
  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index];
  if (!Number.isSafeInteger(value) || value === 2 ** (7 * length) - 1) return null;
  return { length, value };
}

function hasWebmStructure(bytes: Uint8Array): boolean {
  if (!hasBytesAt(bytes, 0, EBML_SIGNATURE)) return false;
  const headerSize = readEbmlVint(bytes, 4);
  if (!headerSize) return false;
  const headerEnd = 4 + headerSize.length + headerSize.value;
  if (headerEnd > bytes.length) return false;
  let offset = 4 + headerSize.length;
  let hasWebmDocType = false;
  while (offset < headerEnd) {
    const id = readEbmlVint(bytes, offset, true);
    if (!id) return false;
    offset += id.length;
    const size = readEbmlVint(bytes, offset);
    if (!size || offset + size.length + size.value > headerEnd) return false;
    if (id.value === 0x4282 && ascii(bytes, offset + size.length, offset + size.length + size.value) === "webm") hasWebmDocType = true;
    offset += size.length + size.value;
  }
  if (offset !== headerEnd || !hasWebmDocType || !hasBytesAt(bytes, headerEnd, [0x18, 0x53, 0x80, 0x67])) return false;
  const segmentSize = readEbmlVint(bytes, headerEnd + 4);
  if (!segmentSize) return false;
  const segmentStart = headerEnd + 4 + segmentSize.length;
  const segmentEnd = segmentStart + segmentSize.value;
  if (segmentEnd !== bytes.length || segmentSize.value === 0) return false;
  offset = segmentStart;
  let hasInfo = false;
  let hasTracks = false;
  let hasCluster = false;
  while (offset < segmentEnd) {
    const id = readEbmlVint(bytes, offset, true);
    if (!id) return false;
    offset += id.length;
    const size = readEbmlVint(bytes, offset);
    if (!size || offset + size.length + size.value > segmentEnd) return false;
    const payloadStart = offset + size.length;
    const payloadEnd = payloadStart + size.value;
    if (id.value === 0x1549a966) {
      let child = payloadStart;
      let validInfo = false;
      while (child < payloadEnd) {
        const childId = readEbmlVint(bytes, child, true); if (!childId) return false; child += childId.length;
        const childSize = readEbmlVint(bytes, child); if (!childSize || child + childSize.length + childSize.value > payloadEnd) return false;
        if (childId.value === 0x2ad7b1 && childSize.value > 0) validInfo = true;
        child += childSize.length + childSize.value;
      }
      hasInfo = child === payloadEnd && validInfo;
    } else if (id.value === 0x1654ae6b) {
      let child = payloadStart;
      let validTrack = false;
      while (child < payloadEnd) {
        const childId = readEbmlVint(bytes, child, true); if (!childId) return false; child += childId.length;
        const childSize = readEbmlVint(bytes, child); if (!childSize || child + childSize.length + childSize.value > payloadEnd) return false;
        if (childId.value === 0xae && childSize.value >= 8) {
          const entry = bytes.slice(child + childSize.length, child + childSize.length + childSize.value);
          validTrack ||= entry.includes(0xd7) && entry.includes(0x83) && entry.includes(0x86);
        }
        child += childSize.length + childSize.value;
      }
      hasTracks = child === payloadEnd && validTrack;
    } else if (id.value === 0x1f43b675) {
      let child = payloadStart;
      let validCluster = false;
      while (child < payloadEnd) {
        const childId = readEbmlVint(bytes, child, true); if (!childId) return false; child += childId.length;
        const childSize = readEbmlVint(bytes, child); if (!childSize || child + childSize.length + childSize.value > payloadEnd) return false;
        if (childId.value === 0xa3 && childSize.value >= 5) validCluster = true;
        child += childSize.length + childSize.value;
      }
      hasCluster = child === payloadEnd && validCluster;
    }
    offset += size.length + size.value;
  }
  return offset === segmentEnd && hasInfo && hasTracks && hasCluster;
}

function matchesFileSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "application/pdf") return hasPdfStructure(bytes);
  if (mimeType === "video/webm") return hasWebmStructure(bytes);
  return hasBmffStructure(bytes, mimeType);
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
    const { id: productIdInput } = await context.params;
    if (!isValidMaterialUuid(productIdInput)) redirect(CATALOG_ERROR_PATH);
    const productId = productIdInput.toLowerCase();
    if (!(await isMaterialProduct(productId))) redirect(CATALOG_ERROR_PATH);

    const formData = await request.formData();
    const keys = [...formData.keys()];
    const files = formData.getAll("file");
    if (keys.length !== 1 || keys[0] !== "file" || files.length !== 1 || !(files[0] instanceof File)) redirect(CATALOG_ERROR_PATH);
    const file = files[0];
    if (file.size <= 0 || !isSupportedMaterialMimeType(file.type) || file.size > materialSizeLimit(file.type)) redirect(CATALOG_ERROR_PATH);
    sanitizeMaterialFilename(file.name);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesFileSignature(file.type, bytes)) redirect(CATALOG_ERROR_PATH);

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
