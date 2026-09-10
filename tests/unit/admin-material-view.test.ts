import assert from "node:assert/strict";
import { test } from "node:test";
import { hasCurrentMaterialAsset, openMaterialDocument } from "../../app/quan-tri/catalog/material-view-button";

test("material view button visibility follows current asset presence", () => {
  assert.equal(hasCurrentMaterialAsset(undefined), false);
  assert.equal(hasCurrentMaterialAsset(null), false);
  assert.equal(hasCurrentMaterialAsset(0), false);
  assert.equal(hasCurrentMaterialAsset(2), true);
});

test("material viewer calls signed-url with the product id and opens its url", async () => {
  const opened = { location: { href: "" }, close: () => undefined };
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = { open: () => opened } as unknown as Window & typeof globalThis;
  globalThis.fetch = async (input) => {
    assert.equal(input, "/api/materials/2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64/signed-url");
    return Response.json({ url: "https://storage.example/signed-url" });
  };
  try {
    await openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64");
    assert.equal(opened.location.href, "https://storage.example/signed-url");
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("material viewer handles API errors without crashing", async () => {
  let closed = false;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = { open: () => ({ location: { href: "" }, close: () => { closed = true; } }) } as unknown as Window & typeof globalThis;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  try {
    await assert.rejects(openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64"), /Không thể mở tài liệu/);
    assert.equal(closed, true);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});
