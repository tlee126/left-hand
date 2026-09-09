/** Runtime coverage for learning-progress repository, API, page, and workspace client. */

import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { createElement } from "react";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID = "650e8400-e29b-41d4-a716-446655440000";
const OTHER_PRODUCT_ID = "850e8400-e29b-41d4-a716-446655440000";
const ITEM_ID = "950e8400-e29b-41d4-a716-446655440000";
const OTHER_ITEM_ID = "a50e8400-e29b-41d4-a716-446655440000";
const NOW = "2026-09-07T00:00:00.000Z";
const RAW_ERROR = "database PII user@example.test secret=jwt";
const UNSET = Symbol("unset");

type Call = { method: string; table?: string; args: unknown[] };
type StoredRow = Record<string, unknown>;

let rows: StoredRow[] = [];
let entitlement: unknown | typeof UNSET = UNSET;
let materials: StoredRow[] = [];
let lessons: StoredRow[] = [];
let queryError: unknown = null;
let upsertError: unknown = null;
let createClientCalls = 0;
let calls: Call[] = [];
let access: any;
let Route: any;
let RealClient: any;
let timeline: string[] = [];
let recordProgressRead = false;

type HookSlot = { kind: "state"; value: unknown } | { kind: "ref"; value: { current: unknown } };
type HookRuntime = { slots: HookSlot[]; cursor: number };
let activeHookRuntime: HookRuntime | null = null;

function testUseState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
  if (!activeHookRuntime) throw new Error("Hook runtime is not active.");
  const index = activeHookRuntime.cursor++;
  let slot = activeHookRuntime.slots[index];
  if (!slot) {
    const value = typeof initial === "function" ? (initial as () => T)() : initial;
    slot = { kind: "state", value };
    activeHookRuntime.slots[index] = slot;
  }
  if (slot.kind !== "state") throw new Error("Hook order changed.");
  return [slot.value as T, (next) => {
    slot!.value = typeof next === "function" ? (next as (previous: T) => T)(slot!.value as T) : next;
  }];
}

function testUseRef<T>(initial: T): { current: T } {
  if (!activeHookRuntime) throw new Error("Hook runtime is not active.");
  const index = activeHookRuntime.cursor++;
  let slot = activeHookRuntime.slots[index];
  if (!slot) {
    slot = { kind: "ref", value: { current: initial } };
    activeHookRuntime.slots[index] = slot;
  }
  if (slot.kind !== "ref") throw new Error("Hook order changed.");
  return slot.value as { current: T };
}

function renderClient(props: unknown, runtime: HookRuntime) {
  runtime.cursor = 0;
  activeHookRuntime = runtime;
  try {
    return RealClient(props);
  } finally {
    activeHookRuntime = null;
  }
}

function walkRenderedTree(node: unknown, visit: (element: any) => void): void {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return;
  if (Array.isArray(node)) {
    node.forEach((child) => walkRenderedTree(child, visit));
    return;
  }
  if (typeof node !== "object") return;
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof element.type === "function") {
    walkRenderedTree((element.type as (props: unknown) => unknown)(element.props ?? {}), visit);
    return;
  }
  visit(element);
  walkRenderedTree(element.props?.children, visit);
}

function elementText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(elementText).join("");
  if (typeof node !== "object") return "";
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof element.type === "function") {
    return elementText((element.type as (props: unknown) => unknown)(element.props ?? {}));
  }
  return elementText(element.props?.children);
}

function buttonsFor(tree: unknown): any[] {
  const buttons: any[] = [];
  walkRenderedTree(tree, (element) => { if (element.type === "button") buttons.push(element); });
  return buttons;
}

function buttonWithText(tree: unknown, text: string): any {
  const button = buttonsFor(tree).find((candidate) => elementText(candidate.props?.children).includes(text));
  assert.ok(button, `Expected button containing ${text}`);
  return button;
}

function progressRow(overrides: StoredRow = {}): StoredRow {
  return {
    user_id: USER_ID,
    product_id: PRODUCT_ID,
    item_type: "lesson",
    item_id: ITEM_ID,
    status: "completed",
    watched_percent: 100,
    started_at: NOW,
    completed_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    ...overrides
  };
}

