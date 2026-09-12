import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createRequire } from "node:module";
import { test } from "node:test";
import MaterialDirectAccessPanel, {
  expiryDateValue,
  materialDirectGrantStatus,
  materialDirectPermissionLabel
} from "../../app/quan-tri/catalog/material-direct-access-panel";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html?: string, options?: { url?: string }) => any };

const MATERIAL_ID = "2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64";
const STUDENT_A = "3f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64";
const STUDENT_B = "4f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64";
const STUDENT_C = "5f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64";

type FetchHandler = (url: string, init: RequestInit | undefined) => Promise<Response> | Response;

async function withMountedPanel(handler: FetchHandler, callback: (ctx: { container: HTMLElement; dom: any; calls: Array<{ url: string; method: string; body: unknown }>; flush: () => Promise<void> }) => Promise<void>, materialId = MATERIAL_ID): Promise<void> {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const originals = {
    window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement, Node: globalThis.Node,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    fetch: globalThis.fetch
  };
  const install = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  install("window", dom.window); install("document", dom.window.document); install("navigator", dom.window.navigator);
  install("HTMLElement", dom.window.HTMLElement); install("Node", dom.window.Node); install("IS_REACT_ACT_ENVIRONMENT", true);
  // ReactDOM is imported before JSDOM exists in this test process and falls back to
  // its legacy input-event path; provide the DOM methods that path expects.
  (dom.window.HTMLElement.prototype as any).attachEvent = () => {};
  (dom.window.HTMLElement.prototype as any).detachEvent = () => {};
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input); const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });
    return handler(url, init);
  };
  dom.window.confirm = () => true;
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  try {
    await act(async () => { root.render(createElement(MaterialDirectAccessPanel, { materialId })); });
    await callback({ container, dom, calls, flush });
  } finally {
    await act(async () => root.unmount()); container.remove();
    install("window", originals.window); install("document", originals.document); install("navigator", originals.navigator);
    install("HTMLElement", originals.HTMLElement); install("Node", originals.Node); install("IS_REACT_ACT_ENVIRONMENT", originals.IS_REACT_ACT_ENVIRONMENT);
    globalThis.fetch = originals.fetch;
  }
}

function responseFor(url: string, method: string, grants: Record<string, unknown>[] = []): Response {
  if (url.includes("/direct-grants") && method === "GET") return Response.json({ grants });
  if (url.includes("/students/search")) return Response.json({ students: [] });
  return Response.json({ grant: grants[0] ?? grant(STUDENT_A) }, { status: method === "POST" ? 201 : 200 });
}

function clickButton(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(label));
  assert.ok(found, `missing button ${label}`); return found as HTMLButtonElement;
}

async function setInput(dom: any, target: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(target, value); target.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    await Promise.resolve();
  });
}

