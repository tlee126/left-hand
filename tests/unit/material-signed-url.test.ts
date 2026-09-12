/** Runtime tests for the approved-admin-only explicit material signed-URL route. */

import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID = "650e8400-e29b-41d4-a716-446655440000";
const OTHER_PRODUCT_ID = "750e8400-e29b-41d4-a716-446655440001";
const STORAGE_PATH = "materials/650e8400-e29b-41d4-a716-446655440000/v2/850e8400-e29b-41d4-a716-446655440000-private-material.pdf";
const OTHER_STORAGE_PATH = "materials/750e8400-e29b-41d4-a716-446655440001/v2/850e8400-e29b-41d4-a716-446655440000-private-material.pdf";
const SIGNED_URL = "https://example.test/signed/private-material";
const DIRECT_GRANT_ID = "950e8400-e29b-41d4-a716-446655440000";

let GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let DOWNLOAD_GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let VIEW_GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let DIRECT_LIST_GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let DIRECT_CREATE_POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let DIRECT_UPDATE_PATCH: (request: Request, context: { params: Promise<{ id: string; userId: string }> }) => Promise<Response>;
let DIRECT_REVOKE_DELETE: (request: Request, context: { params: Promise<{ id: string; userId: string }> }) => Promise<Response>;
let STUDENT_SEARCH_GET: (request: Request) => Promise<Response>;
let access: any;
let entitlement: unknown = { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
let directGrant: unknown = null;
let asset: unknown = { productId: PRODUCT_ID, storagePath: STORAGE_PATH, mimeType: "application/pdf" };
let downloadPermission: unknown = false;
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
let viewerCalls: string[] = [];
let viewerStatus: number | null = null;
let directGrants: unknown[] = [];
let directListMissingMaterial = false;
let directGrantTargetError: unknown = null;
let directUpdateError: unknown = null;
let directRevokeError: unknown = null;
let studentSearchResults: unknown[] = [];
let studentSearchCalls: string[] = [];
let studentSearchError: unknown = null;

class MockMaterialDirectAccessInputError extends Error {}
class MockMaterialDirectAccessRepositoryError extends Error {}

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
    getMaterialDownloadPermission: async (productId: string) => {
      timeline.push("policy");
      return downloadPermission;
    },
    createMaterialAsset: async () => {
      mutationCalls.push("metadata");
      return null;
    }
  });
  setMock(require.resolve("../../lib/repositories/material-direct-access-repository"), {
    getMaterialDirectGrant: async (userId: string, materialId: string) => {
      timeline.push("direct-grant");
      assert.equal(userId, USER_ID);
      assert.equal(materialId, PRODUCT_ID);
      return directGrant;
    },
    isActiveMaterialDirectGrant: (grant: any, userId: string, materialId: string) => Boolean(
      grant
      && grant.user_id?.toLowerCase() === userId
      && grant.material_id?.toLowerCase() === materialId
      && grant.revoked_at === null
      && (!grant.expires_at || Date.parse(grant.expires_at) > Date.now())
    ),
    getMaterialDirectGrants: async () => {
      if (directListMissingMaterial) return null;
      if (directGrants[0] instanceof Error) throw directGrants[0];
      return directGrants;
    },
    searchApprovedStudents: async (query: string) => {
      studentSearchCalls.push(query);
      if (studentSearchError) throw studentSearchError;
      if (query.trim().length < 1 || query.trim().length > 100 || !query.trim().replace(/[^\p{L}\p{N}@._+\-\s]/gu, " ").trim()) {
        throw new MockMaterialDirectAccessInputError();
      }
      return studentSearchResults.slice(0, 20).map((student: any) => ({
        id: student.id,
        full_name: student.full_name,
        email: student.email ?? null,
        student_code: student.student_code ?? null,
        faculty: student.faculty ?? null,
        major: student.major ?? null
      }));
    },
    grantMaterialDirectAccess: async (input: any) => {
      if (directGrantTargetError) throw directGrantTargetError;
      mutationCalls.push(`grant:${input.userId}:${input.materialId}`);
      if (input.canDownload && !input.canView) throw new MockMaterialDirectAccessInputError();
      const grant = activeDirectGrant({ user_id: input.userId, material_id: input.materialId, can_view: input.canView, can_download: input.canDownload, expires_at: input.expiresAt ?? null });
      directGrants = [grant];
      return grant;
    },
    updateMaterialDirectAccess: async (input: any) => {
      if (directUpdateError) throw directUpdateError;
      const keys = Object.keys(input).filter((key) => key !== "userId" && key !== "materialId");
      if (keys.length === 0 || keys.some((key) => !["canView", "canDownload", "expiresAt"].includes(key))
        || (Object.prototype.hasOwnProperty.call(input, "canView") && typeof input.canView !== "boolean")
        || (Object.prototype.hasOwnProperty.call(input, "canDownload") && typeof input.canDownload !== "boolean")
        || (Object.prototype.hasOwnProperty.call(input, "expiresAt") && input.expiresAt !== null && (typeof input.expiresAt !== "string" || !Number.isFinite(Date.parse(input.expiresAt))))
        || (input.canView === false && input.canDownload === true)) throw new MockMaterialDirectAccessInputError();
      mutationCalls.push(`update:${input.userId}:${input.materialId}`);
      return activeDirectGrant({ user_id: input.userId, material_id: input.materialId, ...(input.canView === undefined ? {} : { can_view: input.canView }), ...(input.canDownload === undefined ? {} : { can_download: input.canDownload }), ...(Object.prototype.hasOwnProperty.call(input, "expiresAt") ? { expires_at: input.expiresAt } : {}) });
    },
    revokeMaterialDirectAccess: async (userId: string, materialId: string) => {
      if (directRevokeError) throw directRevokeError;
      mutationCalls.push(`revoke:${userId}:${materialId}`);
      return activeDirectGrant({ user_id: userId, material_id: materialId, revoked_at: "2026-09-11T00:00:00.000Z" });
    },
    validateGrantMaterialDirectAccessInput: (input: unknown) => {
      const value = input as any;
      if (typeof value.userId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.userId)
        || typeof value.materialId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.materialId)
        || typeof value.canView !== "boolean" || typeof value.canDownload !== "boolean"
        || (value.expiresAt !== null && value.expiresAt !== undefined && (typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt))))
      ) {
        throw new MockMaterialDirectAccessInputError();
      }
      if (value.canDownload === true && value.canView !== true) throw new MockMaterialDirectAccessInputError();
      return value;
    },
    MaterialDirectAccessInputError: MockMaterialDirectAccessInputError,
    MaterialDirectAccessRepositoryError: MockMaterialDirectAccessRepositoryError
  });
  const uuidPattern = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
  const storagePathPattern = new RegExp(`^materials/(${uuidPattern})/v[1-9][0-9]*/(${uuidPattern})-([a-z0-9][a-z0-9._-]*)$`, "i");
  setMock(require.resolve("../../lib/storage/material-storage"), {
    MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS: 300,
    isValidMaterialUuid: (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value),
    isValidMaterialRangeHeader: (value: unknown) => typeof value === "string" && /^(?:bytes=(?:\d+-\d+|\d+-|-\d+))$/.test(value),
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
    fetchMaterialObjectForViewer: async (storagePath: string, expectedProductId: string, rangeHeader?: string | null) => {
      timeline.push("viewer");
      viewerCalls.push(`${storagePath}:${expectedProductId}`);
      return new Response(viewerStatus === 416 ? null : (rangeHeader ? "RANGE_BYTES" : "PRIVATE_BYTES"), {
        status: viewerStatus ?? (rangeHeader ? 206 : 200),
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": viewerStatus === 416 ? "0" : (rangeHeader ? "11" : "13"),
          "Accept-Ranges": "bytes",
          ...(rangeHeader && viewerStatus !== 416 ? { "Content-Range": "bytes 0-10/13" } : {})
        }
      });
    },
    uploadMaterialObject: async () => {
      mutationCalls.push("upload");
      return null;
    }
  });

  ({ GET } = await import("../../app/api/materials/[id]/signed-url/route"));
  ({ GET: DOWNLOAD_GET } = await import("../../app/api/materials/[id]/download/route"));
  ({ GET: VIEW_GET } = await import("../../app/api/materials/[id]/view/route"));
  ({ GET: DIRECT_LIST_GET, POST: DIRECT_CREATE_POST } = await import("../../app/api/admin/materials/[id]/direct-grants/route"));
  ({ PATCH: DIRECT_UPDATE_PATCH, DELETE: DIRECT_REVOKE_DELETE } = await import("../../app/api/admin/materials/[id]/direct-grants/[userId]/route"));
  ({ GET: STUDENT_SEARCH_GET } = await import("../../app/api/admin/students/search/route"));
  moduleLoader._load = originalModuleLoad;
});

