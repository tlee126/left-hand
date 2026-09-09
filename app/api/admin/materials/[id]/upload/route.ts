import "server-only";

import { redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import {
  finalizeMaterialAssetUpload,
  isMaterialProduct,
  releaseMaterialAssetUpload,
  reserveMaterialAssetUpload
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

interface AvcConfiguration {
  lengthSize: number;
  sps: Uint8Array;
  pps: Uint8Array;
  frameNumBits: number;
  cavlc: boolean;
  deblockingFilterControlPresent: boolean;
}

class BitReader {
  private readonly bytes: Uint8Array;
  private bitOffset = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  readBits(count: number): number | null {
    if (count < 0 || count > 32 || this.bitOffset + count > this.bytes.length * 8) return null;
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      value = value * 2 + ((this.bytes[Math.floor(this.bitOffset / 8)] >> (7 - (this.bitOffset % 8))) & 1);
      this.bitOffset += 1;
    }
    return value;
  }

  readBit(): number | null { return this.readBits(1); }

  readUnsignedExpGolomb(): number | null {
    let leadingZeroBits = 0;
    while (true) {
      const bit = this.readBit();
      if (bit === null) return null;
      if (bit === 1) break;
      leadingZeroBits += 1;
      if (leadingZeroBits > 31) return null;
    }
    if (leadingZeroBits === 0) return 0;
    const suffix = this.readBits(leadingZeroBits);
    return suffix === null ? null : (2 ** leadingZeroBits) - 1 + suffix;
  }

  readSignedExpGolomb(): number | null {
    const value = this.readUnsignedExpGolomb();
    return value === null ? null : (value % 2 === 0 ? -1 : 1) * Math.ceil(value / 2);
  }

  remaining(): number { return this.bytes.length * 8 - this.bitOffset; }

  readRbspTrailingBits(): boolean {
    if (this.readBit() !== 1) return false;
    while (this.remaining() > 0) if (this.readBit() !== 0) return false;
    return true;
  }
}

function rbsp(bytes: Uint8Array): Uint8Array {
  const result: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (index + 2 < bytes.length && bytes[index] === 0 && bytes[index + 1] === 0 && bytes[index + 2] === 3) {
      result.push(0, 0);
      index += 2;
    } else {
      result.push(bytes[index]);
    }
  }
  return Uint8Array.from(result);
}

function parseAvcSps(value: Uint8Array): number | null {
  if (value.length < 4 || (value[0] & 0x80) !== 0 || (value[0] & 0x1f) !== 7 || (value[0] & 0x60) === 0) return null;
  const reader = new BitReader(rbsp(value.slice(1)));
  const profile = reader.readBits(8);
  if (profile === null || profile !== 66 || reader.readBits(8) === null || reader.readBits(8) === null || reader.readUnsignedExpGolomb() === null) return null;
  if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134].includes(profile)) {
    const chromaFormat = reader.readUnsignedExpGolomb();
    if (chromaFormat === null || chromaFormat > 3) return null;
    if (chromaFormat === 3 && reader.readBit() === null) return null;
    if (reader.readUnsignedExpGolomb() === null || reader.readUnsignedExpGolomb() === null || reader.readBit() === null) return null;
    const scalingMatrix = reader.readBit();
    if (scalingMatrix === null || scalingMatrix !== 0) return null;
  }
  const frameNumMinus4 = reader.readUnsignedExpGolomb();
  if (frameNumMinus4 === null || frameNumMinus4 > 12) return null;
  const frameNumBits = frameNumMinus4 + 4;
  const picOrderType = reader.readUnsignedExpGolomb();
  if (picOrderType === null || picOrderType > 2) return null;
  if (picOrderType === 0) {
    if (reader.readUnsignedExpGolomb() === null) return null;
  } else if (picOrderType === 1) {
    if (reader.readBit() === null || reader.readSignedExpGolomb() === null || reader.readSignedExpGolomb() === null) return null;
    const cycle = reader.readUnsignedExpGolomb();
    if (cycle === null || cycle > 32) return null;
    for (let index = 0; index < cycle; index += 1) if (reader.readSignedExpGolomb() === null) return null;
  }
  if (reader.readUnsignedExpGolomb() === null || reader.readBit() === null || reader.readUnsignedExpGolomb() === null || reader.readUnsignedExpGolomb() === null) return null;
  const frameOnly = reader.readBit();
  if (frameOnly === null) return null;
  if (frameOnly === 0 && reader.readBit() === null) return null;
  if (reader.readBit() === null || reader.readBit() === null) return null;
  const cropping = reader.readBit();
  if (cropping === null) return null;
  if (cropping !== 0) for (let index = 0; index < 4; index += 1) if (reader.readUnsignedExpGolomb() === null) return null;
  return frameNumBits;
}

