import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
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

const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html?: string, options?: { url?: string }) => any };

const PRODUCT_ID = "2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64";
const SIGNED_URL = "https://storage.example/material?signed=1";

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