afterEach(() => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  entitlement = { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
  directGrant = null;
  asset = { productId: PRODUCT_ID, storagePath: STORAGE_PATH, mimeType: "application/pdf" };
  downloadPermission = false;
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
  viewerCalls = [];
  viewerStatus = null;
  directGrants = [];
  directListMissingMaterial = false;
  directGrantTargetError = null;
  directUpdateError = null;
  directRevokeError = null;
  studentSearchResults = [];
  studentSearchCalls = [];
  studentSearchError = null;
});

async function request(id = PRODUCT_ID): Promise<Response> {
  return GET(new Request("https://example.test/api/materials/ignored/signed-url"), {
    params: Promise.resolve({ id })
  });
}

async function requestDownload(id = PRODUCT_ID, headers?: HeadersInit): Promise<Response> {
  return DOWNLOAD_GET(new Request("https://example.test/api/materials/ignored/download", { headers }), {
    params: Promise.resolve({ id })
  });
}

async function requestView(id = PRODUCT_ID, headers?: HeadersInit, metadata = false): Promise<Response> {
  return VIEW_GET(new Request(`https://example.test/api/materials/ignored/view${metadata ? "?metadata=1" : ""}`, { headers }), {
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

test("does not issue an explicit signed URL to an approved student, even with active entitlement", async () => {
  access = approvedStudent;
  const response = await request();
  await assertGeneric(response);
  assert.deepEqual(timeline, ["auth"]);
  assert.deepEqual(entitlementCalls, []);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);
});

test("does not consult entitlement or storage when an approved student calls the signed-URL route", async () => {
  access = approvedStudent;
  for (const invalidEntitlement of [
    null,
    { status: "revoked", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: "2026-09-01T00:00:00.000Z", expires_at: null },
    { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: "2026-09-01T00:00:00.000Z", expires_at: null },
    { status: "expired", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null },
    { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: "2020-01-01T00:00:00.000Z" }
  ]) {
    entitlement = invalidEntitlement;
    await assertGeneric(await request());
    assert.deepEqual(timeline, ["auth"]);
    assert.deepEqual(assetCalls, []);
    assert.deepEqual(signerCalls, []);
    assert.deepEqual(mutationCalls, []);
    timeline = [];
    entitlementCalls = [];
  }
});

test("does not use a mismatched entitlement to grant an approved student a signed URL", async () => {
  access = approvedStudent;
  entitlement = { status: "active", user_id: OTHER_USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
  await assertGeneric(await request());
  assert.deepEqual(timeline, ["auth"]);
  assert.deepEqual(entitlementCalls, []);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);
  assert.deepEqual(mutationCalls, []);
});

test("does not use a mismatched product entitlement to grant an approved student a signed URL", async () => {
  access = approvedStudent;
  entitlement = { status: "active", user_id: USER_ID, product_id: OTHER_PRODUCT_ID, revoked_at: null, expires_at: null };
  await assertGeneric(await request());
  assert.deepEqual(timeline, ["auth"]);
  assert.deepEqual(entitlementCalls, []);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);
  assert.deepEqual(mutationCalls, []);
});

test("accepts equivalent uppercase and lowercase UUID identities for an approved admin", async () => {
  access = { status: "approved", user: { id: USER_ID.toUpperCase() }, profile: { role: "admin" } };
  asset = { productId: PRODUCT_ID.toUpperCase(), storagePath: STORAGE_PATH };

  const response = await request(PRODUCT_ID.toUpperCase());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: SIGNED_URL, expiresIn: 300 });
  assert.deepEqual(timeline, ["auth", "asset", "sign"]);
  assert.deepEqual(entitlementCalls, []);
  assert.deepEqual(assetCalls, [PRODUCT_ID]);
  assert.deepEqual(signerCalls, [STORAGE_PATH]);
  assert.deepEqual(signerProductCalls, [PRODUCT_ID]);
  assert.deepEqual(mutationCalls, []);
});