function activeEntitlement(overrides: StoredRow = {}): StoredRow {
  return {
    user_id: USER_ID,
    product_id: PRODUCT_ID,
    status: "active",
    revoked_at: null,
    expires_at: null,
    ...overrides
  };
}

function reset() {
  rows = [];
  entitlement = UNSET;
  materials = [{ product_id: PRODUCT_ID }];
  lessons = [{ id: ITEM_ID, course_id: PRODUCT_ID }];
  queryError = null;
  upsertError = null;
  createClientCalls = 0;
  calls = [];
  timeline = [];
  recordProgressRead = false;
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "student" } };
}

function resultFor(table: string, filters: Array<[string, unknown]>, operation: "many" | "single") {
  if (queryError) return { data: null, error: queryError };
  if (table === "learning_progress") {
    const userId = filters.find(([field]) => field === "user_id")?.[1];
    const productId = filters.find(([field]) => field === "product_id")?.[1];
    const result = rows.filter((row) => String(row.user_id).toLowerCase() === String(userId).toLowerCase()
      && String(row.product_id).toLowerCase() === String(productId).toLowerCase());
    return { data: operation === "many" ? result : result[0] ?? null, error: null };
  }
  if (table === "product_entitlements") {
    if (entitlement !== UNSET) return { data: entitlement, error: null };
    const userId = filters.find(([field]) => field === "user_id")?.[1];
    const productId = filters.find(([field]) => field === "product_id")?.[1];
    const status = filters.find(([field]) => field === "status")?.[1];
    const found = activeEntitlement({ user_id: userId, product_id: productId });
    return { data: status === "active" ? found : null, error: null };
  }
  if (table === "materials") {
    const id = filters.find(([field]) => field === "product_id")?.[1];
    return { data: materials.find((row) => row.product_id === id) ?? null, error: null };
  }
  if (table === "course_lessons") {
    const id = filters.find(([field]) => field === "id")?.[1];
    return { data: lessons.find((row) => row.id === id) ?? null, error: null };
  }
  return { data: null, error: null };
}

