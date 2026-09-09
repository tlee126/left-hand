import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { purchasedSubjects } from "../../data/student-demo";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const SUBJECT_ID = "650e8400-e29b-41d4-a716-446655440000";
const OTHER_SUBJECT_ID = "750e8400-e29b-41d4-a716-446655440001";
const PRODUCT_ID = "850e8400-e29b-41d4-a716-446655440000";
const OTHER_PRODUCT_ID = "950e8400-e29b-41d4-a716-446655440000";
const STORAGE_PATH = `materials/${PRODUCT_ID}/v1/850e8400-e29b-41d4-a716-446655440000-private.pdf`;
const BUCKET_NAME = "materials";
const RAW_ERROR = "raw database error email@example.test";
const PII = "student-phone-0900000000";
const UNSET = Symbol("unset");

type AccessDecision = {
  status: "unauthenticated" | "pending" | "rejected" | "suspended" | "profile_missing" | "approved";
  user: { id: string } | null;
  profile: { role: string } | null;
};

type QueryErrorFlags = { subject: boolean; product: boolean; entitlement: boolean };

let timeline: string[] = [];
let access: AccessDecision;
let subject: Record<string, unknown> | null;
let products: Array<Record<string, unknown>>;
let materialRows: Array<Record<string, unknown>>;
let lessonRows: Array<Record<string, unknown>>;
let entitlementRows: Array<Record<string, unknown>>;
let entitlementOverride: unknown | typeof UNSET;
let queryErrors: QueryErrorFlags;
let requestedSlug = "ke-toan";
let subjectCalls: string[] = [];
let productCalls: string[] = [];
let entitlementCalls: Array<[string, string]> = [];
let materialCalls: string[][] = [];
let lessonCalls: string[][] = [];
let capturedButtons: Array<Record<string, unknown>> = [];
let renderedWorkspace: unknown = null;
let clientInitialTab: "overview" | "documents" | null = null;
let Page: any;
let RealSubjectWorkspaceClient: any;
let realWorkspaceRepository: any;

const workspaceData = {
  subject: {
    slug: "ke-toan",
    name: "Kế toán thật",
    category: "Kế toán",
    facultyGroup: "UFM",
    colorTheme: "accounting"
  },
  materials: [{
    productId: PRODUCT_ID,
    title: "Tài liệu được cấp quyền",
    description: "Nội dung thật từ workspace",
    pages: 24
  }],
  courses: [],
  hasNextPage: false
};

function activeEntitlement(userId = USER_ID, productId = PRODUCT_ID): Record<string, unknown> {
  return {
    status: "active",
    user_id: userId,
    product_id: productId,
    revoked_at: null,
    expires_at: null,
    granted_by: PII,
    storage_path: STORAGE_PATH,
    bucket: BUCKET_NAME
  };
}

function reset() {
  timeline = [];
  capturedButtons = [];
  renderedWorkspace = null;
  clientInitialTab = null;
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "student" } };
  subject = {
    id: SUBJECT_ID,
    slug: "ke-toan",
    name: "Kế toán thật",
    category: "Kế toán",
    faculty_group: "UFM",
    color_theme: "accounting"
  };
  products = [{
    id: PRODUCT_ID,
    subject_id: SUBJECT_ID,
    kind: "material",
    title: "Tài liệu được cấp quyền",
    description: "Nội dung thật từ workspace"
  }];
  materialRows = [{ product_id: PRODUCT_ID, pages: 24 }];
  lessonRows = [];
  entitlementRows = [activeEntitlement()];
  entitlementOverride = UNSET;
  queryErrors = { subject: false, product: false, entitlement: false };
  requestedSlug = "ke-toan";
  subjectCalls = [];
  productCalls = [];
  entitlementCalls = [];
  materialCalls = [];
  lessonCalls = [];
}

function uuidEquals(left: unknown, right: unknown): boolean {
  return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase();
}

function queryError(message = RAW_ERROR): Error {
  return new Error(message);
}

