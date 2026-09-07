/** Runtime tests for the entitlement-checked material signed-URL route. */

import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID = "650e8400-e29b-41d4-a716-446655440000";
const OTHER_PRODUCT_ID = "750e8400-e29b-41d4-a716-446655440001";
const STORAGE_PATH = "materials/650e8400-e29b-41d4-a716-446655440000/v2/850e8400-e29b-41d4-a716-446655440000-private-material.pdf";
const OTHER_STORAGE_PATH = "materials/750e8400-e29b-41d4-a716-446655440001/v2/850e8400-e29b-41d4-a716-446655440000-private-material.pdf";
const SIGNED_URL = "https://example.test/signed/private-material";

let GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let access: any;
let entitlement: unknown = { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
let asset: unknown = { productId: PRODUCT_ID, storagePath: STORAGE_PATH };
let accessError: unknown = null;
let entitlementError: unknown = null;
let assetError: unknown = null;
let signerError: unknown = null;
let signedUrl = SIGNED_URL;
let timeline: string[] = [];
let entitlementCalls: Array<[string, string]> = [];
let assetCalls: string[] = [];
let signerCalls: string[] = [];
let signerProductCalls: string[] = [];
let mutationCalls: string[] = [];

const approvedStudent = {
  status: "approved",
  user: { id: USER_ID },
  profile: { role: "student" }
};

before(async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  const originalModuleLoad = moduleLoader._load;
  moduleLoader._load = function(request: string, ...args: any[]) {
    if (request === "server-only") return {};
    return originalModuleLoad.call(this, request, ...args);
  };

  const setMock = (path: string, exports: Record<string, unknown>) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports } as any;
  };
  setMock(require.resolve("../../lib/auth/session"), {
    getAccountAccess: async () => {
      timeline.push("auth");
      if (accessError) throw accessError;
      return access;
    }
  });
  setMock(require.resolve("../../lib/repositories/product-entitlement-repository"), {
    getActiveProductEntitlement: async (userId: string, productId: string) => {
      timeline.push("entitlement");
      entitlementCalls.push([userId, productId]);
      if (entitlementError) throw entitlementError;
      return entitlement;
    },
    createProductEntitlement: async () => {
      mutationCalls.push("entitlement");
      return null;
    }
  });
  setMock(require.resolve("../../lib/repositories/material-asset-repository"), {
    getCurrentMaterialAsset: async (productId: string) => {
      timeline.push("asset");
      assetCalls.push(productId);
      if (assetError) throw assetError;
      return asset;
    },
    createMaterialAsset: async () => {
      mutationCalls.push("metadata");
      return null;
    }
  });
  const uuidPattern = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
  const storagePathPattern = new RegExp(`^materials/(${uuidPattern})/v[1-9][0-9]*/(${uuidPattern})-([a-z0-9][a-z0-9._-]*)$`, "i");
  setMock(require.resolve("../../lib/storage/material-storage"), {
    MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS: 300,
    isValidMaterialUuid: (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value),
    isValidMaterialStoragePathForProduct: (storagePath: unknown, expectedProductId: unknown) => {
      if (typeof storagePath !== "string" || typeof expectedProductId !== "string") return false;
      const match = storagePathPattern.exec(storagePath);
      if (!match || match[1].toLowerCase() !== expectedProductId.toLowerCase()) return false;
      const filename = match[3];
      return filename === filename.toLowerCase() && !filename.includes("..");
    },
    createMaterialSignedUrl: async (storagePath: string, expectedProductId: string) => {
      timeline.push("sign");
      signerCalls.push(storagePath);
      signerProductCalls.push(expectedProductId);
      if (signerError) throw signerError;
      return signedUrl;
    },
    uploadMaterialObject: async () => {
      mutationCalls.push("upload");
      return null;
    }
  });

  ({ GET } = await import("../../app/api/materials/[id]/signed-url/route"));
  moduleLoader._load = originalModuleLoad;
});