function createMockClient() {
  return {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ method: "rpc", args: [name, args] });
      timeline.push("progress write");
      if (upsertError) return Promise.resolve({ data: null, error: upsertError });
      const payload = {
        user_id: USER_ID,
        product_id: args.p_product_id,
        item_type: args.p_item_type,
        item_id: args.p_item_id,
        status: args.p_status,
        watched_percent: args.p_watched_percent,
        started_at: args.p_started_at,
        completed_at: args.p_completed_at
      };
      const key = [payload.user_id, payload.product_id, payload.item_type, payload.item_id].map(String).join(":");
      const index = rows.findIndex((row) => [row.user_id, row.product_id, row.item_type, row.item_id].map(String).join(":") === key);
      const saved = { ...progressRow(), ...payload, updated_at: NOW, created_at: index >= 0 ? rows[index].created_at : NOW };
      if (index >= 0) rows[index] = saved;
      else rows.push(saved);
      return Promise.resolve({ data: saved, error: null });
    },
    from(table: string) {
      calls.push({ method: "from", table, args: [] });
      if (table === "materials" || table === "course_lessons") {
        timeline.push("subject", "product");
      } else if (table === "product_entitlements") {
        timeline.push("entitlement");
      } else if (table === "learning_progress" && recordProgressRead) {
        timeline.push("progress read");
      }
      const filters: Array<[string, unknown]> = [];
      let pendingUpsert: StoredRow | null = null;
      const query: any = {
        select(...args: unknown[]) { calls.push({ method: "select", table, args }); return query; },
        eq(field: string, value: unknown) { calls.push({ method: "eq", table, args: [field, value] }); filters.push([field, value]); return query; },
        order(...args: unknown[]) { calls.push({ method: "order", table, args }); return query; },
        limit(...args: unknown[]) { calls.push({ method: "limit", table, args }); return query; },
        upsert(payload: StoredRow) {
          calls.push({ method: "upsert", table, args: [payload, { onConflict: "user_id,product_id,item_type,item_id" }] });
          timeline.push("progress write");
          pendingUpsert = payload;
          if (upsertError) return query;
          const key = [payload.user_id, payload.product_id, payload.item_type, payload.item_id].map(String).join(":");
          const index = rows.findIndex((row) => [row.user_id, row.product_id, row.item_type, row.item_id].map(String).join(":") === key);
          const saved = { ...progressRow(), ...payload, updated_at: NOW, created_at: index >= 0 ? rows[index].created_at : NOW };
          if (index >= 0) rows[index] = saved;
          else rows.push(saved);
          return query;
        },
        maybeSingle: async () => {
          calls.push({ method: "maybeSingle", table, args: [] });
          return resultFor(table, filters, "single");
        },
        single: async () => {
          calls.push({ method: "single", table, args: [] });
          if (upsertError) return { data: null, error: upsertError };
          if (queryError) return { data: null, error: queryError };
          return { data: pendingUpsert ? rows[rows.length - 1] : resultFor(table, filters, "single").data, error: null };
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          calls.push({ method: "execute", table, args: [] });
          return Promise.resolve(resultFor(table, filters, "many")).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function tracedRequest(body: Record<string, unknown>): Request {
  let validationRecorded = false;
  const trackedBody = new Proxy(body, {
    get(target, property, receiver) {
      if (!validationRecorded) {
        validationRecorded = true;
        timeline.push("validation");
      }
      return Reflect.get(target, property, receiver);
    }
  });
  return { json: async () => trackedBody } as Request;
}

const VALID_INPUT = {
  productId: PRODUCT_ID,
  itemType: "lesson",
  itemId: ITEM_ID,
  status: "completed",
  watchedPercent: 100,
  startedAt: NOW,
  completedAt: NOW
};

before(async () => {
  reset();
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  const originalModuleLoad = moduleLoader._load;
  const realReact = require("react") as Record<string, unknown>;
  const testReact = { ...realReact, useState: testUseState, useRef: testUseRef };
  const serverPath = require.resolve("../../lib/supabase/server");
  try { require(serverPath); } catch { /* mocked below */ }
  require.cache[serverPath] = {
    id: serverPath,
    filename: serverPath,
    loaded: true,
    exports: { createClient: async () => { createClientCalls += 1; return createMockClient(); } }
  } as any;
  moduleLoader._load = function(requestName: string, ...args: any[]) {
    if (requestName === "server-only") return {};
    if (requestName === "react") return testReact;
    return originalModuleLoad.call(this, requestName, ...args);
  };
  try {
    const repository = await import("../../lib/repositories/learning-progress-repository");
    const authPath = require.resolve("../../lib/auth/session");
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
      getAccountAccess: async () => { timeline.push("auth"); return access; }
    } } as any;
    moduleLoader._load = function(requestName: string, ...args: any[]) {
      if (requestName === "server-only") return {};
      if (requestName === "react") return testReact;
      if (requestName === "next/navigation") return { redirect: () => { throw new Error("redirect"); }, notFound: () => { throw new Error("notFound"); } };
      if (requestName === "next/link") return (props: any) => createElement("a", { href: props.href }, props.children);
      if (requestName === "lucide-react") return new Proxy({}, { get: (_target, name) => (props: any) => createElement("span", { "data-icon": String(name), ...props }) });
      if (requestName.includes("components/site/")) return { Header: (props: any) => createElement("header", null, props.children), Footer: (props: any) => createElement("footer", null, props.children), FloatingActions: (props: any) => createElement("aside", null, props.children) };
      return originalModuleLoad.call(this, requestName, ...args);
    };
    RealClient = (await import("../../app/ca-nhan/mon/[slug]/workspace-client")).SubjectWorkspaceClient;
    Route = await import("../../app/api/progress/route");
    (globalThis as any).__learningProgressRepository = repository;
  } finally {
    moduleLoader._load = originalModuleLoad;
  }
});

afterEach(() => reset());

test("repository validates exact inputs before creating Supabase and reads bounded deterministic rows", async () => {
  const repository = (globalThis as any).__learningProgressRepository;
  rows = [
    progressRow(),
    progressRow({ item_id: OTHER_ITEM_ID, status: "in_progress", watched_percent: 40 }),
    progressRow({ user_id: OTHER_USER_ID }),
    progressRow({ product_id: OTHER_PRODUCT_ID })
  ];
  const result = await repository.getLearningProgressForWorkspace(USER_ID.toUpperCase(), PRODUCT_ID.toUpperCase());
  assert.equal(result.length, 2);
  assert.ok(result.every((row: StoredRow) => row.user_id === USER_ID && row.product_id === PRODUCT_ID));
  assert.equal(calls.find((call: Call) => call.method === "select")?.args[0], repository.LEARNING_PROGRESS_SELECT);
  assert.deepEqual(calls.filter((call: Call) => call.method === "eq").map((call: Call) => call.args), [["user_id", USER_ID], ["product_id", PRODUCT_ID]]);
  assert.ok(calls.some((call: Call) => call.method === "limit" && call.args[0] === 500));

  for (const invalid of [
    { ...VALID_INPUT, role: "admin" },
    { ...VALID_INPUT, productId: "bad" },
    { ...VALID_INPUT, itemId: "bad" },
    { ...VALID_INPUT, itemType: "video" },
    { ...VALID_INPUT, status: "paused" },
    { ...VALID_INPUT, watchedPercent: -1 },
    { ...VALID_INPUT, watchedPercent: 101 },
    { ...VALID_INPUT, watchedPercent: Number.NaN },
    { ...VALID_INPUT, userId: USER_ID }
  ]) {
    createClientCalls = 0;
    calls = [];
    await assert.rejects(() => repository.upsertLearningProgress(USER_ID, invalid), repository.LearningProgressInputError);
    assert.equal(createClientCalls, 0);
    assert.deepEqual(calls, []);
  }

  await assert.rejects(() => repository.getLearningProgressForWorkspace("bad", PRODUCT_ID), repository.LearningProgressInputError);
  assert.deepEqual(calls, []);
});

test("repository sends the exact permitted RPC payload and repeated saves remain one row", async () => {
  const repository = (globalThis as any).__learningProgressRepository;
  const first = await repository.upsertLearningProgress(USER_ID.toUpperCase(), VALID_INPUT);
  assert.equal(first.user_id, USER_ID);
  const rpc = calls.find((call: Call) => call.method === "rpc");
  assert.deepEqual(rpc?.args, ["save_learning_progress", {
    p_product_id: PRODUCT_ID,
    p_item_type: "lesson",
    p_item_id: ITEM_ID,
    p_status: "completed",
    p_watched_percent: 100,
    p_started_at: NOW,
    p_completed_at: NOW
  }]);
  await repository.upsertLearningProgress(USER_ID, VALID_INPUT);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, USER_ID);
  assert.equal(rows[0].product_id, PRODUCT_ID);
});

