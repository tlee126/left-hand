import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { transform } from "esbuild";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html?: string, options?: { url?: string }) => any };
const require = createRequire(import.meta.url);
type Scenario = {
  prepareStatus?: number;
  prepared?: Record<string, unknown>;
  finalizeStatus?: number;
  finalizeBody?: Record<string, unknown>;
  uploadError?: boolean;
  refreshError?: boolean;
  initialVersion?: number | null;
  metadataReadError?: boolean;
  refreshedMetadataError?: boolean;
  refreshedVersion?: number | null;
  immediateRefreshTimeout?: boolean;
};
type RunResult = { statusText: string; role: string | null; refreshCalls: number; fetchCalls: string[]; uploadCalls: number; inputDisabled: boolean; buttonDisabled: boolean; buttonText: string };

const GLOBALS = ["window", "document", "navigator", "HTMLElement", "Node", "DOMException", "IS_REACT_ACT_ENVIRONMENT", "fetch", "__uploadRouter", "__uploadCreateClient"] as const;
type GlobalName = typeof GLOBALS[number];
function snapshotGlobals(): Map<GlobalName, PropertyDescriptor | undefined> {
  return new Map(GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
}
function restoreGlobals(snapshot: Map<GlobalName, PropertyDescriptor | undefined>, errors: unknown[]): void {
  for (const name of GLOBALS) {
    try {
      const descriptor = snapshot.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    } catch (error) { errors.push(error); }
  }
}
async function cleanupSteps(steps: Array<() => void | Promise<void>>): Promise<unknown[]> {
  const errors: unknown[] = [];
  for (const step of steps) {
    try { await step(); } catch (error) { errors.push(error); }
  }
  return errors;
}

test("cleanup continues through every step when an earlier cleanup action throws", async () => {
  const completed: string[] = [];
  const errors = await cleanupSteps([
    () => { completed.push("unmount"); throw new Error("controlled unmount failure"); },
    () => { completed.push("remove container"); },
    () => { completed.push("restore globals"); }
  ]);
  assert.deepEqual(completed, ["unmount", "remove container", "restore globals"]);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /controlled unmount failure/);
});

const PRODUCT_ID = "650e8400-e29b-41d4-a716-446655440000";
const dataUrl = (source: string) => "data:text/javascript," + encodeURIComponent(source);
const browserModule = dataUrl("export function createClient() { return globalThis.__uploadCreateClient(); }");
const constantsModule = dataUrl("export const MAX_PDF_BYTES = 20971520; export const MAX_VIDEO_BYTES = 524288000; export const MATERIALS_BUCKET = 'materials'; export const SUPPORTED_MATERIAL_MIME_TYPES = ['application/pdf','video/mp4','video/webm','video/quicktime'];");
const attemptModule = dataUrl("export function getOrCreateMaterialUploadAttempt(previous, identity) { return previous && previous.productId === identity.productId && previous.originalName === identity.originalName && previous.mimeType === identity.mimeType && previous.byteSize === identity.byteSize ? previous : { ...identity, idempotencyKey: 'a50e8400-e29b-41d4-a716-446655440000' }; }");
const navigationModule = dataUrl("export function useRouter() { return globalThis.__uploadRouter; }");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

let MaterialUploadForm: (props: { productId: string; currentVersion: number | null; metadataReadError?: boolean }) => ReactNode | Promise<ReactNode>;
before(async () => {
  const source = await (await import("node:fs/promises")).readFile("app/quan-tri/catalog/material-upload-form.tsx", "utf8");
  const reactEntry = pathToFileURL(require.resolve("react")).href;
  const reactJsxEntry = pathToFileURL(require.resolve("react/jsx-runtime")).href;
  const reactModule = dataUrl(`export * from '${reactEntry}'; export { default } from '${reactEntry}';`);
  const reactJsxModule = dataUrl(`export * from '${reactJsxEntry}';`);
  const replaced = source
    .replaceAll('"react"', JSON.stringify(reactModule))
    .replaceAll('"@/lib/supabase/browser"', JSON.stringify(browserModule))
    .replaceAll('"@/lib/storage/material-upload-constants"', JSON.stringify(constantsModule))
    .replaceAll('"./material-upload-attempt"', JSON.stringify(attemptModule))
    .replaceAll('"next/navigation"', JSON.stringify(navigationModule));
  const compiled = await transform(replaced, { loader: "tsx", format: "esm", jsx: "automatic" });
  MaterialUploadForm = (await import(dataUrl(compiled.code.replaceAll('"react/jsx-runtime"', JSON.stringify(reactJsxModule))))).default as typeof MaterialUploadForm;
});

