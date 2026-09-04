/** Runtime unit tests for the server-side admin account approval repository. */

import assert from "node:assert/strict";
import { test, describe, before, afterEach } from "node:test";
import * as fs from "node:fs/promises";

let listAccountsForApproval: any;
let getAccountForApprovalById: any;
let updateAccountApproval: any;
let AccountApprovalInputError: any;
let AccountApprovalRepositoryError: any;
let ACCOUNT_APPROVAL_SELECT_COLUMNS: any;
let ACCOUNT_APPROVAL_STATUSES: any;

let mockClientInstance: any = null;
let mockCreateClientError: unknown = null;

before(async () => {
  const serverPath = require.resolve("../../lib/supabase/server");
  try { require(serverPath); } catch {}
  require.cache[serverPath] = {
    id: serverPath,
    filename: serverPath,
    loaded: true,
    exports: {
      createClient: async () => {
        if (mockCreateClientError) throw mockCreateClientError;
        return mockClientInstance;
      }
    }
  } as any;

  const repository = await import("../../lib/repositories/account-approval-repository");
  listAccountsForApproval = repository.listAccountsForApproval;
  getAccountForApprovalById = repository.getAccountForApprovalById;
  updateAccountApproval = repository.updateAccountApproval;
  AccountApprovalInputError = repository.AccountApprovalInputError;
  AccountApprovalRepositoryError = repository.AccountApprovalRepositoryError;
  ACCOUNT_APPROVAL_SELECT_COLUMNS = repository.ACCOUNT_APPROVAL_SELECT_COLUMNS;
  ACCOUNT_APPROVAL_STATUSES = repository.ACCOUNT_APPROVAL_STATUSES;
});

afterEach(() => {
  mockClientInstance = null;
  mockCreateClientError = null;
});

interface MockQueryCall {
  method: string;
  args: unknown[];
}

function createMockClient(options?: { queryData?: unknown; queryError?: unknown }) {
  const calls: MockQueryCall[] = [];
  const queryBuilder: any = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return queryBuilder;
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return queryBuilder;
    },
    or: (...args: unknown[]) => {
      calls.push({ method: "or", args });
      return queryBuilder;
    },
    order: (...args: unknown[]) => {
      calls.push({ method: "order", args });
      return queryBuilder;
    },
    range: (...args: unknown[]) => {
      calls.push({ method: "range", args });
      return queryBuilder;
    },
    update: (...args: unknown[]) => {
      calls.push({ method: "update", args });
      return queryBuilder;
    },
    maybeSingle: async () => {
      calls.push({ method: "maybeSingle", args: [] });
      return options?.queryError
        ? { data: null, error: options.queryError }
        : { data: options?.queryData ?? null, error: null };
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(
        options?.queryError
          ? { data: null, error: options.queryError }
          : { data: options?.queryData ?? [], error: null }
      ).then(resolve)
  };

  const client = {
    calls,
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return queryBuilder;
    }
  };
  mockClientInstance = client;
  return client;
}

const ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";
const SAMPLE_ACCOUNT = {
  id: ACCOUNT_ID,
  full_name: "Nguyen Van A",
  email: "nguyen@example.test",
  phone: "0901234567",
  faculty: "Accounting",
  major: "Corporate Accounting",
  student_code: "SV001",
  avatar_url: null,
  gpa_goal: 3.5,
  role: "student",
  account_status: "pending",
  approved_at: null,
  approved_by: null,
  rejection_reason: null,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z"
};

