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
type RunResult = { statusText: string; role: string | null; refreshCalls: number; fetchCalls: string[]; uploadCalls: number };

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
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/quan-tri/catalog" });
  if (scenario.immediateRefreshTimeout) {
    const originalSetTimeout = dom.window.setTimeout.bind(dom.window);
    dom.window.setTimeout = ((callback: (...args: unknown[]) => void) => originalSetTimeout(callback, 0)) as typeof dom.window.setTimeout;
  }
  const original = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    DOMException: globalThis.DOMException,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    fetch: globalThis.fetch
  };
  const install = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  install("window", dom.window);
  install("document", dom.window.document);
  install("navigator", dom.window.navigator);
  install("HTMLElement", dom.window.HTMLElement);
  install("Node", dom.window.Node);
  install("DOMException", dom.window.DOMException);
  install("IS_REACT_ACT_ENVIRONMENT", true);

  let refreshCalls = 0;
  let uploadCalls = 0;
  let currentVersion = scenario.initialVersion ?? null;
  let metadataReadError = scenario.metadataReadError ?? false;
  let root: ReturnType<typeof createRoot> | null = null;
  const fetchCalls: string[] = [];
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

  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  try {
    await act(async () => root!.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion, metadataReadError })));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new dom.window.File(["%PDF-1.4"], "material.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => root!.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion, metadataReadError })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const status = container.querySelector('[role="status"], [role="alert"]');
    return { statusText: status?.textContent ?? "", role: status?.getAttribute("role") ?? null, refreshCalls, fetchCalls, uploadCalls };
  } finally {
    await act(async () => root!.unmount());
    container.remove();
    globalThis.fetch = original.fetch;
    for (const [name, value] of Object.entries(original)) if (name !== "fetch") install(name, value);
    delete (globalThis as typeof globalThis & { __uploadRouter?: unknown }).__uploadRouter;
    delete (globalThis as typeof globalThis & { __uploadCreateClient?: unknown }).__uploadCreateClient;
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
  const original = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    DOMException: globalThis.DOMException,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    fetch: globalThis.fetch,
    consoleError: console.error
  };
  const install = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  install("window", dom.window);
  install("document", dom.window.document);
  install("navigator", dom.window.navigator);
  install("HTMLElement", dom.window.HTMLElement);
  install("Node", dom.window.Node);
  install("DOMException", dom.window.DOMException);
  install("IS_REACT_ACT_ENVIRONMENT", true);

  const consoleErrors: unknown[][] = [];
  const windowErrors: string[] = [];
  const onWindowError = (event: ErrorEvent) => windowErrors.push(event.message);
  dom.window.addEventListener("error", onWindowError);
  console.error = (...args: unknown[]) => { consoleErrors.push(args); };

  let refreshCalls = 0;
  let uploadCalls = 0;
  let currentVersion: number | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const fetchCalls: string[] = [];
  (globalThis as typeof globalThis & { __uploadRouter?: unknown; __uploadCreateClient?: unknown }).__uploadRouter = {
    refresh() {
      refreshCalls += 1;
      refreshStarted.resolve();
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

  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const submit = async () => act(async () => {
    container.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });

  try {
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
    assert.match(container.querySelector('[role="status"]')?.textContent ?? "", /Đang tải tệp trực tiếp/);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);

    await act(async () => {
      storageResponse.resolve({ error: null });
      await finalizeStarted.promise;
    });
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
    assert.equal(uploadCalls, 1);

    await act(async () => {
      finalizeResponse.resolve(Response.json({ success: true, version: 5 }));
      await refreshStarted.promise;
    });
    assert.equal(refreshCalls, 1);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1, "completing the first flow must not create a deferred duplicate request");
    assert.equal(uploadCalls, 1);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
    assert.doesNotMatch(container.querySelector('[role="status"]')?.textContent ?? "", /Tải tệp tài liệu thành công/);

    currentVersion = 5;
    await act(async () => root!.render(createElement(MaterialUploadForm, { productId: PRODUCT_ID, currentVersion })));
    assert.match(container.querySelector('[role="status"]')?.textContent ?? "", /Tải tệp tài liệu thành công/);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/prepare")).length, 1);
    assert.equal(uploadCalls, 1);
    assert.equal(fetchCalls.filter((url) => url.endsWith("/upload/finalize")).length, 1);
    assert.equal(refreshCalls, 1);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(windowErrors, []);
  } finally {
    if (root) await act(async () => root!.unmount());
    container.remove();
    dom.window.removeEventListener("error", onWindowError);
    dom.window.close();
    globalThis.fetch = original.fetch;
    console.error = original.consoleError;
    for (const [name, value] of Object.entries(original)) {
      if (name !== "fetch" && name !== "consoleError") install(name, value);
    }
    delete (globalThis as typeof globalThis & { __uploadRouter?: unknown }).__uploadRouter;
    delete (globalThis as typeof globalThis & { __uploadCreateClient?: unknown }).__uploadCreateClient;
  }
});

test("prepare, storage, and finalize failures never refresh or report success", async () => {
  for (const scenario of [{ prepareStatus: 500 }, { uploadError: true }, { finalizeStatus: 500 }]) {
    const result = await run(scenario);
    assert.equal(result.refreshCalls, 0);
    assert.equal(result.role, "alert");
    assert.match(result.statusText, /Không thể tải tệp tài liệu/);
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