interface AvcPictureConfiguration { cavlc: boolean; deblockingFilterControlPresent: boolean; }

function parseAvcPps(value: Uint8Array): AvcPictureConfiguration | null {
  if (value.length < 2 || (value[0] & 0x80) !== 0 || (value[0] & 0x1f) !== 8 || (value[0] & 0x60) === 0) return null;
  const reader = new BitReader(rbsp(value.slice(1)));
  if (reader.readUnsignedExpGolomb() !== 0 || reader.readUnsignedExpGolomb() !== 0) return null;
  const entropyCodingMode = reader.readBit();
  const bottomFieldPicOrder = reader.readBit();
  if (entropyCodingMode === null || bottomFieldPicOrder === null || reader.readUnsignedExpGolomb() !== 0) return null;
  if (reader.readUnsignedExpGolomb() === null || reader.readUnsignedExpGolomb() === null || reader.readBit() === null || reader.readBits(2) === null) return null;
  if (reader.readSignedExpGolomb() === null || reader.readSignedExpGolomb() === null || reader.readSignedExpGolomb() === null) return null;
  const deblocking = reader.readBit();
  const constrainedIntra = reader.readBit();
  const redundantPic = reader.readBit();
  if (deblocking === null || constrainedIntra === null || redundantPic === null || bottomFieldPicOrder !== 0 || redundantPic !== 0 || !reader.readRbspTrailingBits()) return null;
  return { cavlc: entropyCodingMode === 0, deblockingFilterControlPresent: deblocking === 1 };
}

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

function parseAvcConfiguration(bytes: Uint8Array, sampleEntry: BmffBox): AvcConfiguration | null {
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
  let sps: Uint8Array | null = null;
  for (let index = 0; index < spsCount; index += 1) {
    if (offset + 2 > config.end) return null;
    const size = bytes[offset] * 0x100 + bytes[offset + 1];
    offset += 2;
    if (size < 4 || offset + size > config.end || (bytes[offset] & 0x1f) !== 7 || sps !== null) return null;
    sps = bytes.slice(offset, offset + size);
    offset += size;
  }
  if (offset >= config.end) return null;
  const ppsCount = bytes[offset];
  offset += 1;
  if (ppsCount === 0) return null;
  let pps: Uint8Array | null = null;
  for (let index = 0; index < ppsCount; index += 1) {
    if (offset + 2 > config.end) return null;
    const size = bytes[offset] * 0x100 + bytes[offset + 1];
    offset += 2;
    if (size < 2 || offset + size > config.end || (bytes[offset] & 0x1f) !== 8 || pps !== null) return null;
    pps = bytes.slice(offset, offset + size);
    offset += size;
  }
  if (offset !== config.end || sps === null || pps === null) return null;
  const frameNumBits = parseAvcSps(sps);
  const pictureConfiguration = parseAvcPps(pps);
  if (frameNumBits === null || pictureConfiguration === null || !pictureConfiguration.cavlc || !pictureConfiguration.deblockingFilterControlPresent) return null;
  return { lengthSize, sps, pps, frameNumBits, ...pictureConfiguration };
}