describe("Task 3.1-F-A: account approval repository", () => {
  test("lists accounts with status/search/pagination and deterministic ordering", async () => {
    const client = createMockClient({ queryData: [SAMPLE_ACCOUNT] });
    const result = await listAccountsForApproval({
      status: "pending",
      search: "  Nguyen, (Van)%_A  ",
      limit: 50,
      offset: 20
    });

    assert.deepStrictEqual(result, [SAMPLE_ACCOUNT]);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "from")?.args, ["profiles"]);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "select")?.args, [ACCOUNT_APPROVAL_SELECT_COLUMNS]);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "eq")?.args, ["account_status", "pending"]);
    assert.deepStrictEqual(
      client.calls.find((call) => call.method === "or")?.args,
      ["full_name.ilike.%Nguyen   Van   A%,email.ilike.%Nguyen   Van   A%,phone.ilike.%Nguyen   Van   A%"]
    );
    assert.deepStrictEqual(
      client.calls.filter((call) => call.method === "order").map((call) => call.args),
      [["created_at", { ascending: false }], ["id", { ascending: false }]]
    );
    assert.deepStrictEqual(client.calls.find((call) => call.method === "range")?.args, [20, 69]);
  });

  test("uses explicit columns and default bounded pagination", async () => {
    const client = createMockClient({ queryData: [] });
    await listAccountsForApproval();

    assert.deepStrictEqual(client.calls.find((call) => call.method === "select")?.args, [ACCOUNT_APPROVAL_SELECT_COLUMNS]);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "range")?.args, [0, 19]);
  });

  test("gets an account by valid UUID with maybeSingle and returns null when missing", async () => {
    const client = createMockClient({ queryData: SAMPLE_ACCOUNT });
    assert.deepStrictEqual(await getAccountForApprovalById(ACCOUNT_ID), SAMPLE_ACCOUNT);
    assert.deepStrictEqual(client.calls.find((call) => call.method === "eq")?.args, ["id", ACCOUNT_ID]);
    assert.ok(client.calls.some((call) => call.method === "maybeSingle"));

    const missingClient = createMockClient({ queryData: null });
    assert.strictEqual(await getAccountForApprovalById(ACCOUNT_ID), null);
    assert.ok(missingClient.calls.some((call) => call.method === "maybeSingle"));
  });

  test("rejects invalid UUID and invalid input before creating/querying the database", async () => {
    const invalidIds = ["not-a-uuid", "", "550e8400-e29b-41d4-a716-44665544000", null, 123];
    for (const id of invalidIds) {
      const client = createMockClient();
      await assert.rejects(() => getAccountForApprovalById(id), AccountApprovalInputError);
      assert.strictEqual(client.calls.length, 0);
    }

    const invalidInputs = [
      { account_status: "active" },
      { account_status: "pending", role: "admin" },
      { account_status: "pending", approved_by: ACCOUNT_ID },
      { account_status: "pending", approved_at: "2026-09-04T00:00:00Z" },
      { account_status: "pending", email: "attacker@example.test" },
      { account_status: "pending", id: ACCOUNT_ID },
      { rejection_reason: "missing status" }
    ];

    for (const input of invalidInputs) {
      const client = createMockClient();
      await assert.rejects(() => updateAccountApproval(ACCOUNT_ID, input), AccountApprovalInputError);
      assert.strictEqual(client.calls.length, 0);
    }
  });

  test("updates all four canonical statuses and sends only allowed payload fields", async () => {
    for (const status of ACCOUNT_APPROVAL_STATUSES) {
      const client = createMockClient({
        queryData: { ...SAMPLE_ACCOUNT, account_status: status }
      });
      const result = await updateAccountApproval(ACCOUNT_ID, {
        account_status: status,
        rejection_reason: status === "rejected" ? "Incomplete record" : null
      });

      assert.strictEqual(result?.account_status, status);
      assert.deepStrictEqual(
        client.calls.find((call) => call.method === "update")?.args,
        [{ account_status: status, rejection_reason: status === "rejected" ? "Incomplete record" : null }]
      );
      assert.deepStrictEqual(client.calls.find((call) => call.method === "eq")?.args, ["id", ACCOUNT_ID]);
      assert.strictEqual(client.calls.find((call) => call.method === "select")?.args[0], ACCOUNT_APPROVAL_SELECT_COLUMNS);
    }
  });

  test("returns null when an approval update matches no row", async () => {
    createMockClient({ queryData: null });
    assert.strictEqual(
      await updateAccountApproval(ACCOUNT_ID, { account_status: "approved" }),
      null
    );
  });

  test("maps client creation and database failures to generic repository errors", async () => {
    const sensitiveError = new Error("connection refused for nguyen@example.test 0901234567 secret=jwt");
    mockCreateClientError = sensitiveError;
    for (const operation of [
      () => listAccountsForApproval(),
      () => getAccountForApprovalById(ACCOUNT_ID),
      () => updateAccountApproval(ACCOUNT_ID, { account_status: "approved" })
    ]) {
      await assert.rejects(operation, (error: unknown) => {
        assert.ok(error instanceof AccountApprovalRepositoryError);
        assert.ok(!String(error).includes("connection refused"));
        assert.ok(!String(error).includes("nguyen@example.test"));
        assert.ok(!String(error).includes("0901234567"));
        assert.ok(!String(error).includes("secret=jwt"));
        return true;
      });
    }

    mockCreateClientError = null;
    const databaseError = { message: "PII nguyen@example.test / 0901234567", code: "42501" };
    for (const operation of [
      () => listAccountsForApproval(),
      () => getAccountForApprovalById(ACCOUNT_ID),
      () => updateAccountApproval(ACCOUNT_ID, { account_status: "rejected" })
    ]) {
      createMockClient({ queryError: databaseError });
      await assert.rejects(operation, (error: unknown) => {
        assert.ok(error instanceof AccountApprovalRepositoryError);
        assert.ok(!String(error).includes("nguyen@example.test"));
        assert.ok(!String(error).includes("0901234567"));
        assert.ok(!String(error).includes("42501"));
        return true;
      });
    }
  });

  test("does not log raw database errors or account PII", async () => {
    const logs: string[] = [];
    const originalError = console.error;
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));

    try {
      createMockClient({
        queryError: {
          message: "FATAL nguyen@example.test 0901234567 UPDATE profiles SET role = admin",
          code: "P0001"
        }
      });
      await assert.rejects(
        () => updateAccountApproval(ACCOUNT_ID, { account_status: "suspended" }),
        AccountApprovalRepositoryError
      );
      const combined = logs.join("\n");
      assert.ok(!combined.includes("nguyen@example.test"));
      assert.ok(!combined.includes("0901234567"));
      assert.ok(!combined.includes("P0001"));
      assert.ok(!combined.includes("UPDATE profiles"));
    } finally {
      console.error = originalError;
      console.log = originalLog;
      console.warn = originalWarn;
    }
  });

  test("uses the server client only and has no browser/service-role import", async () => {
    const source = await fs.readFile("lib/repositories/account-approval-repository.ts", "utf8");
    assert.match(source, /@\/lib\/supabase\/server/);
    assert.doesNotMatch(source, /@\/lib\/supabase\/browser/);
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  });
});
