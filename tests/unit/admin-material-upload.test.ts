import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const harness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const scenario = JSON.parse(process.argv[1]);
const timeline = [], calls = [], redirects = [];
const modules = Object.fromEntries(["auth", "repo", "storage", "nav"].map(key => [key, "data:text/javascript,material-upload-" + key]));
const uuid = "11111111-1111-1111-1111-111111111111";
const access = scenario.access === "anonymous" ? {status:"unauthenticated", profile:null} : scenario.access === "admin" ? {status:"approved", profile:{role:"admin"}} : {status:scenario.access || "pending", profile:scenario.access === "student" ? {role:"student"} : null};
mock.module(modules.auth, {namedExports:{getAccountAccess:async()=>{timeline.push("access");return access;}}});
mock.module(modules.repo, {namedExports:{
 isMaterialProduct:async id=>{timeline.push("material");calls.push(["material",id]);if(scenario.repoError)throw Error("SQL PRIVATE_PATH private@example.test");return !scenario.nonMaterial;},
 getNextMaterialAssetVersion:async id=>{timeline.push("version");calls.push(["version",id]);if(scenario.repoError)throw Error("SQL PRIVATE_PATH private@example.test");return scenario.version || 3;},
 createMaterialAsset:async payload=>{timeline.push("metadata");calls.push(["metadata",payload]);if(scenario.metadataError)throw Error("SQL PRIVATE_PATH private@example.test");return payload;}
}});
mock.module(modules.storage, {namedExports:{
 isSupportedMaterialMimeType:x=>["application/pdf","video/mp4","video/webm","video/quicktime"].includes(x),
 isValidMaterialUuid:x=>typeof x === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x),
 materialSizeLimit:x=>x === "application/pdf" ? 20*1024*1024 : 500*1024*1024,
 uploadMaterialObject:async payload=>{timeline.push("upload");calls.push(["upload",payload]);if(scenario.storageError)throw Error("storage /materials/private.pdf");return {bucket:"materials",storagePath:"materials/"+payload.productId+"/v"+payload.version+"/22222222-2222-2222-2222-222222222222-safe.pdf"};},
 removeNewMaterialObject:async path=>{timeline.push("cleanup");calls.push(["cleanup",path]);}
}});
mock.module(modules.nav, {namedExports:{redirect:path=>{redirects.push(path);const e=Error("REDIRECT:"+path);e.digest="NEXT_REDIRECT;";throw e;}}});
let source = await readFile("app/api/admin/materials/[id]/upload/route.ts", "utf8");
source = source.replace('import "server-only";', "");
for(const [from,to] of [["@/lib/auth/session","auth"],["@/lib/repositories/material-asset-repository","repo"],["@/lib/storage/material-storage","storage"],["next/navigation","nav"]]) source=source.replaceAll(from,modules[to]);
const compiled=(await transform(source,{loader:"ts",format:"esm"})).code;
const route=await import("data:text/javascript,"+encodeURIComponent(compiled));
class ProbeFile extends File { slice(...args) { timeline.push("read"); return super.slice(...args); } }
const signatures={pdf:[0x25,0x50,0x44,0x46,0x2d,0x31],mp4:[0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d],webm:[0x1a,0x45,0xdf,0xa3],quicktime:[0,0,0,24,0x66,0x74,0x79,0x70,0x71,0x74,0x20,0x20]};
const kind=scenario.kind || "pdf", type=scenario.mime || ({pdf:"application/pdf",mp4:"video/mp4",webm:"video/webm",quicktime:"video/quicktime"}[kind]);
const bytes=scenario.spoof ? [1,2,3,4,5] : signatures[kind];
const file=new ProbeFile([new Uint8Array(bytes)],scenario.name || "private file.pdf",{type});
Object.defineProperty(file,"size",{value:scenario.empty?0:(scenario.oversize?(type==="application/pdf"?20*1024*1024+1:500*1024*1024+1):file.size)});
const entries=scenario.extra ? [["file",file],["role","admin"]] : scenario.missing ? [] : [["file",file]];
const request={formData:async()=>{timeline.push("form");return {keys:()=>entries.map(x=>x[0]),getAll:key=>entries.filter(x=>x[0]===key).map(x=>x[1])};}};
let error="";try{await route.POST(request,{params:Promise.resolve({id:scenario.badId?"bad":uuid})});}catch(e){error=e.message;}
console.log(JSON.stringify({timeline,calls,redirects,error}));
`;

type Result = { timeline: string[]; calls: [string, unknown][]; redirects: string[]; error: string };
async function run(scenario: Record<string, unknown> = {}): Promise<Result> {
  const { stdout } = await promisify(execFile)(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", harness, JSON.stringify(scenario)], { maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim());
}

test("approved admins upload signed PDF and supported video versions with exact server payloads", async () => {
  for (const kind of ["pdf", "mp4", "webm", "quicktime"]) {
    const result = await run({ access: "admin", kind });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=success");
    assert.deepEqual(result.timeline, ["access", "form", "read", "material", "version", "upload", "metadata"]);
    const upload = result.calls.find(([name]) => name === "upload")?.[1] as Record<string, unknown>;
    const metadata = result.calls.find(([name]) => name === "metadata")?.[1] as Record<string, unknown>;
    assert.equal(upload.productId, "11111111-1111-1111-1111-111111111111");
    assert.equal(upload.version, 3);
    assert.equal(metadata.productId, upload.productId);
    assert.equal(metadata.version, 3);
    assert.equal(metadata.storagePath, "materials/11111111-1111-1111-1111-111111111111/v3/22222222-2222-2222-2222-222222222222-safe.pdf");
    assert.ok(typeof metadata.byteSize === "number" && metadata.byteSize > 0);
  }
});

test("anonymous and non-approved accounts stop before form parsing, reads, storage, or repositories", async () => {
  for (const access of ["anonymous", "student", "pending", "rejected", "suspended", "profile_missing"]) {
    const result = await run({ access });
    assert.deepEqual(result.timeline, ["access"]);
    assert.ok(result.error.startsWith("REDIRECT:"));
  }
});

test("invalid multipart data, UUIDs, MIME/signatures, empty, oversized, and non-material files fail generically", async () => {
  for (const scenario of [{ missing: true }, { extra: true }, { badId: true }, { mime: "text/plain" }, { spoof: true }, { empty: true }, { oversize: true }, { nonMaterial: true }]) {
    const result = await run({ access: "admin", ...scenario });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=error");
    assert.equal(result.redirects.at(-1), "/quan-tri/catalog?upload=error");
    assert.ok(!result.timeline.includes("upload"));
    assert.ok(!result.timeline.includes("metadata"));
  }
});

test("metadata failures clean up only the newly uploaded object and errors never leak private details", async () => {
  for (const scenario of [{ metadataError: true }, { storageError: true }, { repoError: true }]) {
    const result = await run({ access: "admin", ...scenario });
    assert.equal(result.error, "REDIRECT:/quan-tri/catalog?upload=error");
    if (scenario.metadataError) assert.deepEqual(result.timeline, ["access", "form", "read", "material", "version", "upload", "metadata", "cleanup"]);
    else assert.ok(!result.timeline.includes("cleanup"));
    const exposed = JSON.stringify({ error: result.error, redirects: result.redirects }).toLowerCase();
    for (const forbidden of ["private_path", "private@example", "sql", "safe.pdf", "materials/"]) assert.ok(!exposed.includes(forbidden), forbidden);
  }
});