async function setDateInput(dom: any, target: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(target, value); target.dispatchEvent(new dom.window.Event("input", { bubbles: true })); target.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function submitForm(form: HTMLFormElement, dom?: any): Promise<void> {
  await act(async () => { form.dispatchEvent(new (dom?.window.Event ?? Event)("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); });
}

function grant(userId: string, values: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `6f7c5d75-4c0c-4f6d-b6b4-${userId === STUDENT_A ? "000000000001" : "000000000002"}`,
    user_id: userId,
    material_id: MATERIAL_ID,
    can_view: true,
    can_download: false,
    expires_at: null,
    revoked_at: null,
    granted_by: "7f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    student: null,
    ...values
  };
}

test("admin material direct-access UI uses the real API contract and keeps failures safe", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const originals = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    fetch: globalThis.fetch
  };
  const install = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  install("window", dom.window);
  install("document", dom.window.document);
  install("navigator", dom.window.navigator);
  install("HTMLElement", dom.window.HTMLElement);
  install("Node", dom.window.Node);
  install("IS_REACT_ACT_ENVIRONMENT", true);

  const students = [
    { id: STUDENT_A, full_name: "Nguyễn Văn A", email: "a@example.test", student_code: "A01", faculty: "Khoa A", major: "Ngành A", password: "must-not-render" },
    { id: STUDENT_B, full_name: "Trần Thị B", email: "b@example.test", student_code: "B02", faculty: null, major: null }
  ];
  const grants = [
    grant(STUDENT_A, { expires_at: "2020-01-01T23:59:59.999Z" }),
    grant(STUDENT_B, { can_download: true, revoked_at: "2026-02-01T00:00:00.000Z" })
  ];
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  let failNextPatch = false;
  let holdNextPatch = false;
  let resolvePatch: ((response: Response) => void) | null = null;
  let resolveFirstList: ((response: Response) => void) | null = null;
  let listCount = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });
    if (url.includes("/api/admin/students/search")) return Response.json({ students });
    if (url.endsWith(`/api/admin/materials/${MATERIAL_ID}/direct-grants`) && method === "GET") {
      listCount += 1;
      if (listCount === 1) return new Promise<Response>((resolve) => { resolveFirstList = resolve; });
      return Response.json({ grants });
    }
    if (url.endsWith(`/api/admin/materials/${MATERIAL_ID}/direct-grants`) && method === "POST") {
      const inputBody = body as Record<string, unknown>;
      const next = grant(String(inputBody.user_id), { can_view: inputBody.can_view, can_download: inputBody.can_download, expires_at: inputBody.expires_at });
      const existing = grants.findIndex((item) => item.user_id === next.user_id);
      if (existing >= 0) grants[existing] = next; else grants.unshift(next);
      return Response.json({ grant: next }, { status: 201 });
    }
    if (url.includes(`/api/admin/materials/${MATERIAL_ID}/direct-grants/`)) {
      const userId = url.split("/").at(-1);
      const current = grants.find((item) => item.user_id === userId);
      if (!current) return Response.json({ error: "missing" }, { status: 500 });
      if (method === "PATCH") {
        if (holdNextPatch) {
          holdNextPatch = false;
          Object.assign(current, body);
          return new Promise<Response>((resolve) => { resolvePatch = resolve; });
        }
        if (failNextPatch) { failNextPatch = false; return Response.json({ error: "raw database token signed-url" }, { status: 500 }); }
        Object.assign(current, body);
        return Response.json({ grant: current });
      }
      if (method === "DELETE") {
        current.revoked_at = "2026-09-11T00:00:00.000Z";
        return Response.json({ grant: current });
      }
    }
    return Response.json({ error: "unexpected product_entitlements request" }, { status: 500 });
  };
  dom.window.confirm = () => true;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  const button = (label: string) => {
    const found = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(label));
    assert.ok(found, `missing button ${label}`);
    return found as HTMLButtonElement;
  };
  const input = (type: string, index = 0) => container.querySelectorAll(`input[type="${type}"]`)[index] as HTMLInputElement;
  const setInputValue = async (target: HTMLInputElement, value: string) => act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(target, value);
    target.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    await Promise.resolve();
  });
  const submit = async (form: HTMLFormElement) => act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); });

  try {
    await act(async () => { root.render(createElement(MaterialDirectAccessPanel, { materialId: MATERIAL_ID })); });
    assert.match(container.textContent ?? "", /Quản lý quyền truy cập riêng/);
    await act(async () => { button("Quản lý quyền truy cập riêng").click(); });
    assert.equal(button("Đang tải quyền riêng…").disabled, true);
    assert.equal(calls[0].url, `/api/admin/materials/${MATERIAL_ID}/direct-grants`);
    const releaseList = resolveFirstList as ((response: Response) => void) | null;
    if (!releaseList) throw new Error("the list request should be pending");
    releaseList(Response.json({ grants }));
    await flush();
    assert.match(container.textContent ?? "", /Hết hạn/);
    assert.match(container.textContent ?? "", /Đã thu hồi/);

    const search = container.querySelector("form") as HTMLFormElement;
    const searchInput = search.querySelector("input") as HTMLInputElement;
    await setInputValue(searchInput, "Nguyễn");
    await flush();
    await act(async () => { button("Tìm học viên").click(); await Promise.resolve(); });
    assert.ok(calls.some((call) => call.url === `/api/admin/students/search?q=${encodeURIComponent("Nguyễn")}`), JSON.stringify(calls));
    assert.match(container.textContent ?? "", /Nguyễn Văn A/);
    await act(async () => { button("Nguyễn Văn A").click(); });
    assert.match(container.textContent ?? "", /Cấp quyền cho: Nguyễn Văn A/);

    const createForm = [...container.querySelectorAll("form")].find((form) => form.textContent?.includes("Cấp quyền riêng")) as HTMLFormElement;
    assert.ok(createForm);
    await submit(createForm);
    const createCall = calls.find((call) => call.method === "POST")!;
    assert.equal(createCall.url, `/api/admin/materials/${MATERIAL_ID}/direct-grants`);
    assert.deepEqual(createCall.body, { user_id: STUDENT_A, can_view: true, can_download: false, expires_at: null });

    await setInputValue(searchInput, "B02");
    await flush();
    await act(async () => { button("Tìm học viên").click(); await Promise.resolve(); });
    await act(async () => { button("Trần Thị B").click(); });
    const createCheckboxes = container.querySelectorAll("form")[1]?.querySelectorAll("input[type=checkbox]") ?? [];
    assert.equal((createCheckboxes[1] as HTMLInputElement).disabled, false);
    await act(async () => { (createCheckboxes[1] as HTMLInputElement).click(); });
    const secondCreate = [...container.querySelectorAll("form")].find((form) => form.textContent?.includes("Cấp quyền riêng")) as HTMLFormElement;
    await submit(secondCreate);
    const createCalls = calls.filter((call) => call.method === "POST");
    assert.deepEqual(createCalls.at(-1)?.body, { user_id: STUDENT_B, can_view: true, can_download: true, expires_at: null });

    await setInputValue(searchInput, "Nguyễn");
    await flush();
    await act(async () => { button("Tìm học viên").click(); await Promise.resolve(); });
    await act(async () => { button("Nguyễn Văn A").click(); });
    const invalidCreate = [...container.querySelectorAll("form")].find((form) => form.textContent?.includes("Cấp quyền riêng")) as HTMLFormElement;
    const invalidCheckboxes = invalidCreate.querySelectorAll("input[type=checkbox]");
    await act(async () => { (invalidCheckboxes[0] as HTMLInputElement).click(); });
    assert.equal((invalidCheckboxes[1] as HTMLInputElement).disabled, true);
    await act(async () => { (invalidCheckboxes[0] as HTMLInputElement).click(); });

    const editButton = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === "Sửa quyền") as HTMLButtonElement;
    await act(async () => { editButton.click(); });
    const editForm = [...container.querySelectorAll("form")].find((form) => form.textContent?.includes("Lưu quyền")) as HTMLFormElement;
    const editCheckboxes = editForm.querySelectorAll("input[type=checkbox]");
    await act(async () => { (editCheckboxes[1] as HTMLInputElement).click(); });
    holdNextPatch = true;
    await submit(editForm);
    await flush();
    assert.equal(button("Đang lưu…").disabled, true);
    const releasePatch = resolvePatch as ((response: Response) => void) | null;
    if (!releasePatch) throw new Error("the patch request should be pending");
    releasePatch(Response.json({ grant: grants[0] }));
    await flush();
    const patchCall = calls.findLast((call) => call.method === "PATCH")!;
    assert.equal(patchCall.url, `/api/admin/materials/${MATERIAL_ID}/direct-grants/${STUDENT_A}`);
    assert.deepEqual(patchCall.body, { can_view: true, can_download: true, expires_at: null });

    failNextPatch = true;
    const failedEditButton = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === "Sửa quyền") as HTMLButtonElement;
    await act(async () => { failedEditButton.click(); });
    const failedEditForm = [...container.querySelectorAll("form")].find((form) => form.textContent?.includes("Lưu quyền")) as HTMLFormElement;
    await submit(failedEditForm);
    assert.match(container.textContent ?? "", /Không thể cập nhật quyền truy cập riêng/);
    assert.doesNotMatch(container.textContent ?? "", /raw database token|signed-url/);
    assert.match(container.textContent ?? "", /Được xem và tải/);

    const revokeButton = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === "Thu hồi") as HTMLButtonElement;
    await act(async () => { revokeButton.click(); await Promise.resolve(); });
    await flush();
    const deleteCall = calls.findLast((call) => call.method === "DELETE")!;
    assert.equal(deleteCall.url, `/api/admin/materials/${MATERIAL_ID}/direct-grants/${STUDENT_A}`);
    assert.match(container.textContent ?? "", /Đã thu hồi/);
    assert.equal(calls.some((call) => call.url.includes("product_entitlements")), false);
    assert.doesNotMatch(container.innerHTML, /password|token|signed-url|raw database/);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    install("window", originals.window);
    install("document", originals.document);
    install("navigator", originals.navigator);
    install("HTMLElement", originals.HTMLElement);
    install("Node", originals.Node);
    install("IS_REACT_ACT_ENVIRONMENT", originals.IS_REACT_ACT_ENVIRONMENT);
    globalThis.fetch = originals.fetch;
  }
});