test("repository item identity and errors fail closed without raw details", async () => {
  const repository = (globalThis as any).__learningProgressRepository;
  assert.equal(await repository.isLearningProgressItemForProduct(PRODUCT_ID, "lesson", ITEM_ID), true);
  assert.equal(await repository.isLearningProgressItemForProduct(OTHER_PRODUCT_ID, "lesson", ITEM_ID), false);
  queryError = new Error(RAW_ERROR);
  await assert.rejects(() => repository.getLearningProgressForWorkspace(USER_ID, PRODUCT_ID), (error: unknown) => {
    assert.ok(error instanceof repository.LearningProgressRepositoryError);
    assert.doesNotMatch(String(error), /user@example|secret=jwt|database/);
    return true;
  });
});

test("API authenticates and validates before entitlement/progress access, then persists only entitled items", async () => {
  const responseModule = Route;
  let response = await responseModule.POST(tracedRequest(VALID_INPUT));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(timeline, ["auth", "validation", "subject", "product", "entitlement", "progress write"]);
  assert.deepEqual(calls.filter((call: Call) => call.method === "rpc")[0]?.args, ["save_learning_progress", {
    p_product_id: PRODUCT_ID,
    p_item_type: "lesson",
    p_item_id: ITEM_ID,
    p_status: "completed",
    p_watched_percent: 100,
    p_started_at: NOW,
    p_completed_at: NOW
  }]);
  timeline = [];
  await responseModule.POST(request(VALID_INPUT));
  assert.equal(rows.length, 1);

  for (const status of ["unauthenticated", "profile_missing", "pending", "rejected", "suspended"] as const) {
    reset();
    access = status === "unauthenticated" ? { status, user: null, profile: null } : { status, user: { id: USER_ID }, profile: null };
    response = await responseModule.POST(request(VALID_INPUT));
    assert.equal(response.status, status === "unauthenticated" ? 401 : 403);
    assert.equal(calls.some((call: Call) => call.method === "rpc"), false);
    assert.equal(calls.some((call: Call) => call.table === "product_entitlements"), false);
  }
});

