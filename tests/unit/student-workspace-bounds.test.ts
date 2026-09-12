import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const SUBJECT_ID = "650e8400-e29b-41d4-a716-446655440000";

type QueryRecord = { table: string; inValues: unknown[] | null; range: [number, number] | null; limit: number | null; orders: string[] };
type Row = Record<string, any>;

let subject: Row;
let products: Row[];
let entitlements: Row[];
let directGrants: Row[];
let materials: Row[];
let lessons: Row[];
let requests: QueryRecord[];
let directGrantBatchCalls: string[][];
let repository: any;

function uuid(index: number): string {
  return `850e8400-e29b-41d4-a716-${index.toString(16).padStart(12, "0")}`;
}

function resetData(): void {
  subject = { id: SUBJECT_ID, slug: "ke-toan", name: "Kế toán", category: "Kế toán", faculty_group: "UFM", color_theme: "accounting" };
  products = [];
  entitlements = [];
  directGrants = [];
  materials = [];
  lessons = [];
  requests = [];
  directGrantBatchCalls = [];
}

function execute(table: string, filters: Array<[string, unknown]>, inFilter: [string, unknown[]] | null, range: [number, number] | null, limit: number | null, orders: string[]): { data: unknown; error: null } {
  const eq = (field: string, value: unknown) => filters.find(([name]) => name === field)?.[1] === value;
  const ids = inFilter?.[1].map(String) ?? [];
  let rows: Row[];
  if (table === "subjects") rows = subject && eq("slug", subject.slug) ? [subject] : [];
  else if (table === "products") rows = products.filter((row) => eq("subject_id", row.subject_id) && ids.includes(row.kind));
  else if (table === "product_entitlements") rows = entitlements.filter((row) => eq("user_id", row.user_id) && ids.includes(row.product_id));
  else if (table === "materials") rows = materials.filter((row) => ids.includes(row.product_id));
  else if (table === "course_lessons") rows = lessons.filter((row) => ids.includes(row.course_id));
  else rows = [];

  for (const field of orders.slice().reverse()) rows = rows.slice().sort((left, right) => typeof left[field] === "number" && typeof right[field] === "number"
    ? left[field] - right[field]
    : String(left[field]).localeCompare(String(right[field])));
  if (range) rows = rows.slice(range[0], range[1] + 1);
  if (limit !== null) rows = rows.slice(0, limit);
  return { data: table === "subjects" ? (rows[0] ?? null) : rows, error: null };
}

