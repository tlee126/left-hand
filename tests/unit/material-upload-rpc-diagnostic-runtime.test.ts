import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const PRODUCT_ID = "750e8400-e29b-41d4-a716-446655440000";
const IDEMPOTENCY_KEY = "950e8400-e29b-41d4-a716-446655440000";

test("material upload diagnostics are emitted immediately before the real RPC", async () => {
  const harness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const source = await readFile(path.resolve(process.cwd(), "lib/repositories/material-asset-repository.ts"), "utf8");
const client = { rpc(name, args) { globalThis.__timeline.push({ kind: "rpc", name, args }); return Promise.resolve({ data: { status: "conflict" }, error: null }); } };
const serverUrl = "data:text/javascript," + encodeURIComponent("export async function createClient() { return globalThis.__client; }");
const adminUrl = "data:text/javascript," + encodeURIComponent("export function createServerAdminClient() { throw new Error('unexpected service-role client'); }");
const storageUrl = "data:text/javascript," + encodeURIComponent("export function isSupportedMaterialMimeType() { return true; } export function isValidMaterialStoragePathForProduct() { return true; } export function isValidMaterialStoragePathForProductAndVersion() { return true; } export function isValidMaterialUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value); } export function materialSizeLimit() { return 20971520; } export function sanitizeMaterialFilename() { return '03-project-test-plan.pdf'; }");
const code = source
  .replace('import "server-only";', '')
  .replaceAll("@/lib/supabase/server-admin", adminUrl)
  .replaceAll("@/lib/supabase/server", serverUrl)
  .replaceAll("@/lib/storage/material-storage", storageUrl);
globalThis.__client = client;
globalThis.__timeline = [];
console.info = (...args) => globalThis.__timeline.push({ kind: "log", args });
console.error = (...args) => globalThis.__timeline.push({ kind: "error", args });
const module = await import("data:text/javascript," + encodeURIComponent((await transform(code, { loader: "ts", format: "esm" })).code));
try {
  await module.reserveMaterialAssetUpload({ productId: "${PRODUCT_ID}", originalName: "03-Project Test Plan.pdf", safeFilename: "03-project-test-plan.pdf", mimeType: "application/pdf", byteSize: 87133, idempotencyKey: "${IDEMPOTENCY_KEY}" }, client, "request-123");
} catch {}
console.log(JSON.stringify(globalThis.__timeline));
`;
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx/esm", "-e", harness], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  const timeline = JSON.parse(stdout.trim()) as Array<{ kind: string; name?: string; args?: unknown[]; } & Record<string, unknown>>;
  assert.equal(timeline[0]?.kind, "log");
  assert.equal(timeline[1]?.kind, "log");
  assert.equal(timeline[2]?.kind, "rpc");
  assert.equal(timeline[2]?.name, "reserve_material_asset_upload");
  assert.deepEqual(timeline[0]?.args?.[0], {
    field: "p_original_name",
    valueJson: JSON.stringify("03-Project Test Plan.pdf"),
    characterLength: 24,
    utf8ByteLength: 24,
    utf8BytesHex: "30332d50726f6a656374205465737420506c616e2e706466",
    databaseRegexValid: true,
    correlationId: "request-123",
    VERCEL_GIT_COMMIT_SHA: "unknown"
  });
  assert.deepEqual(timeline[1]?.args?.[0], {
    field: "p_safe_filename",
    valueJson: JSON.stringify("03-project-test-plan.pdf"),
    characterLength: 24,
    utf8ByteLength: 24,
    utf8BytesHex: "30332d70726f6a6563742d746573742d706c616e2e706466",
    databaseRegexValid: true,
    correlationId: "request-123",
    VERCEL_GIT_COMMIT_SHA: "unknown"
  });
  assert.deepEqual(timeline[2]?.args, {
    p_product_id: PRODUCT_ID,
    p_original_name: "03-Project Test Plan.pdf",
    p_safe_filename: "03-project-test-plan.pdf",
    p_mime_type: "application/pdf",
    p_byte_size: 87133,
    p_idempotency_key: IDEMPOTENCY_KEY
  });
});
