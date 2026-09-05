/** Runtime-mock tests for the typed server-side admin catalog repository. */

import assert from "node:assert/strict";
import { test, describe, before, afterEach } from "node:test";
import * as fs from "node:fs/promises";

type QueryResult = { data: unknown; error: unknown };
type Call = { method: string; args: unknown[]; table?: string };

class MockClient {
  readonly calls: Call[] = [];
  private responses: QueryResult[];

  constructor(responses: QueryResult[] = []) {
    this.responses = [...responses];
  }

  nextResponse(): QueryResult {
    return this.responses.shift() ?? { data: [], error: null };
  }

  from(table: string): MockQuery {
    this.calls.push({ method: "from", args: [table], table });
    return new MockQuery(this, table);
  }
}

class MockQuery implements PromiseLike<QueryResult> {
  constructor(private readonly client: MockClient, private readonly table: string) {}

  private record(method: string, args: unknown[]): this {
    this.client.calls.push({ method, args, table: this.table });
    return this;
  }

  select(...args: unknown[]): this { return this.record("select", args); }
  insert(...args: unknown[]): this { return this.record("insert", args); }
  update(...args: unknown[]): this { return this.record("update", args); }
  delete(...args: unknown[]): this { return this.record("delete", args); }
  eq(...args: unknown[]): this { return this.record("eq", args); }
  or(...args: unknown[]): this { return this.record("or", args); }
  order(...args: unknown[]): this { return this.record("order", args); }
  range(...args: unknown[]): this { return this.record("range", args); }

  maybeSingle(): Promise<QueryResult> {
    this.client.calls.push({ method: "maybeSingle", args: [], table: this.table });
    return Promise.resolve(this.client.nextResponse());
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.client.nextResponse()).then(onfulfilled, onrejected);
  }
}

let repository: typeof import("../../lib/repositories/admin-catalog-repository");
let mockClient: MockClient | null = null;
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
        return mockClient;
      }
    }
  } as never;
  repository = await import("../../lib/repositories/admin-catalog-repository");
});

afterEach(() => {
  mockClient = null;
  mockCreateClientError = null;
});

const SUBJECT_ID = "550e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID = "650e8400-e29b-41d4-a716-446655440000";
const CATEGORY = "Marketing" as never;
const COLOR_THEME = "marketing" as never;
const MATERIAL_PRODUCT = {
  id: PRODUCT_ID,
  slug: "marketing-foundation",
  kind: "material",
  title: "Marketing Foundation",
  description: "Admin material",
  subject_id: SUBJECT_ID,
  category: CATEGORY,
  delivery_kind: "digital_download",
  publication_status: "draft",
  price_vnd: 10000,
  old_price_vnd: null,
  is_contact_for_price: false,
  rating: 5,
  is_hot: false,
  color_theme: COLOR_THEME,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z"
};

const MATERIAL_ROW = {
  product_id: PRODUCT_ID,
  pages: 20,
  tags: ["tag"],
  includes: ["pdf"],
  suitable_for: ["students"],
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z"
};

function productInput(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "marketing-foundation",
    title: "Marketing Foundation",
    description: "Admin material",
    subject_id: SUBJECT_ID,
    category: CATEGORY,
    delivery_kind: "digital_download",
    publication_status: "draft",
    price_vnd: 10000,
    old_price_vnd: null,
    is_contact_for_price: false,
    rating: 5,
    is_hot: false,
    color_theme: COLOR_THEME,
    ...extra
  };
}

