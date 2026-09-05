import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, describe } from "node:test";

const execFileAsync = promisify(execFile);

type Scenario = {
  access: "anonymous" | "non-admin" | "unapproved" | "admin";
  id: string;
  record?: boolean;
  repositoryError?: boolean;
  inbox?: boolean;
  nullableFields?: boolean;
};

const runtimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const scenario = JSON.parse(process.argv[1]);
const calls = [];
const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: {}, profile: { role: "student" } }
    : scenario.access === "unapproved"
      ? { status: "pending", user: {}, profile: { role: "admin" } }
      : { status: "approved", user: {}, profile: { role: "admin" } };
const record = {
  id: scenario.id, request_id: "request-1", full_name: "Nguyen Van A", phone: "0901234567",
  faculty: "Khoa Toan", major: scenario.nullableFields ? null : "Toan ung dung", interest: "Hoc bong", need: "Can tu van chi tiet",
  note: scenario.nullableFields ? null : "PII_NOTE_123", source_path: scenario.nullableFields ? null : "/khoa-hoc/toan", selected_product_slug: scenario.nullableFields ? null : "product-secret",
  selected_subject_slug: scenario.nullableFields ? null : "subject-secret", status: "new", created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z"
};
const authModule = "data:text/javascript,auth-module";
const profileModule = "data:text/javascript,profile-module";
const repositoryModule = "data:text/javascript,repository-module";
const navigationModule = "data:text/javascript,navigation-module";
const linkModule = "data:text/javascript,link-module";
const jsxRuntimeModule = "data:text/javascript,jsx-runtime-module";
mock.module(authModule, { namedExports: { getAccountAccess: async () => access } });
mock.module(profileModule, { namedExports: {} });
mock.module(repositoryModule, { namedExports: {
  VALID_CONSULTATION_STATUSES: ["new", "contacted", "qualified", "closed"],
  isValidUuid: (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  getConsultationById: async (id) => { calls.push(id); if (scenario.repositoryError) throw new Error("RAW_DATABASE_SECRET"); return scenario.record === false ? null : record; },
  listConsultations: async () => [record]
} });
mock.module(navigationModule, { namedExports: {
  redirect: (location) => { throw new Error("REDIRECT:" + location); },
  notFound: () => { throw new Error("NOT_FOUND"); }
} });
mock.module(linkModule, { namedExports: { default: (props) => ({ type: "a", props }) } });
mock.module(jsxRuntimeModule, { namedExports: { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } });
function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") { output.text += value; return; }
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output); return; }
  if (value.props) {
    if (value.type === "a") output.links.push({ href: value.props.href, text: textOf(value.props.children) });
    inspect(value.props.children, output);
  }
}
function textOf(value) { const output = { text: "", links: [] }; inspect(value, output); return output.text; }
try {
  let source = await readFile(process.cwd() + (scenario.inbox ? "/app/quan-tri/tu-van/page.tsx" : "/app/quan-tri/tu-van/[id]/page.tsx"), "utf8");
  source = source.replaceAll("@/lib/auth/session", authModule).replaceAll("@/lib/repositories/profile-repository", profileModule).replaceAll("@/lib/repositories/consultation-repository", repositoryModule).replaceAll("next/navigation", navigationModule).replaceAll("next/link", linkModule);
  const compiled = await transform(source, { loader: "tsx", format: "esm", jsx: "automatic", sourcefile: "page.tsx" });
  const pageCode = compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
  const page = (await import("data:text/javascript," + encodeURIComponent(pageCode))).default;
  const result = scenario.inbox ? await page({ searchParams: Promise.resolve({}) }) : await page({ params: Promise.resolve({ id: scenario.id }) });
  const output = { calls, text: "", links: [] }; inspect(result, output); console.log(JSON.stringify(output));
} catch (error) { console.log(JSON.stringify({ calls, error: String(error?.message ?? error) })); }
`;

async function runPage(scenario: Scenario): Promise<{ calls: string[]; text?: string; links?: { href: string; text: string }[]; error?: string }> {
  const { stdout } = await execFileAsync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", runtimeHarness, JSON.stringify(scenario)], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim());
}

const validId = "11111111-1111-1111-1111-111111111111";

describe("Task 4.2-D: Admin consultation detail", () => {
  test("guards anonymous and unauthorized access before repository calls", async () => {
    assert.equal((await runPage({ access: "anonymous", id: validId })).error, "REDIRECT:/dang-nhap?next=/quan-tri/tu-van/" + validId);
    assert.deepEqual((await runPage({ access: "anonymous", id: validId })).calls, []);
    for (const access of ["non-admin", "unapproved"] as const) {
      const result = await runPage({ access, id: validId });
      assert.equal(result.error, "NOT_FOUND"); assert.deepEqual(result.calls, []);
    }
  });
  test("rejects malformed UUID before repository access", async () => {
    const result = await runPage({ access: "admin", id: "bad-id" });
    assert.equal(result.error, "NOT_FOUND"); assert.deepEqual(result.calls, []);
  });
  test("loads and renders an approved consultation as display-only text", async () => {
    const result = await runPage({ access: "admin", id: validId });
    assert.deepEqual(result.calls, [validId]);
    const formatTimestamp = (value: string) => new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
    for (const value of [
      validId,
      "request-1",
      "Nguyen Van A",
      "0901234567",
      "Khoa Toan",
      "Toan ung dung",
      "Hoc bong",
      "Can tu van chi tiet",
      "new",
      "PII_NOTE_123",
      "product-secret",
      formatTimestamp("2026-01-01T00:00:00.000Z"),
      formatTimestamp("2026-01-02T00:00:00.000Z")
    ]) assert.ok(result.text?.includes(value));
    assert.ok(!result.text?.includes("subject-secret"));
    assert.ok(!result.text?.includes("Slug môn học đã chọn"));
    assert.ok(result.links?.some((link) => link.href === "/quan-tri/tu-van" && link.text.includes("Quay")));
  });
  test("renders fallback values for nullable consultation fields", async () => {
    const result = await runPage({ access: "admin", id: validId, nullableFields: true });
    assert.deepEqual(result.calls, [validId]);
    assert.ok(result.text?.includes(validId));
    assert.ok(result.text?.includes("request-1"));
    assert.equal(result.text?.match(/—/g)?.length, 4);
  });
  test("inbox lead name links to the lead UUID detail path", async () => {
    const result = await runPage({ access: "admin", id: validId, inbox: true });
    assert.ok(result.links?.some((link) => link.href === "/quan-tri/tu-van/" + validId && link.text.includes("Nguyen Van A")));
  });
  test("handles missing records and repository errors safely", async () => {
    assert.equal((await runPage({ access: "admin", id: validId, record: false })).error, "NOT_FOUND");
    const result = await runPage({ access: "admin", id: validId, repositoryError: true });
    assert.ok(result.text?.includes("Kh"));
    assert.ok(!result.text?.includes("RAW_DATABASE_SECRET"));
  });
});