test("direct-access status and date helpers enforce the UI contract", () => {
  assert.equal(expiryDateValue("2027-04-30"), "2027-04-30T23:59:59.999Z");
  assert.equal(expiryDateValue(""), null);
  assert.throws(() => expiryDateValue("2027-02-30"));
  assert.equal(materialDirectGrantStatus({ expires_at: "2020-01-01T00:00:00.000Z", revoked_at: null }, Date.parse("2021-01-01")), "expired");
  assert.equal(materialDirectGrantStatus({ expires_at: null, revoked_at: "2021-01-01T00:00:00.000Z" }), "revoked");
  assert.equal(materialDirectPermissionLabel({ can_view: true, can_download: false, expires_at: null, revoked_at: null }), "Chỉ được xem");
  assert.equal(materialDirectPermissionLabel({ can_view: true, can_download: true, expires_at: null, revoked_at: null }), "Được xem và tải");
  assert.equal(materialDirectPermissionLabel({ can_view: false, can_download: false, expires_at: null, revoked_at: null }), "Chưa cấp quyền");
});

test("empty grant list renders a stable empty state", async () => {
  await withMountedPanel((url, init) => responseFor(url, init?.method ?? "GET", []), async ({ container }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(container.textContent ?? "", /Chưa cấp quyền riêng cho tài liệu này/);
    assert.doesNotMatch(container.textContent ?? "", /Được xem|Đã thu hồi|Hết hạn/);
  });
});

