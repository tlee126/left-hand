import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const lowerUuid = "11111111-1111-1111-1111-111111111111";
const uploaderId = "99999999-9999-9999-9999-999999999999";

const harness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const scenario = JSON.parse(process.argv[1]);
const timeline = [], calls = [], redirects = [], signedUrls = [];
let authCalls = 0;
const uuid = "11111111-1111-1111-1111-111111111111";
const uploaderId = "99999999-9999-9999-9999-999999999999";
const lowerUuid = uuid.toLowerCase();
const approvedProfile = { id: uploaderId, full_name: "Admin", email: "admin@example.test", role: "admin", account_status: "approved", phone: null, faculty: null, major: null, student_code: null, avatar_url: null, gpa_goal: null, approved_at: null, approved_by: null, rejection_reason: null, created_at: "", updated_at: "" };
const supabase = {
  auth: { getUser: async () => { if (authCalls++ === 0) timeline.push("auth"); if (scenario.access === "anonymous") return { data: { user: null }, error: null }; return { data: { user: { id: uploaderId } }, error: null }; } },
  from(table) {
    let insertedPayload;
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
      insert: payload => { insertedPayload = payload; calls.push(["metadata", payload]); return chain; },
      maybeSingle: async () => {
        if (table === "profiles") { timeline.push("profile"); return { data: scenario.access === "admin" ? approvedProfile : scenario.access === "anonymous" ? null : { ...approvedProfile, role: scenario.access === "student" ? "student" : "admin", account_status: scenario.access || "pending" }, error: null }; }
        if (table === "materials") { timeline.push("material"); if (scenario.repoError) return { data: null, error: { message: "SQL PRIVATE_PATH private@example.test" } }; return { data: scenario.nonMaterial ? null : { product_id: lowerUuid }, error: null }; }
        if (table === "material_assets") { timeline.push("version"); if (scenario.repoError) return { data: null, error: { message: "SQL PRIVATE_PATH private@example.test" } }; return { data: { version: 2 }, error: null }; }
        return { data: null, error: null };
      },
      single: async () => { if (table !== "material_assets") return { data: insertedPayload || null, error: scenario.metadataError ? { message: "SQL PRIVATE_PATH private@example.test" } : null }; timeline.push("metadata"); if (scenario.metadataError) return { data: null, error: { message: "SQL PRIVATE_PATH private@example.test" } }; return { data: { ...insertedPayload, id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", uploaded_by: uploaderId, visibility: "private" }, error: null }; }
    };
    return chain;
  },
  storage: { from: bucket => ({ upload: async (path, file, options) => { timeline.push("upload"); calls.push(["upload", { bucket, path, file, fileSize: file.size, options }]); if (scenario.storageError) return { data: null, error: { message: "storage /materials/private.pdf" } }; return { data: { path }, error: null }; }, remove: async paths => { timeline.push("cleanup"); calls.push(["cleanup", { bucket, paths }]); return { data: null, error: null }; }, createSignedUrl: async path => { signedUrls.push(path); return { data: null, error: null }; } }) }
};
const supabaseModule = "data:text/javascript,material-upload-supabase";
const navModule = "data:text/javascript,material-upload-nav";
const authModule = "data:text/javascript,material-upload-auth";
const profileModule = "data:text/javascript,material-upload-profile";
const repoModule = "data:text/javascript,material-upload-repo";
const storageModule = "data:text/javascript,material-upload-storage";
globalThis.__supabase = supabase;
globalThis.__redirects = redirects;
async function compile(file, replacements) { let source = await readFile(file, "utf8"); source = source.replace('import "server-only";', ""); for (const [from, to] of replacements) source = source.replaceAll(from, to); return (await transform(source, { loader: "ts", format: "esm" })).code; }
async function load(file, replacements) { return import("data:text/javascript," + encodeURIComponent(await compile(file, replacements))); }
const profileCode = await compile("lib/repositories/profile-repository.ts", [["@/lib/supabase/server", supabaseModule]]);
const authCode = await compile("lib/auth/session.ts", [["@/lib/supabase/server", supabaseModule], ["@/lib/repositories/profile-repository", profileModule]]);
const storageCode = await compile("lib/storage/material-storage.ts", [["@/lib/supabase/server", supabaseModule]]);
const repoCode = await compile("lib/repositories/material-asset-repository.ts", [["@/lib/supabase/server", supabaseModule], ["@/lib/storage/material-storage", storageModule]]);
const routeCode = await compile("app/api/admin/materials/[id]/upload/route.ts", [["@/lib/auth/session", authModule], ["@/lib/repositories/material-asset-repository", repoModule], ["@/lib/storage/material-storage", storageModule], ["next/navigation", navModule]]);
const toUrl = code => "data:text/javascript," + encodeURIComponent(code);
const supabaseUrl = toUrl("export const createClient = async () => globalThis.__supabase;");
const navUrl = toUrl("export const redirect = path => { globalThis.__redirects.push(path); const error = Error('REDIRECT:' + path); error.digest = 'NEXT_REDIRECT;'; throw error; };");
const profileUrl = toUrl(profileCode.replaceAll(supabaseModule, supabaseUrl));
const authUrl = toUrl(authCode.replaceAll(supabaseModule, supabaseUrl).replaceAll(profileModule, profileUrl));
const storageUrl = toUrl(storageCode.replaceAll(supabaseModule, supabaseUrl));
const repoUrl = toUrl(repoCode.replaceAll(supabaseModule, supabaseUrl).replaceAll(storageModule, storageUrl));
const route = await import(toUrl(routeCode.replaceAll(authModule, authUrl).replaceAll(repoModule, repoUrl).replaceAll(storageModule, storageUrl).replaceAll(navModule, navUrl)));
function concat(...parts) { return parts.flatMap(part => part); }
function pdfBytes() { return new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"); }
function u32(value) { return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]; }
function u16(value) { return [(value >>> 8) & 255, value & 255]; }
function chars(value) { return [...value].map(c => c.charCodeAt(0)); }
function box(type, payload) { return [...u32(payload.length + 8), ...chars(type), ...payload]; }
function avcConfig(invalid) { return invalid ? [1,0x42,0,0x1e,0xff,0xe1,0,3,0x67,0x42,0] : [1,0x42,0,0x1e,0xff,0xe1,0,9,0x67,0x42,0,0x1e,0xe9,0x01,0x40,0x7b,0x20,1,0,4,0x68,0xce,0x06,0xe2]; }
function bmffBytes(brand, options = {}) {
  const full = [0,0,0,0];
  const sample = options.oneByte ? [0] : options.fakeVcl ? [0,0,0,6,0x65,0,0,0,0,0] : [0,0,0,6,0x65,0x88,0x84,0x21,0x01,0x80];
  const stbl = offset => {
    const visual = new Array(78).fill(0);
    visual[6] = 0; visual[7] = 1;
    visual[24] = 2; visual[25] = 0x80;
    visual[26] = 1; visual[27] = 0x68;
    const sampleEntry = box("avc1", concat(visual, options.missingAvcc ? [] : box("avcC", avcConfig(options.invalidAvcc))));
    const tables = [
      box("stsd", concat(full, u32(1), sampleEntry)),
      ...(options.invalidTables ? [] : [box("stts", concat(full, u32(1), u32(1), u32(1)))]),
      box("stsc", concat(full, u32(1), u32(1), u32(1), u32(1))),
      box("stsz", concat(full, u32(0), u32(1), u32(sample.length))),
      box("stco", concat(full, u32(1), u32(offset)))
    ];
    return box("stbl", concat(...tables));
  };
  const makeMoov = offset => box("moov", concat(
    box("mvhd", concat(full, u32(1), u32(1), u32(1000), u32(1000))),
    box("trak", concat(
      box("tkhd", concat([0,0,0,7], u32(1), u32(1), u32(1), u32(1000))),
      box("mdia", concat(
        box("mdhd", concat(full, u32(1), u32(1), u32(1000), u32(1000), u16(0x55c4), u16(0))),
        box("hdlr", concat(full, u32(0), chars("vide"), new Array(12).fill(0), chars("VideoHandler\0"))),
        box("minf", stbl(offset))
      ))
    ))
  ));
  const ftyp = box("ftyp", concat(chars(brand), u32(0), chars(brand)));
  const moov = makeMoov(0);
  const mediaOffset = ftyp.length + moov.length + 8;
  const declaredOffset = options.inconsistent ? mediaOffset + sample.length - 1 : mediaOffset;
  return Uint8Array.from(concat(ftyp, makeMoov(declaredOffset), box("mdat", sample)));
}
function vint(value) { if (value < 0x7f) return [0x80 | value]; if (value < 0x3fff) return [0x40 | (value >>> 8), value & 255]; if (value < 0x1fffff) return [0x20 | (value >>> 16), (value >>> 8) & 255, value & 255]; throw new Error("fixture too large"); }
function ebml(id, payload) { return [...id, ...vint(payload.length), ...payload]; }
function uint(value) { return value < 0x100 ? [value] : u16(value); }
function webmBytes(options = {}) {
  const header = concat(
    ebml([0x42,0x86], [1]), ebml([0x42,0xf7], [1]), ebml([0x42,0xf2], [4]), ebml([0x42,0xf3], [8]),
    ebml([0x42,0x82], chars("webm")), ebml([0x42,0x87], [2]), ebml([0x42,0x85], [2])
  );
  const ebmlHeader = ebml([0x1a,0x45,0xdf,0xa3], header);
  const info = ebml([0x15,0x49,0xa9,0x66], concat(ebml([0x2a,0xd7,0xb1], [0x0f,0x42,0x40]), ebml([0x4d,0x80], chars("test")), ebml([0x57,0x41], chars("test"))));
  const video = ebml([0xe0], concat(ebml([0xb0], uint(640)), ebml([0xba], uint(360))));
  const codec = options.fakeCodec ? "FAKE" : "V_VP8";
  const trackEntry = ebml([0xae], concat(ebml([0xd7], [1]), ebml([0x83], [1]), ebml([0x86], chars(codec)), video));
  const tracks = ebml([0x16,0x54,0xae,0x6b], trackEntry);
  const frame = options.randomFrame ? [0x90,0x00,0x00,0x9d,0x01,0x2a,0x80,0x02,0x68,0x01,0xff,0xff,0xff,0xff,0xde,0xad] : [0x90,0x00,0x00,0x9d,0x01,0x2a,0x80,0x02,0x68,0x01,0x00,0x00,0x00,0x00,0x9e,0x01];
  const block = options.emptyFrame ? [0x81,0x00,0x00,0x80] : options.fiveByteBlock ? [0x81,0x00,0x00,0x80,0x00] : [0x81,0x00,0x00,0x80, ...frame];
  const cluster = ebml([0x1f,0x43,0xb6,0x75], concat(ebml([0xe7], [0]), ebml([0xa3], block)));
  const segmentPayload = options.markerOnlyTrack ? concat(info, ebml([0x16,0x54,0xae,0x6b], ebml([0xae], concat(ebml([0xd7], [1]), ebml([0x83], [1]), ebml([0x86], chars("V_VP8")))))) : concat(info, tracks, cluster);
  return Uint8Array.from(concat(ebmlHeader, [0x18,0x53,0x80,0x67], vint(segmentPayload.length), segmentPayload));
}
function fixture(kind, scenario) {
  if (scenario.fabricated) return kind === "webm" ? Uint8Array.from(concat([0x1a,0x45,0xdf,0xa3], vint(6), ebml([0x42,0x82], chars("webm")), [0x18,0x53,0x80,0x67,0x81,0x00])) : Uint8Array.from(concat(box("ftyp", concat(chars(kind === "quicktime" ? "qt  " : "isom"), u32(0), chars(kind === "quicktime" ? "qt  " : "isom"))), box("avc1", new Array(78).fill(0)), box("mdat", [0])));
  if (scenario.ftypOnly) return Uint8Array.from(box("ftyp", concat(chars("isom"), u32(0), chars("isom"))));
  if (scenario.headerOnly) return Uint8Array.from(concat(box("ftyp", concat(chars("isom"), u32(0), chars("isom"))), [0,0,0,8,0x6d,0x6f,0x6f,0x76]));
  if (scenario.impossibleBox) return Uint8Array.from(concat(box("ftyp", concat(chars("isom"), u32(0), chars("isom"))), [0xff,0xff,0xff,0xff,0x6d,0x6f,0x6f,0x76]));
  const bytes = kind === "pdf" ? pdfBytes() : kind === "webm" ? webmBytes({ fakeCodec: scenario.fakeCodec, emptyFrame: scenario.emptyFrame, fiveByteBlock: scenario.fiveByteBlock, randomFrame: scenario.randomFrame, markerOnlyTrack: scenario.markerOnlyTrack }) : bmffBytes(kind === "quicktime" ? "qt  " : "isom", { missingAvcc: scenario.missingAvcc, invalidAvcc: scenario.invalidAvcc, invalidTables: scenario.invalidTables, inconsistent: scenario.inconsistent, oneByte: scenario.oneByte, fakeVcl: scenario.fakeVcl });
  return scenario.truncated ? bytes.slice(0, bytes.length - (kind === "quicktime" ? 3 : kind === "pdf" ? 4 : 1)) : bytes;
}
const kind = scenario.kind || "pdf";
const type = scenario.mime || ({ pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm", quicktime: "video/quicktime" }[kind]);
const bytes = scenario.spoof ? Uint8Array.from([1,2,3,4,5]) : fixture(kind, scenario);
class ProbeFile extends File { async arrayBuffer() { timeline.push("file"); return super.arrayBuffer(); } }
const file = new ProbeFile([bytes], scenario.name || "private file.pdf", { type });
if (scenario.empty) Object.defineProperty(file, "size", { value: 0 });
if (scenario.oversize) Object.defineProperty(file, "size", { value: type === "application/pdf" ? 20 * 1024 * 1024 + 1 : 500 * 1024 * 1024 + 1 });
const entries = scenario.extra ? [["file", file], ["role", "admin"]] : scenario.missing ? [] : [["file", file]];
const request = { formData: async () => { timeline.push("form"); return { keys: () => entries.map(entry => entry[0]), getAll: key => entries.filter(entry => entry[0] === key).map(entry => entry[1]) }; } };
let error = "";
try { await route.POST(request, { params: Promise.resolve({ id: scenario.uppercase ? uuid.toUpperCase() : scenario.badId ? "bad" : uuid }) }); } catch (caught) { error = caught.message; }
  console.log(JSON.stringify({ timeline, calls, redirects, error, signedUrls, mediaValid: route.validateMaterialMedia(type, bytes) }));
`;

type Call = [string, unknown];
type Result = { timeline: string[]; calls: Call[]; redirects: string[]; error: string; signedUrls: string[]; mediaValid: boolean };
async function run(scenario: Record<string, unknown> = {}): Promise<Result> { const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx/esm", "-e", harness, JSON.stringify(scenario)], { maxBuffer: 1024 * 1024 }); return JSON.parse(stdout.trim()); }
function call(result: Result, name: string): Record<string, unknown> { return result.calls.find(([key]) => key === name)?.[1] as Record<string, unknown>; }

test("approved admins execute the real route, repository, and storage modules", async () => {
  for (const kind of ["pdf", "mp4", "webm", "quicktime"]) {
    const result = await run({ access: "admin", kind });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=success", JSON.stringify({ kind, result }));
    assert.deepEqual(result.timeline, ["auth", "profile", "form", "file", "material", "version", "upload", "metadata"]);
    const upload = call(result, "upload");
    const metadata = result.calls.find(([name]) => name === "metadata")?.[1] as Record<string, unknown>;
    const options = upload.options as Record<string, unknown>;
    assert.equal(upload.bucket, "materials");
    assert.equal(upload.path, metadata.storage_path);
    assert.match(String(upload.path), /^materials\/11111111-1111-1111-1111-111111111111\/v3\/[0-9a-f-]{36}-private-file\.pdf$/);
    assert.equal(options.contentType, kind === "pdf" ? "application/pdf" : ({ mp4: "video/mp4", webm: "video/webm", quicktime: "video/quicktime" }[kind]));
    assert.equal(options.upsert, false);
    assert.equal(metadata.product_id, lowerUuid);
    assert.equal(metadata.original_name, "private file.pdf");
    assert.equal(metadata.mime_type, options.contentType);
    assert.equal(metadata.byte_size, upload.fileSize);
    assert.equal(metadata.version, 3);
    assert.equal(metadata.visibility, "private");
    assert.equal(metadata.uploaded_by, uploaderId);
    assert.deepEqual(result.signedUrls, []);
  }
});
test("authorization remains first and blocks anonymous or non-approved users", async () => { for (const access of ["anonymous", "student", "pending", "rejected", "suspended"]) { const result = await run({ access }); assert.deepEqual(result.timeline, ["auth", ...(access === "anonymous" ? [] : ["profile"])]); assert.ok(result.error.startsWith("REDIRECT:")); } });
test("invalid multipart data, UUIDs, MIME/signatures, size, product, and unsafe names fail generically", async () => {
  for (const scenario of [
    { missing: true }, { extra: true }, { badId: true }, { mime: "text/plain" }, { spoof: true }, { empty: true }, { oversize: true }, { nonMaterial: true },
    { truncated: true }, { kind: "webm", truncated: true }, { kind: "mp4", truncated: true }, { kind: "quicktime", truncated: true }, { kind: "mp4", ftypOnly: true }, { kind: "mp4", headerOnly: true }, { kind: "mp4", impossibleBox: true },
    { kind: "mp4", fabricated: true }, { kind: "webm", fabricated: true }, { kind: "mp4", missingAvcc: true }, { kind: "mp4", invalidAvcc: true }, { kind: "mp4", invalidTables: true },
    { kind: "mp4", inconsistent: true }, { kind: "mp4", fakeVcl: true }, { kind: "quicktime", oneByte: true }, { kind: "webm", fakeCodec: true }, { kind: "webm", markerOnlyTrack: true }, { kind: "webm", fiveByteBlock: true }, { kind: "webm", emptyFrame: true }, { kind: "webm", randomFrame: true },
    { name: "foo/../bar.pdf" }, { name: "foo\\..\\bar.pdf" }, { name: "unsafe\u0000.pdf" }
  ]) {
    const result = await run({ access: "admin", ...scenario });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=error", JSON.stringify({ scenario, result }));
    assert.equal(result.redirects.at(-1), "/quan-tri/catalog?upload=error");
    const mediaInvalid = Boolean(scenario.spoof || scenario.truncated || scenario.fabricated || scenario.ftypOnly || scenario.headerOnly || scenario.impossibleBox || scenario.missingAvcc || scenario.invalidAvcc || scenario.invalidTables || scenario.inconsistent || scenario.fakeVcl || scenario.oneByte || scenario.fakeCodec || scenario.markerOnlyTrack || scenario.fiveByteBlock || scenario.emptyFrame || scenario.randomFrame);
    if (mediaInvalid) assert.equal(result.mediaValid, false, JSON.stringify({ scenario, result }));
    if (!scenario.nonMaterial) assert.ok(!result.timeline.includes("material"), JSON.stringify({ scenario, result }));
    assert.ok(!result.timeline.includes("version"));
    assert.ok(!result.timeline.includes("upload"));
    assert.ok(!result.timeline.includes("metadata"));
    assert.ok(!result.timeline.includes("cleanup"));
  }
});
test("uppercase UUIDs are canonicalized and cleanup is exact only after metadata failure", async () => {
  const success = await run({ access: "admin", uppercase: true });
  assert.equal(success.error, "REDIRECT:/quan-tri/catalog?upload=success");
  assert.equal(String(call(success, "upload").path).startsWith("materials/11111111-1111-1111-1111-111111111111/"), true);
  assert.equal(success.timeline.includes("cleanup"), false);
  const failure = await run({ access: "admin", metadataError: true });
  assert.equal(failure.error, "REDIRECT:/quan-tri/catalog?upload=error");
  assert.deepEqual(failure.timeline, ["auth", "profile", "form", "file", "material", "version", "upload", "metadata", "cleanup"]);
  const uploadPath = call(failure, "upload").path;
  assert.deepEqual(call(failure, "cleanup"), { bucket: "materials", paths: [uploadPath] });
  assert.equal(failure.signedUrls.length, 0);
});
test("storage failures and repository failures stay private and do not delete old versions", async () => {
  for (const scenario of [{ storageError: true }, { repoError: true }]) {
    const result = await run({ access: "admin", ...scenario });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=error");
    assert.equal(result.timeline.includes("cleanup"), false);
    assert.equal(result.calls.some(([name]) => name === "metadata"), false);
    for (const forbidden of ["private_path", "private@example", "sql", "safe.pdf", "materials/"]) assert.ok(!JSON.stringify({ error: result.error, redirects: result.redirects }).toLowerCase().includes(forbidden), forbidden);
  }
});
