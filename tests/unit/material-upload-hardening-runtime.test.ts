import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, test } from "node:test";
import { BoundedJsonError, BoundedJsonErrorCode, readBoundedJson } from "../../lib/http/bounded-json";
import { getOrCreateMaterialUploadAttempt } from "../../app/quan-tri/catalog/material-upload-attempt";

const execFileAsync = promisify(execFile);
const ADMIN_A = "550e8400-e29b-41d4-a716-446655440000";
const ADMIN_B = "650e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID = "750e8400-e29b-41d4-a716-446655440000";
const RESERVATION_ID = "850e8400-e29b-41d4-a716-446655440000";
const IDEMPOTENCY_KEY = "950e8400-e29b-41d4-a716-446655440000";
const STORAGE_PATH = `materials/${PRODUCT_ID}/v1/${RESERVATION_ID}-material.pdf`;

const routeHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
const dataUrl = (source) => "data:text/javascript," + encodeURIComponent(source);
const uuid = "${ADMIN_A}";
const productId = "${PRODUCT_ID}";
const reservationId = "${RESERVATION_ID}";
const storagePath = "${STORAGE_PATH}";
globalThis.__adminId = scenario.adminId || uuid;
globalThis.__reserveCount = 0;
globalThis.__finalizeError = Boolean(scenario.finalizeError);
globalThis.__prepareCommitted = Boolean(scenario.prepareCommitted);
globalThis.__prepareConflict = Boolean(scenario.prepareConflict);
globalThis.__cancelResult = scenario.cancelResult !== false;
globalThis.__calls = [];

