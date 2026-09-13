import assert from "node:assert/strict";
import { after, before, test } from "node:test";

type QueryRecord = { table: string; columns: string; productIds: string[]; filters: Array<[string, unknown]>; orders: Array<[string, boolean]> };
type AssetRow = { product_id: string; version: number; visibility: string; mime_type: string };

const MATERIAL_A = "650e8400-e29b-41d4-a716-446655440000";
const MATERIAL_B = "750e8400-e29b-41d4-a716-446655440001";
const MATERIAL_C = "850e8400-e29b-41d4-a716-446655440002";
const PRIVATE_PATH = `materials/${MATERIAL_A}/v3/850e8400-e29b-41d4-a716-446655440003-private.pdf`;

let rows: AssetRow[] = [];
let queryRecords: QueryRecord[] = [];
let repository: any;
let originalModuleLoad: (...args: any[]) => unknown;

function createAdminClient() {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          const productIds: string[] = [];
          const filters: Array<[string, unknown]> = [];
          const orders: Array<[string, boolean]> = [];
          const query: any = {
            in(field: string, values: string[]) { if (field === "product_id") productIds.push(...values); return query; },
            eq(field: string, value: unknown) { filters.push([field, value]); return query; },
            order(field: string, options: { ascending: boolean }) { orders.push([field, options.ascending]); return query; },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              queryRecords.push({ table, columns, productIds: [...productIds], filters: [...filters], orders: [...orders] });
              const matchingRows = rows.filter((row) => productIds.includes(row.product_id)
                && filters.every(([field, value]) => row[field as keyof AssetRow] === value));
              matchingRows.sort((left, right) => {
                for (const [field, ascending] of orders) {
                  const leftValue = left[field as keyof AssetRow];
                  const rightValue = right[field as keyof AssetRow];
                  const comparison = typeof leftValue === "number" && typeof rightValue === "number"
                    ? leftValue - rightValue
                    : String(leftValue).localeCompare(String(rightValue));
                  if (comparison !== 0) return ascending ? comparison : -comparison;
                }
                return 0;
              });
              return Promise.resolve({ data: matchingRows, error: null }).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
}

before(async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  originalModuleLoad = moduleLoader._load;
  moduleLoader._load = function(request: string, ...args: any[]) {
    if (request === "server-only") return {};
    return originalModuleLoad.call(this, request, ...args);
  };
  const setMock = (path: string, exports: Record<string, unknown>) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports } as any;
  };
  setMock(require.resolve("../../lib/supabase/server-admin"), { createServerAdminClient: createAdminClient });
  setMock(require.resolve("../../lib/supabase/server"), { createClient: () => { throw new Error("learner MIME lookup must use the server-only client"); } });
  repository = await import("../../lib/repositories/material-asset-repository");
  moduleLoader._load = originalModuleLoad;
});

after(() => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  moduleLoader._load = originalModuleLoad;
});

test("authorized learner MIME lookup returns only the newest supported private MIME values", async () => {
  rows = [
    { product_id: MATERIAL_A, version: 3, visibility: "private", mime_type: "application/pdf" },
    { product_id: MATERIAL_A, version: 2, visibility: "private", mime_type: "video/mp4" },
    { product_id: MATERIAL_B, version: 2, visibility: "private", mime_type: "application/octet-stream" },
    { product_id: MATERIAL_B, version: 1, visibility: "private", mime_type: "application/pdf" },
    { product_id: MATERIAL_C, version: 1, visibility: "private", mime_type: "video/webm" },
    { product_id: MATERIAL_A, version: 4, visibility: "public", mime_type: "video/mp4" }
  ];
  queryRecords = [];

  const result = await repository.listCurrentMaterialMimeTypesForAuthorizedProducts([MATERIAL_A, MATERIAL_B, MATERIAL_C]);

  assert.deepEqual(result, { [MATERIAL_A]: "application/pdf", [MATERIAL_C]: "video/webm" });
  assert.deepEqual(queryRecords, [{
    table: "material_assets",
    columns: "product_id, version, visibility, mime_type",
    productIds: [MATERIAL_A, MATERIAL_B, MATERIAL_C],
    filters: [["visibility", "private"]],
    orders: [["product_id", true], ["version", false]]
  }]);
  assert.doesNotMatch(JSON.stringify(result), /storage_path|original_name|signed|token|materials\//i);
  assert.doesNotMatch(JSON.stringify(queryRecords), new RegExp(PRIVATE_PATH));
});

test("empty or invalid authorized material ID sets never query private asset metadata", async () => {
  queryRecords = [];
  assert.deepEqual(await repository.listCurrentMaterialMimeTypesForAuthorizedProducts([]), {});
  await assert.rejects(
    () => repository.listCurrentMaterialMimeTypesForAuthorizedProducts(["not-a-material-id"]),
    (error: Error) => error.name === "MaterialAssetInputError"
  );
  assert.deepEqual(queryRecords, []);
});