function parseAvcSample(bytes: Uint8Array, sample: BmffSample, configuration: AvcConfiguration): boolean {
  const { lengthSize, frameNumBits } = configuration;
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
    const nalHeader = bytes[offset];
    const nalType = nalHeader & 0x1f;
    if ((nalHeader & 0x80) !== 0 || nalType < 1 || nalType > 23) return false;
    if (nalType === 7 || nalType === 8) return false;
    if (nalType === 1 || nalType === 5) {
      const reader = new BitReader(rbsp(bytes.slice(offset + 1, offset + nalSize)));
      const firstMb = reader.readUnsignedExpGolomb();
      const sliceType = reader.readUnsignedExpGolomb();
      const ppsId = reader.readUnsignedExpGolomb();
      if (firstMb !== 0 || sliceType === null || sliceType % 5 !== 2 || ppsId !== 0 || reader.readBits(frameNumBits) === null) return false;
      if (nalType === 5 && reader.readUnsignedExpGolomb() === null) return false;
      if (reader.readSignedExpGolomb() === null || reader.readUnsignedExpGolomb() !== 0) return false;
      for (let index = 0; index < 16; index += 1) {
        const predicted = reader.readBit();
        if (predicted === null) return false;
        if (predicted === 0 && reader.readBits(3) === null) return false;
      }
      if (reader.readUnsignedExpGolomb() !== 0 || reader.readUnsignedExpGolomb() !== 0 || reader.readSignedExpGolomb() !== 0 || !reader.readRbspTrailingBits()) return false;
      hasVcl = true;
    }
    offset += nalSize;
  }
  return offset === end && hasVcl;
}

function parseBmffSamples(bytes: Uint8Array, stbl: BmffBox, mediaRanges: Array<{ start: number; end: number }>, avcLengthSize: number): boolean {
  const stblChildren = bmffChildren(bytes, stbl);
  if (!stblChildren) return false;
  const exactlyOne = (type: string): BmffBox | null => {
    const matches = stblChildren.filter((box) => box.type === type);
    return matches.length === 1 ? matches[0] : null;
  };
  const stsd = exactlyOne("stsd");
  const stts = exactlyOne("stts");
  const stsc = exactlyOne("stsc");
  const stsz = exactlyOne("stsz");
  const stz2 = exactlyOne("stz2");
  const stco = exactlyOne("stco");
  const co64 = exactlyOne("co64");
  if (!stsd || !stts || !stsc || (!stsz && !stz2) || (stsz && stz2) || (!!stco === !!co64) || stsd.size < 16) return false;
  if (stsz && stz2) return false;
  const stsdEntries = bmffChildren(bytes, { ...stsd, payloadStart: stsd.payloadStart + 8 });
  if (!hasFullBoxPayload(bytes, stsd, 8) || !stsdEntries || readUint32(bytes, stsd.payloadStart + 4) !== 1 || stsdEntries.length !== 1) return false;
  const sampleEntry = stsdEntries[0];
  if (sampleEntry.type !== "avc1" && sampleEntry.type !== "avc3") return false;
  const avcConfiguration = parseAvcConfiguration(bytes, sampleEntry);
  if (!avcConfiguration || avcConfiguration.lengthSize !== avcLengthSize) return false;

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
  return sampleIndex === sizes.length && samples.every((sample) => parseAvcSample(bytes, sample, avcConfiguration));
}

