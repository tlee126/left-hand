import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  fetchMaterialDocumentUrl,
  hasCurrentMaterialAsset,
  isValidMaterialUrl,
  isVideoMaterialMimeType,
  materialViewLabel,
  materialViewerKind
} from "../../app/quan-tri/catalog/material-view-button";

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
  assert.equal(isVideoMaterialMimeType("application/pdf"), false);
});

test("viewer shell has a visible close control and the supported renderers", async () => {
  const source = await readFile("app/quan-tri/catalog/material-view-button.tsx", "utf8");
  assert.match(source, />Đóng<\/button>/);
  assert.match(source, /<iframe title="Tài liệu PDF"/);
  assert.match(source, /<video controls/);
  assert.match(source, /setViewerUrl\(null\)/);
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
