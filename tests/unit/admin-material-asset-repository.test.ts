import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { formatMaterialAssetByteSize } from "../../app/quan-tri/catalog/material-asset-metadata";

type MetadataRow = { product_id: unknown; version: unknown; mime_type: unknown; byte_size: unknown };
type QueryCall = { table: string; columns: string; productIds: string[]; orders: Array<[string, boolean]> };

const MATERIAL_A = "650e8400-e29b-41d4-a716-446655440000";
const MATERIAL_B = "750e8400-e29b-41d4-a716-446655440001";
const MATERIAL_C = "850e8400-e29b-41d4-a716-446655440002";
let rows: MetadataRow[] = [];
let queryCalls: QueryCall[] = [];
let queryError: unknown = null;
let scopedClientCalls = 0;
let repository: typeof import("../../lib/repositories/material-asset-repository");
let originalModuleLoad: (...args: any[]) => any;

function createClient() {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          const productIds: string[] = [];
          const orders: Array<[string, boolean]> = [];
          const query = {
            in(field: string, ids: string[]) { if (field === "product_id") productIds.push(...ids); return query; },
            order(field: string, options: { ascending: boolean }) { orders.push([field, options.ascending]); return query; },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              queryCalls.push({ table, columns, productIds: [...productIds], orders: [...orders] });
              return Promise.resolve({ data: rows, error: queryError }).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
}

before(async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => any };
  originalModuleLoad = moduleLoader._load;
  moduleLoader._load = function(request: string, ...args: unknown[]) {
    if (request === "server-only") return {};
    return originalModuleLoad.call(this, request, ...args);
  };
  const serverPath = require.resolve("../../lib/supabase/server");
  require.cache[serverPath] = {
    id: serverPath,
    filename: serverPath,
    loaded: true,
    exports: { createClient: async () => { scopedClientCalls += 1; return createClient(); } }
  } as never;
  repository = await import("../../lib/repositories/material-asset-repository");
  moduleLoader._load = originalModuleLoad;
});

beforeEach(() => {
  rows = [];
  queryCalls = [];
  queryError = null;
  scopedClientCalls = 0;
});

after(() => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => any };
  moduleLoader._load = originalModuleLoad;
});

test("admin metadata query is one batched read and maps the newest asset per material", async () => {
  rows = [
    { product_id: MATERIAL_A, version: 3, mime_type: "application/pdf", byte_size: 2048 },
    { product_id: MATERIAL_A, version: 2, mime_type: "video/mp4", byte_size: 4096 },
    { product_id: MATERIAL_B, version: 1, mime_type: "video/webm", byte_size: 8192 }
  ];

  const result = await repository.listCurrentMaterialAssetMetadata([MATERIAL_A, MATERIAL_B, MATERIAL_C]);

  assert.deepEqual(result, {
    [MATERIAL_A]: { version: 3, mimeType: "application/pdf", byteSize: 2048, mimeSupported: true, metadataComplete: true, status: "ready" },
    [MATERIAL_B]: { version: 1, mimeType: "video/webm", byteSize: 8192, mimeSupported: true, metadataComplete: true, status: "ready" }
  });
  assert.deepEqual(queryCalls, [{
    table: "material_assets",
    columns: "product_id, version, mime_type, byte_size",
    productIds: [MATERIAL_A, MATERIAL_B, MATERIAL_C],
    orders: [["version", false]]
  }]);
  assert.equal(scopedClientCalls, 1);
  assert.doesNotMatch(JSON.stringify(result), /storage_path|signed|provider|token|materials\//i);
});

test("unsupported newest MIME remains the current version and never falls back to an older asset", async () => {
  rows = [
    { product_id: MATERIAL_A, version: 8, mime_type: "application/octet-stream", byte_size: 900 },
    { product_id: MATERIAL_A, version: 7, mime_type: "application/pdf", byte_size: 800 }
  ];

  const result = await repository.listCurrentMaterialAssetMetadata([MATERIAL_A]);

  assert.deepEqual(result[MATERIAL_A], {
    version: 8,
    mimeType: "application/octet-stream",
    byteSize: 900,
    mimeSupported: false,
    metadataComplete: true,
    status: "unsupported_mime"
  });
});

test("empty catalogs return no assets and incomplete newest metadata is explicit without stale fallback", async () => {
  assert.deepEqual(await repository.listCurrentMaterialAssetMetadata([MATERIAL_A]), {});
  assert.deepEqual(queryCalls.length, 1);

  rows = [
    { product_id: MATERIAL_A, version: 5, mime_type: "application/pdf", byte_size: undefined },
    { product_id: MATERIAL_A, version: 4, mime_type: "application/pdf", byte_size: 123 }
  ];
  queryCalls = [];
  const result = await repository.listCurrentMaterialAssetMetadata([MATERIAL_A]);

  assert.deepEqual(result[MATERIAL_A], {
    version: 5,
    mimeType: "application/pdf",
    byteSize: null,
    mimeSupported: true,
    metadataComplete: false,
    status: "incomplete_metadata"
  });
});

test("unusable versions and duplicate versions fail closed instead of presenting a lower version", async () => {
  rows = [
    { product_id: MATERIAL_A, version: 4, mime_type: "application/pdf", byte_size: 400 },
    { product_id: MATERIAL_A, version: null, mime_type: "application/pdf", byte_size: 300 }
  ];
  const invalidVersion = await repository.listCurrentMaterialAssetMetadata([MATERIAL_A]);
  assert.equal(invalidVersion[MATERIAL_A]?.status, "incomplete_metadata");
  assert.equal(invalidVersion[MATERIAL_A]?.version, null);

  rows = [
    { product_id: MATERIAL_A, version: 4, mime_type: "application/pdf", byte_size: 400 },
    { product_id: MATERIAL_A, version: 4, mime_type: "video/mp4", byte_size: 300 }
  ];
  const duplicateVersion = await repository.listCurrentMaterialAssetMetadata([MATERIAL_A]);
  assert.equal(duplicateVersion[MATERIAL_A]?.status, "incomplete_metadata");
  assert.equal(duplicateVersion[MATERIAL_A]?.version, null);
});

test("database errors normalize to the generic material asset repository error", async () => {
  queryError = { message: "SQL secret=private-detail", code: "42501" };
  await assert.rejects(
    () => repository.listCurrentMaterialAssetMetadata([MATERIAL_A]),
    (error: unknown) => error instanceof repository.MaterialAssetRepositoryError && !String(error).includes("private-detail")
  );
});

test("byte-size formatting handles zero, unit boundaries, null, and abnormal values safely", () => {
  assert.equal(formatMaterialAssetByteSize(0), "0 B");
  assert.equal(formatMaterialAssetByteSize(1), "1 B");
  assert.equal(formatMaterialAssetByteSize(1024), "1 KB");
  assert.equal(formatMaterialAssetByteSize(1024 * 1024), "1 MB");
  assert.equal(formatMaterialAssetByteSize(1536), "1,5 KB");
  for (const value of [null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1, "1024"]) {
    assert.equal(formatMaterialAssetByteSize(value), null, String(value));
  }
});