afterEach(() => {
  access = approvedStudent;
  entitlement = { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
  asset = { productId: PRODUCT_ID, storagePath: STORAGE_PATH };
  accessError = null;
  entitlementError = null;
  assetError = null;
  signerError = null;
  signedUrl = SIGNED_URL;
  timeline = [];
  entitlementCalls = [];
  assetCalls = [];
  signerCalls = [];
  signerProductCalls = [];
  mutationCalls = [];
});

async function request(id = PRODUCT_ID): Promise<Response> {
  return GET(new Request("https://example.test/api/materials/ignored/signed-url"), {
    params: Promise.resolve({ id })
  });
}

async function assertGeneric(response: Response, status = 404): Promise<void> {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: "Material unavailable." });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
}

test("rejects anonymous users before repositories or storage", async () => {
  access = { status: "unauthenticated", user: null, profile: null };
  await assertGeneric(await request(), 401);
  assert.deepEqual(timeline, ["auth"]);
  assert.deepEqual(entitlementCalls, []);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);
});

test("rejects pending, rejected, suspended, profile-missing, and approved non-admin users before asset lookup", async () => {
  for (const denied of [
    { status: "pending", user: { id: USER_ID }, profile: { role: "student" } },
    { status: "rejected", user: { id: USER_ID }, profile: { role: "student" } },
    { status: "suspended", user: { id: USER_ID }, profile: { role: "student" } },
    { status: "profile_missing", user: { id: USER_ID }, profile: null },
    approvedStudent
  ]) {
    access = denied;
    entitlement = null;
    await assertGeneric(await request());
    assert.equal(timeline[0], "auth");
    assert.deepEqual(assetCalls, []);
    assert.deepEqual(signerCalls, []);
    timeline = [];
    entitlementCalls = [];
  }
});

test("allows an approved admin without an entitlement and uses only the trusted material ID and database path", async () => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: SIGNED_URL, expiresIn: 300 });
  assert.deepEqual(timeline, ["auth", "asset", "sign"]);
  assert.deepEqual(entitlementCalls, []);
  assert.deepEqual(assetCalls, [PRODUCT_ID]);
  assert.deepEqual(signerCalls, [STORAGE_PATH]);
  assert.deepEqual(signerProductCalls, [PRODUCT_ID]);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("allows only active entitlement results for approved non-admin users", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(timeline, ["auth", "entitlement", "asset", "sign"]);
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.deepEqual(assetCalls, [PRODUCT_ID]);
  assert.deepEqual(signerCalls, [STORAGE_PATH]);
  assert.deepEqual(signerProductCalls, [PRODUCT_ID]);
});

test("rejects missing, revoked, and expired entitlement results before asset lookup or signing", async () => {
  for (const invalidEntitlement of [
    null,
    { status: "revoked", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: "2026-09-01T00:00:00.000Z", expires_at: null },
    { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: "2026-09-01T00:00:00.000Z", expires_at: null },
    { status: "expired", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null },
    { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: "2020-01-01T00:00:00.000Z" }
  ]) {
    entitlement = invalidEntitlement;
    await assertGeneric(await request());
    assert.deepEqual(timeline, ["auth", "entitlement"]);
    assert.deepEqual(assetCalls, []);
    assert.deepEqual(signerCalls, []);
    assert.deepEqual(mutationCalls, []);
    timeline = [];
    entitlementCalls = [];
  }
});

test("rejects an active entitlement with the wrong user identity before asset lookup or signing", async () => {
  entitlement = { status: "active", user_id: OTHER_USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
  await assertGeneric(await request());
  assert.deepEqual(timeline, ["auth", "entitlement"]);
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);
  assert.deepEqual(mutationCalls, []);
});

test("rejects an active entitlement with the wrong product identity before asset lookup or signing", async () => {
  entitlement = { status: "active", user_id: USER_ID, product_id: OTHER_PRODUCT_ID, revoked_at: null, expires_at: null };
  await assertGeneric(await request());
  assert.deepEqual(timeline, ["auth", "entitlement"]);
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);
  assert.deepEqual(mutationCalls, []);
});

