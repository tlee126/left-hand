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
interface BmffSample { offset: number; size: number; }

function readBmffBox(bytes: Uint8Array, offset: number): BmffBox | null {
  if (offset < 0 || offset > bytes.length - 8) return null;
  const declared = readUint32(bytes, offset);
  const type = ascii(bytes, offset + 4, offset + 8);
  let headerSize = 8;
  let size = declared;
  if (declared === 1) {
    if (offset > bytes.length - 16) return null;
    const extended = readUint64(bytes, offset + 8);
    if (extended === null) return null;
    size = extended;
    headerSize = 16;
  }
  // A zero-sized child would have no independently checkable boundary. Reject it
  // everywhere so a truncated nested box cannot be interpreted as complete.
  if (size < headerSize || !Number.isSafeInteger(size) || size > bytes.length - offset) return null;
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

function hasFullBoxPayload(bytes: Uint8Array, box: BmffBox, length: number): boolean {
  return box.size >= 8 + length && box.payloadStart + length <= box.end;
}

function readBmffVersion(bytes: Uint8Array, box: BmffBox): number | null {
  return hasFullBoxPayload(bytes, box, 4) ? bytes[box.payloadStart] : null;
}

function parseAvcConfiguration(bytes: Uint8Array, sampleEntry: BmffBox): number | null {
  if (sampleEntry.type !== "avc1" && sampleEntry.type !== "avc3") return null;
  // VisualSampleEntry is 78 bytes after the box header. The fields checked here
  // ensure this is an actual visual entry, not merely a box named avc1.
  if (sampleEntry.size < 86 || bytes[sampleEntry.start + 14] !== 0 || bytes[sampleEntry.start + 15] !== 1) return null;
  const width = bytes[sampleEntry.start + 32] * 0x100 + bytes[sampleEntry.start + 33];
  const height = bytes[sampleEntry.start + 34] * 0x100 + bytes[sampleEntry.start + 35];
  if (width === 0 || height === 0) return null;
  const children = bmffChildren(bytes, { ...sampleEntry, payloadStart: sampleEntry.start + 86 });
  if (!children) return null;
  const avcC = children.filter((box) => box.type === "avcC");
  if (avcC.length !== 1) return null;
  const config = avcC[0];
  if (config.size < 15 || config.payloadStart + 7 > config.end || bytes[config.payloadStart] !== 1) return null;
  const lengthSize = (bytes[config.payloadStart + 4] & 3) + 1;
  if (lengthSize !== 4) return null;
  const spsCount = bytes[config.payloadStart + 5] & 0x1f;
  if (spsCount === 0) return null;
  let offset = config.payloadStart + 6;
  let hasSps = false;
  for (let index = 0; index < spsCount; index += 1) {
    if (offset + 2 > config.end) return null;
    const size = bytes[offset] * 0x100 + bytes[offset + 1];
    offset += 2;
    if (size < 4 || offset + size > config.end || (bytes[offset] & 0x1f) !== 7) return null;
    hasSps = true;
    offset += size;
  }
  if (offset >= config.end) return null;
  const ppsCount = bytes[offset];
  offset += 1;
  if (ppsCount === 0) return null;
  let hasPps = false;
  for (let index = 0; index < ppsCount; index += 1) {
    if (offset + 2 > config.end) return null;
    const size = bytes[offset] * 0x100 + bytes[offset + 1];
    offset += 2;
    if (size < 2 || offset + size > config.end || (bytes[offset] & 0x1f) !== 8) return null;
    hasPps = true;
    offset += size;
  }
  return hasSps && hasPps && offset === config.end ? lengthSize : null;
}

function parseAvcSample(bytes: Uint8Array, sample: BmffSample, lengthSize: number): boolean {
  if (sample.size <= lengthSize || sample.offset < 0 || sample.offset + sample.size > bytes.length) return false;
  const end = sample.offset + sample.size;
  let offset = sample.offset;
  let hasVcl = false;
  while (offset < end) {
    if (offset + lengthSize > end) return false;
    let nalSize = 0;
    for (let index = 0; index < lengthSize; index += 1) nalSize = nalSize * 0x100 + bytes[offset + index];
    offset += lengthSize;
    if (nalSize < 4 || offset + nalSize > end) return false;
    const nalType = bytes[offset] & 0x1f;
    if (nalType < 1 || nalType > 23) return false;
    if (nalType === 1 || nalType === 5) hasVcl = true;
    offset += nalSize;
  }
  return offset === end && hasVcl;
}

function parseBmffSamples(bytes: Uint8Array, stbl: BmffBox, mediaRanges: Array<{ start: number; end: number }>, avcLengthSize: number): boolean {
  const stsd = bmffChild(bytes, stbl, "stsd");
  const stts = bmffChild(bytes, stbl, "stts");
  const stsc = bmffChild(bytes, stbl, "stsc");
  const stsz = bmffChild(bytes, stbl, "stsz");
  const stz2 = bmffChild(bytes, stbl, "stz2");
  const stco = bmffChild(bytes, stbl, "stco");
  const co64 = bmffChild(bytes, stbl, "co64");
  if (!stsd || !stts || !stsc || (!stsz && !stz2) || (stsz && stz2) || (stco ? co64 : !co64) || stsd.size < 16) return false;
  if (stsz && stz2) return false;
  const stsdEntries = bmffChildren(bytes, { ...stsd, payloadStart: stsd.payloadStart + 8 });
  if (!hasFullBoxPayload(bytes, stsd, 8) || !stsdEntries || readUint32(bytes, stsd.payloadStart + 4) !== 1 || stsdEntries.length !== 1) return false;
  const sampleEntry = stsdEntries[0];
  if (sampleEntry.type !== "avc1" && sampleEntry.type !== "avc3") return false;
  if (parseAvcConfiguration(bytes, sampleEntry) !== avcLengthSize) return false;

  if (!hasFullBoxPayload(bytes, stts, 8)) return false;
  const timeEntryCount = readUint32(bytes, stts.payloadStart + 4);
  if (timeEntryCount === 0 || stts.payloadStart + 8 + timeEntryCount * 8 !== stts.end) return false;
  let timeSampleCount = 0;
  for (let index = 0; index < timeEntryCount; index += 1) {
    const entry = stts.payloadStart + 8 + index * 8;
    const count = readUint32(bytes, entry);
    const delta = readUint32(bytes, entry + 4);
    if (count === 0 || delta === 0 || !Number.isSafeInteger(timeSampleCount + count)) return false;
    timeSampleCount += count;
  }

  if (!hasFullBoxPayload(bytes, stsc, 8)) return false;
  const chunkEntryCount = readUint32(bytes, stsc.payloadStart + 4);
  if (chunkEntryCount === 0 || stsc.payloadStart + 8 + chunkEntryCount * 12 !== stsc.end) return false;
  const chunkEntries: Array<{ firstChunk: number; samplesPerChunk: number }> = [];
  for (let index = 0; index < chunkEntryCount; index += 1) {
    const entry = stsc.payloadStart + 8 + index * 12;
    const firstChunk = readUint32(bytes, entry);
    const samplesPerChunk = readUint32(bytes, entry + 4);
    const descriptionIndex = readUint32(bytes, entry + 8);
    if (firstChunk === 0 || samplesPerChunk === 0 || descriptionIndex !== 1 || (index > 0 && firstChunk <= chunkEntries[index - 1].firstChunk)) return false;
    chunkEntries.push({ firstChunk, samplesPerChunk });
  }

  const sizes: number[] = [];
  if (stsz) {
    if (!hasFullBoxPayload(bytes, stsz, 12)) return false;
    const uniformSize = readUint32(bytes, stsz.payloadStart + 4);
    const sampleCount = readUint32(bytes, stsz.payloadStart + 8);
    if (sampleCount === 0 || (uniformSize === 0 && stsz.payloadStart + 12 + sampleCount * 4 !== stsz.end) || (uniformSize !== 0 && stsz.payloadStart + 12 !== stsz.end)) return false;
    for (let index = 0; index < sampleCount; index += 1) sizes.push(uniformSize || readUint32(bytes, stsz.payloadStart + 12 + index * 4));
  } else if (stz2) {
    if (!hasFullBoxPayload(bytes, stz2, 12)) return false;
    const fieldSize = bytes[stz2.payloadStart + 7];
    const sampleCount = readUint32(bytes, stz2.payloadStart + 8);
    if (sampleCount === 0 || ![4, 8, 16].includes(fieldSize)) return false;
    const dataBytes = fieldSize === 4 ? Math.ceil(sampleCount / 2) : fieldSize === 8 ? sampleCount : sampleCount * 2;
    if (stz2.payloadStart + 12 + dataBytes !== stz2.end) return false;
    for (let index = 0; index < sampleCount; index += 1) {
      const position = stz2.payloadStart + 12 + (fieldSize === 4 ? Math.floor(index / 2) : index * (fieldSize / 8));
      const size = fieldSize === 4 ? (index % 2 === 0 ? bytes[position] >> 4 : bytes[position] & 0x0f) : fieldSize === 8 ? bytes[position] : bytes[position] * 0x100 + bytes[position + 1];
      sizes.push(size);
    }
  }
  if (sizes.length === 0 || sizes.some((size) => size === 0) || sizes.length !== timeSampleCount) return false;

  const offsetsBox = stco || co64;
  if (!offsetsBox || !hasFullBoxPayload(bytes, offsetsBox, 8)) return false;
  const offsetCount = readUint32(bytes, offsetsBox.payloadStart + 4);
  const offsetWidth = offsetsBox.type === "stco" ? 4 : 8;
  if (offsetCount === 0 || offsetsBox.payloadStart + 8 + offsetCount * offsetWidth !== offsetsBox.end || chunkEntries.some((entry) => entry.firstChunk > offsetCount)) return false;
  const chunkOffsets: number[] = [];
  for (let index = 0; index < offsetCount; index += 1) {
    const value = offsetsBox.type === "stco" ? readUint32(bytes, offsetsBox.payloadStart + 8 + index * 4) : readUint64(bytes, offsetsBox.payloadStart + 8 + index * 8);
    if (value === null) return false;
    chunkOffsets.push(value);
  }
  const samples: BmffSample[] = [];
  let sampleIndex = 0;
  for (let chunkIndex = 1; chunkIndex <= offsetCount; chunkIndex += 1) {
    let entryIndex = 0;
    for (let index = 1; index < chunkEntries.length && chunkEntries[index].firstChunk <= chunkIndex; index += 1) entryIndex = index;
    if (chunkEntries[entryIndex].firstChunk > chunkIndex) return false;
    let offset = chunkOffsets[chunkIndex - 1];
    for (let item = 0; item < chunkEntries[entryIndex].samplesPerChunk; item += 1) {
      if (sampleIndex >= sizes.length || !Number.isSafeInteger(offset + sizes[sampleIndex])) return false;
      const sampleSize = sizes[sampleIndex];
      const sampleEnd = offset + sampleSize;
      if (!mediaRanges.some((range) => offset >= range.start && sampleEnd <= range.end)) return false;
      samples.push({ offset, size: sampleSize });
      offset = sampleEnd;
      sampleIndex += 1;
    }
  }
  return sampleIndex === sizes.length && samples.every((sample) => parseAvcSample(bytes, sample, avcLengthSize));
}

function hasValidBmffTrack(bytes: Uint8Array, trak: BmffBox, mediaRanges: Array<{ start: number; end: number }>): boolean {
  const tkhd = bmffChild(bytes, trak, "tkhd");
  const mdia = bmffChild(bytes, trak, "mdia");
  if (!tkhd || !hasFullBoxPayload(bytes, tkhd, 20) || readUint32(bytes, tkhd.payloadStart + 12) === 0 || !mdia) return false;
  const mdhd = bmffChild(bytes, mdia, "mdhd");
  const hdlr = bmffChild(bytes, mdia, "hdlr");
  const minf = bmffChild(bytes, mdia, "minf");
  if (!mdhd || !hasFullBoxPayload(bytes, mdhd, 24) || !hdlr || !hasFullBoxPayload(bytes, hdlr, 16) || !minf) return false;
  const mdhdVersion = readBmffVersion(bytes, mdhd);
  const timescaleOffset = mdhdVersion === 0 ? 12 : mdhdVersion === 1 ? 20 : -1;
  const durationOffset = mdhdVersion === 0 ? 16 : mdhdVersion === 1 ? 24 : -1;
  if (timescaleOffset < 0 || mdhd.payloadStart + durationOffset + 4 > mdhd.end || readUint32(bytes, mdhd.payloadStart + timescaleOffset) === 0 || readUint32(bytes, mdhd.payloadStart + durationOffset) === 0) return false;
  if (ascii(bytes, hdlr.payloadStart + 8, hdlr.payloadStart + 12) !== "vide") return false;
  const stbl = bmffChild(bytes, minf, "stbl");
  if (!stbl) return false;
  return parseBmffSamples(bytes, stbl, mediaRanges, 4);
}

function hasBmffStructure(bytes: Uint8Array, mimeType: string): boolean {
  const ftyp = readBmffBox(bytes, 0);
  if (!ftyp || ftyp.type !== "ftyp" || ftyp.size < 20 || (ftyp.size - 16) % 4 !== 0 || ftyp.payloadStart + 8 > ftyp.end) return false;
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
    if (box.type === "mdat") {
      if (box.end <= box.payloadStart) return false;
      mediaRanges.push({ start: box.payloadStart, end: box.end });
    }
    offset = box.end;
  }
  if (offset !== bytes.length || !moov || mediaRanges.length === 0) return false;
  const moovChildren = bmffChildren(bytes, moov);
  const mvhd = moovChildren?.find((box) => box.type === "mvhd") || null;
  const tracks = moovChildren?.filter((box) => box.type === "trak") || [];
  if (!moovChildren || !mvhd || readBmffVersion(bytes, mvhd) !== 0 || !hasFullBoxPayload(bytes, mvhd, 20) || readUint32(bytes, mvhd.payloadStart + 12) === 0 || readUint32(bytes, mvhd.payloadStart + 16) === 0 || tracks.length === 0) return false;
  return tracks.some((track) => hasValidBmffTrack(bytes, track, mediaRanges));
}

