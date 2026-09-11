/** Runtime-mock tests for the typed server-side admin catalog repository. */

import assert from "node:assert/strict";
import { test, describe, before, afterEach } from "node:test";
import * as fs from "node:fs/promises";
import type { AdminCatalogMutateArgs, AdminMaterialAtomicMutateArgs } from "../../lib/supabase/database.types";

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

  rpc(name: string, args: unknown): Promise<QueryResult> {
    this.calls.push({ method: "rpc", args: [name, args] });
    return Promise.resolve(this.nextResponse());
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
  allow_download: false,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z"
};

const SUBJECT_ROW = {
  id: SUBJECT_ID,
  slug: "marketing",
  name: "Marketing",
  category: CATEGORY,
  faculty_group: "Business",
  color_theme: COLOR_THEME,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z"
};

function productInput(extra: object = {}) {
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

function rpcArgs(call: Call | undefined): AdminCatalogMutateArgs {
  const value = call?.args[1];
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected typed RPC arguments.");
  return value as AdminCatalogMutateArgs;
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

  test("creates all four groups through one typed atomic RPC with restricted payloads", async () => {
    mockClient = new MockClient([{ data: { subject: SUBJECT_ROW }, error: null }]);
    await repository.createAdminSubject({ slug: "marketing", name: "Marketing", category: CATEGORY, faculty_group: "Business", color_theme: COLOR_THEME });
    assert.deepEqual(mockClient.calls.find((call) => call.method === "rpc")?.args, ["admin_subject_mutate_atomic", { p_operation: "create", p_subject: { slug: "marketing", name: "Marketing", category: "Marketing", faculty_group: "Business", color_theme: "marketing" } }]);
    assert.equal(mockClient.calls.some((call) => ["insert", "update", "delete"].includes(call.method)), false);

    for (const [create, input, childTable, childRow, product] of [
      [repository.createAdminMaterial, { ...productInput(), pages: 20, tags: ["tag"] }, "materials", MATERIAL_ROW, MATERIAL_PRODUCT],
      [repository.createAdminCourse, { ...productInput({ delivery_kind: "live_session" }), format: "online", sessions: 4, duration: "4 weeks", schedule: "Sat", mentor: "Mentor" }, "courses", { product_id: PRODUCT_ID, format: "online", sessions: 4, duration: "4 weeks", schedule: "Sat", enrollment_status: "open", mentor: "Mentor", tags: [], curriculum: [], suitable_for: [], preparation: [], created_at: "", updated_at: "" }, { ...MATERIAL_PRODUCT, kind: "course" }],
      [repository.createAdminTutor, { ...productInput({ delivery_kind: "one_on_one_tutoring" }), format: "1:1 (Online)", name: "Tutor", faculty: "Business", availability: "Weekends", short_bio: "Bio" }, "tutors", { product_id: PRODUCT_ID, name: "Tutor", faculty: "Business", format: "1:1 (Online)", availability: "Weekends", short_bio: "Bio", strengths: [], tags: [], suitable_for: [], support_methods: [], created_at: "", updated_at: "" }, { ...MATERIAL_PRODUCT, kind: "tutor" }]
    ] as const) {
      mockClient = new MockClient([
        { data: { product }, error: null },
        { data: { ...product, [childTable]: childRow }, error: null }
      ]);
      await create(input as never);
      const rpc = mockClient.calls.find((call) => call.method === "rpc");
      assert.equal(rpc?.args[0], "admin_catalog_mutate_v2");
      const args = rpcArgs(rpc);
      assert.equal(args.p_operation, "create");
      assert.equal(args.p_kind, product.kind);
      assert.equal(args.p_product_id, undefined);
      assert.equal(mockClient.calls.some((call) => call.method === "insert" || call.method === "update" || call.method === "delete"), false);
    }
  });

  test("updates and deletes four entities with UUID filters", async () => {
    mockClient = new MockClient([
      { data: { product: MATERIAL_PRODUCT, child: MATERIAL_ROW }, error: null },
      { data: { ...MATERIAL_PRODUCT, materials: MATERIAL_ROW }, error: null }
    ]);
    await repository.updateAdminMaterial(PRODUCT_ID, { pages: 24 });
    const materialRpc = mockClient.calls.find((call) => call.method === "rpc");
    const materialArgs = rpcArgs(materialRpc);
    assert.equal(materialArgs.p_operation, "update");
    assert.equal(materialArgs.p_product_id, PRODUCT_ID);
    assert.deepEqual(materialArgs.p_child, { pages: 24 });
    assert.equal(mockClient.calls.some((call) => call.method === "insert" || call.method === "update" || call.method === "delete"), false);

    for (const [update, del, input] of [
      [repository.updateAdminSubject, repository.deleteAdminSubject, { name: "Updated" }],
      [repository.updateAdminCourse, repository.deleteAdminCourse, { mentor: "Updated" }],
      [repository.updateAdminTutor, repository.deleteAdminTutor, { availability: "Updated" }]
    ] as const) {
      const updated = { ...MATERIAL_PRODUCT, kind: "mentor" in input ? "course" : "tutor" };
      const updatedProduct = update === repository.updateAdminSubject
        ? SUBJECT_ROW
        : updated.kind === "course"
          ? { ...updated, courses: { product_id: PRODUCT_ID, format: "online", sessions: 1, duration: "1 week", schedule: "Saturday", enrollment_status: "open", mentor: "Mentor", tags: [], curriculum: [], suitable_for: [], preparation: [], created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" } }
          : { ...updated, tutors: { product_id: PRODUCT_ID, name: "Tutor", faculty: "Business", format: "1:1 (Online)", availability: "Weekends", short_bio: "Bio", strengths: [], tags: [], suitable_for: [], support_methods: [], created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" } };
      mockClient = new MockClient([
        { data: update === repository.updateAdminSubject ? { subject: SUBJECT_ROW } : { product: updated }, error: null },
        { data: updatedProduct, error: null }
      ]);
      await update(PRODUCT_ID, input as never);
      assert.ok(mockClient.calls.some((call) => call.method === "rpc"));
      if (update === repository.updateAdminTutor) assert.deepEqual((rpcArgs(mockClient.calls.find((call) => call.method === "rpc"))).p_child, { availability: "Updated" });
      if (update === repository.updateAdminSubject) assert.equal(mockClient.calls.find((call) => call.method === "rpc")?.args[0], "admin_subject_mutate_atomic");
      mockClient = new MockClient([{ data: { deleted: true, id: PRODUCT_ID }, error: null }]);
      assert.equal(await del(PRODUCT_ID), true);
      assert.equal(mockClient.calls.filter((call) => call.method === "rpc").length, 1);
      assert.equal(mockClient.calls.some((call) => ["insert", "update", "delete"].includes(call.method)), false);
    }
  });

  test("sends material metadata and either download-policy state through one atomic RPC", async () => {
    for (const allowDownload of [false, true]) {
      mockClient = new MockClient([
        { data: { product: MATERIAL_PRODUCT, child: { ...MATERIAL_ROW, allow_download: allowDownload } }, error: null },
        { data: { ...MATERIAL_PRODUCT, materials: { ...MATERIAL_ROW, allow_download: allowDownload } }, error: null }
      ]);
      await repository.updateAdminMaterial(PRODUCT_ID, { pages: 24, allow_download: allowDownload });
      const rpc = mockClient.calls.find((call) => call.method === "rpc");
      assert.equal(rpc?.args[0], "admin_material_mutate_atomic");
      const args = rpc?.args[1] as AdminMaterialAtomicMutateArgs;
      assert.equal(args.p_operation, "update");
      assert.equal(args.p_product_id, PRODUCT_ID);
      assert.deepEqual(args.p_material, { pages: 24, allow_download: allowDownload });
      assert.equal(mockClient.calls.filter((call) => call.method === "rpc").length, 1);
      assert.equal(mockClient.calls.some((call) => ["insert", "update", "delete"].includes(call.method)), false);
    }
  });

  test("an atomic material RPC failure has no second mutation or follow-up read", async () => {
    mockClient = new MockClient([{ data: null, error: { message: "policy constraint failed", code: "23514" } }]);
    await assert.rejects(
      () => repository.updateAdminMaterial(PRODUCT_ID, { pages: 24, allow_download: true }),
      (error: unknown) => error instanceof repository.AdminCatalogRepositoryError && !String(error).includes("policy constraint")
    );
    assert.deepEqual(mockClient.calls.filter((call) => call.method === "rpc").map((call) => call.args[0]), ["admin_material_mutate_atomic"]);
    assert.equal(mockClient.calls.some((call) => ["insert", "update", "delete", "from"].includes(call.method)), false);
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

  test("validates every contact-price and bounded VND combination before the RPC", async () => {
    const invalidInputs = [
      productInput({ price_vnd: 10000, old_price_vnd: null, is_contact_for_price: true }),
      productInput({ price_vnd: null, old_price_vnd: 10000, is_contact_for_price: true }),
      productInput({ price_vnd: null, old_price_vnd: null, is_contact_for_price: false }),
      productInput({ price_vnd: 10000, old_price_vnd: 9999, is_contact_for_price: false }),
      productInput({ price_vnd: -1, old_price_vnd: null, is_contact_for_price: false }),
      productInput({ price_vnd: 1.5, old_price_vnd: null, is_contact_for_price: false }),
      productInput({ price_vnd: 2_147_483_648, old_price_vnd: null, is_contact_for_price: false }),
      productInput({ price_vnd: 10000, old_price_vnd: 2_147_483_648, is_contact_for_price: false })
    ];
    for (const input of invalidInputs) {
      mockClient = new MockClient();
      await assert.rejects(() => repository.createAdminMaterial({ ...input, pages: 20 } as never), repository.AdminCatalogInputError);
      assert.equal(mockClient.calls.length, 0);
    }
  });

  test("validates category/theme, delivery semantics, and atomic tutor associations before the RPC", async () => {
    const tutorInput = { ...productInput({ delivery_kind: "one_on_one_tutoring" }), format: "1:1 (Online)", name: "Tutor", faculty: "Business", availability: "Weekends", short_bio: "Bio" };
    const invalidInputs = [
      () => repository.createAdminMaterial({ ...productInput({ delivery_kind: "live_session" }), pages: 20 } as never),
      () => repository.createAdminCourse({ ...productInput({ delivery_kind: "recorded_video" }), format: "online", sessions: 1, duration: "1", schedule: "1", mentor: "M" } as never),
      () => repository.createAdminTutor({ ...tutorInput, subject_associations: [{ subject_id: SUBJECT_ID, is_primary: true }, { subject_id: SUBJECT_ID, is_primary: false }] } as never),
      () => repository.createAdminTutor({ ...tutorInput, subject_associations: [{ subject_id: PRODUCT_ID, is_primary: true }] } as never),
      () => repository.createAdminSubject({ slug: "marketing", name: "Marketing", category: CATEGORY, faculty_group: "Business", color_theme: "economics" as never })
    ];
    for (const operation of invalidInputs) {
      mockClient = new MockClient();
      await assert.rejects(operation, repository.AdminCatalogInputError);
      assert.equal(mockClient.calls.length, 0);
    }

    mockClient = new MockClient([
      { data: { product: { ...MATERIAL_PRODUCT, kind: "tutor", delivery_kind: "one_on_one_tutoring" }, child: {} }, error: null },
      { data: { ...MATERIAL_PRODUCT, kind: "tutor", delivery_kind: "one_on_one_tutoring", tutors: { product_id: PRODUCT_ID, name: "Tutor", faculty: "Business", format: "1:1 (Online)", availability: "Weekends", short_bio: "Bio", strengths: [], tags: [], suitable_for: [], support_methods: [], created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" } }, error: null }
    ]);
    await repository.createAdminTutor(tutorInput as never);
    const rpc = mockClient.calls.find((call) => call.method === "rpc");
    assert.equal(rpc?.args[0], "admin_catalog_mutate_v2");
    assert.deepEqual((rpc?.args[1] as { p_child: unknown }).p_child, {
      name: "Tutor", faculty: "Business", format: "1:1 (Online)", availability: "Weekends", short_bio: "Bio",
      subject_associations: [{ subject_id: SUBJECT_ID, is_primary: true }]
    });
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

  test("keeps product and child mutations atomic at the RPC boundary", async () => {
    mockClient = new MockClient([{ data: null, error: { message: "child constraint failed", code: "23514" } }]);
    await assert.rejects(
      () => repository.createAdminMaterial({ ...productInput(), pages: 20 } as never),
      (error: unknown) => error instanceof repository.AdminCatalogRepositoryError && !String(error).includes("child constraint")
    );
    assert.equal(mockClient.calls.filter((call) => call.method === "rpc").length, 1);
    assert.equal(mockClient.calls.some((call) => ["insert", "update", "delete"].includes(call.method)), false);

    mockClient = new MockClient([{ data: null, error: null }]);
    assert.equal(await repository.deleteAdminMaterial(PRODUCT_ID), false);
    assert.equal(mockClient.calls.some((call) => call.method === "from"), false);

    mockClient = new MockClient([{ data: { product: { id: "not-a-uuid" } }, error: null }]);
    await assert.rejects(() => repository.updateAdminMaterial(PRODUCT_ID, { pages: 24 } as never), repository.AdminCatalogRepositoryError);
    assert.equal(mockClient.calls.filter((call) => call.method === "rpc").length, 1);
  });

  test("keeps tutor association failure inside the atomic RPC contract", async () => {
    const tutorInput = { ...productInput({ delivery_kind: "one_on_one_tutoring" }), format: "1:1 (Online)", name: "Tutor", faculty: "Business", availability: "Weekends", short_bio: "Bio" };
    mockClient = new MockClient([{ data: null, error: { message: "association constraint PII@example.test", code: "23514" } }]);
    await assert.rejects(
      () => repository.createAdminTutor(tutorInput as never),
      (error: unknown) => error instanceof repository.AdminCatalogRepositoryError && !String(error).includes("association constraint") && !String(error).includes("PII@example.test")
    );
    const rpc = mockClient.calls.find((call) => call.method === "rpc");
    assert.equal(rpc?.args[0], "admin_catalog_mutate_v2");
    assert.equal(mockClient.calls.some((call) => ["insert", "update", "delete"].includes(call.method)), false);
  });

  test("uses only the server client, explicit selects, and no unsafe dynamic types", async () => {
    const source = await fs.readFile("lib/repositories/admin-catalog-repository.ts", "utf8");
    assert.match(source, /@\/lib\/supabase\/server/);
    assert.doesNotMatch(source, /@\/lib\/supabase\/browser|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
    assert.doesNotMatch(source, /\.select\("\*"\)/);
    assert.doesNotMatch(source, /from\("subjects"\)[\s\S]*\.(?:insert|update|delete)\(/);
    assert.doesNotMatch(source, /\bany\b/);
  });
});