async function run(scenario: Scenario = {}): Promise<RunResult> {
  const original = snapshotGlobals();
  let dom: any = null;
  let container: HTMLElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  let refreshCalls = 0;
  let uploadCalls = 0;
  let currentVersion = scenario.initialVersion === undefined ? null : scenario.initialVersion;
  let metadataReadError = scenario.metadataReadError ?? false;
  const fetchCalls: string[] = [];
  const install = (name: GlobalName, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  try {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/quan-tri/catalog" });
  if (scenario.immediateRefreshTimeout) {
    const originalSetTimeout = dom.window.setTimeout.bind(dom.window);
    dom.window.setTimeout = ((callback: (...args: unknown[]) => void) => originalSetTimeout(callback, 0)) as typeof dom.window.setTimeout;
  }
  install("window", dom.window);
  install("document", dom.window.document);
  install("navigator", dom.window.navigator);
  install("HTMLElement", dom.window.HTMLElement);
  install("Node", dom.window.Node);
  install("DOMException", dom.window.DOMException);
  install("IS_REACT_ACT_ENVIRONMENT", true);
  (globalThis as typeof globalThis & { __uploadRouter?: unknown; __uploadCreateClient?: unknown }).__uploadRouter = {
    refresh() {
      refreshCalls += 1;
      if (scenario.refreshError) throw new Error("refresh failed");
      currentVersion = scenario.refreshedVersion === undefined ? 5 : scenario.refreshedVersion;
      metadataReadError = scenario.refreshedMetadataError ?? scenario.metadataReadError ?? false;
      if (root) root.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion, metadataReadError }));
    }
  };
  (globalThis as typeof globalThis & { __uploadCreateClient?: unknown }).__uploadCreateClient = () => ({
    storage: { from(bucket: string) { return { async uploadToSignedUrl() { uploadCalls += 1; return { error: scenario.uploadError ? new Error("storage failed") : null }; } }; } }
  });
  globalThis.fetch = async (input) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url.endsWith("/upload/prepare")) {
      if (scenario.prepareStatus && scenario.prepareStatus >= 400) return Response.json({ error: "generic" }, { status: scenario.prepareStatus });
      return Response.json(scenario.prepared ?? { reservationId: "750e8400-e29b-41d4-a716-446655440001", version: 5, status: "reserved", upload: { bucket: "materials", path: "opaque", token: "opaque" } });
    }
    if (url.endsWith("/upload/finalize")) {
      return Response.json(scenario.finalizeBody ?? { success: true, version: 5 }, { status: scenario.finalizeStatus ?? 200 });
    }
    return Response.json({ success: true });
  };

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
    await act(async () => root!.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion, metadataReadError })));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new dom.window.File(["%PDF-1.4"], "material.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => {
      container!.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => root!.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion, metadataReadError })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const status = container.querySelector('[role="status"], [role="alert"]');
    return { statusText: status?.textContent ?? "", role: status?.getAttribute("role") ?? null, refreshCalls, fetchCalls, uploadCalls,
      inputDisabled: (container.querySelector('input[type="file"]') as HTMLInputElement).disabled,
      buttonDisabled: (container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled,
      buttonText: (container.querySelector('button[type="submit"]') as HTMLButtonElement).textContent ?? "" };
  } finally {
    const restoreErrors: unknown[] = [];
    const cleanupErrors = await cleanupSteps([
      async () => { if (root) await act(async () => root!.unmount()); },
      () => { container?.remove(); },
      () => { dom?.window.close(); },
      () => { restoreGlobals(original, restoreErrors); }
    ]);
    assert.deepEqual([...cleanupErrors, ...restoreErrors], [], "all cleanup steps must complete without errors");
  }
}

