/** Runtime unit tests for the server-side product entitlement repository. */

import assert from "node:assert/strict";
import { test, describe, before, afterEach } from "node:test";
import * as fs from "node:fs/promises";

let getActiveProductEntitlement: any;
let grantProductEntitlement: any;
let revokeProductEntitlement: any;
let ProductEntitlementInputError: any;
let ProductEntitlementRepositoryError: any;
let PRODUCT_ENTITLEMENT_SELECT: string;

let mockClientInstance: any = null;
let mockCreateClientError: unknown = null;
let mockCreateClientCalls = 0;

before(async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  const originalModuleLoad = moduleLoader._load;
  moduleLoader._load = function(request: string, ...args: any[]) {
    if (request === "server-only") return {};
    return originalModuleLoad.call(this, request, ...args);
  };
  const serverPath = require.resolve("../../lib/supabase/server");
  try { require(serverPath); } catch {}
  require.cache[serverPath] = {
    id: serverPath,
    filename: serverPath,
    loaded: true,
    exports: {
      createClient: async () => {
        mockCreateClientCalls += 1;
        if (mockCreateClientError) throw mockCreateClientError;
        return mockClientInstance;
      }
    }
  } as any;

  const repository = await import("../../lib/repositories/product-entitlement-repository");
  getActiveProductEntitlement = repository.getActiveProductEntitlement;
  grantProductEntitlement = repository.grantProductEntitlement;
  revokeProductEntitlement = repository.revokeProductEntitlement;
  ProductEntitlementInputError = repository.ProductEntitlementInputError;
  ProductEntitlementRepositoryError = repository.ProductEntitlementRepositoryError;
  PRODUCT_ENTITLEMENT_SELECT = repository.PRODUCT_ENTITLEMENT_SELECT;
  moduleLoader._load = originalModuleLoad;
});

afterEach(() => {
  mockClientInstance = null;
  mockCreateClientError = null;
  mockCreateClientCalls = 0;
});

interface MockQueryCall {
  method: string;
  args: unknown[];
}

function createMockClient(options?: {
  queryData?: unknown;
  queryError?: unknown;
  authUserId?: string | null;
  authError?: unknown;
}) {
  const calls: MockQueryCall[] = [];
  const queryBuilder: any = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return queryBuilder;
    },
    insert: (...args: unknown[]) => {
      calls.push({ method: "insert", args });
      return queryBuilder;
    },
    update: (...args: unknown[]) => {
      calls.push({ method: "update", args });
      return queryBuilder;
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return queryBuilder;
    },
    maybeSingle: async () => {
      calls.push({ method: "maybeSingle", args: [] });
      return options?.queryError
        ? { data: null, error: options.queryError }
        : { data: options?.queryData ?? null, error: null };
    },
    single: async () => {
      calls.push({ method: "single", args: [] });
      return options?.queryError
        ? { data: null, error: options.queryError }
        : { data: options?.queryData ?? null, error: null };
    }
  };
  const client = {
    calls,
    auth: {
      getUser: async () => ({
        data: { user: options?.authUserId === null ? null : { id: options?.authUserId ?? ADMIN_ID } },
        error: options?.authError ?? null
      })
    },
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return queryBuilder;
    }
  };
  mockClientInstance = client;
  return client;
}

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID = "650e8400-e29b-41d4-a716-446655440000";
const ADMIN_ID = "750e8400-e29b-41d4-a716-446655440000";
const BASE_ROW = {
  id: "850e8400-e29b-41d4-a716-446655440000",
  user_id: USER_ID,
  product_id: PRODUCT_ID,
  status: "active",
  granted_at: "2026-09-01T10:00:00.000Z",
  expires_at: null,
  revoked_at: null,
  granted_by: ADMIN_ID,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z"
};