test("rejects an asset row whose product identity differs from its storage path", async () => {
  asset = { productId: PRODUCT_ID, storagePath: OTHER_STORAGE_PATH };
  await assertGeneric(await request());
  assert.deepEqual(timeline, ["auth", "asset"]);
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
    assert.deepEqual(timeline, ["auth", "asset"]);
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
    assert.deepEqual(timeline, ["auth", "asset"]);
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
  for (const scenario of ["missingAsset", "assetError", "signerError"] as const) {
    if (scenario === "missingAsset") asset = null;
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

test("admin view is allowed without an entitlement and admin download bypasses both policy states", async () => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  const view = await requestView();
  assert.equal(view.status, 200);
  assert.equal(await view.text(), "PRIVATE_BYTES");
  assert.equal(view.headers.get("Content-Type"), "application/pdf");
  assert.equal(view.headers.get("Content-Disposition"), "inline");
  assert.deepEqual(timeline, ["auth", "asset", "viewer"]);
  assert.deepEqual(entitlementCalls, []);

  for (const allowDownload of [false, true]) {
    timeline = [];
    downloadPermission = allowDownload;
    const response = await requestDownload();
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "PRIVATE_BYTES");
    assert.equal(response.headers.get("Content-Disposition"), "attachment");
    assert.equal(response.headers.get("Content-Type"), "application/pdf");
    assert.deepEqual(timeline, ["auth", "asset", "viewer"]);
  }
});

test("active student with allow_download false can view but receives no download capability", async () => {
  access = approvedStudent;
  downloadPermission = false;
  const download = await requestDownload();
  await assertGeneric(download);
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "policy"]);
  assert.deepEqual(assetCalls, []);
  assert.deepEqual(signerCalls, []);

  timeline = [];
  const metadata = await requestView(PRODUCT_ID, undefined, true);
  assert.equal(metadata.status, 200);
  const metadataBody = await metadata.json();
  assert.deepEqual(metadataBody, { mimeType: "application/pdf" });
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "asset"]);
  assert.equal(JSON.stringify(metadataBody).includes(SIGNED_URL), false);

  timeline = [];
  const view = await requestView();
  assert.equal(view.status, 200);
  assert.equal(await view.text(), "PRIVATE_BYTES");
  assert.equal(view.headers.get("Content-Type"), "application/pdf");
  assert.equal(view.headers.get("Content-Disposition"), "inline");
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "asset", "viewer"]);
  assert.equal(JSON.stringify(viewerCalls).includes(SIGNED_URL), false);
});

test("active student with allow_download true can download a PDF", async () => {
  access = approvedStudent;
  downloadPermission = true;
  const response = await requestDownload();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "PRIVATE_BYTES");
  assert.equal(response.headers.get("Content-Disposition"), "attachment");
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "policy", "asset", "viewer"]);
});