test("accepts equivalent uppercase and lowercase UUID identities and passes canonical product values", async () => {
  access = { status: "approved", user: { id: USER_ID.toUpperCase() }, profile: { role: "student" } };
  entitlement = { status: "active", user_id: USER_ID.toUpperCase(), product_id: PRODUCT_ID.toUpperCase(), revoked_at: null, expires_at: null };
  asset = { productId: PRODUCT_ID.toUpperCase(), storagePath: STORAGE_PATH };

  const response = await request(PRODUCT_ID.toUpperCase());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: SIGNED_URL, expiresIn: 300 });
  assert.deepEqual(timeline, ["auth", "entitlement", "asset", "sign"]);
  assert.deepEqual(entitlementCalls, [[USER_ID, PRODUCT_ID]]);
  assert.deepEqual(assetCalls, [PRODUCT_ID]);
  assert.deepEqual(signerCalls, [STORAGE_PATH]);
  assert.deepEqual(signerProductCalls, [PRODUCT_ID]);
  assert.deepEqual(mutationCalls, []);
});

test("rejects an asset row whose product identity differs from its storage path", async () => {
  asset = { productId: PRODUCT_ID, storagePath: OTHER_STORAGE_PATH };
  await assertGeneric(await request());
  assert.deepEqual(timeline, ["auth", "entitlement", "asset"]);
  assert.deepEqual(assetCalls, [PRODUCT_ID]);
  assert.deepEqual(signerCalls, []);
  assert.deepEqual(mutationCalls, []);
});

test("rejects malformed or traversal-looking storage paths before signing", async () => {
  for (const storagePath of [
    `materials/${PRODUCT_ID}/v2/850e8400-e29b-41d4-a716-446655440000-../private-material.pdf`,
    `materials/${PRODUCT_ID}/v2/../850e8400-e29b-41d4-a716-446655440000-private-material.pdf`,
    `materials/${PRODUCT_ID}/v2/850e8400-e29b-41d4-a716-446655440000-private..material.pdf`
  ]) {
    asset = { productId: PRODUCT_ID, storagePath };
    await assertGeneric(await request());
    assert.deepEqual(timeline, ["auth", "entitlement", "asset"]);
    assert.deepEqual(signerCalls, []);
    assert.deepEqual(mutationCalls, []);
    timeline = [];
    entitlementCalls = [];
    assetCalls = [];
    signerCalls = [];
    signerProductCalls = [];
    mutationCalls = [];
  }
});

test("rejects wrong-bucket and wrong-namespace storage paths before signing", async () => {
  for (const storagePath of [
    `private/${PRODUCT_ID}/v2/850e8400-e29b-41d4-a716-446655440000-private-material.pdf`,
    OTHER_STORAGE_PATH
  ]) {
    asset = { productId: PRODUCT_ID, storagePath };
    await assertGeneric(await request());
    assert.deepEqual(timeline, ["auth", "entitlement", "asset"]);
    assert.deepEqual(signerCalls, []);
    assert.deepEqual(mutationCalls, []);
    timeline = [];
    entitlementCalls = [];
    assetCalls = [];
    signerCalls = [];
    signerProductCalls = [];
    mutationCalls = [];
  }
});

test("rejects invalid UUIDs after the session guard but before repository or storage calls", async () => {
  await assertGeneric(await request("not-a-uuid"));
  assert.deepEqual(timeline, ["auth"]);
  assert.deepEqual(entitlementCalls, []);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);
});

test("maps missing assets and repository or signer failures to one private generic response", async () => {
  for (const scenario of ["missingAsset", "entitlementError", "assetError", "signerError"] as const) {
    if (scenario === "missingAsset") asset = null;
    if (scenario === "entitlementError") entitlementError = new Error("email@example.test materials/internal/path SQL");
    if (scenario === "assetError") assetError = new Error("email@example.test materials/internal/path SQL");
    if (scenario === "signerError") signerError = new Error("email@example.test materials/internal/path SQL");
    const response = await request();
    await assertGeneric(response);
    const body = JSON.stringify({ status: response.status, headers: [...response.headers], timeline });
    for (const forbidden of ["email@example.test", "materials/", "internal/path", "sql", STORAGE_PATH.toLowerCase()]) {
      assert.equal(body.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
    }
    timeline = [];
    entitlementCalls = [];
    assetCalls = [];
    signerCalls = [];
    entitlementError = null;
    assetError = null;
    signerError = null;
    asset = { productId: PRODUCT_ID, storagePath: STORAGE_PATH };
  }
});

test("returns only the signed URL fields with a bounded server expiry", async () => {
  const response = await request();
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["expiresIn", "url"]);
  assert.equal(body.expiresIn, 300);
  assert.ok(body.expiresIn > 0 && body.expiresIn <= 300);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