describe("Task 5.2-C0: product entitlement repository", () => {
  test("returns a currently active entitlement with explicit typed columns", async () => {
    const client = createMockClient({ queryData: BASE_ROW });
    assert.deepStrictEqual(await getActiveProductEntitlement(USER_ID, PRODUCT_ID), BASE_ROW);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "from")?.args, ["product_entitlements"]);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "select")?.args, [PRODUCT_ENTITLEMENT_SELECT]);
    assert.deepStrictEqual(
      client.calls.filter((call) => call.method === "eq").map((call) => call.args),
      [["user_id", USER_ID], ["product_id", PRODUCT_ID], ["status", "active"]]
    );
  });

  test("returns null for expired or revoked rows", async () => {
    createMockClient({ queryData: { ...BASE_ROW, expires_at: "2020-01-01T00:00:00.000Z" } });
    assert.strictEqual(await getActiveProductEntitlement(USER_ID, PRODUCT_ID), null);

    createMockClient({ queryData: { ...BASE_ROW, status: "revoked", revoked_at: "2026-09-02T00:00:00.000Z" } });
    assert.strictEqual(await getActiveProductEntitlement(USER_ID, PRODUCT_ID), null);
  });

  test("returns null when no entitlement row exists", async () => {
    createMockClient({ queryData: null });
    assert.strictEqual(await getActiveProductEntitlement(USER_ID, PRODUCT_ID), null);
  });

  test("rejects invalid UUIDs before creating or querying the database", async () => {
    for (const operation of [
      () => getActiveProductEntitlement("not-a-uuid", PRODUCT_ID),
      () => getActiveProductEntitlement(USER_ID, "not-a-uuid"),
      () => revokeProductEntitlement("not-a-uuid", PRODUCT_ID),
      () => grantProductEntitlement({ userId: USER_ID, productId: "not-a-uuid" }),
      () => grantProductEntitlement({ userId: USER_ID, productId: PRODUCT_ID, expiresAt: "not-a-date" })
    ]) {
      const client = createMockClient();
      await assert.rejects(operation, ProductEntitlementInputError);
      assert.strictEqual(mockCreateClientCalls, 0);
      assert.strictEqual(client.calls.length, 0);
    }
  });

  test("grants with the exact canonical payload and server-authenticated grantor", async () => {
    const client = createMockClient({ queryData: BASE_ROW, authUserId: ADMIN_ID });
    const result = await grantProductEntitlement({
      userId: USER_ID.toUpperCase(),
      productId: PRODUCT_ID,
      expiresAt: "2030-01-01T00:00:00.000Z"
    });

    assert.deepStrictEqual(result, BASE_ROW);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "insert")?.args, [{
      user_id: USER_ID,
      product_id: PRODUCT_ID,
      status: "active",
      expires_at: "2030-01-01T00:00:00.000Z",
      granted_by: ADMIN_ID
    }]);
    const payload = client.calls.find((call) => call.method === "insert")?.args[0] as Record<string, unknown>;
    assert.deepStrictEqual(Object.keys(payload).sort(), ["expires_at", "granted_by", "product_id", "status", "user_id"]);
  });

  test("grants a non-expiring entitlement with an exact null expiry payload", async () => {
    const client = createMockClient({ queryData: BASE_ROW, authUserId: ADMIN_ID });
    const result = await grantProductEntitlement({ userId: USER_ID, productId: PRODUCT_ID });

    assert.deepStrictEqual(result, BASE_ROW);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "insert")?.args, [{
      user_id: USER_ID,
      product_id: PRODUCT_ID,
      status: "active",
      expires_at: null,
      granted_by: ADMIN_ID
    }]);
  });

  test("accepts explicit null and undefined optional expiry consistently", async () => {
    for (const input of [
      { userId: USER_ID, productId: PRODUCT_ID, expiresAt: null },
      { userId: USER_ID, productId: PRODUCT_ID, expiresAt: undefined }
    ]) {
      const client = createMockClient({ queryData: BASE_ROW, authUserId: ADMIN_ID });
      await assert.doesNotReject(() => grantProductEntitlement(input));
      assert.deepStrictEqual(client.calls.find((call) => call.method === "insert")?.args, [{
        user_id: USER_ID,
        product_id: PRODUCT_ID,
        status: "active",
        expires_at: null,
        granted_by: ADMIN_ID
      }]);
    }
  });

  test("rejects unknown grant fields before creating or querying the database", async () => {
    for (const input of [
      { userId: USER_ID, productId: PRODUCT_ID, role: "admin" },
      { userId: USER_ID, productId: PRODUCT_ID, accountStatus: "approved" },
      { userId: USER_ID, productId: PRODUCT_ID, approvedBy: ADMIN_ID },
      { userId: USER_ID, productId: PRODUCT_ID, updatedBy: ADMIN_ID },
      { userId: USER_ID, productId: PRODUCT_ID, serviceRole: true }
    ]) {
      const client = createMockClient();
      await assert.rejects(() => grantProductEntitlement(input as any), ProductEntitlementInputError);
      assert.strictEqual(mockCreateClientCalls, 0);
      assert.strictEqual(client.calls.length, 0);
    }
  });

  test("revokes by exact user/product IDs and sets revoked status plus timestamp", async () => {
    const client = createMockClient({ queryData: { ...BASE_ROW, status: "revoked", revoked_at: "2026-09-07T00:00:00.000Z" } });
    const result = await revokeProductEntitlement(USER_ID.toUpperCase(), PRODUCT_ID);
    assert.equal(result?.status, "revoked");
    const update = client.calls.find((call) => call.method === "update")?.args[0] as Record<string, unknown>;
    assert.deepStrictEqual(update, { status: "revoked", revoked_at: update.revoked_at });
    assert.equal(typeof update.revoked_at, "string");
    assert.match(String(update.revoked_at), /^\d{4}-\d{2}-\d{2}T/);
    assert.deepStrictEqual(
      client.calls.filter((call) => call.method === "eq").map((call) => call.args),
      [["user_id", USER_ID], ["product_id", PRODUCT_ID]]
    );
  });

  test("rejects object or extra positional revoke inputs before creating or querying", async () => {
    for (const operation of [
      () => revokeProductEntitlement({ userId: USER_ID, productId: PRODUCT_ID, role: "admin" } as any),
      () => revokeProductEntitlement(USER_ID, PRODUCT_ID, { grantedBy: ADMIN_ID } as any)
    ]) {
      const client = createMockClient();
      await assert.rejects(operation, ProductEntitlementInputError);
      assert.strictEqual(mockCreateClientCalls, 0);
      assert.strictEqual(client.calls.length, 0);
    }
  });

  test("maps client/database failures to generic repository errors without raw details", async () => {
    const sensitiveError = new Error("connection refused for user@example.test secret=jwt");
    mockCreateClientError = sensitiveError;
    await assert.rejects(() => getActiveProductEntitlement(USER_ID, PRODUCT_ID), (error: unknown) => {
      assert.ok(error instanceof ProductEntitlementRepositoryError);
      assert.ok(!String(error).includes("user@example.test"));
      assert.ok(!String(error).includes("secret=jwt"));
      return true;
    });

    const databaseError = { message: "PII user@example.test UPDATE product_entitlements", code: "42501" };
    createMockClient({ queryError: databaseError });
    await assert.rejects(() => getActiveProductEntitlement(USER_ID, PRODUCT_ID), (error: unknown) => {
      assert.ok(error instanceof ProductEntitlementRepositoryError);
      assert.ok(!String(error).includes("user@example.test"));
      assert.ok(!String(error).includes("42501"));
      return true;
    });
  });

  test("does not log raw errors or import browser/service-role clients", async () => {
    const logs: string[] = [];
    const originalError = console.error;
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));

    try {
      createMockClient({ queryError: { message: "FATAL user@example.test UPDATE product_entitlements", code: "P0001" } });
      await assert.rejects(() => revokeProductEntitlement(USER_ID, PRODUCT_ID), ProductEntitlementRepositoryError);
      const combined = logs.join("\n");
      assert.ok(!combined.includes("user@example.test"));
      assert.ok(!combined.includes("P0001"));
    } finally {
      console.error = originalError;
      console.log = originalLog;
      console.warn = originalWarn;
    }

    const source = await fs.readFile("lib/repositories/product-entitlement-repository.ts", "utf8");
    assert.match(source, /@\/lib\/supabase\/server/);
    assert.doesNotMatch(source, /@\/lib\/supabase\/browser/);
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  });
});