const authUrl = dataUrl("export async function getAccountAccess() { return { status: 'approved', user: { id: globalThis.__adminId }, profile: { role: 'admin' } }; }");
const reservation = { reservationId, productId, uploadedBy: uuid, idempotencyKey: "${IDEMPOTENCY_KEY}", storagePath, originalName: 'material.pdf', mimeType: 'application/pdf', byteSize: 5, version: 1, expiresAt: new Date(Date.now() + 3600000).toISOString(), cancelledAt: scenario.cancelledReservation ? new Date().toISOString() : null, retryableAt: null, cleanupPendingAt: scenario.cleanupPendingReservation ? new Date().toISOString() : null };
const asset = { id: "a50e8400-e29b-41d4-a716-446655440000", product_id: productId, uploaded_by: uuid, upload_reservation_id: reservationId, upload_idempotency_key: "${IDEMPOTENCY_KEY}", storage_path: storagePath, original_name: 'material.pdf', mime_type: 'application/pdf', byte_size: 5, version: 1, visibility: 'private', created_at: '', updated_at: '' };
const repoUrl = dataUrl(
  "export class MaterialAssetUploadConflictError extends Error {}\n" +
  "export async function isMaterialProduct() { globalThis.__calls.push('material'); return true; }\n" +
  "export async function reserveMaterialAssetUpload(input) { globalThis.__calls.push('reserve:' + input.idempotencyKey); if (globalThis.__prepareConflict) throw new MaterialAssetUploadConflictError(); const isNew = globalThis.__reserveCount++ === 0; return { reservationId: '" + reservationId + "', version: 1, status: globalThis.__prepareCommitted ? 'committed' : 'reserved', isNew, retryable: false, cleanupPending: false, storagePath: '" + storagePath + "' }; }\n" +
  "export async function getMaterialAssetUploadReservation() { globalThis.__calls.push('reservation'); return !" + Boolean(scenario.missingReservation) + " && (globalThis.__adminId === '" + uuid + "' || " + Boolean(scenario.exposeReservation) + ") ? " + JSON.stringify(reservation) + " : null; }\n" +
  "export async function getMaterialAssetByUploadReservation(id, owner) { globalThis.__calls.push('existing:' + owner); return " + Boolean(scenario.committedAsset) + " && owner === '" + uuid + "' ? " + JSON.stringify(asset) + " : null; }\n" +
  "export async function finalizeMaterialAssetUpload() { globalThis.__calls.push('finalize'); if (globalThis.__finalizeError) throw new Error('rpc'); return " + JSON.stringify(asset) + "; }\n" +
  "export async function releaseMaterialAssetUpload() { globalThis.__calls.push('release'); }\n" +
  "export async function markMaterialAssetUploadCancelled() { globalThis.__calls.push('cancelled'); return globalThis.__cancelResult; }\n" +
  "export async function markMaterialAssetUploadRetryable() { globalThis.__calls.push('retryable'); return true; }\n" +
  "export async function beginMaterialAssetUploadRetryCleanup() { globalThis.__calls.push('begin-retry-cleanup'); return " + (scenario.beginCleanup !== false ? "true" : "false") + "; }\n" +
  "export async function completeMaterialAssetUploadRetryCleanup() { globalThis.__calls.push('complete-retry-cleanup'); return " + (scenario.completeCleanup !== false ? "true" : "false") + "; }"
);
const storageUrl = dataUrl(
  "export const MATERIALS_BUCKET = 'materials'; export const MATERIAL_UPLOAD_EXPIRES_IN_SECONDS = 7200;\n" +
  "export function isSupportedMaterialMimeType(v) { return v === 'application/pdf'; }\n" +
  "export function isValidMaterialUuid(v) { return typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v); }\n" +
  "export function materialSizeLimit() { return 20971520; }\n" +
  "export function sanitizeMaterialFilename() { return 'material.pdf'; }\n" +
  "export function isValidMaterialStoragePathForProductAndVersion() { return true; }\n" +
  "export async function createMaterialUploadCapability(path) { if (" + Boolean(scenario.capabilityFailure) + ") throw new Error('capability'); return { storagePath: path, token: 'token' }; }\n" +
  "export async function inspectMaterialObject(path, mime, size) { globalThis.__calls.push('inspect'); if (" + Boolean(scenario.inspectFailure) + ") throw new Error('inspection'); return { storagePath: path, mimeType: mime, byteSize: size }; }\n" +
  "export async function removeNewMaterialObject() { globalThis.__calls.push('remove'); if (" + Boolean(scenario.removeFailure) + ") throw new Error('storage'); }"
);
const boundedSource = await readFile(path.resolve(process.cwd(), "lib/http/bounded-json.ts"), "utf8");
const boundedUrl = dataUrl((await transform(boundedSource, { loader: "ts", format: "esm" })).code);
async function compile(file) {
  let source = await readFile(path.resolve(process.cwd(), file), "utf8");
  for (const [from, to] of [
    ["@/lib/auth/session", authUrl],
    ["@/lib/http/bounded-json", boundedUrl],
    ["@/lib/repositories/material-asset-repository", repoUrl],
    ["@/lib/storage/material-storage", storageUrl]
  ]) source = source.replaceAll(from, to);
  return (await transform(source, { loader: "ts", format: "esm", sourcefile: file })).code;
}
const routes = {};
for (const [name, file] of Object.entries({
  prepare: "app/api/admin/materials/[id]/upload/prepare/route.ts",
  finalize: "app/api/admin/materials/[id]/upload/finalize/route.ts",
  cancel: "app/api/admin/materials/[id]/upload/cancel/route.ts"
})) routes[name] = await import(dataUrl(await compile(file)));