test("grant list renders student identity returned by GET after a fresh mount", async () => {
  const listedGrant = grant(STUDENT_A, {
    student: { id: STUDENT_A, full_name: "Nguyễn Văn A", email: "a@example.test", student_code: "A01" }
  });
  await withMountedPanel((url, init) => responseFor(url, init?.method ?? "GET", [listedGrant]), async ({ container }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(container.textContent ?? "", /Nguyễn Văn A/);
    assert.match(container.textContent ?? "", /A01/);
    assert.doesNotMatch(container.textContent ?? "", new RegExp(`Học viên · ${STUDENT_A}`));
  });
});

test("grant list falls back safely when the student profile is missing", async () => {
  await withMountedPanel((url, init) => responseFor(url, init?.method ?? "GET", [grant(STUDENT_A)]), async ({ container }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(container.textContent ?? "", new RegExp(`Học viên · ${STUDENT_A}`));
    assert.doesNotMatch(container.textContent ?? "", /a@example\.test|A01/);
  });
});

test("search API errors are generic and clear loading", async () => {
  await withMountedPanel((url, init) => url.includes("/students/search") ? Response.json({ error: "raw provider token" }, { status: 500 }) : responseFor(url, init?.method ?? "GET", []), async ({ container, dom }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = container.querySelector('input[aria-label="Tìm học viên"]') as HTMLInputElement;
    await setInput(dom, input, "student"); await submitForm(input.form!, dom);
    assert.match(container.textContent ?? "", /Không thể tìm học viên/);
    assert.doesNotMatch(container.textContent ?? "", /raw provider token/);
    assert.equal(clickButton(container, "Tìm học viên").disabled, false);
  });
});