test("API rejects arbitrary fields, invalid progress values, expired/revoked/wrong entitlement, and wrong product items", async () => {
  const responseModule = Route;
  for (const invalid of [
    { ...VALID_INPUT, admin: true },
    { ...VALID_INPUT, itemType: "material", itemId: "bad" },
    { ...VALID_INPUT, status: "paused" },
    { ...VALID_INPUT, watchedPercent: 101 }
  ]) {
    reset();
    const response = await responseModule.POST(request(invalid));
    assert.equal(response.status, 400);
    assert.equal(calls.some((call: Call) => call.table === "product_entitlements"), false);
  }
  for (const invalidEntitlement of [
    null,
    activeEntitlement({ expires_at: "2020-01-01T00:00:00.000Z" }),
    activeEntitlement({ status: "revoked", revoked_at: NOW }),
    activeEntitlement({ user_id: OTHER_USER_ID }),
    activeEntitlement({ product_id: OTHER_PRODUCT_ID })
  ]) {
    reset();
    entitlement = invalidEntitlement;
    const response = await responseModule.POST(request(VALID_INPUT));
    assert.equal(response.status, 404);
    assert.equal(calls.some((call: Call) => call.method === "rpc"), false);
  }
  reset();
  entitlement = activeEntitlement();
  lessons = [{ id: ITEM_ID, course_id: OTHER_PRODUCT_ID }];
  const wrongItem = await responseModule.POST(request(VALID_INPUT));
  assert.equal(wrongItem.status, 404);
  assert.equal(calls.some((call: Call) => call.table === "product_entitlements"), false);
  assert.equal(calls.some((call: Call) => call.method === "rpc"), false);

  reset();
  const wrongProductBinding = await responseModule.POST(request({ ...VALID_INPUT, productId: OTHER_PRODUCT_ID }));
  assert.equal(wrongProductBinding.status, 404);
  assert.equal(calls.some((call: Call) => call.table === "product_entitlements"), false);
  assert.equal(calls.some((call: Call) => call.method === "rpc"), false);
});

test("API writes only after binding and entitlement, and maps a progress write failure generically", async () => {
  upsertError = new Error(RAW_ERROR);
  const response = await Route.POST(tracedRequest(VALID_INPUT));
  assert.equal(response.status, 500);
  assert.deepEqual(timeline, ["auth", "validation", "subject", "product", "entitlement", "progress write"]);
  const body = JSON.stringify(await response.json());
  assert.doesNotMatch(body, /database|user@example|secret=jwt/);
  assert.equal(rows.length, 0);
});

test("API maps repository/database failures to generic responses without raw error leakage", async () => {
  const responseModule = Route;
  queryError = new Error(RAW_ERROR);
  const response = await responseModule.POST(request(VALID_INPUT));
  assert.equal(response.status, 500);
  const body = JSON.stringify(await response.json());
  assert.doesNotMatch(body, /user@example|secret=jwt|database/);
});