function request(body, contentLength) {
  const headers = new Headers({ "content-type": "application/json" });
  if (contentLength !== undefined) headers.set("content-length", contentLength);
  const init = { method: "POST", headers, body, duplex: "half" };
  return new Request("https://example.test/api/upload", init);
}
function bodyFor(value) {
  if (value === "oversized") return new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(40000)); controller.close(); } });
  return value;
}
const results = [];
for (const item of scenario.calls || [{ route: scenario.route, adminId: scenario.adminId, body: scenario.body, contentLength: scenario.contentLength }]) {
  globalThis.__adminId = item.adminId || uuid;
  const route = routes[item.route];
  const response = await route.POST(request(bodyFor(item.body), item.contentLength), { params: Promise.resolve({ id: productId }) });
  results.push({ status: response.status, body: await response.json() });
}
console.log(JSON.stringify({ results, calls: globalThis.__calls }));
`;

async function runRoute(calls: unknown[], options: Record<string, unknown> = {}): Promise<{ results: Array<{ status: number; body: unknown }>; calls: string[] }> {
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx/esm", "-e", routeHarness, JSON.stringify({ calls, ...options })], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim()) as { results: Array<{ status: number; body: unknown }>; calls: string[] };
}

const cleanupHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";
const scenario = JSON.parse(process.argv[1]);
process.env.CRON_SECRET = "test-cron-secret";
globalThis.__calls = [];
globalThis.__claimCount = 0;
globalThis.__completionCount = 0;
globalThis.__removeCount = 0;
globalThis.__completed = false;
const dataUrl = (source) => "data:text/javascript," + encodeURIComponent(source);
const claimRows = JSON.stringify(scenario.claimRows ?? [{ reservationId: '850e8400-e29b-41d4-a716-446655440000', claimId: '950e8400-e29b-41d4-a716-446655440000', storagePath: 'materials/750e8400-e29b-41d4-a716-446655440000/v1/850e8400-e29b-41d4-a716-446655440000-material.pdf' }]);
const completionOverride = Object.prototype.hasOwnProperty.call(scenario, 'completionValue') ? JSON.stringify(scenario.completionValue) : null;
const repoUrl = dataUrl(
  "export async function claimExpiredMaterialAssetUploads() { globalThis.__calls.push('claim'); globalThis.__claimCount++; return (" + (scenario.noClaims ? "true" : "false") + " || globalThis.__completed || (" + (scenario.repeatEmpty ? "globalThis.__claimCount > 1" : "false") + ")) ? [] : " + claimRows + "; }\n" +
  "export async function completeExpiredMaterialAssetUploadCleanup() { globalThis.__calls.push('complete'); globalThis.__completionCount++; if (" + Boolean(scenario.completionError) + ") throw new Error('db'); if (" + (completionOverride ? "true" : "false") + ") return " + (completionOverride ?? "null") + "; if (" + Boolean(scenario.completionFalse) + " && !(" + Boolean(scenario.completionFalseOnce) + " && globalThis.__completionCount > 1) ) return false; globalThis.__completed = true; return true; }\n" +
  "export async function releaseExpiredMaterialAssetUploadCleanup() { globalThis.__calls.push('release'); return true; }"
);
const storageUrl = dataUrl("export async function removeNewMaterialObject() { globalThis.__calls.push('remove'); globalThis.__removeCount++; if (" + Boolean(scenario.storageFailure) + " || (Array.isArray(" + JSON.stringify(scenario.storageFailures ?? null) + ") && " + JSON.stringify(scenario.storageFailures ?? null) + "[globalThis.__removeCount - 1] === true)) throw new Error('storage'); }");
let source = await readFile(path.resolve(process.cwd(), "app/api/internal/cron/material-upload-cleanup/route.ts"), "utf8");
source = source.replaceAll("@/lib/repositories/material-asset-repository", repoUrl).replaceAll("@/lib/storage/material-storage", storageUrl);
const route = await import(dataUrl((await transform(source, { loader: "ts", format: "esm" })).code));
const results = [];
for (const authorized of scenario.authorized ?? [true]) {
  const headers = authorized ? { authorization: "Bearer test-cron-secret" } : {};
  const response = await route.POST(new Request("https://example.test/api/internal/cron/material-upload-cleanup", { method: "POST", headers }));
  results.push({ status: response.status, body: await response.json() });
}
console.log(JSON.stringify({ results, calls: globalThis.__calls }));
`;

async function runCleanup(scenario: Record<string, unknown>): Promise<{ results: Array<{ status: number; body: unknown }>; calls: string[] }> {
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx/esm", "-e", cleanupHarness, JSON.stringify(scenario)], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim()) as { results: Array<{ status: number; body: unknown }>; calls: string[] };
}

const inspectHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";
const scenario = JSON.parse(process.argv[1]);
const dataUrl = (source) => "data:text/javascript," + encodeURIComponent(source);
const constantsUrl = dataUrl("export const MATERIALS_BUCKET = 'materials'; export const MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS = 300; export const MATERIAL_UPLOAD_EXPIRES_IN_SECONDS = 7200; export const MAX_PDF_BYTES = 20971520; export const MAX_VIDEO_BYTES = 524288000; export const SUPPORTED_MATERIAL_MIME_TYPES = ['application/pdf','video/mp4','video/webm','video/quicktime'];");
const adminUrl = dataUrl("export function createServerAdminClient() { return { storage: { from() { return { async info() { return { data: { size: " + Number(scenario.size ?? 8) + ", contentType: " + JSON.stringify(scenario.providerMime ?? 'application/pdf') + " }, error: null }; }, async createSignedUrl() { return { data: { signedUrl: 'https://storage.example.test/object' }, error: null }; } }; } } }; }");
const serverUrl = dataUrl("export async function createClient() { throw new Error('unexpected'); }");
let source = await readFile(path.resolve(process.cwd(), "lib/storage/material-storage.ts"), "utf8");
source = source.replaceAll('server-only', dataUrl('export default {};')).replaceAll('@/lib/supabase/server-admin', adminUrl).replaceAll('@/lib/supabase/server', serverUrl).replaceAll('./material-upload-constants', constantsUrl);
globalThis.fetch = async () => new Response(Uint8Array.from(scenario.prefix), { status: 206 });
const storage = await import(dataUrl((await transform(source, { loader: "ts", format: "esm" })).code));
try {
  const result = await storage.inspectMaterialObject('materials/750e8400-e29b-41d4-a716-446655440000/v1/850e8400-e29b-41d4-a716-446655440000-material.pdf', scenario.expectedMime ?? 'application/pdf', Number(scenario.size ?? 8));
  console.log(JSON.stringify({ ok: true, result }));
} catch {
  console.log(JSON.stringify({ ok: false }));
}
`;

async function runInspect(scenario: Record<string, unknown>): Promise<{ ok: boolean }> {
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx/esm", "-e", inspectHarness, JSON.stringify(scenario)], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim()) as { ok: boolean };
}

describe("direct material upload hardening runtime", () => {
  test("client upload attempts reuse the key only for the same immutable file identity", () => {
    const identity = { productId: PRODUCT_ID, originalName: "material.pdf", mimeType: "application/pdf", byteSize: 5 };
    const first = getOrCreateMaterialUploadAttempt(null, identity, () => IDEMPOTENCY_KEY);
    const retry = getOrCreateMaterialUploadAttempt(first, identity, () => "a50e8400-e29b-41d4-a716-446655440000");
    const changed = getOrCreateMaterialUploadAttempt(first, { ...identity, byteSize: 6 }, () => "a50e8400-e29b-41d4-a716-446655440000");
    assert.equal(retry.idempotencyKey, IDEMPOTENCY_KEY);
    assert.equal(changed.idempotencyKey, "a50e8400-e29b-41d4-a716-446655440000");
  });

  test("prepare retries reuse one idempotency key and committed prepare skips a second storage upload", async () => {
    const body = JSON.stringify({ originalName: "material.pdf", mimeType: "application/pdf", byteSize: 5, idempotencyKey: IDEMPOTENCY_KEY });
    const retried = await runRoute([
      { route: "prepare", adminId: ADMIN_A, body },
      { route: "prepare", adminId: ADMIN_A, body }
    ]);
    assert.deepEqual(retried.results.map((item) => item.status), [200, 200]);
    assert.deepEqual(retried.results.map((item) => (item.body as { reservationId?: string; version?: number; status?: string }).reservationId), [RESERVATION_ID, RESERVATION_ID]);
    assert.deepEqual(retried.results.map((item) => (item.body as { version?: number }).version), [1, 1]);
    assert.deepEqual(retried.calls.filter((call) => call.startsWith("reserve:")), [`reserve:${IDEMPOTENCY_KEY}`, `reserve:${IDEMPOTENCY_KEY}`]);

    const committed = await runRoute([{ route: "prepare", adminId: ADMIN_A, body }], { prepareCommitted: true });
    assert.equal((committed.results[0].body as { status?: string }).status, "committed");

    const conflict = await runRoute([{ route: "prepare", adminId: ADMIN_A, body: JSON.stringify({ originalName: "other.pdf", mimeType: "application/pdf", byteSize: 5, idempotencyKey: IDEMPOTENCY_KEY }) }], { prepareConflict: true });
    assert.equal(conflict.results[0].status, 409);
    assert.deepEqual(conflict.results[0].body, { error: "Material upload is not available." });
  });

  test("same-admin duplicate finalize is idempotent and foreign admin replay is rejected", async () => {
    const result = await runRoute([
      { route: "finalize", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID, idempotencyKey: IDEMPOTENCY_KEY }) },
      { route: "finalize", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID, idempotencyKey: IDEMPOTENCY_KEY }) },
      { route: "finalize", adminId: ADMIN_B, body: JSON.stringify({ reservationId: RESERVATION_ID, idempotencyKey: IDEMPOTENCY_KEY }) }
    ]);
    assert.deepEqual(result.results.map((item) => item.status), [200, 200, 409]);
    assert.equal(result.calls.filter((call) => call === "finalize").length, 2);
    assert.equal(result.calls.filter((call) => call === `existing:${ADMIN_B}`).length, 1);
  });

  test("cancel cannot delete a reservation owned by another admin", async () => {
    const result = await runRoute([{ route: "cancel", adminId: ADMIN_B, body: JSON.stringify({ reservationId: RESERVATION_ID }) }]);
    assert.deepEqual(result.results.map((item) => item.status), [404]);
    assert.equal(result.calls.includes(`existing:${ADMIN_B}`), true);
    assert.equal(result.calls.includes("remove"), false);
  });

  test("cancel rejects a foreign terminal reservation even if a repository row is exposed", async () => {
    const result = await runRoute([{ route: "cancel", adminId: ADMIN_B, body: JSON.stringify({ reservationId: RESERVATION_ID }) }], { exposeReservation: true, cancelledReservation: true });
    assert.deepEqual(result.results.map((item) => item.status), [404]);
    assert.deepEqual(result.results[0].body, { error: "Material upload is not available." });
    assert.equal(result.calls.includes("cancelled"), false);
    assert.equal(result.calls.includes("remove"), false);
  });

  test("a finalize RPC failure never deletes an object that may already be committed", async () => {
    const result = await runRoute([{ route: "finalize", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID, idempotencyKey: IDEMPOTENCY_KEY }) }], { finalizeError: true });
    assert.deepEqual(result.results.map((item) => item.status), [500]);
    assert.equal(result.calls.includes("remove"), false);
  });

  test("pre-commit inspection failure preserves the reservation and reuses its server path", async () => {
    const body = JSON.stringify({ originalName: "material.pdf", mimeType: "application/pdf", byteSize: 5, idempotencyKey: IDEMPOTENCY_KEY });
    const finalizeBody = JSON.stringify({ reservationId: RESERVATION_ID, idempotencyKey: IDEMPOTENCY_KEY });
    const result = await runRoute([
      { route: "finalize", adminId: ADMIN_A, body: finalizeBody },
      { route: "prepare", adminId: ADMIN_A, body }
    ], { inspectFailure: true });
    assert.deepEqual(result.results.map((item) => item.status), [500, 200]);
    assert.deepEqual(result.calls.slice(0, 5), ["reservation", "inspect", "begin-retry-cleanup", "remove", "complete-retry-cleanup"]);
    assert.equal(result.calls.includes("release"), false);
    assert.deepEqual(result.results[1].body, {
      reservationId: RESERVATION_ID,
      version: 1,
      status: "reserved",
      upload: { bucket: "materials", path: STORAGE_PATH, token: "token" },
      expiresIn: 7200
    });
  });

  test("object deletion failure leaves cleanup pending and never releases the reservation", async () => {
    const result = await runRoute([{ route: "finalize", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID, idempotencyKey: IDEMPOTENCY_KEY }) }], { inspectFailure: true, removeFailure: true });
    assert.equal(result.results[0].status, 500);
    assert.deepEqual(result.calls, ["reservation", "inspect", "begin-retry-cleanup", "remove"]);
    assert.equal(result.calls.includes("release"), false);
    assert.equal(result.calls.includes("complete-retry-cleanup"), false);
  });

  test("a concurrent finalize that cannot begin cleanup never deletes the exact path", async () => {
    const result = await runRoute([{ route: "finalize", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID, idempotencyKey: IDEMPOTENCY_KEY }) }], { inspectFailure: true, beginCleanup: false });
    assert.equal(result.results[0].status, 500);
    assert.deepEqual(result.calls, ["reservation", "inspect", "begin-retry-cleanup"]);
    assert.equal(result.calls.includes("remove"), false);
  });

  test("prepare capability failure marks a new reservation retryable instead of releasing it", async () => {
    const result = await runRoute([{ route: "prepare", adminId: ADMIN_A, body: JSON.stringify({ originalName: "material.pdf", mimeType: "application/pdf", byteSize: 5, idempotencyKey: IDEMPOTENCY_KEY }) }], { capabilityFailure: true });
    assert.equal(result.results[0].status, 500);
    assert.equal(result.calls.includes("retryable"), true);
    assert.equal(result.calls.includes("release"), false);
  });

  test("cancel after commit is a generic conflict and does not mutate storage", async () => {
    const result = await runRoute([{ route: "cancel", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID }) }], { committedAsset: true, missingReservation: true });
    assert.equal(result.results[0].status, 409);
    assert.deepEqual(result.results[0].body, { error: "Material upload is not available." });
    assert.equal(result.calls.includes("cancelled"), false);
    assert.equal(result.calls.includes("remove"), false);
  });

  test("owner retry of a terminal canceled reservation is idempotent", async () => {
    const result = await runRoute([
      { route: "cancel", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID }) },
      { route: "cancel", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID }) }
    ], { cancelledReservation: true });
    assert.deepEqual(result.results.map((item) => item.status), [200, 200]);
    assert.equal(result.calls.includes("cancelled"), false);
    assert.equal(result.calls.includes("remove"), false);
  });

  test("owner cancellation transitions the reservation and removes only its exact object", async () => {
    const result = await runRoute([{ route: "cancel", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID }) }]);
    assert.equal(result.results[0].status, 200);
    assert.deepEqual(result.calls, ["reservation", "cancelled", "remove"]);
  });

  test("cancel leaves a cleanup-pending reservation to the database cleanup state machine", async () => {
    const result = await runRoute([{ route: "cancel", adminId: ADMIN_A, body: JSON.stringify({ reservationId: RESERVATION_ID }) }], { cleanupPendingReservation: true });
    assert.equal(result.results[0].status, 409);
    assert.deepEqual(result.results[0].body, { error: "Material upload is not available." });
    assert.equal(result.calls.includes("cancelled"), false);
    assert.equal(result.calls.includes("remove"), false);
  });

  test("all three exported routes reject malformed and oversized JSON", async () => {
    const result = await runRoute([
      { route: "prepare", body: "{" },
      { route: "finalize", body: "{" },
      { route: "cancel", body: "{" },
      { route: "prepare", body: JSON.stringify({}), contentLength: "999999" },
      { route: "finalize", body: JSON.stringify({}), contentLength: "999999" },
      { route: "cancel", body: JSON.stringify({}), contentLength: "999999" },
      { route: "prepare", body: JSON.stringify({}), contentLength: "99999999999999999999999" },
      { route: "prepare", body: "oversized" },
      { route: "finalize", body: "oversized" },
      { route: "cancel", body: "oversized" },
      { route: "prepare", body: JSON.stringify({}), contentLength: "1.5" }
    ]);
    assert.deepEqual(result.results.map((item) => item.status), [400, 400, 400, 413, 413, 413, 413, 413, 413, 413, 400]);
    assert.equal(result.calls.some((call) => call === "reserve" || call === "reservation" || call === "existing:"), false);
  });

  test("content validators accept supported signatures and reject arbitrary bytes", async () => {
    assert.equal((await runInspect({ prefix: [37, 80, 68, 70, 45], size: 8 })).ok, true);
    assert.equal((await runInspect({ prefix: [0, 1, 2, 3, 4], size: 8 })).ok, false);
    assert.equal((await runInspect({ expectedMime: "video/webm", providerMime: "video/webm", prefix: [0x1a, 0x45, 0xdf, 0xa3], size: 8 })).ok, true);
    assert.equal((await runInspect({ expectedMime: "video/webm", providerMime: "video/webm", prefix: [0, 1, 2, 3], size: 8 })).ok, false);
    const mp4 = Uint8Array.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0, 0, 0, 0]);
    const quickTime = Uint8Array.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal((await runInspect({ expectedMime: "video/mp4", providerMime: "video/mp4", prefix: Array.from(mp4), size: 20 })).ok, true);
    assert.equal((await runInspect({ expectedMime: "video/quicktime", providerMime: "video/quicktime", prefix: Array.from(quickTime), size: 20 })).ok, true);
    assert.equal((await runInspect({ expectedMime: "video/mp4", providerMime: "video/mp4", prefix: Array.from(new Uint8Array(20)), size: 20 })).ok, false);
    assert.equal((await runInspect({ expectedMime: "video/mp4", providerMime: "video/mp4", prefix: Array.from(quickTime), size: 20 })).ok, false);
  });

  test("bounded reader handles missing length, malformed JSON, and chunked overflow", async () => {
    const small = new Request("https://example.test", { method: "POST", body: JSON.stringify({ reservationId: RESERVATION_ID }) });
    assert.deepEqual(await readBoundedJson(small, 1024), { reservationId: RESERVATION_ID });
    const malformed = new Request("https://example.test", { method: "POST", body: "{" });
    await assert.rejects(() => readBoundedJson(malformed, 1024), (error: unknown) => error instanceof BoundedJsonError && error.code === BoundedJsonErrorCode.Malformed);
    const oversized = new Request("https://example.test", { method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1025)); controller.close(); } }), duplex: "half" } as RequestInit);
    await assert.rejects(() => readBoundedJson(oversized, 1024), (error: unknown) => error instanceof BoundedJsonError && error.code === BoundedJsonErrorCode.TooLarge);
  });

  test("cleanup route is internal, idempotent, and retryable after storage failure", async () => {
    const unauthorized = await runCleanup({ authorized: [false] });
    assert.deepEqual(unauthorized.results.map((item) => item.status), [404]);
    assert.deepEqual(unauthorized.calls, []);

    const successful = await runCleanup({ authorized: [true, true], repeatEmpty: true });
    assert.deepEqual(successful.results.map((item) => item.status), [200, 200]);
    assert.deepEqual(successful.calls, ["claim", "remove", "complete", "claim"]);

    const failed = await runCleanup({ authorized: [true], storageFailure: true });
    assert.deepEqual(failed.results.map((item) => item.status), [500]);
    assert.deepEqual(failed.calls, ["claim", "remove", "release"]);

    const finalized = await runCleanup({ authorized: [true], noClaims: true });
    assert.deepEqual(finalized.results.map((item) => item.status), [200]);
    assert.deepEqual(finalized.calls, ["claim"]);
  });

  test("cleanup completion false or throw is never counted and the claim is retryable", async () => {
    const incomplete = await runCleanup({ authorized: [true], completionFalse: true });
    assert.deepEqual(incomplete.results.map((item) => item.status), [500]);
    assert.deepEqual(incomplete.results[0].body, { success: false, cleaned: 0, failed: 1 });
    assert.deepEqual(incomplete.calls, ["claim", "remove", "complete", "release"]);

    const thrown = await runCleanup({ authorized: [true], completionError: true });
    assert.deepEqual(thrown.results.map((item) => item.status), [500]);
    assert.deepEqual(thrown.results[0].body, { success: false, cleaned: 0, failed: 1 });
    assert.deepEqual(thrown.calls, ["claim", "remove", "complete", "release"]);

    const retried = await runCleanup({ authorized: [true, true], completionFalse: true, completionFalseOnce: true });
    assert.deepEqual(retried.results.map((item) => item.status), [500, 200]);
    assert.deepEqual(retried.results.map((item) => item.body), [{ success: false, cleaned: 0, failed: 1 }, { success: true, cleaned: 1, failed: 0 }]);
    assert.deepEqual(retried.calls, ["claim", "remove", "complete", "release", "claim", "remove", "complete"]);
  });

  test("cleanup null and malformed completion results are failures, not cleaned items", async () => {
    for (const completionValue of [null, { completed: true }]) {
      const result = await runCleanup({ authorized: [true], completionValue });
      assert.deepEqual(result.results[0].body, { success: false, cleaned: 0, failed: 1 });
      assert.deepEqual(result.calls, ["claim", "remove", "complete", "release"]);
    }
  });

  test("cleanup reports partial batch results without mixing successful and retryable items", async () => {
    const result = await runCleanup({
      authorized: [true],
      claimRows: [
        { reservationId: RESERVATION_ID, claimId: IDEMPOTENCY_KEY, storagePath: STORAGE_PATH },
        { reservationId: "a50e8400-e29b-41d4-a716-446655440000", claimId: "b50e8400-e29b-41d4-a716-446655440000", storagePath: `materials/${PRODUCT_ID}/v2/a50e8400-e29b-41d4-a716-446655440000-material.pdf` }
      ],
      storageFailures: [false, true]
    });
    assert.equal(result.results[0].status, 500);
    assert.deepEqual(result.results[0].body, { success: false, cleaned: 1, failed: 1 });
    assert.deepEqual(result.calls, ["claim", "remove", "complete", "remove", "release"]);
  });

  test("finalization inspection rejects provider/content mismatches without reading a full object", async () => {
    assert.equal((await runInspect({ prefix: [37, 80, 68, 70, 45], size: 8 })).ok, true);
    assert.equal((await runInspect({ prefix: [0, 1, 2, 3, 4], size: 8 })).ok, false);
    assert.equal((await runInspect({ prefix: [37, 80, 68, 70, 45], size: 8, providerMime: "application/octet-stream" })).ok, false);
    assert.equal((await runInspect({ prefix: Array.from({ length: 4097 }, () => 0), size: 4097 })).ok, false);
  });
});