test("initial grant-list API errors render only the generic error state", async () => {
  await withMountedPanel((url, init) => url.includes("/direct-grants") && (init?.method ?? "GET") === "GET" ? Response.json({ error: "raw database error" }, { status: 500 }) : responseFor(url, init?.method ?? "GET", []), async ({ container }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(container.textContent ?? "", /Không thể tải quyền truy cập riêng/);
    assert.doesNotMatch(container.textContent ?? "", /raw database error|Được xem|Đã thu hồi/);
  });
});

test("Enter submits student search exactly once", async () => {
  let searchCalls = 0;
  await withMountedPanel((url, init) => { if (url.includes("/students/search")) { searchCalls += 1; return Response.json({ students: [] }); } return responseFor(url, init?.method ?? "GET", []); }, async ({ container, dom }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = container.querySelector('input[aria-label="Tìm học viên"]') as HTMLInputElement;
    await setInput(dom, input, "student");
    await act(async () => { input.focus(); input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); input.form!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); });
    assert.equal(searchCalls, 1);
  });
});

test("duplicate search clicks are blocked while pending and the guard releases after success", async () => {
  let releaseSearch: ((response: Response) => void) | null = null;
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  await withMountedPanel((url, init) => {
    const method = init?.method ?? "GET";
    if (url.includes("/students/search")) {
      calls.push({ url, method, body: init?.body ?? null });
      return new Promise<Response>((resolve) => { releaseSearch = resolve; });
    }
    return responseFor(url, method, []);
  }, async ({ container, dom, flush }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); }); await flush();
    const input = container.querySelector('input[aria-label="Tìm học viên"]') as HTMLInputElement;
    await setInput(dom, input, "pending-query");
    const searchButton = clickButton(container, "Tìm học viên");
    await submitForm(input.form!, dom);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { url: "/api/admin/students/search?q=pending-query", method: "GET", body: null });
    assert.equal(searchButton.disabled, true);
    searchButton.click(); searchButton.click();
    assert.equal(calls.length, 1);
    releaseSearch!(Response.json({ students: [{ id: STUDENT_A, full_name: "Pending Result", email: "pending@example.test", student_code: "P01" }] }));
    await flush();
    assert.equal(searchButton.disabled, false);
    assert.match(container.textContent ?? "", /Pending Result/);

    await submitForm(input.form!, dom);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], { url: "/api/admin/students/search?q=pending-query", method: "GET", body: null });
  });
});

