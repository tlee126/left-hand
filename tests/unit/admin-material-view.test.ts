import assert from "node:assert/strict";
import { test } from "node:test";
import { hasCurrentMaterialAsset, isVideoMaterialMimeType, materialViewLabel, openMaterialDocument } from "../../app/quan-tri/catalog/material-view-button";

test("material view button visibility follows current asset presence", () => {
  assert.equal(hasCurrentMaterialAsset(undefined), false);
  assert.equal(hasCurrentMaterialAsset(null), false);
  assert.equal(hasCurrentMaterialAsset(0), false);
  assert.equal(hasCurrentMaterialAsset(2), true);
});

test("material view labels use the stored MIME type", () => {
  assert.equal(materialViewLabel("application/pdf"), "Xem tài liệu");
  assert.equal(materialViewLabel("video/mp4"), "Xem video");
  assert.equal(materialViewLabel("video/webm"), "Xem video");
  assert.equal(materialViewLabel("video/quicktime"), "Xem video");
  assert.equal(isVideoMaterialMimeType("video/mp4"), true);
  assert.equal(isVideoMaterialMimeType("video/webm"), true);
  assert.equal(isVideoMaterialMimeType("video/quicktime"), true);
  assert.equal(isVideoMaterialMimeType("application/pdf"), false);
});

test("material video viewer calls the signed-url API with the product id and opens the signed URL", async () => {
  const opened = { location: { href: "" }, close: () => undefined };
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = {
    open: () => opened,
    location: { assign: () => assert.fail("video popup should not use fallback") }
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async (input) => {
    assert.equal(input, "/api/materials/2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64/signed-url");
    return Response.json({ url: "https://storage.example/video.mp4?signed=1" });
  };
  try {
    await openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64");
    assert.equal(opened.location.href, "https://storage.example/video.mp4?signed=1");
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("material viewer opens the popup before fetching and navigates it to the signed url", async () => {
  const events: string[] = [];
  const opened = { location: { href: "" }, close: () => undefined };
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = {
    open: () => {
      events.push("open");
      return opened;
    },
    location: { assign: () => events.push("fallback") }
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async (input) => {
    events.push("fetch");
    assert.equal(input, "/api/materials/2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64/signed-url");
    return Response.json({ url: "https://storage.example/signed-url" });
  };
  try {
    await openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64");
    assert.deepEqual(events, ["open", "fetch"]);
    assert.equal(opened.location.href, "https://storage.example/signed-url");
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("material viewer falls back to the current tab when the popup is blocked", async () => {
  const events: string[] = [];
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = {
    open: () => {
      events.push("open");
      return null;
    },
    location: {
      assign: (url: string) => {
        events.push(`assign:${url}`);
      }
    }
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async (input) => {
    events.push("fetch");
    assert.equal(input, "/api/materials/2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64/signed-url");
    return Response.json({ url: "https://storage.example/signed-url" });
  };
  try {
    await openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64");
    assert.deepEqual(events, ["open", "fetch", "assign:https://storage.example/signed-url"]);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("material viewer accepts a valid http url", async () => {
  const opened = { location: { href: "" }, close: () => undefined };
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = {
    open: () => opened,
    location: { assign: () => assert.fail("valid popup url should not use fallback") }
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async () => Response.json({ url: "http://storage.example/material.pdf" });
  try {
    await openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64");
    assert.equal(opened.location.href, "http://storage.example/material.pdf");
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("material viewer rejects unsafe or malformed urls and closes the popup", async () => {
  const invalidUrls: unknown[] = [
    "",
    "   ",
    " https://storage.example/material.pdf",
    "https://storage.example/material.pdf ",
    "https://example.com/material file.pdf",
    "https://[malformed",
    "javascript:alert(1)",
    "data:application/pdf;base64,ZmFrZQ==",
    "blob:https://storage.example/asset-id",
    "file:///tmp/material.pdf",
    "ftp://storage.example/material.pdf",
    "custom://storage.example/material.pdf",
    "/materials/material.pdf",
    undefined,
    null,
    42,
    { url: "https://storage.example/material.pdf" }
  ];

  for (const invalidUrl of invalidUrls) {
    let closed = false;
    let assigned = false;
    let popupHref = "";
    const originalWindow = globalThis.window;
    const originalFetch = globalThis.fetch;
    globalThis.window = {
      open: () => ({ location: { get href() { return popupHref; }, set href(value: string) { popupHref = value; } }, close: () => { closed = true; } }),
      location: { assign: () => { assigned = true; } }
    } as unknown as Window & typeof globalThis;
    globalThis.fetch = async () => Response.json({ url: invalidUrl });
    try {
      await assert.rejects(openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64"), /Không thể mở tài liệu/);
      assert.equal(closed, true, `popup should close for ${JSON.stringify(invalidUrl)}`);
      assert.equal(popupHref, "", `popup should not navigate for ${JSON.stringify(invalidUrl)}`);
      assert.equal(assigned, false, `fallback should not run for ${JSON.stringify(invalidUrl)}`);
    } finally {
      globalThis.window = originalWindow;
      globalThis.fetch = originalFetch;
    }
  }
});

test("material viewer does not fall back when a blocked popup receives an invalid url", async () => {
  let assigned = false;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = {
    open: () => null,
    location: { assign: () => { assigned = true; } }
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async () => Response.json({ url: "javascript:alert(1)" });
  try {
    await assert.rejects(openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64"), /Không thể mở tài liệu/);
    assert.equal(assigned, false);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("material viewer handles API errors without navigating to an invalid url", async () => {
  let closed = false;
  let assigned = false;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = {
    open: () => ({ location: { href: "" }, close: () => { closed = true; } }),
    location: { assign: () => { assigned = true; } }
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  try {
    await assert.rejects(openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64"), /Không thể mở tài liệu/);
    assert.equal(closed, true);
    assert.equal(assigned, false);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("material viewer does not log the signed url or token", async () => {
  const signedUrl = "https://storage.example/signed-url?token=secret-token";
  const logged: unknown[][] = [];
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  globalThis.window = {
    open: () => ({ location: { href: "" }, close: () => undefined }),
    location: { assign: () => undefined }
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async () => Response.json({ url: signedUrl });
  console.log = (...args: unknown[]) => logged.push(args);
  console.warn = (...args: unknown[]) => logged.push(args);
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    await openMaterialDocument("2f7c5d75-4c0c-4f6d-b6b4-1d5e3b9d1e64");
    assert.equal(logged.flat().some((value) => String(value).includes(signedUrl)), false);
    assert.equal(logged.flat().some((value) => String(value).includes("secret-token")), false);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
});