function hasValidBmffTrack(bytes: Uint8Array, trak: BmffBox, mediaRanges: Array<{ start: number; end: number }>): boolean {
  const trakChildren = bmffChildren(bytes, trak);
  const tkhd = trakChildren?.filter((box) => box.type === "tkhd");
  const mdia = trakChildren?.filter((box) => box.type === "mdia");
  if (!trakChildren || !tkhd || !mdia || tkhd.length !== 1 || mdia.length !== 1) return false;
  const tkhdBox = tkhd[0];
  const mdiaChildren = bmffChildren(bytes, mdia[0]);
  const mdhd = mdiaChildren?.filter((box) => box.type === "mdhd");
  const hdlr = mdiaChildren?.filter((box) => box.type === "hdlr");
  const minf = mdiaChildren?.filter((box) => box.type === "minf");
  if (!mdiaChildren || !mdhd || !hdlr || !minf || mdhd.length !== 1 || hdlr.length !== 1 || minf.length !== 1) return false;
  const mdhdBox = mdhd[0];
  const hdlrBox = hdlr[0];
  const minfBox = minf[0];
  if (!hasFullBoxPayload(bytes, tkhdBox, 20) || readUint32(bytes, tkhdBox.payloadStart + 12) === 0 || !hasFullBoxPayload(bytes, mdhdBox, 24) || !hasFullBoxPayload(bytes, hdlrBox, 16)) return false;
  const mdhdVersion = readBmffVersion(bytes, mdhdBox);
  const timescaleOffset = mdhdVersion === 0 ? 12 : mdhdVersion === 1 ? 20 : -1;
  const durationOffset = mdhdVersion === 0 ? 16 : mdhdVersion === 1 ? 24 : -1;
  if (timescaleOffset < 0 || mdhdBox.payloadStart + durationOffset + 4 > mdhdBox.end || readUint32(bytes, mdhdBox.payloadStart + timescaleOffset) === 0 || readUint32(bytes, mdhdBox.payloadStart + durationOffset) === 0) return false;
  if (ascii(bytes, hdlrBox.payloadStart + 8, hdlrBox.payloadStart + 12) !== "vide") return false;
  const minfChildren = bmffChildren(bytes, minfBox);
  const stbl = minfChildren?.filter((box) => box.type === "stbl");
  if (!minfChildren || !stbl || stbl.length !== 1) return false;
  return parseBmffSamples(bytes, stbl[0], mediaRanges, 4);
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
  if (!moovChildren || !mvhd || moovChildren.filter((box) => box.type === "mvhd").length !== 1 || readBmffVersion(bytes, mvhd) !== 0 || !hasFullBoxPayload(bytes, mvhd, 20) || readUint32(bytes, mvhd.payloadStart + 12) === 0 || readUint32(bytes, mvhd.payloadStart + 16) === 0 || tracks.length !== 1) return false;
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

class Vp8BoolReader {
  private readonly bytes: Uint8Array;
  private byteOffset = 1;
  private bitCount = 8;
  private value: number;
  private range = 255;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.value = bytes.length > 0 ? bytes[0] : 0;
  }

  readBoolean(probability: number): number | null {
    if (probability < 0 || probability > 255 || this.bytes.length === 0) return null;
    const split = 1 + (((this.range - 1) * probability) >> 8);
    const bigSplit = split << 8;
    let result: number;
    if (this.value >= bigSplit) {
      this.range -= split;
      this.value -= bigSplit;
      result = 1;
    } else {
      this.range = split;
      result = 0;
    }
    while (this.range < 128) {
      this.range <<= 1;
      this.value <<= 1;
      this.bitCount -= 1;
      if (this.bitCount === 0) {
        if (this.byteOffset >= this.bytes.length) return null;
        this.value |= this.bytes[this.byteOffset++];
        this.bitCount = 8;
      }
    }
    return result;
  }

  isAtPartitionEnd(): boolean {
    const remaining = this.bytes.slice(this.byteOffset);
    return remaining.length === 0 || (this.bitCount === 8 && remaining.every((value) => value === 0));
  }
}

// A conservative VP8 subset: key frames with one token partition and zero
// residual coefficients. The complete 11-leaf coefficient token tree is
// decoded with the normative band-0/context-0 probabilities. Non-zero
// coefficient symbols are outside the supported subset and are rejected.
const VP8_BAND0_TOKEN_PROBABILITIES = [
  [128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128],
  [198, 35, 237, 223, 193, 187, 162, 160, 145, 155, 62],
  [253, 9, 248, 251, 207, 208, 255, 192, 128, 128, 128],
  [202, 24, 213, 235, 186, 191, 220, 160, 240, 175, 255]
] as const;