test("direct view and download calls enforce every non-approved account state", async () => {
  for (const denied of [
    { status: "unauthenticated", user: null, profile: null },
    { status: "pending", user: { id: USER_ID }, profile: { role: "student" } },
    { status: "rejected", user: { id: USER_ID }, profile: { role: "student" } },
    { status: "suspended", user: { id: USER_ID }, profile: { role: "student" } }
  ]) {
    access = denied;
    await assertGeneric(await requestView(), denied.status === "unauthenticated" ? 401 : 404);
    assert.deepEqual(timeline, ["auth"]);
    timeline = [];
    await assertGeneric(await requestDownload(), denied.status === "unauthenticated" ? 401 : 404);
    assert.deepEqual(timeline, ["auth"]);
    timeline = [];
  }
});

test("authorized view preserves provider range headers while an unauthorized range remains denied", async () => {
  access = approvedStudent;
  const ranged = await requestView(PRODUCT_ID, { Range: "bytes=0-10" });
  assert.equal(ranged.status, 206);
  assert.equal(await ranged.text(), "RANGE_BYTES");
  assert.equal(ranged.headers.get("Content-Range"), "bytes 0-10/13");
  assert.equal(ranged.headers.get("Content-Length"), "11");
  assert.equal(ranged.headers.get("Accept-Ranges"), "bytes");
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "asset", "viewer"]);

  timeline = [];
  entitlement = null;
  const denied = await requestView(PRODUCT_ID, { Range: "bytes=0-10" });
  await assertGeneric(denied);
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement"]);
});

test("download streams video attachments through the same server boundary", async () => {
  access = approvedStudent;
  downloadPermission = true;
  asset = { productId: PRODUCT_ID, storagePath: STORAGE_PATH.replace(/\.pdf$/, ".mp4"), mimeType: "video/mp4" };
  const response = await requestDownload();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "PRIVATE_BYTES");
  assert.equal(response.headers.get("Content-Disposition"), "attachment");
  assert.equal(response.headers.get("Content-Type"), "video/mp4");
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "policy", "asset", "viewer"]);
});

test("missing, expired, and revoked students cannot view or download", async () => {
  access = approvedStudent;
  for (const invalid of [null, { status: "expired", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: "2020-01-01T00:00:00.000Z" }, { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: "2026-09-01T00:00:00.000Z", expires_at: null }]) {
    entitlement = invalid;
    await assertGeneric(await requestDownload());
    assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement"]);
    timeline = [];
    await assertGeneric(await requestView());
    assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement"]);
    timeline = [];
  }
});

test("student video view streams through the app-controlled view endpoint without a provider URL", async () => {
  access = approvedStudent;
  asset = { productId: PRODUCT_ID, storagePath: STORAGE_PATH.replace(/\.pdf$/, ".mp4"), mimeType: "video/mp4" };
  const response = await requestView();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "video/mp4");
  assert.equal(await response.text(), "PRIVATE_BYTES");
  assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "asset", "viewer"]);
  assert.equal(JSON.stringify(viewerCalls).includes(SIGNED_URL), false);
});

test("direct view and download reject missing or private-path-invalid assets", async () => {
  access = approvedStudent;
  entitlement = { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
  downloadPermission = true;
  for (const invalidAsset of [
    null,
    { productId: PRODUCT_ID, storagePath: `private/${PRODUCT_ID}/v2/file.pdf`, mimeType: "application/pdf" },
    { productId: PRODUCT_ID, storagePath: OTHER_STORAGE_PATH, mimeType: "application/pdf" }
  ]) {
    asset = invalidAsset;
    await assertGeneric(await requestView());
    assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "asset"]);
    assert.deepEqual(viewerCalls, []);
    timeline = [];
    await assertGeneric(await requestDownload());
    assert.deepEqual(timeline, ["auth", "direct-grant", "entitlement", "policy", "asset"]);
    assert.deepEqual(viewerCalls, []);
    timeline = [];
    viewerCalls = [];
  }
});

function activeDirectGrant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: DIRECT_GRANT_ID,
    user_id: USER_ID,
    material_id: PRODUCT_ID,
    can_view: true,
    can_download: false,
    expires_at: null,
    revoked_at: null,
    granted_by: OTHER_USER_ID,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