function createMockClient() {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          const filters: Array<[string, unknown]> = [];
          let inFilter: [string, unknown[]] | null = null;
          let range: [number, number] | null = null;
          let limit: number | null = null;
          const orders: string[] = [];
          const query: any = {
            eq(field: string, value: unknown) { filters.push([field, value]); return query; },
            in(field: string, values: unknown[]) { inFilter = [field, values]; return query; },
            order(field: string) { orders.push(field); return query; },
            range(from: number, to: number) { range = [from, to]; return query; },
            limit(value: number) { limit = value; return query; },
            maybeSingle: async () => execute(table, filters, inFilter, range, limit, orders),
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              requests.push({ table, inValues: inFilter?.[1] ?? null, range, limit, orders: [...orders] });
              return Promise.resolve(execute(table, filters, inFilter, range, limit, orders)).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
}

function configureProducts(count: number, allEntitled = true): void {
  products = Array.from({ length: count }, (_, index) => {
    const id = uuid(index + 1);
    const kind = index % 2 === 0 ? "material" : "course";
    return { id, subject_id: SUBJECT_ID, kind, title: `${kind}-${index}`, description: `${kind} description` };
  });
  entitlements = products
    .filter((_product, index) => allEntitled || index === 0)
    .map((product) => ({ user_id: USER_ID, product_id: product.id, status: "active", expires_at: null, revoked_at: null }));
  materials = products.filter((product) => product.kind === "material").map((product) => ({ product_id: product.id, pages: 10 }));
  lessons = products.filter((product) => product.kind === "course").flatMap((product) => [
    { id: uuid(10_000 + Number.parseInt(product.id.slice(-4), 16) * 2), course_id: product.id, title: "Second", description: null, duration_minutes: 2, order_index: 2 },
    { id: uuid(20_000 + Number.parseInt(product.id.slice(-4), 16) * 2), course_id: product.id, title: "First", description: null, duration_minutes: 1, order_index: 1 }
  ]);
}

before(async () => {
  resetData();
  const serverPath = require.resolve("../../lib/supabase/server");
  require.cache[serverPath] = {
    id: serverPath,
    filename: serverPath,
    loaded: true,
    exports: { createClient: async () => createMockClient() }
  } as any;
  const directAccessPath = require.resolve("../../lib/repositories/material-direct-access-repository");
  require.cache[directAccessPath] = {
    id: directAccessPath,
    filename: directAccessPath,
    loaded: true,
    exports: {
      getMaterialDirectGrantsForUserAndMaterials: async (_userId: string, materialIds: string[]) => { directGrantBatchCalls.push([...materialIds]); return directGrants.filter((grant) => materialIds.includes(grant.material_id)); },
      isActiveMaterialDirectGrant: (grant: Row, userId: string, materialId: string) => grant.user_id === userId && grant.material_id === materialId && grant.revoked_at === null && (grant.expires_at === null || Date.parse(grant.expires_at) > Date.now())
    }
  } as any;
  repository = await import("../../lib/repositories/student-workspace-repository");
});

afterEach(() => resetData());

test("workspace reads normal material/course data with deterministic bounded queries", async () => {
  configureProducts(2);
  const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");

  assert.equal(result?.hasNextPage, false);
  assert.deepEqual(result?.materials.map((row: any) => row.productId), [products[0].id]);
  assert.deepEqual(result?.courses.map((row: any) => row.productId), [products[1].id]);
  assert.deepEqual(result?.courses[0].lessons.map((row: any) => row.orderIndex), [1, 2]);
  assert.ok(requests.every((request) => !request.inValues || request.inValues.length <= repository.STUDENT_WORKSPACE_ID_CHUNK_SIZE));
  assert.ok(requests.some((request) => request.table === "products" && request.range?.[0] === 0));
});

test("workspace skips child and entitlement queries when their ID lists are empty", async () => {
  configureProducts(1);
  products[0].kind = "material";
  materials = [{ product_id: products[0].id, pages: 3 }];
  const materialOnly = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");
  assert.equal(materialOnly?.materials.length, 1);
  assert.equal(requests.some((request) => request.table === "course_lessons"), false);

  resetData();
  configureProducts(1);
  products[0].kind = "course";
  materials = [];
  lessons = [{ id: uuid(30_000), course_id: products[0].id, title: "Lesson", description: null, duration_minutes: 1, order_index: 1 }];
  const courseOnly = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");
  assert.equal(courseOnly?.courses.length, 1);
  assert.equal(requests.some((request) => request.table === "materials"), false);
});

test("direct-granted materials are visible without entitlement and use direct download permission", async () => {
  configureProducts(1);
  entitlements = [];
  products[0].kind = "material";
  materials = [{ product_id: products[0].id, pages: 3, allow_download: false }];
  directGrants = [{ user_id: USER_ID, material_id: products[0].id, can_view: true, can_download: true, revoked_at: null, expires_at: null }];

  const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");

  assert.deepEqual(result?.materials.map((row: any) => ({ productId: row.productId, allowDownload: row.allowDownload })), [{ productId: products[0].id, allowDownload: true }]);
});

test("direct-grant-only published, draft, and archived materials satisfy the workspace repository contract", async () => {
  for (const publicationStatus of ["published", "draft", "archived"]) {
    resetData();
    configureProducts(1);
    products[0].kind = "material";
    products[0].publication_status = publicationStatus;
    entitlements = [];
    materials = [{ product_id: products[0].id, pages: 3, allow_download: true }];
    directGrants = [{ user_id: USER_ID, material_id: products[0].id, can_view: true, can_download: false, revoked_at: null, expires_at: null }];

    const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");

    assert.deepEqual(result?.materials.map((row: any) => row.productId), [products[0].id], publicationStatus);
    assert.equal(result?.materials[0].allowDownload, false, "can_view does not inherit the material's download setting");
    assert.deepEqual(requests.map((request) => request.table), ["products", "product_entitlements", "materials"]);
    assert.deepEqual(directGrantBatchCalls, [[products[0].id]], "grant lookup remains one bounded batch, not one query per row");
  }
});

test("draft and archived workspace materials without a direct grant or entitlement are hidden by repository authorization", async () => {
  for (const publicationStatus of ["draft", "archived"]) {
    resetData();
    configureProducts(1);
    products[0].kind = "material";
    products[0].publication_status = publicationStatus;
    entitlements = [];
    directGrants = [];

    const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");

    assert.equal(result, null, publicationStatus);
    assert.equal(requests.some((request) => request.table === "materials"), false, "child metadata is not fetched without an authorized product");
  }
});

test("entitled materials explicitly fall back to materials.allow_download when no direct grant exists", async () => {
  configureProducts(1);
  products[0].kind = "material";
  for (const allowDownload of [true, false]) {
    materials = [{ product_id: products[0].id, pages: 3, allow_download: allowDownload }];
    directGrants = [];

    const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");

    assert.deepEqual(result?.materials.map((row: any) => ({ productId: row.productId, allowDownload: row.allowDownload })), [{ productId: products[0].id, allowDownload }]);
    assert.deepEqual(directGrantBatchCalls, [[products[0].id]], `direct-grant lookup must not replace entitlement fallback for allow_download=${allowDownload}`);
    resetData();
    configureProducts(1);
    products[0].kind = "material";
  }
});

test("a direct grant for another subject/product does not alter the current workspace", async () => {
  configureProducts(1);
  products[0].kind = "material";
  materials = [{ product_id: products[0].id, pages: 3, allow_download: false }];
  const otherSubjectProductId = "750e8400-e29b-41d4-a716-446655440000";
  directGrants = [{ user_id: USER_ID, material_id: otherSubjectProductId, can_view: true, can_download: true, revoked_at: null, expires_at: null }];

  const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");

  assert.deepEqual(result?.materials.map((row: any) => ({ productId: row.productId, allowDownload: row.allowDownload })), [{ productId: products[0].id, allowDownload: false }]);
  assert.deepEqual(directGrantBatchCalls, [[products[0].id]]);
});

test("direct grants override entitlement visibility and download policy without fallback", async () => {
  configureProducts(1);
  products[0].kind = "material";
  materials = [{ product_id: products[0].id, pages: 3, allow_download: true }];

  for (const grant of [
    { user_id: USER_ID, material_id: products[0].id, can_view: true, can_download: false, revoked_at: null, expires_at: null },
    { user_id: USER_ID, material_id: products[0].id, can_view: true, can_download: true, revoked_at: null, expires_at: null },
    { user_id: USER_ID, material_id: products[0].id, can_view: false, can_download: false, revoked_at: null, expires_at: null },
    { user_id: USER_ID, material_id: products[0].id, can_view: true, can_download: true, revoked_at: "2026-09-01T00:00:00.000Z", expires_at: null },
    { user_id: USER_ID, material_id: products[0].id, can_view: true, can_download: true, revoked_at: null, expires_at: "2020-01-01T00:00:00.000Z" }
  ]) {
    directGrants = [grant];
    const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");
    if (grant.can_view && grant.revoked_at === null && (grant.expires_at === null || Date.parse(grant.expires_at) > Date.now())) {
      assert.equal(result?.materials[0].allowDownload, grant.can_download);
    } else {
      assert.equal(result, null);
    }
  }
});

test("direct grants are isolated by learner and material identity", async () => {
  configureProducts(2);
  products[0].kind = "material";
  products[1].kind = "material";
  materials = products.map((product) => ({ product_id: product.id, pages: 3, allow_download: false }));
  directGrants = [
    { user_id: "750e8400-e29b-41d4-a716-446655440000", material_id: products[0].id, can_view: true, can_download: true, revoked_at: null, expires_at: null },
    { user_id: USER_ID, material_id: products[1].id, can_view: true, can_download: true, revoked_at: null, expires_at: null }
  ];
  entitlements = [];

  const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");

  assert.deepEqual(result?.materials.map((row: any) => row.productId), [products[1].id]);
  assert.equal(result?.materials[0].allowDownload, true);
});

test("workspace page boundary sizes are bounded and never claim an incomplete page is complete", async () => {
  for (const count of [0, 1, 99, 100, 101, 499, 500]) {
    resetData();
    configureProducts(count);
    const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");
    if (count === 0) {
      assert.equal(result, null);
      assert.equal(requests.some((request) => request.table === "product_entitlements"), false);
      continue;
    }
    assert.equal((result?.materials.length ?? 0) + (result?.courses.length ?? 0), Math.min(count, repository.STUDENT_WORKSPACE_PAGE_SIZE), String(count));
    assert.equal(result?.page, 1);
    assert.equal(result?.hasPreviousPage, false);
    assert.equal(result?.hasNextPage, count > repository.STUDENT_WORKSPACE_PAGE_SIZE, String(count));
    assert.equal(result?.hasHardOverflow, false, String(count));
  }
});

test("workspace continuation returns every authorized product once in deterministic order without N+1", async () => {
  configureProducts(205);
  const pages = await Promise.all([1, 2, 3].map((page) => repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan", page)));
  assert.deepEqual(pages.map((page: any) => page?.hasNextPage), [true, true, false]);
  assert.ok(pages.every((page: any) => page && !page.hasHardOverflow));
  const materials = pages.flatMap((page: any) => page.materials).map((row: any) => row.productId);
  const courses = pages.flatMap((page: any) => page.courses);
  assert.deepEqual(materials, products.filter((row) => row.kind === "material").map((row) => row.id).sort());
  assert.deepEqual(courses.map((row: any) => row.productId), products.filter((row) => row.kind === "course").map((row) => row.id).sort());
  assert.equal(new Set([...materials, ...courses.map((row: any) => row.productId)]).size, 205);
  assert.ok(courses.every((course: any) => course.lessons.length === 2 && course.lessons.map((lesson: any) => lesson.orderIndex).join(",") === "1,2"));
  assert.ok(requests.every((request) => !request.inValues || request.inValues.length <= repository.STUDENT_WORKSPACE_ID_CHUNK_SIZE));
  assert.ok(requests.filter((request) => request.table === "product_entitlements").length < 205);
  assert.ok(requests.filter((request) => request.table === "product_entitlements").every((request) => request.orders.includes("product_id")));
  assert.equal(directGrantBatchCalls.length, 8);
  assert.ok(directGrantBatchCalls.every((batch) => batch.length <= repository.STUDENT_WORKSPACE_ID_CHUNK_SIZE));
  assert.ok(requests.filter((request) => request.table === "course_lessons").every((request) => request.orders.join(",") === "course_id,order_index,id"));
});

test("workspace marks the fifth page as hard overflow at 501 authorized products", async () => {
  configureProducts(repository.STUDENT_WORKSPACE_MAX_AUTHORIZED_PRODUCTS + 1);
  const result = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan", repository.STUDENT_WORKSPACE_MAX_PAGES);
  assert.equal(result?.page, 5);
  assert.equal((result?.materials.length ?? 0) + (result?.courses.length ?? 0), 100);
  assert.equal(result?.hasNextPage, false);
  assert.equal(result?.hasHardOverflow, true);
  await assert.rejects(() => repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan", repository.STUDENT_WORKSPACE_MAX_PAGES + 1), repository.StudentWorkspaceRepositoryError);
});

test("lesson hard overflow is explicit at 2,001 without dropping the first deterministic 2,000", async () => {
  configureProducts(1);
  products[0].kind = "course";
  materials = [];
  const courseId = products[0].id;
  lessons = Array.from({ length: repository.STUDENT_WORKSPACE_MAX_LESSONS }, (_, index) => ({ id: uuid(50_000 + index), course_id: courseId, title: `Lesson ${index + 1}`, description: null, duration_minutes: 1, order_index: index + 1 }));
  const complete = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");
  assert.equal(complete?.courses[0].lessons.length, 2_000);
  assert.equal(complete?.hasHardOverflow, false);

  lessons.push({ id: uuid(60_000), course_id: courseId, title: "Overflow", description: null, duration_minutes: 1, order_index: 2_001 });
  const overflow = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");
  assert.equal(overflow?.courses[0].lessons.length, 2_000);
  assert.equal(overflow?.hasHardOverflow, true);
  assert.deepEqual(overflow?.courses[0].lessons.map((lesson: any) => lesson.orderIndex), Array.from({ length: 2_000 }, (_, index) => index + 1));
});

test("unauthorized continuation does not reveal a later workspace page", async () => {
  configureProducts(205, false);
  const first = await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan");
  assert.equal((first?.materials.length ?? 0) + (first?.courses.length ?? 0), 1);
  assert.equal(first?.hasNextPage, false);
  assert.equal(await repository.getAuthorizedStudentWorkspace(USER_ID, "ke-toan", 2), null);
});

test("workspace bounds are server-controlled safe constants, with no client page/limit input", () => {
  assert.ok(Number.isSafeInteger(repository.STUDENT_WORKSPACE_PAGE_SIZE));
  assert.ok(Number.isSafeInteger(repository.STUDENT_WORKSPACE_ID_CHUNK_SIZE));
  assert.ok(Number.isSafeInteger(repository.STUDENT_WORKSPACE_MAX_AUTHORIZED_PRODUCTS));
  assert.ok(Number.isSafeInteger(repository.STUDENT_WORKSPACE_MAX_LESSONS));
});
