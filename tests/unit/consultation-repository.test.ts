/**
 * Unit & Contract Tests for Server-side Consultation Repository (Task 4.2-B)
 */

import assert from "node:assert/strict";
import { test, describe, before, afterEach } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  Consultation,
  ListConsultationsOptions,
  UpdatedConsultationStatus
} from "../../lib/repositories/consultation-repository";

let listConsultations: any;
let getConsultationById: any;
let updateConsultationStatus: any;
let isValidUuid: any;
let ConsultationInputError: any;
let ConsultationRepositoryError: any;
let VALID_CONSULTATION_STATUSES: any;
let CONSULTATION_COLUMNS: any;
let CONSULTATION_SELECT_COLUMNS: any;
let CONSULTATION_STATUS_UPDATE_COLUMNS: any;
let CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS: any;
let DEFAULT_CONSULTATION_PAGE_LIMIT: any;
let MAX_CONSULTATION_PAGE_LIMIT: any;
let MAX_SEARCH_LENGTH: any;

let mockClientInstance: any = null;

before(async () => {
  const serverPath = require.resolve("../../lib/supabase/server");
  try { require(serverPath); } catch(e) {}
  require.cache[serverPath] = {
    id: serverPath,
    filename: serverPath,
    loaded: true,
    exports: {
      createClient: async () => mockClientInstance
    }
  } as any;

  const repo = await import("../../lib/repositories/consultation-repository");
  listConsultations = repo.listConsultations;
  getConsultationById = repo.getConsultationById;
  updateConsultationStatus = repo.updateConsultationStatus;
  isValidUuid = repo.isValidUuid;
  ConsultationInputError = repo.ConsultationInputError;
  ConsultationRepositoryError = repo.ConsultationRepositoryError;
  VALID_CONSULTATION_STATUSES = repo.VALID_CONSULTATION_STATUSES;
  CONSULTATION_COLUMNS = repo.CONSULTATION_COLUMNS;
  CONSULTATION_SELECT_COLUMNS = repo.CONSULTATION_SELECT_COLUMNS;
  CONSULTATION_STATUS_UPDATE_COLUMNS = repo.CONSULTATION_STATUS_UPDATE_COLUMNS;
  CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS = repo.CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS;
  DEFAULT_CONSULTATION_PAGE_LIMIT = repo.DEFAULT_CONSULTATION_PAGE_LIMIT;
  MAX_CONSULTATION_PAGE_LIMIT = repo.MAX_CONSULTATION_PAGE_LIMIT;
  MAX_SEARCH_LENGTH = repo.MAX_SEARCH_LENGTH;
});

afterEach(() => { mockClientInstance = null; });

interface MockQueryCall {
  method: string;
  args: any[];
}

function createMockClient(options?: {
  queryData?: any;
  queryError?: any;
}) {
  const calls: MockQueryCall[] = [];

  const queryBuilder: any = {
    _calls: calls,
    select: (...args: any[]) => {
      calls.push({ method: "select", args });
      return queryBuilder;
    },
    update: (...args: any[]) => {
      calls.push({ method: "update", args });
      return queryBuilder;
    },
    eq: (...args: any[]) => {
      calls.push({ method: "eq", args });
      return queryBuilder;
    },
    or: (...args: any[]) => {
      calls.push({ method: "or", args });
      return queryBuilder;
    },
    order: (...args: any[]) => {
      calls.push({ method: "order", args });
      return queryBuilder;
    },
    range: (...args: any[]) => {
      calls.push({ method: "range", args });
      return queryBuilder;
    },
    limit: (...args: any[]) => {
      calls.push({ method: "limit", args });
      return queryBuilder;
    },
    maybeSingle: async () => {
      calls.push({ method: "maybeSingle", args: [] });
      if (options?.queryError) {
        return { data: null, error: options.queryError };
      }
      return { data: options?.queryData ?? null, error: null };
    },
    then: (resolve: (value: any) => void) => {
      if (options?.queryError) {
        resolve({ data: null, error: options.queryError });
      } else {
        resolve({ data: options?.queryData ?? [], error: null });
      }
    }
  };

  const client = {
    _calls: calls,
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return queryBuilder;
    }
  };

  mockClientInstance = client;
  return client;
}

const SAMPLE_CONSULTATION: Consultation = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  request_id: "req-12345",
  full_name: "Nguyễn Văn A",
  phone: "0901234567",
  faculty: "Kế toán - Kiểm toán",
  interest: "Kế toán tài chính 1",
  need: "Cần tư vấn ôn thi cấp tốc",
  major: "Kế toán doanh nghiệp",
  note: "Gặp khó khăn với định khoản kế toán",
  source_path: "/tai-lieu/ke-toan-tai-chinh-1",
  selected_product_slug: "ke-toan-tai-chinh-1",
  selected_subject_slug: "ke-toan-tai-chinh-1",
  status: "new",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z"
};