function readVp8CoefficientToken(reader: Vp8BoolReader, probabilities: readonly number[]): number | null {
  if (reader.readBoolean(probabilities[0]) === 0) return 0;
  if (reader.readBoolean(probabilities[1]) === 0) return 1;
  if (reader.readBoolean(probabilities[2]) === 0) return 2;
  if (reader.readBoolean(probabilities[3]) === 0) return 3;
  if (reader.readBoolean(probabilities[4]) === 0) return 4;
  if (reader.readBoolean(probabilities[5]) === 0) return 5;
  if (reader.readBoolean(probabilities[6]) === 0) return 6;
  if (reader.readBoolean(probabilities[7]) === 0) return 7;
  if (reader.readBoolean(probabilities[8]) === 0) return 8;
  if (reader.readBoolean(probabilities[9]) === 0) return 9;
  return reader.readBoolean(probabilities[10]) === 0 ? 10 : 11;
}

function hasVp8TokenSyntax(bytes: Uint8Array, start: number, end: number, width: number, height: number, tokenPartitions: number): boolean {
  if (tokenPartitions !== 1 || start < 0 || start >= end) return false;
  const reader = new Vp8BoolReader(bytes.slice(start, end));
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  if (!Number.isSafeInteger(macroblocks) || macroblocks < 1 || macroblocks > 65536) return false;
  for (let macroblock = 0; macroblock < macroblocks; macroblock += 1) {
    for (let block = 0; block < 25; block += 1) {
      const blockType = block < 16 ? 0 : block === 16 ? 1 : block < 21 ? 2 : 3;
      if (readVp8CoefficientToken(reader, VP8_BAND0_TOKEN_PROBABILITIES[blockType]) !== 0) return false;
    }
  }
  return reader.isAtPartitionEnd();
}

function hasVp8Frame(bytes: Uint8Array, frameStart: number, frameEnd: number): boolean {
  if (frameEnd - frameStart < 12) return false;
  const tag = bytes[frameStart] | (bytes[frameStart + 1] << 8) | (bytes[frameStart + 2] << 16);
  const firstPartitionSize = tag >> 5;
  const frameType = tag & 1;
  const version = (tag >> 1) & 7;
  const showFrame = (tag >> 4) & 1;
  if (frameType !== 0 || version > 3 || showFrame !== 1 || firstPartitionSize < 4 || 10 + firstPartitionSize >= frameEnd - frameStart) return false;
  if (bytes[frameStart + 3] !== 0x9d || bytes[frameStart + 4] !== 0x01 || bytes[frameStart + 5] !== 0x2a) return false;
  const width = bytes[frameStart + 6] | ((bytes[frameStart + 7] & 0x3f) << 8);
  const height = bytes[frameStart + 8] | ((bytes[frameStart + 9] & 0x3f) << 8);
  if (width === 0 || height === 0) return false;
  const firstPartition = new BitReader(bytes.slice(frameStart + 10, frameStart + 10 + firstPartitionSize));
  if (firstPartition.readBit() !== 0 || firstPartition.readBit() !== 0 || firstPartition.readBits(6) === null || firstPartition.readBits(3) === null) return false;
  const deltaEnabled = firstPartition.readBit();
  if (deltaEnabled === null) return false;
  if (deltaEnabled !== 0) {
    for (let index = 0; index < 4; index += 1) {
      const update = firstPartition.readBit();
      if (update === null || update !== 0) return false;
    }
  }
  const tokenPartitionBits = firstPartition.readBits(2);
  if (tokenPartitionBits === null || firstPartition.readBits(7) === null) return false;
  for (let index = 0; index < 4; index += 1) {
    const update = firstPartition.readBit();
    if (update === null || update !== 0) return false;
  }
  const tokenPartitions = 1 << tokenPartitionBits;
  const tokenStart = frameStart + 10 + firstPartitionSize;
  const tokenBytes = frameEnd - tokenStart;
  if (tokenStart < frameStart + 10 || tokenStart >= frameEnd || tokenBytes < 1) return false;
  return hasVp8TokenSyntax(bytes, tokenStart, frameEnd, width, height, tokenPartitions);
}