test("successful finalize refreshes exactly once after the committed response", async () => {
  const result = await run();
  assert.equal(result.uploadCalls, 1);
  assert.equal(result.fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
  assert.equal(result.refreshCalls, 1);
  assert.match(result.statusText, /Tải tệp tài liệu thành công/);
  assert.equal(result.role, "status");
});

test("near-simultaneous submits reuse one in-flight upload and wait for refreshed server props", async () => {
  const prepareResponse = deferred<Response>();
  const storageResponse = deferred<{ error: Error | null }>();
  const finalizeResponse = deferred<Response>();
  const uploadStarted = deferred<void>();
  const finalizeStarted = deferred<void>();
  const refreshStarted = deferred<void>();
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/quan-tri/catalog" });
  const original = snapshotGlobals();
  const originalConsoleError = console.error;
  const consoleErrors: unknown[][] = [];
  const windowErrors: string[] = [];
  const onWindowError = (event: ErrorEvent) => windowErrors.push(event.message);
  let root: ReturnType<typeof createRoot> | null = null;
  let container: HTMLElement | null = null;
  const install = (name: GlobalName, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  let refreshCalls = 0;
  let uploadCalls = 0;
  let currentVersion: number | null = 4;
  const fetchCalls: string[] = [];
  try {
  install("window", dom.window);
  install("document", dom.window.document);
  install("navigator", dom.window.navigator);
  install("HTMLElement", dom.window.HTMLElement);
  install("Node", dom.window.Node);
  install("DOMException", dom.window.DOMException);
  install("IS_REACT_ACT_ENVIRONMENT", true);

  dom.window.addEventListener("error", onWindowError);
  console.error = (...args: unknown[]) => { consoleErrors.push(args); originalConsoleError(...args); };
  (globalThis as typeof globalThis & { __uploadRouter?: unknown; __uploadCreateClient?: unknown }).__uploadRouter = {
    refresh() {
      refreshCalls += 1;
      refreshStarted.resolve();
      if (root) root.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion, metadataReadError: false }));
    }
  };
  (globalThis as typeof globalThis & { __uploadCreateClient?: unknown }).__uploadCreateClient = () => ({
    storage: { from() { return { uploadToSignedUrl() { uploadCalls += 1; uploadStarted.resolve(); return storageResponse.promise; } }; } }
  });
  globalThis.fetch = async (input) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url.endsWith("/upload/prepare")) return prepareResponse.promise;
    if (url.endsWith("/upload/finalize")) {
      finalizeStarted.resolve();
      return finalizeResponse.promise;
    }
    return Response.json({ success: true });
  };

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const submit = async () => act(async () => {
    container!.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });

    await act(async () => root!.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion })));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new dom.window.File(["%PDF-1.4"], "material.pdf", { type: "application/pdf" })]
    });

    await submit();
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);
    assert.equal((container.querySelector('input[type="file"]') as HTMLInputElement).disabled, true);
    assert.equal((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled, true);
    assert.match(container.querySelector('[role="status"]')?.textContent ?? "", /Đang chuẩn bị tải lên/);

    // Browser-like disabled-button interaction: clicking the disabled control cannot submit again.
    (container.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1, "disabled-button click must not start a second request");

    // Direct form dispatch separately exercises the component's active-state submit guard.
    await submit();
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1, "second submit while prepare is pending must not start another prepare");
    assert.equal(uploadCalls, 0);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 0);
    assert.equal(refreshCalls, 0);

    await act(async () => {
      prepareResponse.resolve(Response.json({
        reservationId: "750e8400-e29b-41d4-a716-446655440001",
        version: 5,
        status: "reserved",
        upload: { bucket: "materials", path: "opaque", token: "opaque" }
      }));
      await uploadStarted.promise;
    });
    assert.equal(uploadCalls, 1);
    assert.equal((container.querySelector('input[type="file"]') as HTMLInputElement).disabled, true);
    assert.equal((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled, true);
    assert.match(container.querySelector('[role="status"]')?.textContent ?? "", /Đang tải tệp trực tiếp/);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);

    await act(async () => {
      storageResponse.resolve({ error: null });
      await finalizeStarted.promise;
    });
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
    assert.equal(uploadCalls, 1);
    assert.equal((container.querySelector('input[type="file"]') as HTMLInputElement).disabled, true);
    assert.equal((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled, true);
    assert.match(container.querySelector('[role="status"]')?.textContent ?? "", /Đang xác nhận phiên bản/);

    await act(async () => {
      finalizeResponse.resolve(Response.json({ success: true, version: 5 }));
      await refreshStarted.promise;
    });
    assert.equal(refreshCalls, 1);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1, "completing the first flow must not create a deferred duplicate request");
    assert.equal(uploadCalls, 1);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
    assert.equal(currentVersion, 4, "refresh leaves server props at the old version in this gate case");
    assert.match(container.querySelector('[role="status"]')?.textContent ?? "", /Đang cập nhật metadata/);
    assert.equal((container.querySelector('input[type="file"]') as HTMLInputElement).disabled, true);
    assert.equal((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled, true);
    assert.doesNotMatch(container.querySelector('[role="status"]')?.textContent ?? "", /Tải tệp tài liệu thành công/);

    currentVersion = 5;
    await act(async () => root!.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion })));
    assert.match(container.querySelector('[role="status"]')?.textContent ?? "", /Tải tệp tài liệu thành công/);
    assert.equal((container.querySelector('input[type="file"]') as HTMLInputElement).disabled, false);
    assert.equal((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled, false);
    assert.doesNotMatch(container.querySelector('[role="status"]')?.textContent ?? "", /Đang (?:chuẩn bị|tải tệp trực tiếp|xác nhận phiên bản|cập nhật metadata)/);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);
    assert.equal(uploadCalls, 1);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
    assert.equal(refreshCalls, 1);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(windowErrors, []);
  } finally {
    const restoreErrors: unknown[] = [];
    const cleanupErrors = await cleanupSteps([
      async () => { if (root) await act(async () => root!.unmount()); },
      () => { container?.remove(); },
      () => { dom.window.removeEventListener("error", onWindowError); },
      () => { dom.window.close(); },
      () => { console.error = originalConsoleError; },
      () => { restoreGlobals(original, restoreErrors); }
    ]);
    assert.deepEqual([...cleanupErrors, ...restoreErrors], [], "all cleanup steps must run even if one step fails");
  }
});

