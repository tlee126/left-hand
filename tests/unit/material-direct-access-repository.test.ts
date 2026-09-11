/** Runtime tests for the learner direct-grant batch repository query. */
import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const GRANTED_BY = "650e8400-e29b-41d4-a716-446655440000";

type Query = {
  table: string;
  filters: Array<[string, unknown]>;
  inValues: string[] | null;
  limit: number | null;
};

let queries: Query[];
let rows: Record<string, unknown>[];
let queryError: unknown;
let repository: typeof import("../../lib/repositories/material-direct-access-repository");

function uuid(index: number): string {
  return `850e8400-e29b-41d4-a716-${index.toString(16).padStart(12, "0")}`;
}

function row(materialId: string, userId = USER_ID): Record<string, unknown> {
  return {
    id: uuid(Number.parseInt(materialId.slice(-4), 16) + 1000),
    user_id: userId,
    material_id: materialId,
    can_view: true,
    can_download: materialId.endsWith("0002"),
    expires_at: materialId.endsWith("0003") ? "2027-01-01T00:00:00.000Z" : null,
    revoked_at: materialId.endsWith("0004") ? "2026-01-01T00:00:00.000Z" : null,
    granted_by: GRANTED_BY,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  };
}

function createQuery(table: string) {
  const query: Query = { table, filters: [], inValues: null, limit: null };
  queries.push(query);
  const builder: any = {
    select() { return builder; },
    eq(field: string, value: unknown) { query.filters.push([field, value]); return builder; },
    in(field: string, values: string[]) { query.filters.push([field, values]); query.inValues = [...values]; return builder; },
    order() { return builder; },
    limit(value: number) { query.limit = value; return builder; },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      if (queryError) return Promise.reject(queryError).then(resolve, reject);
      const userId = query.filters.find(([field]) => field === "user_id")?.[1];
      const materialIds = query.inValues ?? [];
      const data = rows.filter((candidate) => candidate.user_id === userId && materialIds.includes(String(candidate.material_id)));
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    }
  };
  return builder;
}

before(async () => {
  queries = [];
  rows = [];
  queryError = null;
  const moduleLoader = require("node:module") as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
  const originalLoad = moduleLoader._load;
  moduleLoader._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  const serverAdminPath = require.resolve("../../lib/supabase/server-admin");
  require.cache[serverAdminPath] = {
    id: serverAdminPath,
    filename: serverAdminPath,
    loaded: true,
    exports: { createServerAdminClient: () => ({ from: createQuery }) }
  } as any;
  try {
    repository = await import("../../lib/repositories/material-direct-access-repository");
  } finally {
    moduleLoader._load = originalLoad;
  }
});

afterEach(() => {
  queries = [];
  rows = [];
  queryError = null;
});

test("batch query filters one learner, returns only matching materials, and maps grant fields", async () => {
  const materialIds = [uuid(1).toUpperCase(), uuid(2), uuid(3), uuid(4)];
  rows = [
    row(materialIds[0].toLowerCase()),
    row(materialIds[1]),
    row(materialIds[2]),
    row(materialIds[3]),
    row(materialIds[0].toLowerCase(), OTHER_USER_ID),
    row(uuid(99))
  ];

  const result = await repository.getMaterialDirectGrantsForUserAndMaterials(USER_ID.toUpperCase(), materialIds);

  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].filters.find(([field]) => field === "user_id"), ["user_id", USER_ID]);
  assert.deepEqual(queries[0].inValues, materialIds.map((id) => id.toLowerCase()));
  assert.equal(queries[0].limit, materialIds.length + 1);
  assert.deepEqual(result.map((grant) => ({
    user_id: grant.user_id,
    material_id: grant.material_id,
    can_view: grant.can_view,
    can_download: grant.can_download,
    expires_at: grant.expires_at,
    revoked_at: grant.revoked_at
  })), [
    { user_id: USER_ID, material_id: materialIds[0].toLowerCase(), can_view: true, can_download: false, expires_at: null, revoked_at: null },
    { user_id: USER_ID, material_id: materialIds[1], can_view: true, can_download: true, expires_at: null, revoked_at: null },
    { user_id: USER_ID, material_id: materialIds[2], can_view: true, can_download: false, expires_at: "2027-01-01T00:00:00.000Z", revoked_at: null },
    { user_id: USER_ID, material_id: materialIds[3], can_view: true, can_download: false, expires_at: null, revoked_at: "2026-01-01T00:00:00.000Z" }
  ]);
});

test("more than 100 material IDs use bounded batches without N+1 queries", async () => {
  const materialIds = Array.from({ length: 205 }, (_, index) => uuid(index + 1));
  rows = materialIds.map((materialId) => row(materialId));

  const result = await repository.getMaterialDirectGrantsForUserAndMaterials(USER_ID, materialIds);

  assert.equal(result.length, materialIds.length);
  assert.equal(queries.length, 3);
  assert.deepEqual(queries.map((query) => query.inValues?.length), [100, 100, 5]);
  assert.ok(queries.every((query) => (query.inValues?.length ?? 0) <= 100));
  assert.ok(queries.every((query) => query.filters.some(([field, value]) => field === "user_id" && value === USER_ID)));
});

test("invalid UUIDs fail before database access and database errors normalize to repository errors", async () => {
  await assert.rejects(() => repository.getMaterialDirectGrantsForUserAndMaterials("not-a-uuid", []), repository.MaterialDirectAccessInputError);
  assert.equal(queries.length, 0);

  queryError = new Error("private database detail");
  await assert.rejects(
    () => repository.getMaterialDirectGrantsForUserAndMaterials(USER_ID, [uuid(1)]),
    (error: unknown) => error instanceof repository.MaterialDirectAccessRepositoryError && !(error as Error).message.includes("private database detail")
  );
});
