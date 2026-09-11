import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { test } from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  beginMaterialViewerLoad,
  closeMaterialViewer,
  completeMaterialViewerLoad,
  createMaterialViewerState,
  fetchMaterialDocumentUrl,
  hasCurrentMaterialAsset,
  isValidMaterialUrl,
  isVideoMaterialMimeType,
  materialViewLabel,
  materialViewerKind,
  default as MaterialViewButton
} from "../../app/quan-tri/catalog/material-view-button";
import LearnerMaterialViewer from "../../app/ca-nhan/mon/[slug]/material-viewer";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html?: string, options?: { url?: string }) => any };

const PRODUCT_ID = "2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64";
const SIGNED_URL = "https://storage.example/material?signed=1";
const execFileAsync = promisify(execFile);

const learnerPdfRuntimeHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const pdfjsModule = "data:text/javascript," + encodeURIComponent("export const GlobalWorkerOptions = globalThis.__workerOptions; export const getDocument = options => globalThis.__getDocument(options);");
const lucideModule = "data:text/javascript," + encodeURIComponent("export const Download = () => null; export const Eye = () => null; export const X = () => null;");
const reactEntry = await import.meta.resolve("react");
const reactModule = "data:text/javascript," + encodeURIComponent("export * from '" + reactEntry + "'; export { default } from '" + reactEntry + "';");
let source = await readFile("app/ca-nhan/mon/[slug]/material-viewer.tsx", "utf8");
source = 'import React from "react";\n' + source;
source = source.replace('await import("pdfjs-dist/legacy/build/pdf.mjs")', 'await import("' + pdfjsModule + '")');
source = source.replaceAll('"lucide-react"', '"' + lucideModule + '"');
source = source.replaceAll('"react"', '"' + reactModule + '"');
source = source.replace('new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString()', '"https://app.example/_next/static/chunks/pdf.worker.min.mjs"');
const compiled = await transform(source, { loader: "tsx", format: "esm", jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment" });
const component = (await import("data:text/javascript," + encodeURIComponent(compiled.code))).default;

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const installGlobal = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
installGlobal("window", dom.window);
installGlobal("document", dom.window.document);
installGlobal("navigator", dom.window.navigator);
installGlobal("HTMLElement", dom.window.HTMLElement);
installGlobal("Node", dom.window.Node);
installGlobal("DOMException", dom.window.DOMException);
installGlobal("IS_REACT_ACT_ENVIRONMENT", true);
dom.window.HTMLCanvasElement.prototype.getContext = () => ({});

const requestedPages = [], renderedPages = [];
let pdfDestroyCalls = 0, loadingDestroyCalls = 0, renderCancelCalls = 0, getDocumentCalls = 0, fetchCalls = 0;
let workerAtCall, disableWorker;
let resolveFirstFetch;
let resolveSecondRender;
const pdf = {
  numPages: 2,
  getPage: async pageNumber => {
    requestedPages.push(pageNumber);
    return {
      getViewport: () => ({ width: 640, height: 900 }),
      render: () => {
        renderedPages.push(pageNumber);
        const promise = pageNumber === 2 ? new Promise(resolve => { resolveSecondRender = resolve; }) : Promise.resolve();
        return { promise, cancel: () => { renderCancelCalls += 1; } };
      }
    };
  },
  destroy: async () => { pdfDestroyCalls += 1; }
};
globalThis.__workerOptions = {};
globalThis.__getDocument = options => {
  getDocumentCalls += 1;
  workerAtCall = globalThis.__workerOptions.workerSrc;
  disableWorker = options.disableWorker;
  return { promise: Promise.resolve(pdf), destroy: async () => { loadingDestroyCalls += 1; } };
};
globalThis.fetch = async () => {
  fetchCalls += 1;
  if (fetchCalls === 1) return new Promise(resolve => { resolveFirstFetch = resolve; });
  return fetchCalls === 2
    ? new Response(null, { status: 500 })
    : new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { "Content-Type": "application/pdf" } });
};

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const button = label => {
  const found = [...container.querySelectorAll("button")].find(candidate => candidate.textContent?.includes(label));
  if (!found) throw new Error("Missing button " + label);
  return found;
};
await act(async () => { root.render(createElement(component, { productId: "2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64", mimeType: "application/pdf", allowDownload: false })); });
await act(async () => { button("Mở tài liệu").click(); await Promise.resolve(); });
const loadingShown = container.querySelector('[role="status"]') !== null;
resolveFirstFetch(new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { "Content-Type": "application/pdf" } }));
await flush();
await act(async () => { button("Trang sau").click(); });
await flush();
const hasNativeToolbar = container.querySelector("iframe, embed, object") !== null;
await act(async () => { button("Đóng").click(); });
await flush();
const closed = container.querySelector('[role="dialog"]') === null && container.querySelector("canvas") === null;
await act(async () => { button("Mở tài liệu").click(); });
await flush();
const errorShown = container.querySelector('[role="alert"]') !== null;
console.log(JSON.stringify({ loadingShown, workerAtCall, disableWorker, getDocumentCalls, requestedPages, renderedPages, pdfDestroyCalls, loadingDestroyCalls, renderCancelCalls, hasNativeToolbar, closed, errorShown, fetchCalls }));
await act(async () => root.unmount());
`;

test("material view button visibility follows current asset presence", () => {
  assert.equal(hasCurrentMaterialAsset(undefined), false);
  assert.equal(hasCurrentMaterialAsset(null), false);
  assert.equal(hasCurrentMaterialAsset(0), false);
  assert.equal(hasCurrentMaterialAsset(2), true);
});

test("material labels and viewer kinds use the stored MIME type", () => {
  assert.equal(materialViewLabel("application/pdf"), "Xem tài liệu");
  assert.equal(materialViewLabel("video/mp4"), "Xem video");
  assert.equal(materialViewLabel("video/webm"), "Xem video");
  assert.equal(materialViewLabel("video/quicktime"), "Xem video");
  assert.equal(materialViewerKind("application/pdf"), "pdf");
  assert.equal(materialViewerKind("video/mp4"), "video");
  assert.equal(materialViewerKind("video/webm"), "video");
  assert.equal(materialViewerKind("video/quicktime"), "video");
  assert.equal(materialViewerKind("application/octet-stream"), null);
  assert.equal(materialViewerKind("text/plain"), null);
  assert.equal(materialViewerKind(undefined), null);
  assert.equal(materialViewerKind(null), null);
  assert.equal(isVideoMaterialMimeType("application/pdf"), false);
});

test("unsupported MIME renders no viewer and cannot call the signed-url API", () => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.fetch = async () => { fetchCalls += 1; return Response.json({ url: SIGNED_URL }); };
  globalThis.window = {
    open: () => { throw new Error("window.open must not be called"); },
    location: { assign: () => { throw new Error("window.location.assign must not be called"); } }
  } as unknown as Window & typeof globalThis;
  try {
    const html = renderToStaticMarkup(createElement(MaterialViewButton, { productId: PRODUCT_ID, mimeType: "application/octet-stream" }));
    assert.equal(html, "");
    assert.equal(fetchCalls, 0);
    assert.doesNotMatch(html, /iframe|video/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test("mounted unsupported MIME values never fetch, navigate, or render a viewer", async () => {
  const unsupportedMimeTypes: Array<string | undefined | null> = ["text/plain", undefined, null];

  for (const mimeType of unsupportedMimeTypes) {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
    const originalGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      navigator: globalThis.navigator,
      HTMLElement: globalThis.HTMLElement,
      Node: globalThis.Node,
      DOMException: globalThis.DOMException,
      IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
      fetch: globalThis.fetch
    };
    const navigationCalls: string[] = [];
    const installGlobal = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
    installGlobal("window", {
      open: () => { navigationCalls.push("window.open"); },
      location: { assign: () => { navigationCalls.push("window.location.assign"); } }
    } as unknown as Window & typeof globalThis);
    installGlobal("document", dom.window.document);
    installGlobal("navigator", dom.window.navigator);
    installGlobal("HTMLElement", dom.window.HTMLElement);
    installGlobal("Node", dom.window.Node);
    installGlobal("DOMException", dom.window.DOMException);
    installGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ url: SIGNED_URL });
    };

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(createElement(MaterialViewButton, { productId: PRODUCT_ID, mimeType: mimeType as string }));
      });
      assert.equal(container.innerHTML, "");
      assert.equal(fetchCalls, 0);
      assert.equal(navigationCalls.length, 0);
      assert.equal(container.querySelector('[role="dialog"]'), null);
      assert.equal(container.querySelector("iframe, embed, object, video"), null);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      globalThis.fetch = originalGlobals.fetch;
      for (const [name, value] of Object.entries(originalGlobals)) {
        if (name !== "fetch") installGlobal(name, value);
      }
    }
  }
});

test("mounted PDF and video viewers close, reset their URL, and reopen with a fresh signed URL", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    DOMException: globalThis.DOMException,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    fetch: globalThis.fetch
  };
  const installGlobal = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  installGlobal("window", dom.window);
  installGlobal("document", dom.window.document);
  installGlobal("navigator", dom.window.navigator);
  installGlobal("HTMLElement", dom.window.HTMLElement);
  installGlobal("Node", dom.window.Node);
  installGlobal("DOMException", dom.window.DOMException);
  installGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const pendingResponses: Array<(response: Response) => void> = [];
  const fetchCalls: string[] = [];
  globalThis.fetch = async (input) => {
    fetchCalls.push(String(input));
    return new Promise<Response>((resolve) => pendingResponses.push(resolve));
  };

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (mimeType: string) => act(async () => {
    root.render(createElement(MaterialViewButton, { productId: PRODUCT_ID, mimeType }));
  });
  const resolveNext = async (url: string) => act(async () => {
    const resolveResponse = pendingResponses.shift();
    assert.ok(resolveResponse, "the viewer should have an outstanding signed-url request");
    resolveResponse(Response.json({ url }));
    await Promise.resolve();
  });
  const clickButton = async (label: string) => act(async () => {
    const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
    assert.ok(button, `expected button ${label}`);
    button.click();
  });
  const clickClose = async () => act(async () => {
    const dialog = container.querySelector('[role="dialog"]');
    assert.ok(dialog, "expected an open viewer dialog");
    const closeButton = [...dialog.querySelectorAll("button")].find((candidate) => candidate.textContent === "Đóng");
    assert.ok(closeButton, "expected the Đóng button");
    closeButton.click();
  });

  try {
    await render("application/pdf");
    await clickButton("Xem tài liệu");
    assert.equal(fetchCalls.length, 1);
    assert.equal(container.querySelector('[role="dialog"]') !== null, true);
    assert.equal(container.querySelector("iframe"), null);
    await resolveNext(SIGNED_URL);
    const firstPdf = container.querySelector("iframe");
    assert.ok(firstPdf);
    assert.equal(firstPdf.getAttribute("src"), SIGNED_URL);
    await clickClose();
    assert.equal(container.querySelector('[role="dialog"]'), null);
    assert.equal(container.querySelector("iframe"), null);
    assert.doesNotMatch(container.innerHTML, /storage\.example\/material\?signed=1/);

    const reopenedPdfUrl = "https://storage.example/material?signed=2";
    await clickButton("Xem tài liệu");
    await resolveNext(reopenedPdfUrl);
    const reopenedPdf = container.querySelector("iframe");
    assert.ok(reopenedPdf);
    assert.equal(reopenedPdf.getAttribute("src"), reopenedPdfUrl);
    assert.notEqual(reopenedPdf.getAttribute("src"), SIGNED_URL);
    await clickClose();

    await render("video/mp4");
    await clickButton("Xem video");
    await resolveNext("https://storage.example/video?signed=3");
    const firstVideo = container.querySelector("video");
    assert.ok(firstVideo);
    assert.equal(firstVideo.controls, true);
    assert.equal(firstVideo.autoplay, false);
    assert.equal(firstVideo.getAttribute("src"), "https://storage.example/video?signed=3");
    await clickClose();
    assert.equal(container.querySelector("video"), null);
    assert.doesNotMatch(container.innerHTML, /storage\.example\/video\?signed=3/);

    await clickButton("Xem video");
    await resolveNext("https://storage.example/video?signed=4");
    const reopenedVideo = container.querySelector("video");
    assert.ok(reopenedVideo);
    assert.equal(reopenedVideo.getAttribute("src"), "https://storage.example/video?signed=4");
    assert.notEqual(reopenedVideo.getAttribute("src"), "https://storage.example/video?signed=3");
    await clickClose();

    await render("application/octet-stream");
    assert.equal(container.innerHTML, "");
    assert.equal(fetchCalls.length, 4);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalGlobals.fetch;
    for (const [name, value] of Object.entries(originalGlobals)) {
      if (name !== "fetch") installGlobal(name, value);
    }
  }
});

test("viewer lifecycle resets URL on close and never reuses the previous URL", () => {
  const initial = createMaterialViewerState();
  const loading = beginMaterialViewerLoad();
  const first = completeMaterialViewerLoad(SIGNED_URL);
  const closed = closeMaterialViewer();
  const second = completeMaterialViewerLoad("https://storage.example/other?signed=2");
  assert.equal(initial.viewerOpen, false);
  assert.equal(loading.viewerUrl, null);
  assert.equal(first.viewerOpen, true);
  assert.equal(closed.viewerOpen, false);
  assert.equal(closed.viewerUrl, null);
  assert.notEqual(second.viewerUrl, first.viewerUrl);
  assert.equal(second.viewerOpen, true);
});

test("viewer shell has a visible close control and the supported renderers", async () => {
  const source = await readFile("app/quan-tri/catalog/material-view-button.tsx", "utf8");
  assert.match(source, />Đóng<\/button>/);
  assert.match(source, /<iframe title="Tài liệu PDF"/);
  assert.match(source, /<video controls/);
  assert.match(source, /closeMaterialViewer\(\)/);
  assert.doesNotMatch(source, /window\.open|window\.location\.assign/);
  assert.doesNotMatch(source, /autoPlay/);
});

test("learner view-only viewer uses an app-controlled PDF canvas and app view/download boundaries", async () => {
  const source = await readFile("app/ca-nhan/mon/[slug]/material-viewer.tsx", "utf8");
  assert.match(source, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(source, /<canvas/);
  assert.match(source, /\/api\/materials\/\$\{encodeURIComponent\(productId\)\}\/view/);
  assert.match(source, /\/api\/materials\/\$\{encodeURIComponent\(productId\)\}\/download/);
  assert.match(source, /GlobalWorkerOptions\.workerSrc/);
  assert.match(source, /pdf\.worker\.min\.mjs/);
  assert.match(source, /allowDownload \?/);
  assert.match(source, /<video controls preload="metadata"/);
  assert.doesNotMatch(source, /<iframe|signed-url/);
  assert.doesNotMatch(source, /disableWorker/);
  assert.doesNotMatch(source, /autoPlay/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)|localStorage|sessionStorage/);
});

test("learner PDF viewer uses the bundled worker, renders multiple pages, and cleans up", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["--import", "tsx/esm", "-e", learnerPdfRuntimeHarness], {
    cwd: process.cwd(),
    maxBuffer: 2 * 1024 * 1024
  });
  const result = JSON.parse(stdout.trim()) as {
    loadingShown: boolean;
    workerAtCall?: string;
    disableWorker?: unknown;
    getDocumentCalls: number;
    requestedPages: number[];
    renderedPages: number[];
    pdfDestroyCalls: number;
    loadingDestroyCalls: number;
    renderCancelCalls: number;
    hasNativeToolbar: boolean;
    closed: boolean;
    errorShown: boolean;
    fetchCalls: number;
  };
  assert.equal(result.loadingShown, true);
  assert.equal(result.getDocumentCalls, 1);
  assert.match(result.workerAtCall ?? "", /pdf\.worker\.min\.mjs/);
  assert.equal(result.disableWorker, undefined);
  assert.deepEqual(result.requestedPages, [1, 2]);
  assert.deepEqual(result.renderedPages, [1, 2]);
  assert.equal(result.hasNativeToolbar, false);
  assert.equal(result.closed, true);
  assert.equal(result.pdfDestroyCalls, 1);
  assert.equal(result.loadingDestroyCalls, 1);
  assert.ok(result.renderCancelCalls >= 1);
  assert.equal(result.errorShown, true);
  assert.equal(result.fetchCalls, 2);
});

test("learner download control fetches the app endpoint and creates a browser download", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    DOMException: globalThis.DOMException,
    IS_REACT_ACT_ENVIRONMENT: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    fetch: globalThis.fetch
  };
  const originalAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
  const originalCreateObjectUrl = globalThis.URL.createObjectURL;
  const originalRevokeObjectUrl = globalThis.URL.revokeObjectURL;
  const installGlobal = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  installGlobal("window", dom.window);
  installGlobal("document", dom.window.document);
  installGlobal("navigator", dom.window.navigator);
  installGlobal("HTMLElement", dom.window.HTMLElement);
  installGlobal("Node", dom.window.Node);
  installGlobal("DOMException", dom.window.DOMException);
  installGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let requestedUrl = "";
  let downloadHref = "";
  let downloadName = "";
  let revokedHref = "";
  const downloadedBlobUrl = "blob:http://localhost/material";
  dom.window.HTMLAnchorElement.prototype.click = function click() {
    downloadHref = this.href;
    downloadName = this.download;
  };
  Object.defineProperty(globalThis.URL, "createObjectURL", { configurable: true, value: () => downloadedBlobUrl });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", { configurable: true, value: (value: string) => { revokedHref = value; } });
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment" } });
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(LearnerMaterialViewer, { productId: PRODUCT_ID, mimeType: "video/mp4", allowDownload: true }));
    });
    const openButton = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Mở tài liệu"));
    assert.ok(openButton);
    await act(async () => { (openButton as HTMLButtonElement).click(); });
    assert.ok(container.querySelector("video"));
    assert.equal((container.querySelector("video") as HTMLVideoElement).controls, true);
    assert.equal((container.querySelector("video") as HTMLVideoElement).autoplay, false);
    const downloadButton = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Tải xuống"));
    assert.ok(downloadButton);
    await act(async () => { (downloadButton as HTMLButtonElement).click(); await Promise.resolve(); });
    assert.equal(requestedUrl, `/api/materials/${PRODUCT_ID}/download`);
    assert.equal(downloadHref, downloadedBlobUrl);
    assert.equal(downloadName, `material-${PRODUCT_ID}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.equal(revokedHref, downloadedBlobUrl);
    assert.doesNotMatch(container.innerHTML, /signed|token|storage\.example/i);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalGlobals.fetch;
    dom.window.HTMLAnchorElement.prototype.click = originalAnchorClick;
    Object.defineProperty(globalThis.URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
    for (const [name, value] of Object.entries(originalGlobals)) {
      if (name !== "fetch") installGlobal(name, value);
    }
  }
});