test("search retry after failure creates exactly one new request and renders its result", async () => {
  let searchCalls = 0;
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  await withMountedPanel((url, init) => {
    const method = init?.method ?? "GET";
    if (url.includes("/students/search")) {
      calls.push({ url, method, body: init?.body ?? null });
      searchCalls += 1;
      if (searchCalls === 1) return Response.json({ error: "raw search provider secret" }, { status: 500 });
      return Response.json({ students: [{ id: STUDENT_B, full_name: "Retry Result", email: "retry@example.test", student_code: "R02" }] });
    }
    return responseFor(url, method, []);
  }, async ({ container, dom, flush }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); }); await flush();
    const input = container.querySelector('input[aria-label="Tìm học viên"]') as HTMLInputElement;
    await setInput(dom, input, "retry-query");
    await submitForm(input.form!, dom);
    await flush();
    assert.equal(searchCalls, 1);
    assert.deepEqual(calls[0], { url: "/api/admin/students/search?q=retry-query", method: "GET", body: null });
    assert.match(container.textContent ?? "", /Không thể tìm học viên/);
    assert.doesNotMatch(container.textContent ?? "", /raw search provider secret/);
    assert.equal(clickButton(container, "Tìm học viên").disabled, false);

    await submitForm(input.form!, dom);
    await flush();
    assert.equal(searchCalls, 2);
    assert.deepEqual(calls[1], { url: "/api/admin/students/search?q=retry-query", method: "GET", body: null });
    assert.match(container.textContent ?? "", /Retry Result/);
    assert.doesNotMatch(container.textContent ?? "", /Không thể tìm học viên/);
  });
});

test("duplicate create clicks produce one pending POST and one refresh", async () => {
  let releasePost: ((response: Response) => void) | null = null; let listCalls = 0; let postCalls = 0;
  const student = { id: STUDENT_A, full_name: "Student A", email: "long@example.test", student_code: "A01" };
  await withMountedPanel((url, init) => {
    const method = init?.method ?? "GET";
    if (url.includes("/students/search")) return Response.json({ students: [student] });
    if (url.endsWith(`/direct-grants`) && method === "GET") { listCalls += 1; return Response.json({ grants: [] }); }
    if (url.endsWith(`/direct-grants`) && method === "POST") { postCalls += 1; return new Promise<Response>((resolve) => { releasePost = resolve; }); }
    return responseFor(url, method, []);
  }, async ({ container, dom, flush }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); }); await flush();
    const input = container.querySelector('input[aria-label="Tìm học viên"]') as HTMLInputElement; await setInput(dom, input, "A01"); await submitForm(input.form!, dom); await flush();
    await act(async () => { clickButton(container, "Student A").click(); });
    const form = [...container.querySelectorAll("form")].find((item) => item.textContent?.includes("Cấp quyền riêng")) as HTMLFormElement;
    const create = clickButton(form, "Cấp quyền riêng");
    await act(async () => { create.click(); create.click(); await Promise.resolve(); });
    assert.equal(postCalls, 1); assert.equal(create.disabled, true); assert.ok(releasePost);
    releasePost!(Response.json({ grant: grant(STUDENT_A) }, { status: 201 })); await flush();
    assert.equal(listCalls, 2);
  });
});

test("duplicate revoke clicks produce one pending DELETE and one refresh", async () => {
  const existing = grant(STUDENT_A); let releaseDelete: ((response: Response) => void) | null = null; let deleteCalls = 0; let listCalls = 0;
  await withMountedPanel((url, init) => {
    const method = init?.method ?? "GET";
    if (url.endsWith(`/direct-grants`) && method === "GET") { listCalls += 1; return Response.json({ grants: [existing] }); }
    if (method === "DELETE") { deleteCalls += 1; return new Promise<Response>((resolve) => { releaseDelete = resolve; }); }
    return responseFor(url, method, [existing]);
  }, async ({ container, flush }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); }); await flush();
    const revoke = clickButton(container, "Thu hồi");
    await act(async () => { revoke.click(); revoke.click(); await Promise.resolve(); });
    assert.equal(deleteCalls, 1); assert.equal(revoke.disabled, true); assert.ok(releaseDelete);
    releaseDelete!(Response.json({ grant: { ...existing, revoked_at: "2026-09-11T00:00:00.000Z" } })); await flush();
    assert.equal(listCalls, 2);
  });
});