function parseWebmBlock(bytes: Uint8Array, block: EbmlElement, trackCodecs: Map<number, string>): boolean {
  if (block.size < 4) return false;
  const track = readEbmlVint(bytes, block.dataStart);
  if (!track || track.value === 0 || block.dataStart + track.length + 3 > block.end) return false;
  const flags = bytes[block.dataStart + track.length + 2];
  // Laced blocks require a second framing parser; reject them rather than
  // treating the lacing header as a frame.
  if ((flags & 0x06) !== 0 || (flags & 0x80) === 0) return false;
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
    const timecodes = clusterChildren.filter((element) => element.id === 0xe7);
    if (timecodes.length !== 1 || ebmlUnsigned(bytes, timecodes[0]) === null) return false;
    const blocks = clusterChildren.filter((element) => element.id === 0xa3);
    const blockGroups = clusterChildren.filter((element) => element.id === 0xa0);
    for (const block of blocks) {
      if (!parseWebmBlock(bytes, block, trackCodecs)) return false;
      hasCluster = true;
    }
    for (const group of blockGroups) {
      const groupChildren = ebmlChildren(bytes, group.dataStart, group.end);
      const blockEntries = groupChildren?.filter((element) => element.id === 0xa1) || [];
      if (!groupChildren || blockEntries.length !== 1 || !parseWebmBlock(bytes, blockEntries[0], trackCodecs)) return false;
      hasCluster = true;
    }
  }
  return hasCluster;
}

export function validateMaterialMedia(mimeType: string, bytes: Uint8Array): boolean {
  if (!isSupportedMaterialMimeType(mimeType)) return false;
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
  let reservationId: string | null = null;
  try {
    const { id: productIdInput } = await context.params;
    if (!isValidMaterialUuid(productIdInput)) redirect(CATALOG_ERROR_PATH);
    const productId = productIdInput.toLowerCase();

    const formData = await request.formData();
    const keys = [...formData.keys()];
    const files = formData.getAll("file");
    if (keys.length !== 1 || keys[0] !== "file" || files.length !== 1 || !(files[0] instanceof File)) redirect(CATALOG_ERROR_PATH);
    const file = files[0];
    if (file.size <= 0 || !isSupportedMaterialMimeType(file.type) || file.size > materialSizeLimit(file.type)) redirect(CATALOG_ERROR_PATH);
    sanitizeMaterialFilename(file.name);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateMaterialMedia(file.type, bytes)) redirect(CATALOG_ERROR_PATH);

    if (!(await isMaterialProduct(productId))) redirect(CATALOG_ERROR_PATH);

    const safeFilename = sanitizeMaterialFilename(file.name);
    const reservation = await reserveMaterialAssetUpload({
      productId,
      originalName: file.name,
      safeFilename,
      mimeType: file.type,
      byteSize: file.size
    });
    reservationId = reservation.reservationId;
    const stored = await uploadMaterialObject({
      productId,
      version: reservation.version,
      originalName: file.name,
      mimeType: file.type,
      file,
      storagePath: reservation.storagePath
    });
    uploadedPath = stored.storagePath;
    await finalizeMaterialAssetUpload(reservation.reservationId);
    reservationId = null;
  } catch (error) {
    if (isRedirectControlFlow(error)) throw error;
    if (uploadedPath) {
      try {
        await removeNewMaterialObject(uploadedPath);
      } catch {
        // The route intentionally does not disclose cleanup or storage details.
      }
    }
    if (reservationId) {
      try {
        await releaseMaterialAssetUpload(reservationId);
      } catch {
        // The route intentionally does not disclose cleanup or storage details.
      }
    }
    redirect(CATALOG_ERROR_PATH);
  }
  redirect(CATALOG_SUCCESS_PATH);
}