test("viewer fetches the signed URL with the product id and does not navigate a popup", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(input, `/api/materials/${PRODUCT_ID}/signed-url`);
    assert.equal((init?.headers as Record<string, string>).Accept, "application/json");
    return Response.json({ url: SIGNED_URL });
  };
  try {
    assert.equal(await fetchMaterialDocumentUrl(PRODUCT_ID), SIGNED_URL);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("viewer rejects empty, malformed, relative, whitespace and unsafe URLs", () => {
  const invalidUrls: unknown[] = [
    "", "   ", " https://storage.example/material.pdf", "https://storage.example/material.pdf ",
    "https://example.com/material file.pdf", "https://[malformed", "javascript:alert(1)",
    "data:application/pdf;base64,ZmFrZQ==", "blob:https://storage.example/asset-id",
    "file:///tmp/material.pdf", "ftp://storage.example/material.pdf", "custom://storage.example/material.pdf",
    "/materials/material.pdf", undefined, null, 42, { url: SIGNED_URL }
  ];
  for (const value of invalidUrls) assert.equal(isValidMaterialUrl(value), false, JSON.stringify(value));
  assert.equal(isValidMaterialUrl("http://storage.example/material.pdf"), true);
  assert.equal(isValidMaterialUrl(SIGNED_URL), true);
});

test("API errors and malformed payloads become a generic error without logging the URL", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const logged: unknown[] = [];
  globalThis.fetch = async () => new Response(null, { status: 404 });
  console.log = (...args: unknown[]) => logged.push(...args);
  console.warn = (...args: unknown[]) => logged.push(...args);
  console.error = (...args: unknown[]) => logged.push(...args);
  try {
    await assert.rejects(fetchMaterialDocumentUrl(PRODUCT_ID), /Không thể mở tài liệu/);
    globalThis.fetch = async () => Response.json({ url: "javascript:alert(1)" });
    await assert.rejects(fetchMaterialDocumentUrl(PRODUCT_ID), /Không thể mở tài liệu/);
    assert.equal(logged.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
});