test("admin grant listing batch-loads only matching student summary fields", async () => {
  const moduleLoader = require("node:module") as { _load: (...args: any[]) => unknown };
  const originalLoad = moduleLoader._load;
  const repositoryPath = require.resolve("../../lib/repositories/material-direct-access-repository");
  const adminClientPath = require.resolve("../../lib/supabase/server-admin");
  const serverClientPath = require.resolve("../../lib/supabase/server");
  const originalRepository = require.cache[repositoryPath];
  const originalAdminClient = require.cache[adminClientPath];
  const originalServerClient = require.cache[serverClientPath];
  const profileIds = Array.from({ length: 101 }, (_, index) => `a0000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`);
  let grantRows: Record<string, unknown>[] = [
    ...profileIds.map((userId, index) => activeDirectGrant({
      id: `b0000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
      user_id: userId
    })),
    activeDirectGrant({ id: "b0000000-0000-4000-8000-000000000101", user_id: profileIds[0].toUpperCase() })
  ];
  const profiles = profileIds.map((id) => ({ id, full_name: `Student ${id.slice(-3)}`, email: `${id.slice(-3)}@example.test`, student_code: id.slice(-3) }));
  const queries: Array<{ table: string; selection: string | null; ids: string[] | null; filters: Array<[string, unknown]> }> = [];
  let profileQueryError: unknown = null;
  const from = (table: string) => {
    const query = { table, selection: null as string | null, ids: null as string[] | null, filters: [] as Array<[string, unknown]> };
    queries.push(query);
    const builder: any = {
      select(selection: string) { query.selection = selection; return builder; },
      eq(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
      order() { return builder; },
      in(_column: string, ids: string[]) { query.ids = [...ids]; return builder; },
      maybeSingle() { return Promise.resolve({ data: { product_id: PRODUCT_ID }, error: null }); },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        const data = table === "material_direct_grants"
          ? grantRows
          : profiles.filter((profile) => query.ids?.includes(profile.id));
        return Promise.resolve({ data, error: table === "profiles" ? profileQueryError : null }).then(resolve, reject);
      }
    };
    return builder;
  };

  try {
    moduleLoader._load = function(request: string, ...args: any[]) {
      if (request === "server-only") return {};
      return originalLoad.call(this, request, ...args);
    };
    delete require.cache[repositoryPath];
    require.cache[adminClientPath] = { id: adminClientPath, filename: adminClientPath, loaded: true, exports: { createServerAdminClient: () => ({ from }) } } as any;
    require.cache[serverClientPath] = { id: serverClientPath, filename: serverClientPath, loaded: true, exports: { createClient: async () => { throw new Error("unexpected RPC"); } } } as any;
    const repository = require(repositoryPath) as typeof import("../../lib/repositories/material-direct-access-repository");

    const result = await repository.getMaterialDirectGrants(PRODUCT_ID);
    assert.equal(result?.length, 102);
    assert.deepEqual(result?.[0].student, { id: profileIds[0], full_name: `Student ${profileIds[0].slice(-3)}`, email: `${profileIds[0].slice(-3)}@example.test`, student_code: profileIds[0].slice(-3) });
    assert.deepEqual(result?.at(-1)?.student, result?.[0].student, "case-normalized duplicate user IDs map to one profile");
    const profileQueries = queries.filter((query) => query.table === "profiles");
    assert.equal(profileQueries.length, 2, "profile reads are batched rather than one query per grant");
    assert.deepEqual(profileQueries.map((query) => query.ids?.length), [100, 1]);
    assert.ok(profileQueries.every((query) => query.selection === "id, full_name, email, student_code"));
    const grantQuery = queries.filter((query) => query.table === "material_direct_grants")[0];
    assert.equal(grantQuery.selection, "id, user_id, material_id, can_view, can_download, expires_at, revoked_at, granted_by, created_at, updated_at");
    assert.deepEqual(grantQuery.filters, [["material_id", PRODUCT_ID]]);

    queries.length = 0;
    grantRows = [];
    assert.deepEqual(await repository.getMaterialDirectGrants(PRODUCT_ID), []);
    assert.equal(queries.some((query) => query.table === "profiles"), false, "empty grant lists do not query profiles");

    grantRows = [activeDirectGrant()];
    profileQueryError = new Error("private profile database detail");
    await assert.rejects(
      repository.getMaterialDirectGrants(PRODUCT_ID),
      (error: unknown) => error instanceof repository.MaterialDirectAccessRepositoryError && !(error as Error).message.includes("private profile database detail")
    );
  } finally {
    moduleLoader._load = originalLoad;
    if (originalRepository) require.cache[repositoryPath] = originalRepository; else delete require.cache[repositoryPath];
    if (originalAdminClient) require.cache[adminClientPath] = originalAdminClient; else delete require.cache[adminClientPath];
    if (originalServerClient) require.cache[serverClientPath] = originalServerClient; else delete require.cache[serverClientPath];
  }
});

test("active direct view-only grant bypasses entitlement but cannot download", async () => {
  access = approvedStudent;
  entitlement = null;
  directGrant = activeDirectGrant();

  const view = await requestView();
  assert.equal(view.status, 200);
  assert.equal(await view.text(), "PRIVATE_BYTES");
  assert.deepEqual(timeline, ["auth", "direct-grant", "asset", "viewer"]);

  timeline = [];
  const download = await requestDownload();
  await assertGeneric(download);
  assert.deepEqual(timeline, ["auth", "direct-grant"]);
  assert.deepEqual(entitlementCalls, []);
});

test("active direct view-and-download grant bypasses product policy and downloads", async () => {
  access = approvedStudent;
  entitlement = null;
  downloadPermission = false;
  directGrant = activeDirectGrant({ can_download: true });

  const view = await requestView();
  assert.equal(view.status, 200);
  assert.equal(await view.text(), "PRIVATE_BYTES");
  assert.deepEqual(timeline, ["auth", "direct-grant", "asset", "viewer"]);

  timeline = [];
  const download = await requestDownload();
  assert.equal(download.status, 200);
  assert.equal(await download.text(), "PRIVATE_BYTES");
  assert.deepEqual(timeline, ["auth", "direct-grant", "asset", "viewer"]);
  assert.deepEqual(entitlementCalls, []);
});

test("expired, revoked, cross-user, cross-material, and contradictory direct grants fail closed", async () => {
  access = approvedStudent;
  entitlement = { status: "active", user_id: USER_ID, product_id: PRODUCT_ID, revoked_at: null, expires_at: null };
  for (const overrides of [
    { expires_at: "2020-01-01T00:00:00.000Z" },
    { revoked_at: "2026-09-01T00:00:00.000Z" },
    { user_id: OTHER_USER_ID },
    { material_id: OTHER_PRODUCT_ID },
    { can_view: false, can_download: true }
  ]) {
    directGrant = activeDirectGrant(overrides);
    await assertGeneric(await requestView());
    assert.deepEqual(timeline, ["auth", "direct-grant"]);
    assert.deepEqual(entitlementCalls, []);
    timeline = [];
    await assertGeneric(await requestDownload());
    assert.deepEqual(timeline, ["auth", "direct-grant"]);
    assert.deepEqual(entitlementCalls, []);
    timeline = [];
  }
});

test("admin direct-grant API lists, creates, updates, revokes, and searches without touching entitlement policy", async () => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  directGrants = [{
    ...activeDirectGrant(),
    student: { id: USER_ID, full_name: "Student A", email: "a@example.test", student_code: "A01" }
  }];
  studentSearchResults = [{ id: OTHER_USER_ID, full_name: "Student B", email: "b@example.test", student_code: "B01", faculty: null, major: null }];

  const params = { params: Promise.resolve({ id: PRODUCT_ID }) };
  const listed = await DIRECT_LIST_GET(new Request("https://example.test"), params);
  assert.equal(listed.status, 200);
  const listedBody = await listed.json();
  assert.equal(listedBody.grants.length, 1);
  assert.deepEqual(Object.keys(listedBody.grants[0]).sort(), ["can_download", "can_view", "created_at", "expires_at", "granted_by", "id", "material_id", "revoked_at", "student", "updated_at", "user_id"]);
  assert.deepEqual(listedBody.grants[0].student, { id: USER_ID, full_name: "Student A", email: "a@example.test", student_code: "A01" });

  const created = await DIRECT_CREATE_POST(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ user_id: OTHER_USER_ID, can_view: true, can_download: true, expires_at: null }),
    headers: { "content-type": "application/json" }
  }), params);
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.grant.can_download, true);
  assert.deepEqual(Object.keys(createdBody.grant).sort(), ["can_download", "can_view", "created_at", "expires_at", "granted_by", "id", "material_id", "revoked_at", "updated_at", "user_id"]);

  const updated = await DIRECT_UPDATE_PATCH(new Request("https://example.test", {
    method: "PATCH",
    body: JSON.stringify({ can_download: false, expires_at: "2027-01-01T00:00:00.000Z" }),
    headers: { "content-type": "application/json" }
  }), { params: Promise.resolve({ id: PRODUCT_ID, userId: OTHER_USER_ID }) });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.deepEqual(Object.keys(updatedBody.grant).sort(), ["can_download", "can_view", "created_at", "expires_at", "granted_by", "id", "material_id", "revoked_at", "updated_at", "user_id"]);
  assert.deepEqual(mutationCalls, [`grant:${OTHER_USER_ID}:${PRODUCT_ID}`, `update:${OTHER_USER_ID}:${PRODUCT_ID}`]);

  const revoked = await DIRECT_REVOKE_DELETE(new Request("https://example.test", { method: "DELETE" }), { params: Promise.resolve({ id: PRODUCT_ID, userId: OTHER_USER_ID }) });
  assert.equal(revoked.status, 200);
  const revokedBody = await revoked.json();
  assert.deepEqual(Object.keys(revokedBody.grant).sort(), ["can_download", "can_view", "created_at", "expires_at", "granted_by", "id", "material_id", "revoked_at", "updated_at", "user_id"]);
  assert.deepEqual(mutationCalls, [`grant:${OTHER_USER_ID}:${PRODUCT_ID}`, `update:${OTHER_USER_ID}:${PRODUCT_ID}`, `revoke:${OTHER_USER_ID}:${PRODUCT_ID}`]);

  const search = await STUDENT_SEARCH_GET(new Request("https://example.test/api/admin/students/search?q=student"));
  assert.equal(search.status, 200);
  const searchBody = await search.json();
  assert.deepEqual(searchBody, { students: studentSearchResults });
  assert.deepEqual(Object.keys((searchBody as any).students[0]).sort(), ["email", "faculty", "full_name", "id", "major", "student_code"]);
  assert.deepEqual(entitlementCalls, []);
});

test("direct-grant mutations reject contradictory permissions and non-admin callers", async () => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  const invalid = await DIRECT_CREATE_POST(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ user_id: OTHER_USER_ID, can_view: false, can_download: true }),
    headers: { "content-type": "application/json" }
  }), { params: Promise.resolve({ id: PRODUCT_ID }) });
  assert.equal(invalid.status, 400);

  access = approvedStudent;
  const forbidden = await DIRECT_CREATE_POST(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ user_id: OTHER_USER_ID, can_view: true, can_download: false }),
    headers: { "content-type": "application/json" }
  }), { params: Promise.resolve({ id: PRODUCT_ID }) });
  assert.equal(forbidden.status, 403);
});

test("download forwards Range server-side and preserves partial attachment headers", async () => {
  access = approvedStudent;
  downloadPermission = true;

  const full = await requestDownload();
  assert.equal(full.status, 200);
  assert.equal(await full.text(), "PRIVATE_BYTES");
  assert.equal(full.headers.get("Content-Disposition"), "attachment");
  assert.equal(full.headers.get("Content-Length"), "13");

  timeline = [];
  const partial = await requestDownload(PRODUCT_ID, { Range: "bytes=0-99" });
  assert.equal(partial.status, 206);
  assert.equal(await partial.text(), "RANGE_BYTES");
  assert.equal(partial.headers.get("Content-Range"), "bytes 0-10/13");
  assert.equal(partial.headers.get("Content-Length"), "11");
  assert.equal(partial.headers.get("Accept-Ranges"), "bytes");
  assert.equal(partial.headers.get("Content-Type"), "application/pdf");
  assert.equal(partial.headers.get("Content-Disposition"), "attachment");
  assert.deepEqual(viewerCalls, [`${STORAGE_PATH}:${PRODUCT_ID}`, `${STORAGE_PATH}:${PRODUCT_ID}`]);
});

test("download never turns an upstream 416 into a full response", async () => {
  access = approvedStudent;
  downloadPermission = true;
  viewerStatus = 416;

  const response = await requestDownload(PRODUCT_ID, { Range: "bytes=100-199" });
  await assertGeneric(response, 416);
  assert.equal(response.status, 416);
});

test("range download remains behind authorization", async () => {
  access = approvedStudent;
  directGrant = activeDirectGrant();
  const viewOnly = await requestDownload(PRODUCT_ID, { Range: "bytes=0-99" });
  await assertGeneric(viewOnly);
  assert.deepEqual(viewerCalls, []);

  timeline = [];
  directGrant = activeDirectGrant({ can_download: true });
  const direct = await requestDownload(PRODUCT_ID, { Range: "bytes=100-199" });
  assert.equal(direct.status, 206);
  assert.equal(await direct.text(), "RANGE_BYTES");

  timeline = [];
  directGrant = null;
  downloadPermission = false;
  const entitlementDenied = await requestDownload(PRODUCT_ID, { Range: "bytes=0-99" });
  await assertGeneric(entitlementDenied);
  assert.deepEqual(viewerCalls, [`${STORAGE_PATH}:${PRODUCT_ID}`]);
});

test("every admin direct-grant method rejects anonymous and unapproved callers before repositories", async () => {
  const states = ["unauthenticated", "pending", "rejected", "suspended"] as const;
  for (const status of states) {
    access = status === "unauthenticated"
      ? { status, user: null, profile: null }
      : { status, user: { id: USER_ID }, profile: { role: "admin" } };
    const collectionContext = { params: Promise.resolve({ id: PRODUCT_ID }) };
    const userContext = { params: Promise.resolve({ id: PRODUCT_ID, userId: OTHER_USER_ID }) };
    const body = new Request("https://example.test", { method: "POST", body: "{}" });
    assert.equal((await DIRECT_LIST_GET(new Request("https://example.test"), collectionContext)).status, status === "unauthenticated" ? 401 : 403);
    assert.equal((await DIRECT_CREATE_POST(body, collectionContext)).status, status === "unauthenticated" ? 401 : 403);
    assert.equal((await DIRECT_UPDATE_PATCH(new Request("https://example.test", { method: "PATCH", body: "{}" }), userContext)).status, status === "unauthenticated" ? 401 : 403);
    assert.equal((await DIRECT_REVOKE_DELETE(new Request("https://example.test", { method: "DELETE" }), userContext)).status, status === "unauthenticated" ? 401 : 403);
    assert.equal((await STUDENT_SEARCH_GET(new Request("https://example.test/api/admin/students/search?q=a"))).status, status === "unauthenticated" ? 401 : 403);
    assert.deepEqual(directGrants, []);
    assert.deepEqual(studentSearchCalls, []);
    timeline = [];
  }
});

test("admin direct-grant handlers validate IDs, payloads, and repository failures generically", async () => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  const validCollection = { params: Promise.resolve({ id: PRODUCT_ID }) };
  const validUser = { params: Promise.resolve({ id: PRODUCT_ID, userId: OTHER_USER_ID }) };
  for (const id of ["bad"]) {
    const response = await DIRECT_LIST_GET(new Request("https://example.test"), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 400);
  }
  for (const payload of [
    "",
    "not-json",
    "{}",
    JSON.stringify({ user_id: "bad", can_view: true, can_download: false }),
    JSON.stringify({ user_id: OTHER_USER_ID, can_view: "yes", can_download: false }),
    JSON.stringify({ user_id: OTHER_USER_ID, can_view: false, can_download: true }),
    JSON.stringify({ user_id: OTHER_USER_ID, can_view: true, can_download: false, expires_at: "bad" })
  ]) {
    const response = await DIRECT_CREATE_POST(new Request("https://example.test", { method: "POST", body: payload, headers: { "content-type": "application/json" } }), validCollection);
    assert.equal(response.status, 400);
  }
  studentSearchError = new Error("raw db password signed-url token");
  const failedSearch = await STUDENT_SEARCH_GET(new Request("https://example.test/api/admin/students/search?q=student"));
  assert.equal(failedSearch.status, 500);
  assert.deepEqual(await failedSearch.json(), { error: "Student search is unavailable." });
  assert.equal(JSON.stringify(failedSearch).includes("password"), false);
  studentSearchError = null;
  studentSearchResults = Array.from({ length: 25 }, (_, index) => ({ id: OTHER_USER_ID, full_name: `Student ${index}`, email: null, student_code: null, faculty: null, major: null, password: "secret" }));
  const bounded = await STUDENT_SEARCH_GET(new Request("https://example.test/api/admin/students/search?q=student"));
  const boundedBody = await bounded.json();
  assert.equal(bounded.status, 200);
  assert.equal(boundedBody.students.length, 20);
  assert.equal(Object.keys(boundedBody.students[0]).includes("password"), false);
  assert.deepEqual(studentSearchCalls, ["student", "student"]);

  const repoFailure = new Error("database internal material grant token");
  directGrants = [repoFailure];
  const listFailure = await DIRECT_LIST_GET(new Request("https://example.test"), validCollection);
  assert.equal(listFailure.status, 500);
  assert.deepEqual(await listFailure.json(), { error: "Material direct access is unavailable." });

  directGrants = [];
  directListMissingMaterial = true;
  const missingMaterial = await DIRECT_LIST_GET(new Request("https://example.test"), validCollection);
  assert.equal(missingMaterial.status, 404);
  directListMissingMaterial = false;

  directGrantTargetError = new Error("foreign user database detail");
  const missingUser = await DIRECT_CREATE_POST(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ user_id: OTHER_USER_ID, can_view: true, can_download: false }),
    headers: { "content-type": "application/json" }
  }), validCollection);
  assert.equal(missingUser.status, 500);
  const missingUserBody = await missingUser.json();
  assert.deepEqual(missingUserBody, { error: "Direct material access mutation failed." });
  assert.equal(JSON.stringify(missingUserBody).includes("foreign"), false);
  void validUser;
});

test("student search rejects invalid queries without a database search and returns empty results safely", async () => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  for (const query of ["", "   ", "x".repeat(101), "!!!"]) {
    const response = await STUDENT_SEARCH_GET(new Request(`https://example.test/api/admin/students/search?q=${encodeURIComponent(query)}`));
    assert.equal(response.status, 400);
  }
  assert.deepEqual(studentSearchCalls, []);

  studentSearchResults = [];
  const empty = await STUDENT_SEARCH_GET(new Request("https://example.test/api/admin/students/search?q=missing"));
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { students: [] });
});

test("admin direct-grant handlers cover user/material isolation, invalid user routes, and RPC failures", async () => {
  access = { status: "approved", user: { id: USER_ID }, profile: { role: "admin" } };
  const materialA = PRODUCT_ID;
  const materialB = OTHER_PRODUCT_ID;
  const userA = OTHER_USER_ID;
  const userB = USER_ID;
  const validA = { params: Promise.resolve({ id: materialA, userId: userA }) };

  for (const [id, userId] of [["bad", userA], [materialA, "bad"]]) {
    const response = await DIRECT_UPDATE_PATCH(new Request("https://example.test", { method: "PATCH", body: JSON.stringify({ can_view: true }) }), { params: Promise.resolve({ id, userId }) });
    assert.equal(response.status, 400);
  }
  for (const [id, userId] of [["bad", userA], [materialA, "bad"]]) {
    const response = await DIRECT_REVOKE_DELETE(new Request("https://example.test", { method: "DELETE" }), { params: Promise.resolve({ id, userId }) });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(mutationCalls, []);

  for (const body of ["", "not-json", "{}", JSON.stringify({ can_view: "yes" }), JSON.stringify({ can_download: "yes" }), JSON.stringify({ expires_at: "bad" }), JSON.stringify({ can_view: false, can_download: true })]) {
    const response = await DIRECT_UPDATE_PATCH(new Request("https://example.test", {
      method: "PATCH",
      body,
      headers: { "content-type": "application/json" }
    }), validA);
    assert.equal(response.status, 400);
  }
  assert.deepEqual(mutationCalls, []);

  directUpdateError = new Error("raw database password signed-url token");
  const updateFailure = await DIRECT_UPDATE_PATCH(new Request("https://example.test", {
    method: "PATCH",
    body: JSON.stringify({ can_view: true }),
    headers: { "content-type": "application/json" }
  }), validA);
  assert.equal(updateFailure.status, 500);
  assert.deepEqual(await updateFailure.json(), { error: "Direct material access mutation failed." });
  directUpdateError = null;

  directUpdateError = new Error("unknown material database details");
  const unknownMaterial = await DIRECT_UPDATE_PATCH(new Request("https://example.test", {
    method: "PATCH",
    body: JSON.stringify({ can_view: true }),
    headers: { "content-type": "application/json" }
  }), { params: Promise.resolve({ id: materialB, userId: userA }) });
  assert.equal(unknownMaterial.status, 500);
  assert.deepEqual(await unknownMaterial.json(), { error: "Direct material access mutation failed." });
  directUpdateError = null;

  directRevokeError = new Error("raw rpc token");
  const revokeFailure = await DIRECT_REVOKE_DELETE(new Request("https://example.test", { method: "DELETE" }), validA);
  assert.equal(revokeFailure.status, 500);
  assert.deepEqual(await revokeFailure.json(), { error: "Direct material access mutation failed." });
  directRevokeError = null;

  directGrantTargetError = new Error("unknown user database details signed-url token");
  const unknownUser = await DIRECT_CREATE_POST(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ user_id: userB, can_view: true, can_download: false }),
    headers: { "content-type": "application/json" }
  }), { params: Promise.resolve({ id: materialB }) });
  assert.equal(unknownUser.status, 500);
  assert.deepEqual(await unknownUser.json(), { error: "Direct material access mutation failed." });
  assert.deepEqual(mutationCalls, []);
});