function resultForTable(table: string, filters: Array<[string, unknown]>): { data: unknown; error: Error | null } {
  if (table === "subjects") {
    if (queryErrors.subject) return { data: null, error: queryError() };
    const slug = filters.find(([field]) => field === "slug")?.[1];
    return { data: subject && slug === subject.slug ? subject : null, error: null };
  }

  if (table === "product_entitlements") {
    if (queryErrors.entitlement) return { data: null, error: queryError() };
    if (entitlementOverride !== UNSET) return { data: entitlementOverride, error: null };
    const userId = filters.find(([field]) => field === "user_id")?.[1];
    const productId = filters.find(([field]) => field === "product_id")?.[1];
    const status = filters.find(([field]) => field === "status")?.[1];
    const matchingRows = entitlementRows.filter((row) => (
      uuidEquals(row.user_id, userId)
      && uuidEquals(row.product_id, productId)
      && (status === undefined || row.status === status)
    ));
    if (matchingRows.length > 1) return { data: null, error: queryError("multiple rows for entitlement") };
    return { data: matchingRows[0] ?? null, error: null };
  }

  return { data: null, error: null };
}

function createSupabaseMock() {
  return {
    from(table: string) {
      return {
        select(_columns: string) {
          const filters: Array<[string, unknown]> = [];
          let inValues: unknown[] = [];
          const query = {
            eq(field: string, value: unknown) {
              filters.push([field, value]);
              if (table === "subjects") subjectCalls.push(`${field}:${String(value)}`);
              if (table === "products" && field === "subject_id") productCalls.push(`${field}:${String(value)}`);
              if (table === "product_entitlements" && field === "user_id") entitlementCalls.push([String(value), ""]);
              if (table === "product_entitlements" && field === "product_id") {
                const lastCall = entitlementCalls[entitlementCalls.length - 1];
                if (lastCall) lastCall[1] = String(value);
              }
              return query;
            },
            in(field: string, _values: unknown[]) {
              inValues = _values;
              if (table === "product_entitlements" && field === "product_id") {
                const lastCall = entitlementCalls[entitlementCalls.length - 1];
                if (lastCall) lastCall[1] = _values.map(String).join(",");
              }
              return query;
            },
            order() {
              return query;
            },
            limit() {
              return query;
            },
            range() {
              return query;
            },
            maybeSingle: async () => {
              if (table === "subjects") timeline.push("subject lookup");
              if (table === "product_entitlements") timeline.push("entitlement lookup");
              return resultForTable(table, filters);
            },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              if (table === "product_entitlements") timeline.push("entitlement lookup");
              if (table === "products") timeline.push("product lookup");
              if (table === "materials") materialCalls.push(inValues.map(String));
              if (table === "course_lessons") lessonCalls.push(inValues.map(String));
              let result: { data: unknown; error: Error | null };
              if (table === "product_entitlements") {
                if (queryErrors.entitlement) result = { data: null, error: queryError() };
                else if (entitlementOverride !== UNSET) result = { data: Array.isArray(entitlementOverride) ? entitlementOverride : entitlementOverride ? [entitlementOverride] : [], error: null };
                else result = { data: entitlementRows.filter((row) => uuidEquals(row.user_id, filters.find(([name]) => name === "user_id")?.[1]) && inValues.some((value) => uuidEquals(row.product_id, value))), error: null };
              } else if (table === "products") {
                result = queryErrors.product ? { data: null, error: queryError() } : { data: products, error: null };
              } else if (table === "materials") {
                result = { data: materialRows, error: null };
              } else if (table === "course_lessons") {
                result = { data: lessonRows, error: null };
              } else {
                result = { data: [], error: null };
              }
              return Promise.resolve(result).then(resolve, reject);
            }
          };
          return query;
        }
      };
    }
  };
}

function runtimeAdapter(tag: string) {
  return function Adapter(props: Record<string, unknown>) {
    return createElement(tag, null, props.children as any);
  };
}

function iconAdapter(name: string) {
  return function Icon(props: Record<string, unknown>) {
    return createElement("span", { "data-icon": name, ...(props as object) });
  };
}

function flattenText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join("");
  if (value && typeof value === "object" && "props" in value) return flattenText((value as { props: { children?: unknown } }).props.children);
  return "";
}

async function renderPage(slug = requestedSlug): Promise<any> {
  return Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
}

async function renderPageMarkup(slug = requestedSlug): Promise<string> {
  return renderToStaticMarkup(await renderPage(slug));
}

async function expectNotFound(action: () => Promise<unknown>): Promise<void> {
  await assert.rejects(action, (error: any) => error.kind === "notFound");
}

async function renderRealClient(workspace: unknown): Promise<string> {
  return renderToStaticMarkup(createElement(RealSubjectWorkspaceClient, { workspace }));
}

