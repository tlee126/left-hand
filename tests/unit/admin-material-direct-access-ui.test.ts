import assert from "node:assert/strict";
import { createElement } from "react";
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
