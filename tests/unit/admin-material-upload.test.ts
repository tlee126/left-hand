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
function bmffBytes(brand) { return Uint8Array.from(concat([0,0,0,20], [..."ftyp"].map(c => c.charCodeAt(0)), [...brand].map(c => c.charCodeAt(0)), [0,0,0,0], [...brand].map(c => c.charCodeAt(0)), [0,0,0,9], [..."mdat"].map(c => c.charCodeAt(0)), [0])); }
function webmBytes() { return Uint8Array.from(concat([0x1a,0x45,0xdf,0xa3,0x97,0x42,0x86,0x81,0x01,0x42,0xf7,0x81,0x01,0x42,0xf2,0x81,0x04,0x42,0xf3,0x81,0x08,0x42,0x82,0x84,0x77,0x65,0x62,0x6d], [0x18,0x53,0x80,0x67,0x83,0xec,0x81,0x00])); }
function fixture(kind, scenario) { if (scenario.truncated) return Uint8Array.from(kind === "pdf" ? [0x25,0x50,0x44,0x46,0x2d] : kind === "webm" ? [0x1a,0x45,0xdf,0xa3] : [0,0,0,24,0x66,0x74,0x79,0x70]); if (kind === "pdf") return pdfBytes(); if (kind === "webm") return webmBytes(); return bmffBytes(kind === "quicktime" ? "qt  " : "isom"); }
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
console.log(JSON.stringify({ timeline, calls, redirects, error, signedUrls }));
`;

type Call = [string, unknown];
type Result = { timeline: string[]; calls: Call[]; redirects: string[]; error: string; signedUrls: string[] };
async function run(scenario: Record<string, unknown> = {}): Promise<Result> { const { stdout } = await promisify(execFile)(process.execPath, ["--import", "tsx/esm", "-e", harness, JSON.stringify(scenario)], { maxBuffer: 1024 * 1024 }); return JSON.parse(stdout.trim()); }
function call(result: Result, name: string): Record<string, unknown> { return result.calls.find(([key]) => key === name)?.[1] as Record<string, unknown>; }

test("approved admins execute the real route, repository, and storage modules", async () => {
  for (const kind of ["pdf", "mp4", "webm", "quicktime"]) {
    const result = await run({ access: "admin", kind });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=success", JSON.stringify({ kind, result }));
    assert.deepEqual(result.timeline, ["auth", "profile", "material", "form", "file", "version", "upload", "metadata"]);
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
  for (const scenario of [{ missing: true }, { extra: true }, { badId: true }, { mime: "text/plain" }, { spoof: true }, { empty: true }, { oversize: true }, { nonMaterial: true }, { truncated: true }, { kind: "webm", truncated: true }, { kind: "mp4", truncated: true }, { name: "foo/../bar.pdf" }, { name: "foo\\..\\bar.pdf" }, { name: "unsafe\u0000.pdf" }]) {
    const result = await run({ access: "admin", ...scenario });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=error");
    assert.equal(result.redirects.at(-1), "/quan-tri/catalog?upload=error");
    assert.ok(!result.timeline.includes("upload"));
    assert.ok(!result.timeline.includes("metadata"));
  }
});
test("uppercase UUIDs are canonicalized and cleanup is exact only after metadata failure", async () => {
  const success = await run({ access: "admin", uppercase: true });
  assert.equal(success.error, "REDIRECT:/quan-tri/catalog?upload=success");
  assert.equal(String(call(success, "upload").path).startsWith("materials/11111111-1111-1111-1111-111111111111/"), true);
  assert.equal(success.timeline.includes("cleanup"), false);
  const failure = await run({ access: "admin", metadataError: true });
  assert.equal(failure.error, "REDIRECT:/quan-tri/catalog?upload=error");
  assert.deepEqual(failure.timeline, ["auth", "profile", "material", "form", "file", "version", "upload", "metadata", "cleanup"]);
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