test("prepare, storage, and finalize failures never refresh or report success", async () => {
  const prepare = await run({ prepareStatus: 500 });
  assert.equal(prepare.role, "alert");
  assert.match(prepare.statusText, /Không thể tải tệp tài liệu/);
  assert.doesNotMatch(prepare.statusText, /thành công/);
  assert.doesNotMatch(prepare.statusText, /Đang (?:chuẩn bị|tải|xác nhận|cập nhật)/);
  assert.equal(prepare.inputDisabled, false, "prepare failure releases the file input");
  assert.equal(prepare.buttonDisabled, false, "prepare failure releases submit");
  assert.equal(prepare.fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);
  assert.equal(prepare.uploadCalls, 0);
  assert.equal(prepare.fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 0);
  assert.equal(prepare.refreshCalls, 0);

  const storage = await run({ uploadError: true });
  assert.equal(storage.role, "alert");
  assert.match(storage.statusText, /Không thể tải tệp tài liệu/);
  assert.doesNotMatch(storage.statusText, /thành công/);
  assert.doesNotMatch(storage.statusText, /Đang (?:chuẩn bị|tải|xác nhận|cập nhật)/);
  assert.equal(storage.inputDisabled, false, "storage failure releases the file input");
  assert.equal(storage.buttonDisabled, false, "storage failure releases submit");
  assert.equal(storage.fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);
  assert.equal(storage.uploadCalls, 1);
  assert.equal(storage.fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 0, "storage failure must skip finalize");
  assert.equal(storage.refreshCalls, 0);

  const finalize = await run({ finalizeStatus: 500 });
  assert.equal(finalize.role, "alert");
  assert.match(finalize.statusText, /Không thể tải tệp tài liệu/);
  assert.doesNotMatch(finalize.statusText, /thành công/);
  assert.doesNotMatch(finalize.statusText, /Đang (?:chuẩn bị|tải|xác nhận|cập nhật)/);
  assert.equal(finalize.inputDisabled, false, "finalize failure releases the file input");
  assert.equal(finalize.buttonDisabled, false, "finalize failure releases submit");
  assert.equal(finalize.fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);
  assert.equal(finalize.uploadCalls, 1);
  assert.equal(finalize.fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
  assert.equal(finalize.refreshCalls, 0);
});

test("server version equal to or above pending version confirms success", async () => {
  const atPendingVersion = await run({ initialVersion: 4, refreshedVersion: 5 });
  assert.match(atPendingVersion.statusText, /Tải tệp tài liệu thành công/);
  assert.equal(atPendingVersion.inputDisabled, false);
  assert.equal(atPendingVersion.buttonDisabled, false);
  const abovePendingVersion = await run({ initialVersion: 4, refreshedVersion: 6 });
  assert.match(abovePendingVersion.statusText, /Tải tệp tài liệu thành công/);
  assert.equal(abovePendingVersion.inputDisabled, false);
  assert.equal(abovePendingVersion.buttonDisabled, false);
  for (const result of [atPendingVersion, abovePendingVersion]) {
    assert.equal(result.fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);
    assert.equal(result.uploadCalls, 1);
    assert.equal(result.fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
    assert.equal(result.refreshCalls, 1);
  }
});

test("a previously committed idempotent attempt refreshes once without another upload or finalize", async () => {
  const result = await run({ prepared: { reservationId: "750e8400-e29b-41d4-a716-446655440001", version: 5, status: "committed" } });
  assert.equal(result.refreshCalls, 1);
  assert.equal(result.uploadCalls, 0);
  assert.equal(result.fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 0);
  assert.match(result.statusText, /Tải tệp tài liệu thành công/);
});

test("refresh exceptions and refreshed metadata-query errors do not leave a success status", async () => {
  for (const scenario of [{ refreshError: true }, { refreshedMetadataError: true }]) {
    const result = await run(scenario);
    assert.equal(result.refreshCalls, 1);
    assert.equal(result.role, "alert");
    assert.match(result.statusText, /không thể cập nhật metadata/);
    assert.doesNotMatch(result.statusText, /Tải tệp tài liệu thành công/);
  }
});

test("an empty refreshed catalog does not claim success for the new version", async () => {
  const result = await run({ refreshedVersion: null, immediateRefreshTimeout: true });
  assert.equal(result.refreshCalls, 1);
  assert.equal(result.role, "alert");
  assert.match(result.statusText, /danh mục chưa xác nhận metadata mới/);
  assert.doesNotMatch(result.statusText, /Tải tệp tài liệu thành công/);
});