before(async () => {
  reset();
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  const originalModuleLoad = moduleLoader._load;
  let clientComponent: any;
  const reactModule = require("react") as { useState: (initialState: unknown) => unknown };
  const realUseState = reactModule.useState;
  reactModule.useState = (initialState: unknown) => {
    if (clientInitialTab === "documents" && initialState === "overview") return ["documents", () => {}];
    return realUseState(initialState as any);
  };

  moduleLoader._load = function(request: string, ...args: any[]) {
    if (request === "server-only") return {};
    if (request === "next/navigation") {
      return {
        redirect: (url: string) => {
          const error: any = new Error("redirect");
          error.kind = "redirect";
          error.url = url;
          throw error;
        },
        notFound: () => {
          const error: any = new Error("notFound");
          error.kind = "notFound";
          throw error;
        }
      };
    }
    if (request === "next/link") {
      return function Link(props: Record<string, unknown>) {
        return createElement("a", { href: props.href, className: props.className }, props.children as any);
      };
    }
    if (request === "lucide-react") {
      return {
        ArrowLeft: iconAdapter("ArrowLeft"),
        BookOpen: iconAdapter("BookOpen"),
        Download: iconAdapter("Download"),
        FileText: iconAdapter("FileText"),
        Home: iconAdapter("Home"),
        Sparkles: iconAdapter("Sparkles")
      };
    }
    if (request === "react/jsx-runtime") {
      const realRuntime = originalModuleLoad.call(this, request, ...args) as Record<string, unknown>;
      const capture = (type: unknown, props: Record<string, unknown> | null) => {
        if (type === "button" && props) capturedButtons.push(props);
      };
      return {
        ...realRuntime,
        jsx: (type: unknown, props: Record<string, unknown>, key: unknown) => {
          capture(type, props);
          return (realRuntime.jsx as Function)(type, props, key);
        },
        jsxs: (type: unknown, props: Record<string, unknown>, key: unknown) => {
          capture(type, props);
          return (realRuntime.jsxs as Function)(type, props, key);
        }
      };
    }
    if (request === "./workspace-client" && clientComponent) {
      return {
        SubjectWorkspaceClient: (props: Record<string, unknown>) => {
          timeline.push("client render");
          renderedWorkspace = props.workspace;
          return clientComponent(props);
        }
      };
    }
    return originalModuleLoad.call(this, request, ...args);
  };

  const setMock = (path: string, exports: Record<string, unknown>) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports } as any;
  };
  setMock(require.resolve("../../lib/auth/session"), {
    getAccountAccess: async () => {
      timeline.push("session guard");
      return access;
    }
  });
  setMock(require.resolve("../../lib/supabase/server"), { createClient: async () => createSupabaseMock() });
  setMock(require.resolve("../../components/site/header"), { Header: runtimeAdapter("header") });
  setMock(require.resolve("../../components/site/footer"), { Footer: runtimeAdapter("footer") });
  setMock(require.resolve("../../components/site/floating-actions"), { FloatingActions: runtimeAdapter("aside") });

  try {
    ({ SubjectWorkspaceClient: clientComponent } = await import("../../app/ca-nhan/mon/[slug]/workspace-client"));
    RealSubjectWorkspaceClient = clientComponent;

    const repository = await import("../../lib/repositories/student-workspace-repository");
    realWorkspaceRepository = repository.getAuthorizedStudentWorkspace;
    setMock(require.resolve("../../lib/repositories/student-workspace-repository"), {
      ...repository,
      getAuthorizedStudentWorkspace: async (userId: string, slug: string) => {
        const result = await realWorkspaceRepository(userId, slug);
        if (result) timeline.push("authorized workspace data");
        return result;
      }
    });

    ({ default: Page } = await import("../../app/ca-nhan/mon/[slug]/page"));
  } finally {
    moduleLoader._load = originalModuleLoad;
  }
});

afterEach(() => {
  reset();
  delete (globalThis as { window?: unknown }).window;
});

test("session guards stop before repository, workspace data, and client render", async () => {
  for (const [status, url] of [
    ["unauthenticated", "/dang-nhap?next=%2Fca-nhan%2Fmon%2Fke-toan"],
    ["pending", "/cho-duyet"],
    ["rejected", "/cho-duyet?status=rejected"],
    ["suspended", "/cho-duyet?status=suspended"],
    ["profile_missing", "/cho-duyet?status=missing-profile"]
  ] as const) {
    access = { status, user: status === "unauthenticated" ? null : { id: USER_ID }, profile: null };
    await assert.rejects(renderPage(), (error: any) => error.kind === "redirect" && error.url === url);
    assert.deepEqual(timeline, ["session guard"]);
    timeline = [];
  }
});

