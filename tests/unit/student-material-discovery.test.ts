import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { promisify } from "node:util";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const SUBJECT_A = "650e8400-e29b-41d4-a716-446655440000";
const SUBJECT_B = "650e8400-e29b-41d4-a716-446655440001";
const MATERIAL_A = "850e8400-e29b-41d4-a716-446655440000";
const MATERIAL_B = "850e8400-e29b-41d4-a716-446655440001";
const COURSE_B = "850e8400-e29b-41d4-a716-446655440002";

type Row = Record<string, any>;
let products: Row[] = [];
let subjects: Row[] = [];
let entitlements: Row[] = [];
let directGrants: Row[] = [];
let materials: Row[] = [];
let queries: string[] = [];
const execFileAsync = promisify(execFile);

const discoveryHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const scenario = JSON.parse(process.argv[1]);
const queryData = scenario;
globalThis.__seenTables = [];
globalThis.__seenSelections = [];
function client() {
  return {
    from(table) {
        globalThis.__seenTables.push(table);
      return {
        select(columns) {
          globalThis.__seenSelections.push([table, columns]);
          const filters = [];
          const inByField = new Map();
          const query = {
            eq(field, value) { filters.push([field, value]); return query; },
            in(field, values) { inByField.set(field, values); return query; },
            order() { return query; },
            limit() { return query; },
            then(resolve, reject) {
              const eq = (field, value) => filters.find(([name]) => name === field)?.[1] === value;
              let rows = [];
              if (table === "product_entitlements") rows = queryData.entitlements.filter((row) => eq("user_id", row.user_id) && eq("status", row.status));
              if (table === "products") rows = queryData.products.filter((row) => inByField.get("id")?.includes(row.id) && inByField.get("kind")?.includes(row.kind));
              if (table === "subjects") rows = queryData.subjects.filter((row) => inByField.get("id")?.includes(row.id));
              if (table === "materials") rows = queryData.materials.filter((row) => inByField.get("product_id")?.includes(row.product_id));
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
}
const directRows = JSON.stringify(scenario.directGrants);
const source = (await readFile("lib/repositories/student-material-discovery-repository.ts", "utf8"))
  .replace('import "server-only";', "")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => (" + client.toString().replaceAll("queryData", JSON.stringify(scenario)) + ")();")
  .replace(/import \{[\s\S]*?\} from "@\/lib\/repositories\/material-direct-access-repository";/, "const getMaterialDirectGrantsForUser = async (userId) => " + directRows + ".filter((grant) => grant.user_id === userId); const isActiveMaterialDirectGrant = (grant, userId, materialId) => grant.user_id === userId && grant.material_id === materialId && grant.can_view && grant.revoked_at === null && (grant.expires_at === null || Date.parse(grant.expires_at) > Date.now());");
const compiled = await transform(source, { loader: "ts", format: "esm", sourcefile: "student-material-discovery-repository.ts" });
const loaded = await import("data:text/javascript," + encodeURIComponent(compiled.code));
console.log(JSON.stringify({ result: await loaded.getStudentMaterialDiscovery(scenario.userId), queryTables: globalThis.__seenTables, selections: globalThis.__seenSelections }));
`;

async function runDiscovery(data: Record<string, unknown>): Promise<any> {
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx/esm", "-e", discoveryHarness, JSON.stringify(data)], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim());
}

function reset(): void {
  products = [
    { id: MATERIAL_A, subject_id: SUBJECT_A, kind: "material", title: "Tài liệu cấp riêng A", description: "Nội dung A" },
    { id: MATERIAL_B, subject_id: SUBJECT_B, kind: "material", title: "Tài liệu entitlement B", description: "Nội dung B" },
    { id: COURSE_B, subject_id: SUBJECT_B, kind: "course", title: "Khóa học B", description: "Khóa B" }
  ];
  subjects = [
    { id: SUBJECT_A, slug: "ke-toan", name: "Kế toán", category: "Kế toán", color_theme: "accounting" },
    { id: SUBJECT_B, slug: "marketing", name: "Marketing", category: "Marketing", color_theme: "marketing" }
  ];
  entitlements = [{ user_id: USER_ID, product_id: COURSE_B, status: "active", expires_at: null, revoked_at: null }];
  directGrants = [{ user_id: USER_ID, material_id: MATERIAL_A, can_view: true, can_download: false, expires_at: "2099-01-01T00:00:00.000Z", revoked_at: null }];
  materials = [{ product_id: MATERIAL_A, allow_download: true }, { product_id: MATERIAL_B, allow_download: false }];
  queries = [];
}

function createClientMock() {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          const filters: Array<[string, unknown]> = [];
          const inValuesByField = new Map<string, unknown[]>();
          const query: any = {
            eq(field: string, value: unknown) { filters.push([field, value]); return query; },
            in(field: string, values: unknown[]) { inValuesByField.set(field, values); return query; },
            order() { return query; },
            limit() { return query; },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              queries.push(table);
              const eq = (field: string, value: unknown) => filters.find(([name]) => name === field)?.[1] === value;
              let rows: Row[] = [];
              if (table === "product_entitlements") rows = entitlements.filter((row) => eq("user_id", row.user_id) && eq("status", row.status));
              if (table === "products") rows = products.filter((row) => inValuesByField.get("id")?.includes(row.id) && inValuesByField.get("kind")?.includes(row.kind));
              if (table === "subjects") rows = subjects.filter((row) => inValuesByField.get("id")?.includes(row.id));
              if (table === "materials") rows = materials.filter((row) => inValuesByField.get("product_id")?.includes(row.product_id));
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
}

test("discovery returns entitlement and direct-grant subjects with one bounded batch per table", async () => {
  reset();
  const discovery = await runDiscovery({ userId: USER_ID, products, subjects, entitlements, directGrants, materials });
  const result = discovery.result;

  assert.deepEqual(result.subjects.map((subject: Row) => ({ slug: subject.slug, source: subject.accessSource })), [
    { slug: "ke-toan", source: "direct_grant" },
    { slug: "marketing", source: "entitlement" }
  ]);
  assert.deepEqual(result.directMaterials, [{
    productId: MATERIAL_A,
    title: "Tài liệu cấp riêng A",
    subjectSlug: "ke-toan",
    subjectName: "Kế toán",
    allowDownload: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
    workspacePage: 1
  }]);
  assert.deepEqual(discovery.queryTables.sort(), ["materials", "product_entitlements", "products", "subjects"]);
  assert.deepEqual(discovery.selections.filter(([table]: [string, string]) => table === "products" || table === "materials").sort(), [
    ["materials", "product_id, allow_download"],
    ["products", "id, subject_id, kind, title, description"]
  ]);
  assert.ok(discovery.selections.every(([, columns]: [string, string]) => columns !== "*"));
});

test("direct-grant-only published, draft, and archived materials satisfy the discovery repository contract", async () => {
  for (const publicationStatus of ["published", "draft", "archived"]) {
    const scenario = {
      userId: USER_ID,
      products: [{ id: MATERIAL_A, subject_id: SUBJECT_A, kind: "material", title: `Grant ${publicationStatus}`, description: "Material description", publication_status: publicationStatus }],
      subjects: [{ id: SUBJECT_A, slug: "ke-toan", name: "Kế toán", category: "Kế toán", color_theme: "accounting" }],
      entitlements: [],
      directGrants: [{ user_id: USER_ID, material_id: MATERIAL_A, can_view: true, can_download: false, expires_at: null, revoked_at: null }],
      materials: [{ product_id: MATERIAL_A, allow_download: true }]
    };

    const discovery = await runDiscovery(scenario);

    assert.deepEqual(discovery.result.directMaterials.map((material: Row) => material.productId), [MATERIAL_A], publicationStatus);
    assert.equal(discovery.result.directMaterials[0].allowDownload, false, "a view grant must not inherit materials.allow_download");
    assert.deepEqual(discovery.result.subjects.map((subject: Row) => subject.accessSource), ["direct_grant"]);
    assert.deepEqual(discovery.queryTables.sort(), ["materials", "product_entitlements", "products", "subjects"]);
  }
});

test("discovery excludes expired, revoked, view-disabled, foreign, and mismatched direct grants", async () => {
  const invalidGrants = [
    { user_id: USER_ID, material_id: MATERIAL_A, can_view: true, can_download: false, expires_at: "2020-01-01T00:00:00.000Z", revoked_at: null },
    { user_id: USER_ID, material_id: MATERIAL_A, can_view: true, can_download: false, expires_at: null, revoked_at: "2026-09-01T00:00:00.000Z" },
    { user_id: USER_ID, material_id: MATERIAL_A, can_view: false, can_download: false, expires_at: null, revoked_at: null },
    { user_id: OTHER_USER_ID, material_id: MATERIAL_A, can_view: true, can_download: false, expires_at: null, revoked_at: null },
    { user_id: USER_ID, material_id: MATERIAL_B, can_view: true, can_download: false, expires_at: null, revoked_at: null }
  ];

  for (const directGrant of invalidGrants) {
    const discovery = await runDiscovery({
      userId: USER_ID,
      products: [{ id: MATERIAL_A, subject_id: SUBJECT_A, kind: "material", title: "Draft material", description: "Private draft", publication_status: "draft" }],
      subjects: [{ id: SUBJECT_A, slug: "ke-toan", name: "Kế toán", category: "Kế toán", color_theme: "accounting" }],
      entitlements: [],
      directGrants: [directGrant],
      materials: [{ product_id: MATERIAL_A, allow_download: false }]
    });
    assert.deepEqual(discovery.result, { subjects: [], directMaterials: [] });
  }
});

test("draft and archived materials without a direct grant or entitlement are not discovered", async () => {
  for (const publicationStatus of ["draft", "archived"]) {
    const discovery = await runDiscovery({
      userId: USER_ID,
      products: [{ id: MATERIAL_A, subject_id: SUBJECT_A, kind: "material", title: "Hidden material", description: "Private", publication_status: publicationStatus }],
      subjects: [{ id: SUBJECT_A, slug: "ke-toan", name: "Kế toán", category: "Kế toán", color_theme: "accounting" }],
      entitlements: [],
      directGrants: [],
      materials: [{ product_id: MATERIAL_A, allow_download: true }]
    });
    assert.deepEqual(discovery.result, { subjects: [], directMaterials: [] }, publicationStatus);
    assert.equal(discovery.queryTables.includes("products"), false, "unauthorized unpublished IDs are never queried");
  }
});

test("discovery fails closed for inactive or foreign grants and never falls back to material policy", async () => {
  directGrants = [
    { user_id: USER_ID, material_id: MATERIAL_A, can_view: false, can_download: false, expires_at: null, revoked_at: null },
    { user_id: USER_ID, material_id: MATERIAL_B, can_view: true, can_download: true, expires_at: "2020-01-01T00:00:00.000Z", revoked_at: null },
    { user_id: OTHER_USER_ID, material_id: MATERIAL_A, can_view: true, can_download: true, expires_at: null, revoked_at: null }
  ];
  entitlements = [];

  const result = (await runDiscovery({ userId: USER_ID, products, subjects, entitlements, directGrants, materials })).result;

  assert.deepEqual(result, { subjects: [], directMaterials: [] });
});

test("dashboard renders real subject and direct-material links with permission labels", async () => {
  const { StudentDashboardClient } = await import("../../app/ca-nhan/dashboard-client");
  const dashboard = createElement(StudentDashboardClient, {
    todayDate: "2026-09-11",
    materialDiscovery: {
      subjects: [{ id: SUBJECT_A, slug: "ke-toan", name: "Kế toán", category: "Kế toán", colorTheme: "accounting", accessSource: "direct_grant" }],
      directMaterials: [
        { productId: MATERIAL_A, title: "Tài liệu cấp riêng A", subjectSlug: "ke-toan", subjectName: "Kế toán", allowDownload: false, expiresAt: "2099-01-01T00:00:00.000Z", workspacePage: 1 },
        { productId: MATERIAL_B, title: "Tài liệu cấp riêng B", subjectSlug: "ke-toan", subjectName: "Kế toán", allowDownload: true, expiresAt: null, workspacePage: 1 }
      ]
    }
  });
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} } as never;
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(PathnameContext.Provider, { value: "/ca-nhan" }, dashboard)));

  assert.match(html, /Môn học có quyền truy cập/);
  assert.match(html, /Môn khả dụng/);
  assert.match(html, /Tài liệu cấp riêng A/);
  assert.match(html, /Tài liệu cấp riêng B/);
  assert.match(html, /Chỉ xem/);
  assert.match(html, /Được phép tải/);
  assert.match(html, /href="\/ca-nhan\/mon\/ke-toan"/);
  assert.match(html, new RegExp(`href="/ca-nhan/mon/ke-toan\\?page=1&amp;material=${MATERIAL_A}"`));
  assert.doesNotMatch(html, /marketing|MATERIAL_OUTSIDE/);
});