describe("Task 4.2-B: Server-side Consultation Repository", () => {
  describe("1. listConsultations: Defaults and No Filters", () => {
    test("list with no filters queries consultations table with explicit columns and default pagination", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      const results = await listConsultations(undefined);

      assert.deepStrictEqual(results, [SAMPLE_CONSULTATION]);

      const fromCall = client._calls.find((c) => c.method === "from");
      assert.ok(fromCall, "Must call .from()");
      assert.strictEqual(fromCall.args[0], "consultations");

      const selectCall = client._calls.find((c) => c.method === "select");
      assert.ok(selectCall, "Must call .select()");
      assert.strictEqual(selectCall.args[0], CONSULTATION_SELECT_COLUMNS);

      // Verify default range: offset 0, limit 20 -> range(0, 19)
      const rangeCall = client._calls.find((c) => c.method === "range");
      assert.ok(rangeCall, "Must call .range()");
      assert.deepStrictEqual(rangeCall.args, [0, DEFAULT_CONSULTATION_PAGE_LIMIT - 1]);

      // Verify no status filter or search filter added
      assert.strictEqual(client._calls.filter((c) => c.method === "eq").length, 0);
      assert.strictEqual(client._calls.filter((c) => c.method === "or").length, 0);
    });

    test("list with empty options object applies default pagination", async () => {
      const client = createMockClient({ queryData: [] });
      const results = await listConsultations({});

      assert.deepStrictEqual(results, []);
      const rangeCall = client._calls.find((c) => c.method === "range");
      assert.ok(rangeCall);
      assert.deepStrictEqual(rangeCall.args, [0, 19]);
    });
  });

  describe("2. listConsultations: Status Filtering", () => {
    test("valid status filters are accepted and passed to eq()", async () => {
      for (const status of VALID_CONSULTATION_STATUSES) {
        const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
        const results = await listConsultations({ status });

        assert.deepStrictEqual(results, [SAMPLE_CONSULTATION]);

        const eqCalls = client._calls.filter((c) => c.method === "eq");
        assert.strictEqual(eqCalls.length, 1);
        assert.deepStrictEqual(eqCalls[0].args, ["status", status]);
      }
    });

    test("invalid status values are rejected with ConsultationInputError without calling database", async () => {
      const invalidStatuses = [
        "invalid_status",
        "pending",
        "deleted",
        "admin",
        "active",
        "",
        123 as any,
        null as any
      ];

      for (const invalidStatus of invalidStatuses) {
        const client = createMockClient({ queryData: [] });
        await assert.rejects(
          async () => {
            await listConsultations({ status: invalidStatus });
          },
          (err: unknown) => {
            assert.ok(err instanceof ConsultationInputError);
            assert.ok(err instanceof Error);
            assert.strictEqual(err.name, "ConsultationInputError");
            return true;
          },
          `Status "${invalidStatus}" must be rejected`
        );

        // Database client must never have been called
        assert.strictEqual(
          client._calls.length,
          0,
          `DB should not be called for invalid status "${invalidStatus}"`
        );
      }
    });
  });

  describe("3. listConsultations: Search by Name and Phone", () => {

    test("sanitizes SQL ILIKE wildcards to prevent wildcard expansion", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations({ search: "Nguyen%Van_A*" });

      const orCalls = client._calls.filter((c) => c.method === "or");
      assert.strictEqual(orCalls.length, 1);
      assert.strictEqual(
        orCalls[0].args[0],
        "full_name.ilike.%Nguyen Van A%,phone.ilike.%Nguyen Van A%"
      );
    });

    test("searches by full_name and phone using PostgREST or filter", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations({ search: "Nguyễn Văn A" });

      const orCalls = client._calls.filter((c) => c.method === "or");
      assert.strictEqual(orCalls.length, 1);
      assert.strictEqual(
        orCalls[0].args[0],
        "full_name.ilike.%Nguyễn Văn A%,phone.ilike.%Nguyễn Văn A%"
      );
    });

    test("searches by phone number accurately", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations({ search: "0901234567" });

      const orCalls = client._calls.filter((c) => c.method === "or");
      assert.strictEqual(orCalls.length, 1);
      assert.strictEqual(
        orCalls[0].args[0],
        "full_name.ilike.%0901234567%,phone.ilike.%0901234567%"
      );
    });

    test("trims leading/trailing whitespace on search input", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations({ search: "   0901234567   " });

      const orCalls = client._calls.filter((c) => c.method === "or");
      assert.strictEqual(orCalls.length, 1);
      assert.strictEqual(
        orCalls[0].args[0],
        "full_name.ilike.%0901234567%,phone.ilike.%0901234567%"
      );
    });

    test("bounds long search query to maximum allowed length", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      const longQuery = "a".repeat(200);
      await listConsultations({ search: longQuery });

      const orCalls = client._calls.filter((c) => c.method === "or");
      assert.strictEqual(orCalls.length, 1);
      const expectedSubstring = "a".repeat(MAX_SEARCH_LENGTH);
      assert.strictEqual(
        orCalls[0].args[0],
        `full_name.ilike.%${expectedSubstring}%,phone.ilike.%${expectedSubstring}%`
      );
    });

    test("sanitizes PostgREST syntax injection characters from search query", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations({ search: 'Nguyễn, An (Test) "quote" \\' });

      const orCalls = client._calls.filter((c) => c.method === "or");
      assert.strictEqual(orCalls.length, 1);
      assert.strictEqual(
        orCalls[0].args[0],
        "full_name.ilike.%Nguyễn  An  Test   quote%,phone.ilike.%Nguyễn  An  Test   quote%"
      );
    });

    test("whitespace-only search query does not add an or filter", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations({ search: "     " });

      const orCalls = client._calls.filter((c) => c.method === "or");
      assert.strictEqual(orCalls.length, 0);
    });

    test("non-string search parameter throws ConsultationInputError", async () => {
      const client = createMockClient({ queryData: [] });
      await assert.rejects(
        async () => {
          await listConsultations({ search: 12345 as any });
        },
        ConsultationInputError
      );
      assert.strictEqual(client._calls.length, 0);
    });
  });

  describe("4. listConsultations: Bounded Pagination", () => {
    test("accepts valid limit and offset within bounds", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations({ limit: 50, offset: 20 });

      const rangeCall = client._calls.find((c) => c.method === "range");
      assert.ok(rangeCall);
      assert.deepStrictEqual(rangeCall.args, [20, 69]);
    });

    test("accepts boundary limit of 1 and max limit of 100", async () => {
      const client1 = createMockClient({ queryData: [] });
      await listConsultations({ limit: 1, offset: 0 });
      const range1 = client1._calls.find((c) => c.method === "range");
      assert.deepStrictEqual(range1?.args, [0, 0]);

      const clientMax = createMockClient({ queryData: [] });
      await listConsultations({ limit: MAX_CONSULTATION_PAGE_LIMIT, offset: 50 });
      const rangeMax = clientMax._calls.find((c) => c.method === "range");
      assert.deepStrictEqual(rangeMax?.args, [50, 149]);
    });

    test("rejects limit exceeding hard maximum of 100 rows", async () => {
      const client = createMockClient({ queryData: [] });
      await assert.rejects(
        async () => {
          await listConsultations({ limit: 101 });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConsultationInputError);
          assert.match((err as Error).message, /must be an integer between 1 and 100/i);
          return true;
        }
      );
      assert.strictEqual(client._calls.length, 0);
    });

    test("rejects non-positive and non-integer limits", async () => {
      const invalidLimits = [0, -1, -50, 10.5, NaN, Infinity, "20" as any];
      for (const limit of invalidLimits) {
        const client = createMockClient({ queryData: [] });
        await assert.rejects(
          async () => {
            await listConsultations({ limit });
          },
          ConsultationInputError,
          `Limit ${limit} should be rejected`
        );
        assert.strictEqual(client._calls.length, 0);
      }
    });

    test("rejects negative and non-integer offsets", async () => {
      const invalidOffsets = [-1, -100, 5.5, NaN, Infinity, "0" as any];
      for (const offset of invalidOffsets) {
        const client = createMockClient({ queryData: [] });
        await assert.rejects(
          async () => {
            await listConsultations({ offset });
          },
          ConsultationInputError,
          `Offset ${offset} should be rejected`
        );
        assert.strictEqual(client._calls.length, 0);
      }
    });
  });

  describe("5. listConsultations: Deterministic Ordering", () => {
    test("orders newest first by created_at DESC with id DESC as tie-breaker", async () => {
      const client = createMockClient({ queryData: [SAMPLE_CONSULTATION] });
      await listConsultations(undefined);

      const orderCalls = client._calls.filter((c) => c.method === "order");
      assert.strictEqual(orderCalls.length, 2, "Must specify two ordering criteria");
      assert.deepStrictEqual(orderCalls[0].args, ["created_at", { ascending: false }]);
      assert.deepStrictEqual(orderCalls[1].args, ["id", { ascending: false }]);
    });
  });

  describe("6. getConsultationById: Valid UUID Lookup", () => {
    test("retrieves consultation by valid UUID using explicit columns and maybeSingle", async () => {
      const client = createMockClient({ queryData: SAMPLE_CONSULTATION });
      const result = await getConsultationById(SAMPLE_CONSULTATION.id);

      assert.deepStrictEqual(result, SAMPLE_CONSULTATION);

      const fromCall = client._calls.find((c) => c.method === "from");
      assert.ok(fromCall);
      assert.strictEqual(fromCall.args[0], "consultations");

      const selectCall = client._calls.find((c) => c.method === "select");
      assert.ok(selectCall);
      assert.strictEqual(selectCall.args[0], CONSULTATION_SELECT_COLUMNS);

      const eqCall = client._calls.find((c) => c.method === "eq");
      assert.ok(eqCall);
      assert.deepStrictEqual(eqCall.args, ["id", SAMPLE_CONSULTATION.id]);

      const maybeSingleCall = client._calls.find((c) => c.method === "maybeSingle");
      assert.ok(maybeSingleCall, "Must use maybeSingle() for safe lookup");
    });

    test("returns null when consultation is not found", async () => {
      const client = createMockClient({ queryData: null });
      const result = await getConsultationById(SAMPLE_CONSULTATION.id);

      assert.strictEqual(result, null);
    });
  });

  describe("7. getConsultationById: Invalid UUID Rejection", () => {
    test("rejects non-UUID identifiers with ConsultationInputError without querying database", async () => {
      const invalidIds = [
        "not-a-uuid",
        "123",
        "",
        "   ",
        "550e8400-e29b-41d4-a716-44665544000", // too short
        "550e8400-e29b-41d4-a716-4466554400000", // too long
        "550e8400-e29b-41d4-a716-44665544000z", // invalid hex
        "'; DROP TABLE consultations; --",
        null as any,
        undefined as any,
        12345 as any
      ];

      for (const id of invalidIds) {
        const client = createMockClient({ queryData: null });
        await assert.rejects(
          async () => {
            await getConsultationById(id);
          },
          (err: unknown) => {
            assert.ok(err instanceof ConsultationInputError);
            assert.match((err as Error).message, /must be a valid UUID/i);
            return true;
          },
          `ID "${id}" must be rejected as invalid UUID`
        );
        assert.strictEqual(client._calls.length, 0, "DB must not be called for invalid UUID");
      }
    });

    test("isValidUuid helper validates strictly", () => {
      assert.strictEqual(isValidUuid("550e8400-e29b-41d4-a716-446655440000"), true);
      assert.strictEqual(isValidUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"), true);
      assert.strictEqual(isValidUuid("not-a-uuid"), false);
      assert.strictEqual(isValidUuid(""), false);
      assert.strictEqual(isValidUuid(null), false);
      assert.strictEqual(isValidUuid(undefined), false);
    });
  });

  describe("8. Error Handling & Privacy Guarantees", () => {
    test("listConsultations maps database errors to safe ConsultationRepositoryError", async () => {
      const client = createMockClient({
        queryError: {
          message: "relation \"consultations\" does not exist",
          code: "42P01",
          details: "table not found in public schema"
        }
      });

      await assert.rejects(
        async () => {
          await listConsultations(undefined);
        },
        (err: unknown) => {
          assert.ok(err instanceof ConsultationRepositoryError);
          assert.ok(err instanceof Error);
          assert.strictEqual((err as Error).message, "Failed to list consultations from database.");
          // Must not leak Postgres raw error details
          assert.ok(!((err as Error).message.includes("42P01")));
          assert.ok(!((err as Error).message.includes("relation")));
          assert.ok(!((err as Error).message.includes("public schema")));
          return true;
        }
      );
    });

    test("getConsultationById maps database errors to safe ConsultationRepositoryError", async () => {
      const client = createMockClient({
        queryError: {
          message: "connection refused: 5432",
          code: "ECONNREFUSED"
        }
      });

      await assert.rejects(
        async () => {
          await getConsultationById(SAMPLE_CONSULTATION.id);
        },
        (err: unknown) => {
          assert.ok(err instanceof ConsultationRepositoryError);
          assert.strictEqual((err as Error).message, "Failed to retrieve consultation from database.");
          assert.ok(!((err as Error).message.includes("ECONNREFUSED")));
          assert.ok(!((err as Error).message.includes("5432")));
          return true;
        }
      );
    });

    test("no raw database details or PII are logged to console", async () => {
      const loggedMessages: string[] = [];
      const originalConsoleError = console.error;
      const originalConsoleLog = console.log;
      const originalConsoleWarn = console.warn;

      console.error = (...args: any[]) => loggedMessages.push(args.map(String).join(" "));
      console.log = (...args: any[]) => loggedMessages.push(args.map(String).join(" "));
      console.warn = (...args: any[]) => loggedMessages.push(args.map(String).join(" "));

      try {
        const client = createMockClient({
          queryError: {
            message: "FATAL: password authentication failed for user 'postgres'",
            code: "28P01",
            details: "secret_db_credential_leak"
          }
        });

        // Trigger error during listing with PII-like search
        await assert.rejects(async () => {
          await listConsultations({ search: "0901234567" });
        });

        // Trigger error during get by ID
        await assert.rejects(async () => {
          await getConsultationById("550e8400-e29b-41d4-a716-446655440000");
        });

        const combinedLogs = loggedMessages.join("\n");
        // Verify no sensitive PII or Postgres details leaked into logs
        assert.ok(!combinedLogs.includes("0901234567"), "Phone must not be logged");
        assert.ok(!combinedLogs.includes("28P01"), "Postgres error code must not be logged");
        assert.ok(!combinedLogs.includes("password authentication failed"), "DB error must not be logged");
        assert.ok(!combinedLogs.includes("secret_db_credential_leak"), "DB details must not be logged");
      } finally {
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
      }
    });
  });

  describe("9. Security & RLS Authority Compliance", () => {
    test("rejects client-supplied role or user ID parameters", async () => {
      const dangerousOptions: ListConsultationsOptions[] = [
        { role: "admin" } as any,
        { userId: "admin-uuid" } as any,
        { user_id: "admin-uuid" } as any,
        { role: "admin", userId: "123" } as any
      ];

      for (const dangerous of dangerousOptions) {
        const client = createMockClient({ queryData: [] });
        await assert.rejects(
          async () => {
            await listConsultations(dangerous);
          },
          (err: unknown) => {
            assert.ok(err instanceof ConsultationInputError);
            assert.match((err as Error).message, /client-supplied role or user id is not permitted/i);
            return true;
          }
        );
        assert.strictEqual(client._calls.length, 0, "DB must not be called with client-supplied role/user ID");
      }
    });

    test("repository file does not import service-role key or client-side supabase", async () => {
      const repoFilePath = path.resolve(
        process.cwd(),
        "lib/repositories/consultation-repository.ts"
      );
      const fileContent = await fs.readFile(repoFilePath, "utf-8");

      // Must never reference service role keys
      assert.ok(
        !fileContent.includes("SUPABASE_SERVICE_ROLE_KEY"),
        "Repository must never reference SUPABASE_SERVICE_ROLE_KEY"
      );
      assert.ok(
        !fileContent.includes("service_role"),
        "Repository must never reference service_role"
      );

      // Must never import browser client
      assert.ok(
        !fileContent.includes("@/lib/supabase/client"),
        "Repository must not import from @/lib/supabase/client"
      );
      assert.ok(
        !fileContent.includes("createBrowserClient"),
        "Repository must not import createBrowserClient"
      );

      // Must import server createClient
      assert.ok(
        fileContent.includes('import { createClient } from "@/lib/supabase/server"'),
        "Repository must import createClient from @/lib/supabase/server"
      );
    });

    test("repository still has no general mutation methods", async () => {
      const repo = await import("../../lib/repositories/consultation-repository");
      const exportedKeys = Object.keys(repo);

      // Check general mutation method names do not exist
      const forbiddenMutationNames = [
        "createConsultation",
        "insertConsultation",
        "updateConsultation",
        "deleteConsultation",
        "patchConsultation",
        "bulkUpdateConsultations",
        "upsertConsultation"
      ];

      for (const forbidden of forbiddenMutationNames) {
        assert.ok(
          !exportedKeys.includes(forbidden),
          `Repository must not expose general mutation method "${forbidden}"`
        );
      }

      // Verify updateConsultationStatus IS exported
      assert.ok(
        exportedKeys.includes("updateConsultationStatus"),
        "Repository must expose updateConsultationStatus"
      );

      // Check file content for forbidden mutation operations
      const repoFilePath = path.resolve(
        process.cwd(),
        "lib/repositories/consultation-repository.ts"
      );
      const fileContent = await fs.readFile(repoFilePath, "utf-8");
      assert.ok(!fileContent.includes(".insert("), "Repository must not perform .insert()");
      assert.ok(!fileContent.includes(".delete("), "Repository must not perform .delete()");

      // Verify only status update is performed, not general update
      const updateMatches = fileContent.match(/\.update\(([^)]*)\)/g) || [];
      assert.strictEqual(updateMatches.length, 1, "Only one .update() call must exist");
      assert.ok(updateMatches[0].includes("{ status }"), "Update call must be strictly { status }");
    });

    test("repository selects only explicit consultation columns matching 0006 schema", () => {
      assert.strictEqual(CONSULTATION_COLUMNS.length, 15);
      const expectedColumns = [
        "id",
        "request_id",
        "full_name",
        "phone",
        "faculty",
        "interest",
        "need",
        "major",
        "note",
        "source_path",
        "selected_product_slug",
        "selected_subject_slug",
        "status",
        "created_at",
        "updated_at"
      ];

      assert.deepStrictEqual([...CONSULTATION_COLUMNS], expectedColumns);
      for (const col of expectedColumns) {
        assert.ok(CONSULTATION_SELECT_COLUMNS.includes(col), `Select string must include "${col}"`);
      }
    });

    test("0007_consultation_admin_rls.sql enforces admin SELECT authorization at database level", async () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/0007_consultation_admin_rls.sql"
      );
      const migrationSql = await fs.readFile(migrationPath, "utf-8");

      assert.ok(
        migrationSql.includes("GRANT SELECT ON TABLE consultations TO authenticated"),
        "Must grant SELECT to authenticated"
      );
      assert.ok(
        migrationSql.includes("CREATE POLICY \"consultations_allow_select_admin\""),
        "Must define admin SELECT policy"
      );
      assert.ok(
        migrationSql.includes("profiles.role = 'admin'"),
        "Admin policy must check profiles.role = 'admin'"
      );
      assert.ok(
        migrationSql.includes("profiles.id = auth.uid()"),
        "Admin policy must check profiles.id = auth.uid()"
      );
    });
  });

  describe("10. updateConsultationStatus: Status Mutation Operations", () => {
    test("valid status update sends exactly { status }", async () => {
      const client = createMockClient({
        queryData: {
          id: SAMPLE_CONSULTATION.id,
          status: "contacted",
          updated_at: "2026-09-03T10:00:00Z"
        }
      });
      const result = await updateConsultationStatus(
        SAMPLE_CONSULTATION.id,
        "contacted",
        client
      );

      assert.ok(result);
      assert.strictEqual(result.status, "contacted");

      const fromCall = client._calls.find((c) => c.method === "from");
      assert.ok(fromCall, "Must call .from()");
      assert.strictEqual(fromCall.args[0], "consultations");

      const updateCall = client._calls.find((c) => c.method === "update");
      assert.ok(updateCall, "Must call .update()");
      assert.deepStrictEqual(updateCall.args, [{ status: "contacted" }]);
      assert.strictEqual(
        Object.keys(updateCall.args[0]).length,
        1,
        "Update payload must contain exactly one property"
      );
      assert.strictEqual(updateCall.args[0].status, "contacted");
    });

    test("valid UUID is passed to .eq('id', id)", async () => {
      const client = createMockClient({
        queryData: {
          id: SAMPLE_CONSULTATION.id,
          status: "qualified",
          updated_at: "2026-09-03T10:00:00Z"
        }
      });
      await updateConsultationStatus(
        SAMPLE_CONSULTATION.id,
        "qualified",
        client
      );

      const eqCall = client._calls.find((c) => c.method === "eq");
      assert.ok(eqCall, "Must call .eq()");
      assert.deepStrictEqual(eqCall.args, ["id", SAMPLE_CONSULTATION.id]);
    });

    test("result contains only the minimal returned fields (id, status, updated_at)", async () => {
      const client = createMockClient({
        queryData: {
          id: SAMPLE_CONSULTATION.id,
          status: "qualified",
          updated_at: "2026-09-03T10:00:00Z",
          full_name: "Nguyễn Văn A",
          phone: "0901234567",
          note: "Secret note"
        }
      });
      const result = await updateConsultationStatus(
        SAMPLE_CONSULTATION.id,
        "qualified",
        client
      );

      assert.ok(result);
      assert.deepStrictEqual(result, {
        id: SAMPLE_CONSULTATION.id,
        status: "qualified",
        updated_at: "2026-09-03T10:00:00Z"
      });
      assert.deepStrictEqual(
        Object.keys(result!).sort(),
        ["id", "status", "updated_at"]
      );
      assert.strictEqual((result as any).full_name, undefined);
      assert.strictEqual((result as any).phone, undefined);
      assert.strictEqual((result as any).note, undefined);

      const selectCall = client._calls.find((c) => c.method === "select");
      assert.ok(selectCall, "Must call .select()");
      assert.strictEqual(
        selectCall.args[0],
        CONSULTATION_STATUS_UPDATE_SELECT_COLUMNS
      );
      assert.strictEqual(selectCall.args[0], "id, status, updated_at");
    });

    test("all four valid statuses are accepted and updated", async () => {
      for (const status of VALID_CONSULTATION_STATUSES) {
        const client = createMockClient({
          queryData: {
            id: SAMPLE_CONSULTATION.id,
            status,
            updated_at: "2026-09-03T12:00:00Z"
          }
        });
        const result = await updateConsultationStatus(
          SAMPLE_CONSULTATION.id,
          status,
          client
        );

        assert.ok(result);
        assert.strictEqual(result.status, status);

        const updateCall = client._calls.find((c) => c.method === "update");
        assert.ok(updateCall);
        assert.deepStrictEqual(updateCall.args, [{ status }]);
      }
    });

    test("invalid UUID rejects before DB call with ConsultationInputError", async () => {
      const invalidIds = [
        "not-a-uuid",
        "123",
        "",
        "   ",
        "550e8400-e29b-41d4-a716-44665544000",
        "550e8400-e29b-41d4-a716-4466554400000",
        "550e8400-e29b-41d4-a716-44665544000z",
        "'; DROP TABLE consultations; --",
        null as any,
        undefined as any,
        12345 as any,
        {} as any,
        [] as any
      ];

      for (const id of invalidIds) {
        const client = createMockClient({ queryData: null });
        await assert.rejects(
          async () => {
            await updateConsultationStatus(id, "contacted", client);
          },
          (err: unknown) => {
            assert.ok(err instanceof ConsultationInputError);
            assert.match((err as Error).message, /must be a valid UUID/i);
            return true;
          },
          `ID "${id}" must be rejected as invalid UUID`
        );
        assert.strictEqual(
          client._calls.length,
          0,
          `DB must not be called for invalid UUID "${id}"`
        );
      }
    });

    test("invalid status rejects before DB call with ConsultationInputError", async () => {
      const invalidStatuses = [
        "invalid_status",
        "pending",
        "deleted",
        "admin",
        "active",
        "NEW",
        "Contacted",
        "QUALIFIED",
        "Closed",
        "",
        "   ",
        123 as any,
        null as any,
        undefined as any,
        {} as any,
        [] as any,
        true as any
      ];

      for (const status of invalidStatuses) {
        const client = createMockClient({ queryData: null });
        await assert.rejects(
          async () => {
            await updateConsultationStatus(SAMPLE_CONSULTATION.id, status, client);
          },
          (err: unknown) => {
            assert.ok(err instanceof ConsultationInputError);
            assert.match((err as Error).message, /invalid status/i);
            return true;
          },
          `Status "${String(status)}" must be rejected`
        );
        assert.strictEqual(
          client._calls.length,
          0,
          `DB must not be called for invalid status "${String(status)}"`
        );
      }
    });

    test("no arbitrary or server-managed fields can enter the update payload", async () => {
      const client = createMockClient({
        queryData: {
          id: SAMPLE_CONSULTATION.id,
          status: "closed",
          updated_at: "2026-09-03T10:00:00Z"
        }
      });

      // Attempting to pass an object payload with extra fields as status is rejected before DB
      const maliciousStatusPayloads = [
        { status: "contacted", phone: "0999999999" } as any,
        { status: "closed", full_name: "Hacker" } as any,
        { status: "new", note: "malicious note" } as any,
        { status: "qualified", request_id: "fake-req" } as any,
        { status: "contacted", id: "550e8400-e29b-41d4-a716-446655440099" } as any,
        { status: "closed", created_at: "2020-01-01T00:00:00Z" } as any,
        { status: "closed", updated_at: "2020-01-01T00:00:00Z" } as any
      ];

      for (const malicious of maliciousStatusPayloads) {
        const testClient = createMockClient({ queryData: null });
        await assert.rejects(
          async () => {
            await updateConsultationStatus(SAMPLE_CONSULTATION.id, malicious, testClient);
          },
          ConsultationInputError
        );
        assert.strictEqual(testClient._calls.length, 0);
      }

      // In a valid call, ensure only status is passed and server-managed fields are never present
      await updateConsultationStatus(SAMPLE_CONSULTATION.id, "closed", client);
      const updateCall = client._calls.find((c) => c.method === "update");
      assert.ok(updateCall);
      const payloadKeys = Object.keys(updateCall.args[0]);
      assert.deepStrictEqual(payloadKeys, ["status"]);

      const forbiddenFields = [
        "id",
        "request_id",
        "full_name",
        "phone",
        "faculty",
        "interest",
        "need",
        "major",
        "note",
        "source_path",
        "selected_product_slug",
        "selected_subject_slug",
        "created_at",
        "updated_at",
        "role",
        "userId",
        "user_id"
      ];
      for (const forbidden of forbiddenFields) {
        assert.strictEqual(
          forbidden in updateCall.args[0],
          false,
          `Field "${forbidden}" must never exist in update payload`
        );
      }
    });

    test("no row returns null when record is not found or blocked by RLS", async () => {
      const client = createMockClient({ queryData: null });
      const result = await updateConsultationStatus(
        SAMPLE_CONSULTATION.id,
        "closed",
        client
      );

      assert.strictEqual(result, null);
    });

    test("database error becomes generic ConsultationRepositoryError without exposing details", async () => {
      // 1. Supabase client returning an error
      const clientWithError = createMockClient({
        queryError: {
          message: "permission denied for table consultations: admin check failed",
          code: "42501",
          details: "row level security policy violation"
        }
      });

      await assert.rejects(
        async () => {
          await updateConsultationStatus(
            SAMPLE_CONSULTATION.id,
            "closed",
            clientWithError
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConsultationRepositoryError);
          assert.strictEqual(
            (err as Error).message,
            "Failed to update consultation status in database."
          );
          assert.ok(!((err as Error).message.includes("42501")));
          assert.ok(!((err as Error).message.includes("permission denied")));
          assert.ok(!((err as Error).message.includes("security policy")));
          return true;
        }
      );

      // 2. Thrown exception (network drop / connection refused)
      const throwingClient = {
        _calls: [],
        from: () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
        }
      };

      await assert.rejects(
        async () => {
          await updateConsultationStatus(
            SAMPLE_CONSULTATION.id,
            "contacted",
            throwingClient as any
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof ConsultationRepositoryError);
          assert.strictEqual(
            (err as Error).message,
            "Failed to update consultation status in database."
          );
          assert.ok(!((err as Error).message.includes("ECONNREFUSED")));
          assert.ok(!((err as Error).message.includes("5432")));
          return true;
        }
      );
    });

    test("raw database message and PII are not logged or exposed", async () => {
      const loggedMessages: string[] = [];
      const originalConsoleError = console.error;
      const originalConsoleLog = console.log;
      const originalConsoleWarn = console.warn;

      console.error = (...args: any[]) => loggedMessages.push(args.map(String).join(" "));
      console.log = (...args: any[]) => loggedMessages.push(args.map(String).join(" "));
      console.warn = (...args: any[]) => loggedMessages.push(args.map(String).join(" "));

      try {
        const client = createMockClient({
          queryError: {
            message: "FATAL: error on 0901234567 with name Nguyễn Văn A and token secret_admin_jwt",
            code: "P0001",
            details: "sensitive SQL statement: UPDATE consultations SET status = 'closed'"
          }
        });

        await assert.rejects(
          async () => {
            await updateConsultationStatus(
              SAMPLE_CONSULTATION.id,
              "closed",
              client
            );
          },
          ConsultationRepositoryError
        );

        const combinedLogs = loggedMessages.join("\n");
        assert.ok(!combinedLogs.includes("0901234567"), "Phone number must not be logged");
        assert.ok(!combinedLogs.includes("Nguyễn Văn A"), "Full name must not be logged");
        assert.ok(!combinedLogs.includes("secret_admin_jwt"), "Secret must not be logged");
        assert.ok(!combinedLogs.includes("UPDATE consultations"), "SQL must not be logged");
        assert.ok(!combinedLogs.includes("P0001"), "Error code must not be logged");
      } finally {
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
      }
    });

    test("uses server Supabase client createClient() when positional mock client is omitted", async () => {
      const client = createMockClient({
        queryData: {
          id: SAMPLE_CONSULTATION.id,
          status: "new",
          updated_at: "2026-09-03T10:00:00Z"
        }
      });
      // client is registered to mockClientInstance by createMockClient
      const result = await updateConsultationStatus(
        SAMPLE_CONSULTATION.id,
        "new"
      );

      assert.ok(result);
      assert.strictEqual(result.status, "new");
      const fromCall = client._calls.find((c) => c.method === "from");
      assert.ok(fromCall);
      assert.strictEqual(fromCall.args[0], "consultations");
    });
  });
});
