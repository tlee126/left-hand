import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHmac } from "node:crypto";

const execFileAsync = promisify(execFile);

type RouteScenario = {
  ip?: string;
  forwarded?: string;
  trustedProxy?: boolean;
  trustedProxyHops?: string;
  body?: unknown;
  rawBody?: string;
  contentLength?: string;
  streamCount?: number;
  streamChunkSize?: number;
  streamPrefix?: string;
  idempotencyKey?: string;
  subjectOnly?: boolean;
  subjectExists?: boolean;
  sourcePath?: unknown;
  clientError?: boolean;
  rpcError?: { code?: string; message?: string };
  rpcOutcome?: "created" | "duplicate" | "invalid";
  calls?: number;
  forwardedVariants?: string[];
  proxySignature?: string;
  proxySignatureVariants?: string[];
};

const routeHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server.js";

const scenario = JSON.parse(process.argv[1]);
process.env.CONSULTATION_TRUSTED_PROXY = scenario.trustedProxy ? "true" : "false";
process.env.CONSULTATION_PROXY_SIGNING_SECRET = "phase4-runtime-proxy-secret";
let createClientCalls = 0;
const calls = [];
let inserted = [];
let streamState = { pulls: 0, cancelled: false };

function dataUrl(source) { return "data:text/javascript," + encodeURIComponent(source); }
const validationSource = await readFile(path.resolve(process.cwd(), "lib/validation/consultation.ts"), "utf8");
const validationCode = (await transform(validationSource, { loader: "ts", format: "esm" })).code;
const validationUrl = dataUrl(validationCode);
const nextServerUrl = pathToFileURL(path.resolve(process.cwd(), "node_modules/next/server.js")).href;
const serverUrl = dataUrl(
  "export async function createClient() {\n" +
  "  globalThis.__createClientCalls++;\n" +
  "  if (globalThis.__clientError) throw new Error('provider SQL secret phone=0901234567');\n" +
  "  return globalThis.__client;\n" +
  "}\n" +
  "export const createServerAdminClient = createClient;"
);
globalThis.__createClientCalls = 0;
globalThis.__clientError = Boolean(scenario.clientError);

function queryFor(table) {
  let slug = null;
  const query = {
    select(value) { calls.push([table, "select", value]); return query; },
    eq(column, value) { calls.push([table, "eq", column, value]); if (column === "slug") slug = value; return query; },
    range() { calls.push([table, "range"]); return query; },
    async maybeSingle() {
      calls.push([table, "maybeSingle"]);
      if (table === "subjects" && scenario.subjectExists && slug === "existing-subject") return { data: { slug }, error: null };
      if (table === "products" && slug === "published-product") return { data: { slug, subjects: { slug: "existing-subject" } }, error: null };
      return { data: null, error: null };
    }
  };
  return query;
}
globalThis.__client = {
  from(table) {
    calls.push(["from", table]);
    if (table === "products" || table === "subjects") return queryFor(table);
    throw new Error("unexpected table");
  },
  rpc(name, payload) {
    calls.push(["rpc", name, payload]);
    if (name !== "submit_consultation_intake") throw new Error("unexpected RPC");
    if (scenario.rpcError) return Promise.resolve({ data: null, error: scenario.rpcError });
    if (scenario.rpcOutcome === "invalid") return Promise.resolve({ data: { outcome: "invalid" }, error: null });
    inserted.push(payload);
    return Promise.resolve({ data: { outcome: scenario.rpcOutcome ?? "created" }, error: null });
  }
};