function readEbmlVint(bytes: Uint8Array, offset: number, preserveMarker = false): { length: number; value: number } | null {
  if (offset < 0 || offset >= bytes.length) return null;
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

interface EbmlElement { id: number; start: number; dataStart: number; end: number; size: number; }

function readEbmlElement(bytes: Uint8Array, offset: number, end: number): EbmlElement | null {
  const id = readEbmlVint(bytes, offset, true);
  if (!id || id.length > 4) return null;
  const size = readEbmlVint(bytes, offset + id.length);
  if (!size || offset + id.length + size.length > end || size.value > end - offset - id.length - size.length) return null;
  const dataStart = offset + id.length + size.length;
  return { id: id.value, start: offset, dataStart, end: dataStart + size.value, size: size.value };
}

function ebmlChildren(bytes: Uint8Array, start: number, end: number): EbmlElement[] | null {
  const children: EbmlElement[] = [];
  let offset = start;
  while (offset < end) {
    const element = readEbmlElement(bytes, offset, end);
    if (!element) return null;
    children.push(element);
    offset = element.end;
  }
  return offset === end ? children : null;
}

function ebmlUnsigned(bytes: Uint8Array, element: EbmlElement): number | null {
  if (element.size === 0 || element.size > 8) return null;
  let value = 0;
  for (let offset = element.dataStart; offset < element.end; offset += 1) {
    value = value * 0x100 + bytes[offset];
    if (!Number.isSafeInteger(value)) return null;
  }
  return value;
}

function ebmlAscii(bytes: Uint8Array, element: EbmlElement): string {
  return ascii(bytes, element.dataStart, element.end);
}

function hasVp8Frame(bytes: Uint8Array, frameStart: number, frameEnd: number): boolean {
  if (frameEnd - frameStart < 10) return false;
  const firstPartitionSize = (bytes[frameStart] >> 5) | (bytes[frameStart + 1] << 3) | ((bytes[frameStart + 2] & 7) << 11);
  if ((bytes[frameStart] & 1) !== 0 || firstPartitionSize < 7 || 3 + firstPartitionSize > frameEnd - frameStart) return false;
  if (bytes[frameStart + 3] !== 0x9d || bytes[frameStart + 4] !== 0x01 || bytes[frameStart + 5] !== 0x2a) return false;
  const width = bytes[frameStart + 6] | ((bytes[frameStart + 7] & 0x3f) << 8);
  const height = bytes[frameStart + 8] | ((bytes[frameStart + 9] & 0x3f) << 8);
  return width > 0 && height > 0;
}

function parseWebmBlock(bytes: Uint8Array, block: EbmlElement, trackCodecs: Map<number, string>): boolean {
  if (block.size < 4) return false;
  const track = readEbmlVint(bytes, block.dataStart);
  if (!track || track.value === 0 || block.dataStart + track.length + 3 > block.end) return false;
  const flags = bytes[block.dataStart + track.length + 2];
  // Laced blocks require a second framing parser; reject them rather than
  // treating the lacing header as a frame.
  if ((flags & 0x06) !== 0) return false;
  const frameStart = block.dataStart + track.length + 3;
  const codec = trackCodecs.get(track.value);
  return codec === "V_VP8" && hasVp8Frame(bytes, frameStart, block.end);
}

function hasWebmStructure(bytes: Uint8Array): boolean {
  const header = readEbmlElement(bytes, 0, bytes.length);
  if (!header || header.id !== 0x1a45dfa3) return false;
  const headerChildren = ebmlChildren(bytes, header.dataStart, header.end);
  const docType = headerChildren?.find((element) => element.id === 0x4282);
  if (!headerChildren || !docType || ebmlAscii(bytes, docType) !== "webm") return false;
  const segment = readEbmlElement(bytes, header.end, bytes.length);
  if (!segment || segment.id !== 0x18538067 || segment.end !== bytes.length || segment.size === 0) return false;
  const segmentChildren = ebmlChildren(bytes, segment.dataStart, segment.end);
  if (!segmentChildren) return false;
  const info = segmentChildren.find((element) => element.id === 0x1549a966);
  const tracks = segmentChildren.find((element) => element.id === 0x1654ae6b);
  if (!info || !tracks) return false;
  const infoChildren = ebmlChildren(bytes, info.dataStart, info.end);
  const timecodeScale = infoChildren?.find((element) => element.id === 0x2ad7b1);
  if (!infoChildren || !timecodeScale || ebmlUnsigned(bytes, timecodeScale) === null || ebmlUnsigned(bytes, timecodeScale) === 0) return false;
  const trackEntries = ebmlChildren(bytes, tracks.dataStart, tracks.end)?.filter((element) => element.id === 0xae) || [];
  if (trackEntries.length === 0) return false;
  const trackCodecs = new Map<number, string>();
  for (const entry of trackEntries) {
    const children = ebmlChildren(bytes, entry.dataStart, entry.end);
    const trackNumber = children?.find((element) => element.id === 0xd7);
    const trackType = children?.find((element) => element.id === 0x83);
    const codecId = children?.find((element) => element.id === 0x86);
    const video = children?.find((element) => element.id === 0xe0);
    if (!children || !trackNumber || !trackType || !codecId || !video || ebmlUnsigned(bytes, trackNumber) === null || ebmlUnsigned(bytes, trackType) !== 1 || ebmlAscii(bytes, codecId) !== "V_VP8") return false;
    const videoChildren = ebmlChildren(bytes, video.dataStart, video.end);
    const width = videoChildren?.find((element) => element.id === 0xb0);
    const height = videoChildren?.find((element) => element.id === 0xba);
    const trackNumberValue = ebmlUnsigned(bytes, trackNumber);
    if (!videoChildren || !width || !height || ebmlUnsigned(bytes, width) === null || ebmlUnsigned(bytes, height) === null || ebmlUnsigned(bytes, width) === 0 || ebmlUnsigned(bytes, height) === 0 || trackNumberValue === null || trackCodecs.has(trackNumberValue)) return false;
    trackCodecs.set(trackNumberValue, "V_VP8");
  }
  let hasCluster = false;
  for (const cluster of segmentChildren.filter((element) => element.id === 0x1f43b675)) {
    const clusterChildren = ebmlChildren(bytes, cluster.dataStart, cluster.end);
    if (!clusterChildren) return false;
    const blocks = clusterChildren.filter((element) => element.id === 0xa3);
    const blockGroups = clusterChildren.filter((element) => element.id === 0xa0);
    for (const block of blocks) {
      if (!parseWebmBlock(bytes, block, trackCodecs)) return false;
      hasCluster = true;
    }
    for (const group of blockGroups) {
      const groupChildren = ebmlChildren(bytes, group.dataStart, group.end);
      const block = groupChildren?.find((element) => element.id === 0xa1);
      if (!groupChildren || !block || !parseWebmBlock(bytes, block, trackCodecs)) return false;
      hasCluster = true;
    }
  }
  return hasCluster;
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