test("past expiry date blocks create through the real form interaction", async () => {
  let postCalls = 0;
  await withMountedPanel((url, init) => { if ((init?.method ?? "GET") === "POST") { postCalls += 1; } if (url.includes("/students/search")) return Response.json({ students: [{ id: STUDENT_A, full_name: "Student A", email: null, student_code: "A01" }] }); return responseFor(url, init?.method ?? "GET", []); }, async ({ container, dom, flush }) => {
    await act(async () => { clickButton(container, "Quản lý quyền truy cập riêng").click(); }); await flush();
    const input = container.querySelector('input[aria-label="Tìm học viên"]') as HTMLInputElement; await setInput(dom, input, "A01"); await submitForm(input.form!, dom); await flush(); await act(async () => { clickButton(container, "Student A").click(); });
    const form = [...container.querySelectorAll("form")].find((item) => item.textContent?.includes("Cấp quyền riêng")) as HTMLFormElement;
    await setDateInput(dom, form.querySelector('input[type="date"]') as HTMLInputElement, "2020-01-01"); await flush(); await submitForm(form, dom);
    assert.equal(postCalls, 0); assert.match(container.textContent ?? "", /Ngày hết hạn phải là hôm nay/);
  });
});

test("two mounted materials isolate grants and request identities", async () => {
  const otherMaterial = "8f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64";
  const grantA = grant(STUDENT_A); const grantB = { ...grant(STUDENT_B), material_id: otherMaterial }; const calls: string[] = [];
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const originals = { window: globalThis.window, document: globalThis.document, navigator: globalThis.navigator, HTMLElement: globalThis.HTMLElement, Node: globalThis.Node, IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT, fetch: globalThis.fetch };
  const install = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  install("window", dom.window); install("document", dom.window.document); install("navigator", dom.window.navigator); install("HTMLElement", dom.window.HTMLElement); install("Node", dom.window.Node); install("IS_REACT_ACT_ENVIRONMENT", true); dom.window.confirm = () => true;
  globalThis.fetch = async (input, init) => { const url = String(input); calls.push(url); const id = url.includes(otherMaterial) ? otherMaterial : MATERIAL_ID; return url.includes("/direct-grants") && (init?.method ?? "GET") === "GET" ? Response.json({ grants: [id === MATERIAL_ID ? grantA : grantB] }) : Response.json({ students: [] }); };
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => { root.render(createElement(Fragment, null, createElement(MaterialDirectAccessPanel, { materialId: MATERIAL_ID }), createElement(MaterialDirectAccessPanel, { materialId: otherMaterial }))); });
    const panels = [...container.querySelectorAll("[data-material-direct-access]")] as HTMLElement[]; assert.equal(panels.length, 2);
    await act(async () => { clickButton(panels[0], "Quản lý quyền truy cập riêng").click(); clickButton(panels[1], "Quản lý quyền truy cập riêng").click(); await Promise.resolve(); }); await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(panels[0].textContent ?? "", new RegExp(STUDENT_A)); assert.doesNotMatch(panels[0].textContent ?? "", new RegExp(STUDENT_B));
    assert.match(panels[1].textContent ?? "", new RegExp(STUDENT_B)); assert.doesNotMatch(panels[1].textContent ?? "", new RegExp(STUDENT_A));
    assert.ok(calls.includes(`/api/admin/materials/${MATERIAL_ID}/direct-grants`)); assert.ok(calls.includes(`/api/admin/materials/${otherMaterial}/direct-grants`));
  } finally { await act(async () => root.unmount()); container.remove(); install("window", originals.window); install("document", originals.document); install("navigator", originals.navigator); install("HTMLElement", originals.HTMLElement); install("Node", originals.Node); install("IS_REACT_ACT_ENVIRONMENT", originals.IS_REACT_ACT_ENVIRONMENT); globalThis.fetch = originals.fetch; }
});