describe("Task 5.1-A: admin catalog repository", () => {
  test("exports typed CRUD functions for all four catalog groups", () => {
    for (const name of [
      "listAdminSubjects", "getAdminSubjectById", "createAdminSubject", "updateAdminSubject", "deleteAdminSubject",
      "listAdminMaterials", "getAdminMaterialById", "createAdminMaterial", "updateAdminMaterial", "deleteAdminMaterial",
      "listAdminCourses", "getAdminCourseById", "createAdminCourse", "updateAdminCourse", "deleteAdminCourse",
      "listAdminTutors", "getAdminTutorById", "createAdminTutor", "updateAdminTutor", "deleteAdminTutor"
    ]) {
      assert.equal(typeof repository[name as keyof typeof repository], "function", name);
    }
  });

  test("lists subjects with explicit columns, bounded pagination, search, and deterministic order", async () => {
    mockClient = new MockClient([{ data: [], error: null }]);
    await repository.listAdminSubjects({ search: "  intro,%_  ", limit: 10, offset: 20 });

    assert.deepEqual(mockClient.calls.find((call) => call.method === "from")?.args, ["subjects"]);
    assert.deepEqual(mockClient.calls.find((call) => call.method === "select")?.args, [repository.SUBJECT_SELECT_COLUMNS]);
    assert.deepEqual(mockClient.calls.find((call) => call.method === "or")?.args, ["slug.ilike.%intro%,name.ilike.%intro%"]);
    assert.deepEqual(mockClient.calls.filter((call) => call.method === "order").map((call) => call.args), [
      ["created_at", { ascending: false }],
      ["id", { ascending: false }]
    ]);
    assert.deepEqual(mockClient.calls.find((call) => call.method === "range")?.args, [20, 29]);
  });

  test("lists each product-backed entity with kind and publication filters", async () => {
    for (const [list, kind, child] of [
      [repository.listAdminMaterials, "material", "materials"],
      [repository.listAdminCourses, "course", "courses"],
      [repository.listAdminTutors, "tutor", "tutors"]
    ] as const) {
      mockClient = new MockClient([{ data: [], error: null }]);
      await list({ publication_status: "published" as never, limit: 5 });
      assert.equal(mockClient.calls.find((call) => call.method === "from")?.args[0], "products");
      assert.deepEqual(mockClient.calls.filter((call) => call.method === "eq").map((call) => call.args), [
        ["kind", kind],
        ["publication_status", "published"]
      ]);
      const select = String(mockClient.calls.find((call) => call.method === "select")?.args[0]);
      assert.ok(select.includes(child));
      assert.ok(!select.includes("*"));
    }
  });

  test("gets by UUID and filters product kind before the query result", async () => {
    mockClient = new MockClient([{ data: { ...MATERIAL_PRODUCT, materials: MATERIAL_ROW }, error: null }]);
    const result = await repository.getAdminMaterialById(PRODUCT_ID);
    assert.equal(result?.id, PRODUCT_ID);
    assert.deepEqual(mockClient.calls.filter((call) => call.method === "eq").map((call) => call.args), [
      ["id", PRODUCT_ID],
      ["kind", "material"]
    ]);
  });

  test("creates all four groups through runtime-mocked server queries with restricted payloads", async () => {
    const subject = { id: SUBJECT_ID, slug: "marketing", name: "Marketing", category: CATEGORY, faculty_group: "Business", color_theme: COLOR_THEME };
    mockClient = new MockClient([{ data: subject, error: null }]);
    await repository.createAdminSubject({ slug: "marketing", name: "Marketing", category: CATEGORY, faculty_group: "Business", color_theme: COLOR_THEME });
    assert.deepEqual(mockClient.calls.find((call) => call.method === "insert")?.args, [{ slug: "marketing", name: "Marketing", category: "Marketing", faculty_group: "Business", color_theme: "marketing" }]);

    for (const [create, input, childTable, childRow, product] of [
      [repository.createAdminMaterial, { ...productInput(), pages: 20, tags: ["tag"] }, "materials", MATERIAL_ROW, MATERIAL_PRODUCT],
      [repository.createAdminCourse, { ...productInput({ delivery_kind: "live_session" }), format: "online", sessions: 4, duration: "4 weeks", schedule: "Sat", mentor: "Mentor" }, "courses", { product_id: PRODUCT_ID, format: "online", sessions: 4, duration: "4 weeks", schedule: "Sat", enrollment_status: "open", mentor: "Mentor", tags: [], curriculum: [], suitable_for: [], preparation: [], created_at: "", updated_at: "" }, { ...MATERIAL_PRODUCT, kind: "course" }],
      [repository.createAdminTutor, { ...productInput({ delivery_kind: "one_on_one_tutoring" }), format: "1:1", name: "Tutor", faculty: "Business", availability: "Weekends", short_bio: "Bio" }, "tutors", { product_id: PRODUCT_ID, name: "Tutor", faculty: "Business", format: "1:1", availability: "Weekends", short_bio: "Bio", strengths: [], tags: [], suitable_for: [], support_methods: [], created_at: "", updated_at: "" }, { ...MATERIAL_PRODUCT, kind: "tutor" }]
    ] as const) {
      mockClient = new MockClient([
        { data: product, error: null },
        { data: childRow, error: null }
      ]);
      await create(input as never);
      const productInsert = mockClient.calls.find((call) => call.method === "insert" && call.table === "products");
      const childInsert = mockClient.calls.find((call) => call.method === "insert" && call.table === childTable);
      assert.equal((productInsert?.args[0] as Record<string, unknown>).kind, product.kind);
      assert.equal((childInsert?.args[0] as Record<string, unknown>).product_id, PRODUCT_ID);
      assert.equal("role" in (productInsert?.args[0] as Record<string, unknown>), false);
      assert.equal("user_id" in (childInsert?.args[0] as Record<string, unknown>), false);
    }
  });

  test("updates and deletes four entities with UUID filters", async () => {
    mockClient = new MockClient([{ data: { ...MATERIAL_PRODUCT, materials: MATERIAL_ROW }, error: null }]);
    await repository.updateAdminMaterial(PRODUCT_ID, { pages: 24 });
    assert.deepEqual(mockClient.calls.filter((call) => call.method === "eq").map((call) => call.args).slice(0, 1), [["product_id", PRODUCT_ID]]);
    assert.equal((mockClient.calls.find((call) => call.method === "update")?.args[0] as Record<string, unknown>).pages, 24);

    for (const [update, del, input] of [
      [repository.updateAdminSubject, repository.deleteAdminSubject, { name: "Updated" }],
      [repository.updateAdminCourse, repository.deleteAdminCourse, { mentor: "Updated" }],
      [repository.updateAdminTutor, repository.deleteAdminTutor, { availability: "Updated" }]
    ] as const) {
      mockClient = new MockClient([{ data: { id: PRODUCT_ID }, error: null }]);
      await update(PRODUCT_ID, input as never);
      assert.ok(mockClient.calls.some((call) => call.method === "eq" && call.args[0] === "id"));
      mockClient = new MockClient([{ data: { id: PRODUCT_ID }, error: null }]);
      assert.equal(await del(PRODUCT_ID), true);
      assert.ok(mockClient.calls.some((call) => call.method === "delete"));
      assert.ok(mockClient.calls.some((call) => call.method === "eq" && call.args[0] === "id"));
    }
  });

  test("validates UUID, slug, status, required fields, and forbidden payload fields before client creation", async () => {
    const invalidOperations: Array<() => Promise<unknown>> = [
      () => repository.getAdminSubjectById("not-a-uuid"),
      () => repository.deleteAdminMaterial("not-a-uuid"),
      () => repository.createAdminSubject({ slug: "Bad Slug", name: "Name", category: CATEGORY, faculty_group: "Faculty", color_theme: COLOR_THEME }),
      () => repository.createAdminMaterial({ ...productInput({ role: "admin" }), pages: 2 } as never),
      () => repository.listAdminSubjects({ publication_status: "pending" as never }),
      () => repository.createAdminCourse({ ...productInput({ price_vnd: null, is_contact_for_price: false }), format: "online", sessions: 1, duration: "1", schedule: "1", mentor: "M" } as never)
    ];
    for (const operation of invalidOperations) {
      mockClient = new MockClient();
      await assert.rejects(operation, repository.AdminCatalogInputError);
      assert.equal(mockClient.calls.length, 0);
    }
  });

  test("maps client factory and database failures to generic errors without leaking raw details", async () => {
    mockCreateClientError = new Error("secret=jwt PII@example.test");
    await assert.rejects(() => repository.listAdminSubjects(), (error: unknown) => {
      assert.ok(error instanceof repository.AdminCatalogRepositoryError);
      assert.doesNotMatch(String(error), /secret=jwt|PII@example\.test/);
      return true;
    });

    mockCreateClientError = null;
    mockClient = new MockClient([{ data: null, error: { message: "SQL PII@example.test", code: "42501" } }]);
    await assert.rejects(() => repository.getAdminSubjectById(SUBJECT_ID), (error: unknown) => {
      assert.ok(error instanceof repository.AdminCatalogRepositoryError);
      assert.doesNotMatch(String(error), /SQL|PII@example\.test|42501/);
      return true;
    });
  });

  test("uses only the server client, explicit selects, and no unsafe dynamic types", async () => {
    const source = await fs.readFile("lib/repositories/admin-catalog-repository.ts", "utf8");
    assert.match(source, /@\/lib\/supabase\/server/);
    assert.doesNotMatch(source, /@\/lib\/supabase\/browser|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
    assert.doesNotMatch(source, /\.select\("\*"\)/);
    assert.doesNotMatch(source, /\bany\b/);
  });
});