test("approved admin redirects without treating admin access as student entitlement", async () => {
  access.profile = { role: "admin" };
  await assert.rejects(renderPage(), (error: any) => error.kind === "redirect" && error.url === "/quan-tri");
  assert.deepEqual(timeline, ["session guard"]);
});

test("unknown database subject wins over a matching static purchasedSubjects entry", async () => {
  requestedSlug = purchasedSubjects[0].slug;
  subject = null;
  await expectNotFound(() => renderPage());
  assert.deepEqual(timeline, ["session guard", "subject lookup"]);
  assert.deepEqual(productCalls, []);
  assert.deepEqual(entitlementCalls, []);
});

test("cross-subject entitlement does not unlock the requested subject workspace", async () => {
  products = [
    { ...products[0] },
    {
      id: OTHER_PRODUCT_ID,
      subject_id: OTHER_SUBJECT_ID,
      kind: "material",
      title: "Subject B private material",
      description: "Not part of Subject A"
    }
  ];
  entitlementRows = [activeEntitlement(USER_ID, OTHER_PRODUCT_ID)];

  await expectNotFound(() => renderPage());

  assert.deepEqual(timeline, ["session guard", "subject lookup", "product lookup", "entitlement lookup"]);
  assert.deepEqual(subjectCalls, ["slug:ke-toan"]);
  assert.deepEqual(productCalls, [`subject_id:${SUBJECT_ID}`]);
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.deepEqual(materialCalls, []);
  assert.deepEqual(lessonCalls, []);
  assert.equal(renderedWorkspace, null);
  assert.deepEqual(capturedButtons, []);
  assert.equal(timeline.includes("authorized workspace data"), false);
  assert.equal(timeline.includes("client render"), false);
});

test("repository errors stop before workspace data and render", async () => {
  for (const scenario of ["subject", "product", "entitlement"] as const) {
    queryErrors[scenario] = true;
    await expectNotFound(() => renderPage());
    assert.equal(timeline.includes("authorized workspace data"), false);
    assert.equal(timeline.includes("client render"), false);
    if (scenario === "subject") assert.deepEqual(timeline, ["session guard", "subject lookup"]);
    if (scenario === "product") assert.deepEqual(timeline, ["session guard", "subject lookup", "product lookup"]);
    if (scenario === "entitlement") assert.deepEqual(timeline, ["session guard", "subject lookup", "product lookup", "entitlement lookup"]);
    reset();
  }
});

test("malformed, missing, revoked, expired, wrong-user, and wrong-product entitlements deny access", async () => {
  const invalidEntitlements: unknown[] = [
    null,
    { status: "active", user_id: "not-a-uuid", product_id: PRODUCT_ID, revoked_at: null, expires_at: null },
    { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: "2026-01-01T00:00:00.000Z", expires_at: null },
    { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: "2020-01-01T00:00:00.000Z" },
    { status: "active", user_id: OTHER_USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null },
    { status: "active", user_id: USER_ID, product_id: OTHER_PRODUCT_ID, revoked_at: null, expires_at: null }
  ];

  for (const invalid of invalidEntitlements) {
    entitlementOverride = invalid;
    await expectNotFound(() => renderPage());
    assert.deepEqual(timeline, ["session guard", "subject lookup", "product lookup", "entitlement lookup"]);
    assert.equal(timeline.includes("authorized workspace data"), false);
    assert.equal(timeline.includes("client render"), false);
    reset();
  }
});

test("multiple matching entitlement rows fail closed, while one valid row among unrelated rows succeeds", async () => {
  entitlementRows = [activeEntitlement(), activeEntitlement()];
  await expectNotFound(() => renderPage());
  assert.deepEqual(timeline, ["session guard", "subject lookup", "product lookup", "entitlement lookup"]);

  reset();
  entitlementRows = [activeEntitlement(), activeEntitlement(OTHER_USER_ID), activeEntitlement(USER_ID, OTHER_PRODUCT_ID)];
  const markup = await renderPageMarkup();
  assert.deepEqual(timeline, [
    "session guard",
    "subject lookup",
    "product lookup",
    "entitlement lookup",
    "authorized workspace data",
    "client render"
  ]);
  assert.match(markup, /Học liệu đã được cấp quyền/);
});

