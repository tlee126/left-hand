import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const SUBJECT_ID = "650e8400-e29b-41d4-a716-446655440000";
const OTHER_SUBJECT_ID = "750e8400-e29b-41d4-a716-446655440001";
const PRODUCT_ID = "850e8400-e29b-41d4-a716-446655440000";
const OTHER_PRODUCT_ID = "950e8400-e29b-41d4-a716-446655440000";
let timeline: string[] = [];
let access: any;
let subject: any;
let products: any[];
let entitlement: any;
let subjectCalls: string[] = [];
let productCalls: string[] = [];
let entitlementCalls: Array<[string, string]> = [];
let Page: any;
let getWorkspace: any;

function reset() {
  timeline = []; subjectCalls = []; productCalls = []; entitlementCalls = [];
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "student" } };
  subject = { id: SUBJECT_ID, slug: "ke-toan", name: "Kế toán", category: "core", faculty_group: "UFM", color_theme: "blue" };
  products = [{ id: PRODUCT_ID, subject_id: SUBJECT_ID, kind: "material", title: "Tài liệu", description: "Đã duyệt" }];
  entitlement = { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
}

before(async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  const original = moduleLoader._load;
  moduleLoader._load = function(request: string, ...args: any[]) {
    if (request === "server-only") return {};
    if (request === "next/navigation") return { redirect: (url: string) => { const error: any = new Error("redirect"); error.kind = "redirect"; error.url = url; throw error; }, notFound: () => { const error: any = new Error("notFound"); error.kind = "notFound"; throw error; } };
    if (request === "./workspace-client") return { SubjectWorkspaceClient: (props: any) => ({ type: "workspace", props }) };
    return original.call(this, request, ...args);
  };
  const mock = (path: string, exports: Record<string, unknown>) => { require.cache[path] = { id: path, filename: path, loaded: true, exports } as any; };
  mock(require.resolve("../../lib/auth/session"), { getAccountAccess: async () => { timeline.push("session guard"); return access; } });
  mock(require.resolve("../../lib/supabase/server"), { createClient: async () => ({ from: (table: string) => ({ select: () => ({ eq: (field: string, value: string) => { if (table === "subjects") { timeline.push("subject lookup"); subjectCalls.push(`${field}:${value}`); return { maybeSingle: async () => ({ data: subject, error: null }) }; } if (table === "products") { productCalls.push(`${field}:${value}`); return { in: async () => ({ data: products, error: null }) }; } if (table === "product_entitlements") { timeline.push("entitlement lookup"); entitlementCalls.push([value, ""]); return { eq: (_productField: string, productId: string) => { entitlementCalls[entitlementCalls.length - 1][1] = productId; return { maybeSingle: async () => ({ data: entitlement, error: null }) }; } }; } return { maybeSingle: async () => ({ data: null, error: null }) }; }, in: async () => ({ data: [], error: null }) }), in: () => ({ order: async () => ({ data: [], error: null }) }) }) }) });
  ({ getAuthorizedStudentWorkspace: getWorkspace } = await import("../../lib/repositories/student-workspace-repository"));
  ({ default: Page } = await import("../../app/ca-nhan/mon/[slug]/page"));
  moduleLoader._load = original;
});

afterEach(reset);

async function renderPage() { return Page({ params: Promise.resolve({ slug: "ke-toan" }), searchParams: Promise.resolve({}) }); }
async function expectRedirect(url: string) { await assert.rejects(renderPage(), (error: any) => error.kind === "redirect" && error.url === url); }

test("session guards run before repository calls and preserve lifecycle redirects", async () => {
  for (const [status, url] of [["unauthenticated", "/dang-nhap?next=%2Fca-nhan%2Fmon%2Fke-toan"], ["pending", "/cho-duyet"], ["rejected", "/cho-duyet?status=rejected"], ["suspended", "/cho-duyet?status=suspended"], ["profile_missing", "/cho-duyet?status=missing-profile"]] as const) {
    access = { status, user: status === "unauthenticated" ? null : { id: USER_ID }, profile: null };
    await expectRedirect(url);
    assert.deepEqual(timeline, ["session guard"]);
    timeline = [];
  }
});

test("approved admin redirects without subject or entitlement lookup", async () => {
  access.profile.role = "admin";
  await expectRedirect("/quan-tri");
  assert.deepEqual(timeline, ["session guard"]);
});

test("unknown subject is not found after lookup and before entitlement", async () => {
  subject = null;
  await assert.rejects(renderPage(), (error: any) => error.kind === "notFound");
  assert.deepEqual(timeline, ["session guard", "subject lookup"]);
  assert.deepEqual(entitlementCalls, []);
});

test("blocks no, expired, revoked, wrong-user, or wrong-product entitlement without workspace data", async () => {
  for (const invalid of [null, { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: "2020-01-01T00:00:00.000Z" }, { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: "2026-01-01T00:00:00.000Z", expires_at: null }, { status: "active", user_id: OTHER_USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null }, { status: "active", user_id: USER_ID, product_id: OTHER_PRODUCT_ID, revoked_at: null, expires_at: null }]) {
    entitlement = invalid;
    await assert.rejects(renderPage(), (error: any) => error.kind === "notFound");
    assert.equal(timeline.includes("entitlement lookup"), true);
    timeline = [];
  }
});

test("exact matching entitlement authorizes only its requested-subject product with canonical UUIDs", async () => {
  access.user.id = USER_ID.toUpperCase();
  products[0].id = PRODUCT_ID.toUpperCase();
  products[0].subject_id = SUBJECT_ID.toUpperCase();
  entitlement = { status: "active", user_id: USER_ID.toUpperCase(), product_id: PRODUCT_ID.toUpperCase(), revoked_at: null, expires_at: null };
  const result = await renderPage();
  assert.equal(typeof result.type, "function");
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.deepEqual(timeline, ["session guard", "subject lookup", "entitlement lookup"]);
  assert.equal(result.props.workspace.materials.length, 0);
});

test("another subject product does not unlock the requested subject and queries are exact", async () => {
  products = [{ id: OTHER_PRODUCT_ID, subject_id: OTHER_SUBJECT_ID, kind: "material", title: "Other", description: "Other" }];
  await assert.rejects(renderPage(), (error: any) => error.kind === "notFound");
  assert.deepEqual(subjectCalls, ["slug:ke-toan"]);
  assert.deepEqual(productCalls, [`subject_id:${SUBJECT_ID}`]);
  assert.deepEqual(entitlementCalls, []);
});

test("client boundary exposes no storage details and opens only the signed-url endpoint", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("app/ca-nhan/mon/[slug]/workspace-client.tsx", "utf8"));
  assert.match(source, /\/api\/materials\/\$\{encodeURIComponent\(productId\)\}\/signed-url/);
  for (const forbidden of ["storage_path", "storagePath", "bucket", "purchasedSubjects", "localStorage", "supabase"]) assert.equal(source.includes(forbidden), false, forbidden);
  assert.match(source, /Chưa có dữ liệu/);
});
