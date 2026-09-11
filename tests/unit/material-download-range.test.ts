import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID = "650e8400-e29b-41d4-a716-446655440000";
const OBJECT_ID = "850e8400-e29b-41d4-a716-446655440000";
const STORAGE_PATH = `materials/${PRODUCT_ID}/v2/${OBJECT_ID}-private-material.pdf`;
const SIGNED_URL = "https://provider.example/signed/private-material";

let access: unknown;
let asset: unknown;
let downloadPermission = true;
let assetCalls: string[] = [];
let upstreamRequests: Request[] = [];
let upstreamResponse: Response;
let DOWNLOAD_GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let originalFetch: typeof fetch;
let originalModuleLoad: (...args: any[]) => unknown;

before(async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  originalModuleLoad = moduleLoader._load;
  moduleLoader._load = function(request: string, ...args: any[]) {
    if (request === "server-only") return {};
    return originalModuleLoad.call(this, request, ...args);
  };

  const setMock = (path: string, exports: Record<string, unknown>) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports } as any;
  };
  setMock(require.resolve("../../lib/auth/session"), {
    getAccountAccess: async () => access
  });
  setMock(require.resolve("../../lib/repositories/material-asset-repository"), {
    getCurrentMaterialAsset: async (productId: string) => {
      assetCalls.push(productId);
      return asset;
    },
    getMaterialDownloadPermission: async () => downloadPermission
  });
  setMock(require.resolve("../../lib/repositories/material-direct-access-repository"), {
    getMaterialDirectGrant: async () => null,
    isActiveMaterialDirectGrant: () => false
  });
  setMock(require.resolve("../../lib/repositories/product-entitlement-repository"), {
    getActiveProductEntitlement: async () => ({
      status: "active",
      user_id: USER_ID,
      product_id: PRODUCT_ID,
      revoked_at: null,
      expires_at: null
    })
  });
  setMock(require.resolve("../../lib/supabase/server-admin"), {
    createServerAdminClient: () => ({
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: { signedUrl: SIGNED_URL }, error: null })
        })
      }
    })
  });

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    upstreamRequests.push(new Request(input, init));
    return upstreamResponse;
  };

  ({ GET: DOWNLOAD_GET } = await import("../../app/api/materials/[id]/download/route"));
  moduleLoader._load = originalModuleLoad;
});

after(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "student" } };
  asset = { productId: PRODUCT_ID, storagePath: STORAGE_PATH, mimeType: "application/pdf" };
  downloadPermission = true;
  assetCalls = [];
  upstreamRequests = [];
  upstreamResponse = new Response("FULL_BYTES", {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": "10",
      "Accept-Ranges": "bytes",
      ETag: '"full-etag"',
      "Last-Modified": "Wed, 10 Sep 2026 00:00:00 GMT"
    }
  });
});

function request(headers?: HeadersInit): Request {
  return new Request("https://example.test/api/materials/ignored/download", { headers });
}

function context(id = PRODUCT_ID) {
  return { params: Promise.resolve({ id }) };
}

async function download(headers?: HeadersInit): Promise<Response> {
  return DOWNLOAD_GET(request(headers), context());
}

test("no Range returns the complete PDF body with the legacy download contract", async () => {
  const response = await download();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "FULL_BYTES");
  assert.equal(upstreamRequests.length, 1);
  assert.equal(upstreamRequests[0].headers.get("range"), null);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(response.headers.get("Content-Disposition"), "attachment");
  assert.equal(response.headers.get("Content-Length"), "10");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("ETag"), '"full-etag"');
  assert.equal(response.headers.get("Last-Modified"), "Wed, 10 Sep 2026 00:00:00 GMT");
});

test("a ranged PDF request reaches global fetch and returns the real partial response", async () => {
  upstreamResponse = new Response("PDF_PART", {
    status: 206,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": "8",
      "Content-Range": "bytes 10-17/100",
      "Accept-Ranges": "bytes",
      ETag: '"partial-pdf"',
      "Last-Modified": "Wed, 10 Sep 2026 00:00:00 GMT"
    }
  });

  const response = await download({ Range: "bytes=10-17" });
  assert.equal(upstreamRequests.length, 1);
  assert.equal(upstreamRequests[0].url, SIGNED_URL);
  assert.equal(upstreamRequests[0].headers.get("Range"), "bytes=10-17");
  assert.equal(response.status, 206);
  assert.equal(await response.text(), "PDF_PART");
  assert.equal(response.headers.get("Content-Range"), "bytes 10-17/100");
  assert.equal(response.headers.get("Content-Length"), "8");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(response.headers.get("Content-Disposition"), "attachment");
  assert.equal(response.headers.get("ETag"), '"partial-pdf"');
  assert.equal(response.headers.get("Last-Modified"), "Wed, 10 Sep 2026 00:00:00 GMT");
});

test("a ranged video request preserves partial body and attachment headers", async () => {
  asset = { productId: PRODUCT_ID, storagePath: STORAGE_PATH.replace(".pdf", ".mp4"), mimeType: "video/mp4" };
  upstreamResponse = new Response("VIDEO_PART", {
    status: 206,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": "10",
      "Content-Range": "bytes 0-9/500",
      "Accept-Ranges": "bytes"
    }
  });

  const response = await download({ Range: "bytes=0-9" });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), "VIDEO_PART");
  assert.equal(upstreamRequests[0].headers.get("Range"), "bytes=0-9");
  assert.equal(response.headers.get("Content-Type"), "video/mp4");
  assert.equal(response.headers.get("Content-Disposition"), "attachment");
  assert.equal(response.headers.get("Content-Range"), "bytes 0-9/500");
});

test("malformed and multiple ranges return 416 before asset or provider access", async () => {
  for (const range of ["bytes=broken", "bytes=0-1,2-3", "bytes=-"]) {
    const response = await download({ Range: range });
    assert.equal(response.status, 416);
    assert.deepEqual(await response.json(), { error: "Material unavailable." });
    assert.deepEqual(assetCalls, []);
    assert.deepEqual(upstreamRequests, []);
    assetCalls = [];
  }
});

test("upstream 416 stays 416 and never becomes a full response", async () => {
  upstreamResponse = new Response(null, {
    status: 416,
    headers: { "Content-Range": "bytes */100" }
  });

  const response = await download({ Range: "bytes=100-199" });
  assert.equal(response.status, 416);
  assert.deepEqual(await response.json(), { error: "Material unavailable." });
  assert.equal(upstreamRequests[0].headers.get("Range"), "bytes=100-199");
  assert.equal(response.headers.get("Content-Range"), null);
});

test("upstream 200 full body is rejected when a Range was requested", async () => {
  const response = await download({ Range: "bytes=0-9" });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Material unavailable." });
  assert.equal(upstreamRequests[0].headers.get("Range"), "bytes=0-9");
});

test("authorization completes before any provider access, including ranged requests", async () => {
  access = { status: "pending", user: { id: USER_ID }, profile: { role: "student" } };
  const response = await download({ Range: "bytes=0-9" });
  assert.equal(response.status, 404);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(upstreamRequests, []);
});