test("multiple entitlement rows with zero valid matches fail closed before workspace or signed-url access", async () => {
  entitlementRows = [
    activeEntitlement(USER_ID, OTHER_PRODUCT_ID),
    activeEntitlement(OTHER_USER_ID, PRODUCT_ID),
    { ...activeEntitlement(), status: "revoked", revoked_at: "2026-01-01T00:00:00.000Z" },
    { ...activeEntitlement(), expires_at: "2020-01-01T00:00:00.000Z" }
  ];

  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    return new Response(JSON.stringify({ url: "https://example.test/should-not-be-called" }), { status: 200 });
  };
  try {
    await expectNotFound(() => renderPage());
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(timeline, ["session guard", "subject lookup", "product lookup", "entitlement lookup"]);
  assert.deepEqual(subjectCalls, ["slug:ke-toan"]);
  assert.deepEqual(productCalls, [`subject_id:${SUBJECT_ID}`]);
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.deepEqual(materialCalls, []);
  assert.deepEqual(lessonCalls, []);
  assert.deepEqual(fetchCalls, []);
  assert.equal(renderedWorkspace, null);
  assert.deepEqual(capturedButtons, []);
  assert.equal(timeline.includes("authorized workspace data"), false);
  assert.equal(timeline.includes("client render"), false);
});

test("authorized page executes the complete guard-to-render timeline and passes exact canonical identities", async () => {
  access.user = { id: USER_ID.toUpperCase() };
  products[0].id = PRODUCT_ID.toUpperCase();
  products[0].subject_id = SUBJECT_ID.toUpperCase();
  entitlementRows = [activeEntitlement(USER_ID.toUpperCase(), PRODUCT_ID.toUpperCase())];
  materialRows = [{ product_id: PRODUCT_ID.toUpperCase(), pages: 24 }];

  const markup = await renderPageMarkup();
  assert.deepEqual(timeline, [
    "session guard",
    "subject lookup",
    "product lookup",
    "entitlement lookup",
    "authorized workspace data",
    "client render"
  ]);
  assert.deepEqual(subjectCalls, ["slug:ke-toan"]);
  assert.deepEqual(productCalls, [`subject_id:${SUBJECT_ID}`]);
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.match(markup, /Kế toán thật/);
  assert.match(markup, /Học liệu đã được cấp quyền/);
  assert.deepEqual(renderedWorkspace, {
    ...workspaceData,
    subject: { ...workspaceData.subject }
  });
});

test("real client renders an empty workspace as a fixed unavailable state", async () => {
  const emptyWorkspace = { ...workspaceData, materials: [], courses: [] };
  const markup = await renderRealClient(emptyWorkspace);
  assert.match(markup, /Chưa có dữ liệu/);
  assert.doesNotMatch(markup, /Tài liệu được cấp quyền|UNAUTHORIZED/);
});

test("real client renders only server-authorized fields and uses the signed-url API boundary", async () => {
  clientInitialTab = "documents";
  const markup = await renderPageMarkup();
  const materialButton = capturedButtons.find((button) => flattenText(button.children).includes("Mở tài liệu"));
  assert.ok(materialButton);
  assert.match(markup, /Tài liệu được cấp quyền/);
  assert.doesNotMatch(markup, /UNAUTHORIZED|purchasedSubjects|localStorage|left-hand-demo-auth/);
  assert.doesNotMatch(markup, new RegExp(`${STORAGE_PATH}|${BUCKET_NAME}|${RAW_ERROR}|${PII}`));

  const fetchCalls: Array<[string, RequestInit | undefined]> = [];
  const openedUrls: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push([String(input), init]);
    return new Response(JSON.stringify({ url: "https://example.test/private-signed-url" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  (globalThis as { window?: { open: (...args: string[]) => void } }).window = {
    open: (url: string) => openedUrls.push(url)
  };
  try {
    await (materialButton.onClick as () => Promise<void>)();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
  }
  assert.deepEqual(fetchCalls, [[`/api/materials/${PRODUCT_ID}/signed-url`, { method: "GET", cache: "no-store" }]]);
  assert.deepEqual(openedUrls, ["https://example.test/private-signed-url"]);
});

test("unauthorized output never contains product or material fields", async () => {
  entitlementOverride = null;
  products[0].title = "UNAUTHORIZED PRODUCT";
  products[0].description = "UNAUTHORIZED MATERIAL";
  await expectNotFound(() => renderPage());
  assert.equal(timeline.includes("authorized workspace data"), false);
  assert.equal(timeline.includes("client render"), false);
  assert.equal(JSON.stringify(timeline).includes("UNAUTHORIZED"), false);
});