async function compile(filePath, replacements, loader) {
  let source = await readFile(filePath, "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  return (await transform(source, { loader, format: "esm", sourcefile: path.basename(filePath) })).code;
}
const repoCode = await compile(
  path.resolve(process.cwd(), "lib/repositories/consultation-repository.ts"),
  [["\"@/lib/supabase/server\"", JSON.stringify(serverUrl)]],
  "ts"
);
const repoUrl = dataUrl(repoCode);
const routeCode = await compile(
  path.resolve(process.cwd(), "app/api/consultations/route.ts"),
    [
      ["\"next/server\"", JSON.stringify(nextServerUrl)],
    ["\"@/lib/supabase/server-admin\"", JSON.stringify(serverUrl)],
    ["\"@/lib/validation/consultation\"", JSON.stringify(validationUrl)],
    ["\"@/lib/repositories/consultation-repository\"", JSON.stringify(repoUrl)]
  ],
  "ts"
);
const { POST } = await import(dataUrl(routeCode));

function makeRequest(s, index = 0) {
  const headers = new Headers({
    "content-type": "application/json",
    "Idempotency-Key": s.idempotencyKey ?? ("runtime-key-" + index)
  });
  if (s.forwarded !== undefined) headers.set("x-forwarded-for", s.forwarded);
  if (s.trustedProxy && s.forwarded) {
    const proxyIp = s.forwarded.split(",")[0].trim().toLowerCase();
    const canonicalIp = proxyIp === "2001:0db8:0000:0000:0000:0000:0000:0001"
      ? "2001:db8::1"
      : proxyIp === "0:0:0:0:0:ffff:c000:22c"
        ? "::ffff:192.0.2.44"
        : proxyIp;
    headers.set("x-consultation-client-ip", canonicalIp);
    headers.set("x-consultation-client-ip-signature", s.proxySignature ?? "");
  }
  if (s.contentLength !== undefined) headers.set("content-length", s.contentLength);
  let body = s.rawBody ?? JSON.stringify(s.body ?? {
    fullName: "Nguyễn Văn An", phone: "0901234567", faculty: "Khoa Tài chính",
    interest: "Toán", need: "Cần tư vấn", sourcePath: s.sourcePath ?? "/",
    ...(s.subjectOnly ? { selectedSubjectSlug: "existing-subject" } : {})
  });
  if (s.streamCount) {
    let index = 0;
    body = new ReadableStream({
      pull(controller) {
        streamState.pulls++;
        if (index >= s.streamCount) { controller.close(); return; }
        if (index === 0 && s.streamPrefix) {
          controller.enqueue(new TextEncoder().encode(s.streamPrefix));
        } else {
          controller.enqueue(new Uint8Array(s.streamChunkSize ?? 1024));
        }
        index++;
      },
      cancel() { streamState.cancelled = true; }
    });
  }
  const request = new NextRequest("http://localhost/api/consultations", {
    method: "POST", headers, body, duplex: "half"
  });
  if (s.ip !== undefined) request.ip = s.ip;
  return request;
}

const responses = [];
if (scenario.forwardedVariants) {
  for (let i = 0; i < scenario.forwardedVariants.length; i++) {
    responses.push((await POST(makeRequest({ ...scenario, forwarded: scenario.forwardedVariants[i], proxySignature: scenario.proxySignatureVariants?.[i] }, i))).status);
  }
} else if (scenario.calls) {
  for (let i = 0; i < scenario.calls; i++) {
    const response = await POST(makeRequest(scenario, i));
    responses.push(response.status);
  }
} else {
  responses.push((await POST(makeRequest(scenario))).status);
}
console.log(JSON.stringify({
  statuses: responses,
  createClientCalls: globalThis.__createClientCalls,
  calls,
  inserted,
  streamState
}));
`;

async function runRouteScenario(scenario: RouteScenario) {
  const rawProxyIp = scenario.forwarded?.split(",")[0].trim().toLowerCase();
  const canonicalProxyIp = rawProxyIp === "2001:0db8:0000:0000:0000:0000:0000:0001"
    ? "2001:db8::1"
    : rawProxyIp === "0:0:0:0:0:ffff:c000:22c"
      ? "::ffff:192.0.2.44"
      : rawProxyIp;
  const signedScenario = scenario.forwardedVariants
    ? {
        ...scenario,
        proxySignatureVariants: scenario.forwardedVariants.map((value) => {
          const normalized = value.split(",")[0].trim().toLowerCase();
          const canonical = normalized === "2001:0db8:0000:0000:0000:0000:0000:0001"
            ? "2001:db8::1"
            : normalized === "0:0:0:0:0:ffff:c000:22c"
              ? "::ffff:192.0.2.44"
              : normalized;
          return createHmac("sha256", "phase4-runtime-proxy-secret").update(canonical).digest("hex");
        })
      }
    : canonicalProxyIp
      ? { ...scenario, proxySignature: createHmac("sha256", "phase4-runtime-proxy-secret").update(canonicalProxyIp).digest("hex") }
      : scenario;
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx/esm", "-e", routeHarness, JSON.stringify(signedScenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as {
    statuses: number[];
    createClientCalls: number;
    calls: unknown[][];
    inserted: Array<Record<string, unknown>>;
    streamState: { pulls: number; cancelled: boolean };
  };
}

const validBody = {
  fullName: "Nguyễn Văn An", phone: "0901234567", faculty: "Khoa Tài chính",
  interest: "Toán", need: "Cần tư vấn", sourcePath: "/tai-lieu/ke-toan"
};

describe("Phase 4 runtime boundary coverage", () => {
  test("executes the exported POST route with a canonical trusted IP and persists verified payload", async () => {
    const result = await runRouteScenario({
      trustedProxy: true,
      forwarded: "203.0.113.10, 10.0.0.1",
      body: validBody
    });
    assert.deepEqual(result.statuses, [201]);
    assert.equal(result.inserted[0].p_source_path, "/tai-lieu/ke-toan");
    assert.equal(result.inserted[0].p_phone, "0901234567");
    assert.equal(result.calls.filter((call) => call[0] === "rpc").length, 1);
  });

  test("isolates two IP buckets, rate-limits the sixth request, and does not call repository after limit", async () => {
    const first = await runRouteScenario({ trustedProxy: true, forwarded: "198.51.100.1, 10.0.0.1", body: validBody, calls: 6 });
    assert.deepEqual(first.statuses, [201, 201, 201, 201, 201, 429]);
    assert.equal(first.inserted.length, 5);
    const second = await runRouteScenario({ trustedProxy: true, forwarded: "198.51.100.2, 10.0.0.1", body: validBody, calls: 1 });
    assert.deepEqual(second.statuses, [201]);
  });

  test("canonicalizes IPv6 and IPv4-mapped forms before the exported POST rate limiter", async () => {
    const ipv6 = await runRouteScenario({
      trustedProxy: true,
      body: validBody,
      forwardedVariants: [
        "2001:0DB8:0000:0000:0000:0000:0000:0001, 2001:db8::ff",
        "2001:db8::1, 2001:db8::ff",
        "2001:db8::1, 2001:db8::ff",
        "2001:db8::1, 2001:db8::ff",
        "2001:db8::1, 2001:db8::ff",
        "2001:db8::1, 2001:db8::ff"
      ]
    });
    assert.deepEqual(ipv6.statuses, [201, 201, 201, 201, 201, 429]);

    const mapped = await runRouteScenario({
      trustedProxy: true,
      body: validBody,
      forwardedVariants: [
        "::ffff:192.0.2.44, 2001:db8::ff",
        "0:0:0:0:0:ffff:c000:22c, 2001:db8::ff",
        "::ffff:192.0.2.44, 2001:db8::ff",
        "::ffff:192.0.2.44, 2001:db8::ff",
        "::ffff:192.0.2.44, 2001:db8::ff",
        "::ffff:192.0.2.44, 2001:db8::ff"
      ]
    });
    assert.deepEqual(mapped.statuses, [201, 201, 201, 201, 201, 429]);
  });

  test("fails closed for missing, malformed, and untrusted forwarded identity without a global bucket", async () => {
    for (const scenario of [
      { body: validBody },
      { forwarded: "not-an-ip", trustedProxy: true, body: validBody },
      { forwarded: "203.0.113.5", trustedProxy: false, body: validBody }
    ]) {
      const result = await runRouteScenario(scenario);
      assert.deepEqual(result.statuses, [400]);
      assert.equal(result.createClientCalls, 0);
      assert.equal(result.inserted.length, 0);
    }
  });

  test("rejects oversized declared and chunked bodies before client/catalog/repository access", async () => {
    const declared = await runRouteScenario({
      trustedProxy: true, forwarded: "203.0.113.20, 10.0.0.1", contentLength: String(32 * 1024 + 1), body: validBody
    });
    assert.deepEqual(declared.statuses, [413]);
    assert.equal(declared.createClientCalls, 0);
    assert.equal(declared.calls.length, 0);

    const enormous = await runRouteScenario({
      trustedProxy: true, forwarded: "203.0.113.201, 10.0.0.1", contentLength: "9007199254740992", body: validBody
    });
    assert.deepEqual(enormous.statuses, [413]);
    assert.equal(enormous.createClientCalls, 0);
    assert.equal(enormous.calls.length, 0);

    const chunked = await runRouteScenario({ trustedProxy: true, forwarded: "203.0.113.21, 10.0.0.1", streamCount: 33, streamChunkSize: 1024 });
    assert.deepEqual(chunked.statuses, [413]);
    assert.equal(chunked.createClientCalls, 0);
    assert.equal(chunked.streamState.cancelled, true);
    assert.equal(chunked.streamState.pulls, 33);
    assert.equal(chunked.calls.length, 0);

    const untrustedLength = await runRouteScenario({ trustedProxy: true, forwarded: "203.0.113.22, 10.0.0.1", contentLength: "not-a-number", streamCount: 33, streamChunkSize: 1024, streamPrefix: '{"unknown":"' });
    assert.deepEqual(untrustedLength.statuses, [400]);
    assert.equal(untrustedLength.createClientCalls, 0);
    // NextRequest may pull one chunk while constructing the request, but the
    // route itself rejects the malformed declaration before consuming it.
    assert.equal(untrustedLength.streamState.pulls, 1);
  });

  test("maps malformed JSON, spoofed source, catalog lookup, and client factory errors safely", async () => {
    const malformed = await runRouteScenario({ trustedProxy: true, forwarded: "203.0.113.30, 10.0.0.1", rawBody: "{broken" });
    assert.deepEqual(malformed.statuses, [400]);
    assert.equal(malformed.createClientCalls, 0);

    const spoofed = await runRouteScenario({ trustedProxy: true, forwarded: "203.0.113.31, 10.0.0.1", body: { ...validBody, sourcePath: "https://evil.example/fake" } });
    assert.deepEqual(spoofed.statuses, [400]);
    assert.equal(spoofed.createClientCalls, 0);

    const subject = await runRouteScenario({ trustedProxy: true, forwarded: "203.0.113.32, 10.0.0.1", subjectExists: true, subjectOnly: true, body: { ...validBody, selectedSubjectSlug: "existing-subject" } });
    assert.deepEqual(subject.statuses, [201]);
    assert.equal(subject.inserted[0].p_selected_subject_slug, "existing-subject");
    assert.equal(subject.inserted[0].p_selected_product_slug, null);
    assert.ok(subject.calls.some((call) => call[0] === "from" && call[1] === "subjects"));

    const factory = await runRouteScenario({ trustedProxy: true, forwarded: "203.0.113.33, 10.0.0.1", body: validBody, clientError: true });
    assert.deepEqual(factory.statuses, [503]);
    assert.equal(factory.inserted.length, 0);
  });
});

const formHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

globalThis.window = { location: { pathname: "/tai-lieu/ke-toan", search: "" } };
const state = [];
let cursor = 0;
let fetchCalls = [];
globalThis.__formState = state;
globalThis.__formCursor = 0;

function useState(initial) {
  const index = globalThis.__formCursor++;
  if (!(index in globalThis.__formState)) globalThis.__formState[index] = initial;
  return [globalThis.__formState[index], (value) => { globalThis.__formState[index] = typeof value === "function" ? value(globalThis.__formState[index]) : value; }];
}
function useRef(initial) {
  const index = globalThis.__formCursor++;
  if (!(index in globalThis.__formState)) globalThis.__formState[index] = { current: initial };
  return globalThis.__formState[index];
}
function useMemo(factory) { globalThis.__formCursor++; return factory(); }
function useEffect(effect) { globalThis.__formCursor++; effect(); }
function jsx(type, props) { return { type, props: props ?? {} }; }
const jsxRuntimeUrl = "data:text/javascript," + encodeURIComponent("export const jsx=" + jsx.toString() + "; export const jsxs=jsx; export const Fragment='fragment';");
const reactUrl = "data:text/javascript," + encodeURIComponent("export const useState=" + useState.toString() + "; export const useRef=" + useRef.toString() + "; export const useMemo=" + useMemo.toString() + "; export const useEffect=" + useEffect.toString() + ";");
const imageUrl = "data:text/javascript,export default function Image(){return null}";
const iconsUrl = "data:text/javascript,export function LoaderCircle(){return null}";
const motionUrl = "data:text/javascript,export function MotionReveal(p){return p.children}";
const headingUrl = "data:text/javascript,export function SectionHeading(){return null}";
const siteUrl = "data:text/javascript," + encodeURIComponent("export const faculties=['Khoa Tài chính']; export const majors=['Kế toán']; export const needs=['Cần tư vấn'];");
const subjectsUrl = "data:text/javascript," + encodeURIComponent("export function normalizeSlug(value){return String(value).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}");
const validationSource = await readFile(path.resolve(process.cwd(), "lib/validation/consultation.ts"), "utf8");
const validationCode = (await transform(validationSource, { loader: "ts", format: "esm" })).code;
const validationUrl = "data:text/javascript," + encodeURIComponent(validationCode);
globalThis.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  return { status: 201, async json() { return { success: true }; } };
};

let source = await readFile(path.resolve(process.cwd(), "components/site/consultation-form.tsx"), "utf8");
for (const [from, to] of [
  ["\"react\"", JSON.stringify(reactUrl)],
  ["\"react/jsx-runtime\"", JSON.stringify(jsxRuntimeUrl)],
  ["\"next/image\"", JSON.stringify(imageUrl)],
  ["\"lucide-react\"", JSON.stringify(iconsUrl)],
  ["\"@/components/site/motion-reveal\"", JSON.stringify(motionUrl)],
  ["\"@/components/site/section-heading\"", JSON.stringify(headingUrl)],
  ["\"@/data/site\"", JSON.stringify(siteUrl)],
  ["\"@/lib/domain/subjects\"", JSON.stringify(subjectsUrl)],
  ["\"@/lib/validation/consultation\"", JSON.stringify(validationUrl)]
]) source = source.replaceAll(from, to);
const code = (await transform(source, { loader: "tsx", format: "esm", jsx: "automatic" })).code.replaceAll("react/jsx-runtime", jsxRuntimeUrl);
const { ConsultationForm } = await import("data:text/javascript," + encodeURIComponent(code));
const catalog = { materials: [{ slug: "published-product", category: "Kế toán", subject: { slug: "existing-subject", name: "Toán" } }], courses: [], tutors: [] };

function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return;
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output); return; }
  if (value.type === "form") output.form = value;
  if (["input", "select", "textarea"].includes(value.type)) output.controls.push(value);
  if (value.props) inspect(value.props.children, output);
}
function render() {
  globalThis.__formCursor = 0;
  const output = { form: null, controls: [] };
  inspect(ConsultationForm({ catalog }), output);
  return output;
}

let output = render();
const controls = output.controls;
controls.find((control) => control.type === "input" && control.props.placeholder.startsWith("Ví dụ: Nguyễn"))?.props.onChange({ target: { value: "Nguyễn Văn Runtime" } });
controls.find((control) => control.type === "input" && control.props.inputMode === "tel")?.props.onChange({ target: { value: "0901234567" } });
const selects = controls.filter((control) => control.type === "select");
selects[0].props.onChange({ target: { value: "Khoa Tài chính" } });
selects[1].props.onChange({ target: { value: "Kế toán" } });
selects[2].props.onChange({ target: { value: "Toán" } });
selects[3].props.onChange({ target: { value: "Cần tư vấn" } });
controls.find((control) => control.type === "textarea").props.onChange({ target: { value: "Ghi chú runtime" } });
output = render();
await output.form.props.onSubmit({ preventDefault() {} });
const submitted = fetchCalls[0];
console.log(JSON.stringify({
  fetchCount: fetchCalls.length,
  url: submitted?.url,
  headers: submitted?.options?.headers,
  payload: submitted ? JSON.parse(submitted.options.body) : null
}));
`;

test("executes the real ConsultationForm through submit to fetch with internal attribution and idempotency", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx/esm", "-e", formHarness],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  const result = JSON.parse(stdout.trim()) as {
    fetchCount: number;
    url: string;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
  };
  assert.equal(result.fetchCount, 1);
  assert.equal(result.url, "/api/consultations");
  assert.equal(result.headers["Content-Type"], "application/json");
  assert.match(result.headers["Idempotency-Key"], /.+/);
  assert.equal(result.payload.fullName, "Nguyễn Văn Runtime");
  assert.equal(result.payload.selectedSubjectSlug, "existing-subject");
  assert.equal(result.payload.sourcePath, "/tai-lieu/ke-toan");
});