test("page and real workspace client preserve the auth-to-render timeline and persisted progress", async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  const originalModuleLoad = moduleLoader._load;
  const workspacePath = require.resolve("../../lib/repositories/student-workspace-repository");
  timeline = [];
  rows = [];
  const pageWorkspace = {
    subject: { slug: "ke-toan", name: "Kế toán", category: "Kế toán", facultyGroup: "UFM", colorTheme: "accounting" },
    materials: [{ productId: PRODUCT_ID, title: "Material", description: "Description", pages: 1 }],
    courses: []
  };
  require.cache[workspacePath] = { id: workspacePath, filename: workspacePath, loaded: true, exports: {
    getAuthorizedStudentWorkspace: async () => { timeline.push("subject", "product", "entitlement"); return pageWorkspace; }
  } } as any;
  recordProgressRead = true;
  moduleLoader._load = function(requestName: string, ...args: any[]) {
    if (requestName === "next/navigation") return { redirect: () => { throw new Error("redirect"); }, notFound: () => { throw new Error("notFound"); } };
    if (requestName === "./workspace-client") return { SubjectWorkspaceClient: (props: any) => { timeline.push("render"); return createElement("workspace", props); } };
    return originalModuleLoad.call(this, requestName, ...args);
  };
  try {
    const page = (await import("../../app/ca-nhan/mon/[slug]/page")).default;
    const rendered = await page({ params: Promise.resolve({ slug: "ke-toan" }), searchParams: Promise.resolve({}) });
    (rendered as any).type((rendered as any).props);
    assert.deepEqual(timeline, ["auth", "subject", "product", "entitlement", "progress read", "render"]);
    assert.equal((rendered as any).props.workspace.progress, undefined);

    const runtime: HookRuntime = { slots: [], cursor: 0 };
    let tree = renderClient({ workspace: pageWorkspace }, runtime);
    // The manual runtime renders the real client component and expands its real child handlers.
    buttonWithText(tree, "Tài liệu").props.onClick();
    tree = renderClient({ workspace: pageWorkspace }, runtime);

    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const pendingResponses: Array<(response: Response) => void> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });
      return new Promise<Response>((resolve) => pendingResponses.push(resolve));
    };
    try {
      let save = buttonWithText(tree, "Đánh dấu đã học").props.onClick();
      const duplicate = buttonWithText(renderClient({ workspace: pageWorkspace }, runtime), "Đang lưu...").props.onClick();
      await duplicate;
      await Promise.resolve();
      tree = renderClient({ workspace: pageWorkspace }, runtime);
      assert.equal(fetchCalls.length, 1);
      assert.equal(String(fetchCalls[0].input), "/api/progress");
      const clientPayload = JSON.parse(String(fetchCalls[0].init?.body));
      assert.deepEqual(Object.keys(clientPayload).sort(), ["completedAt", "itemId", "itemType", "productId", "startedAt", "status", "watchedPercent"]);
      assert.equal(clientPayload.productId, PRODUCT_ID);
      assert.equal(clientPayload.itemType, "material");
      assert.equal(clientPayload.itemId, PRODUCT_ID);
      assert.equal(clientPayload.status, "completed");
      assert.equal(clientPayload.watchedPercent, 100);
      assert.equal(buttonWithText(tree, "Đang lưu...").props.disabled, true);

      pendingResponses.shift()!(new Response(JSON.stringify({ error: "private database detail" }), { status: 500 }));
      await save;
      tree = renderClient({ workspace: pageWorkspace }, runtime);
      assert.match(elementText(tree), /Tiến độ chưa được lưu/);
      assert.match(elementText(tree), /Lưu lại/);
      assert.match(elementText(tree), /0%/);

      save = buttonWithText(tree, "Lưu lại").props.onClick();
      await Promise.resolve();
      tree = renderClient({ workspace: pageWorkspace }, runtime);
      assert.equal(fetchCalls.length, 2);
      assert.equal(buttonWithText(tree, "Đang lưu...").props.disabled, true);

      const retryInit = fetchCalls[1].init;
      const retryResponse = await Route.POST(new Request(`http://localhost${String(fetchCalls[1].input)}`, retryInit));
      pendingResponses.shift()!(retryResponse);
      await save;
      tree = renderClient({ workspace: pageWorkspace }, runtime);
      assert.match(elementText(tree), /100%/);
      assert.equal(buttonWithText(tree, "Đã lưu").props.disabled, true);
      assert.equal(rows.length, 1);

      timeline = [];
      const reloaded = await page({ params: Promise.resolve({ slug: "ke-toan" }), searchParams: Promise.resolve({}) });
      (reloaded as any).type((reloaded as any).props);
      assert.deepEqual(timeline, ["auth", "subject", "product", "entitlement", "progress read", "render"]);
      assert.equal((reloaded as any).props.workspace.progress[0].product_id, PRODUCT_ID);
    } finally {
      globalThis.fetch = originalFetch;
    }
  } finally {
    recordProgressRead = false;
    moduleLoader._load = originalModuleLoad;
  }
});
