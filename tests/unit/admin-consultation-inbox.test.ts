import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const execFileAsync = promisify(execFile);
const pagePath = path.resolve(process.cwd(), "app/quan-tri/tu-van/page.tsx");

type Scenario = {
  access: "anonymous" | "non-admin" | "unapproved" | "admin";
  params?: Record<string, string>;
  rows?: number;
  repositoryError?: boolean;
};

const runtimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const scenario = JSON.parse(process.argv[1]);
const calls = [];
const rows = Array.from({ length: scenario.rows ?? 0 }, (_, index) => ({
  id: "00000000-0000-0000-0000-0000000000" + String(index + 1).padStart(2, "0"),
  request_id: null, full_name: "Khách " + (index + 1), phone: "0900000000",
  faculty: "Khoa", interest: "Toán", need: "Tư vấn", major: null, note: null,
  source_path: null, selected_product_slug: null, selected_subject_slug: null,
  status: "new", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z"
}));
const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: {}, profile: { role: "student" } }
    : scenario.access === "unapproved"
      ? { status: "pending", user: {}, profile: { role: "admin" } }
      : { status: "approved", user: {}, profile: { role: "admin" } };

const authModule = "data:text/javascript,auth-module";
const profileModule = "data:text/javascript,profile-module";
const repositoryModule = "data:text/javascript,repository-module";
const navigationModule = "data:text/javascript,navigation-module";
const linkModule = "data:text/javascript,link-module";
const jsxRuntimeModule = "data:text/javascript,jsx-runtime-module";
mock.module(authModule, { namedExports: { getAccountAccess: async () => access } });
mock.module(profileModule, { namedExports: {} });
mock.module(repositoryModule, {
  namedExports: {
    VALID_CONSULTATION_STATUSES: ["new", "contacted", "qualified", "closed"],
    listConsultations: async (options) => {
      calls.push(options);
      if (scenario.repositoryError) throw new Error("RAW_DATABASE_SECRET");
      return rows;
    }
  }
});
mock.module(navigationModule, {
  namedExports: {
    redirect: (location) => { throw new Error("REDIRECT:" + location); },
    notFound: () => { throw new Error("NOT_FOUND"); }
  }
});
mock.module(linkModule, {
  namedExports: { default: (props) => ({ type: "a", props }) }
});
mock.module(jsxRuntimeModule, {
  namedExports: {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props })
  }
});

function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") {
    if (typeof value === "string") output.text += value;
    return;
  }
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output); return; }
  if (value.props) {
    if (value.type === "a") output.links.push({ href: value.props.href, text: textOf(value.props.children) });
    inspect(value.props.children, output);
  }
}
function textOf(value) { const output = { text: "", links: [] }; inspect(value, output); return output.text; }

try {
  let source = await readFile(process.cwd() + "/app/quan-tri/tu-van/page.tsx", "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("@/lib/repositories/profile-repository", profileModule)
    .replaceAll("@/lib/repositories/consultation-repository", repositoryModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/link", linkModule);
  const compiled = await transform(source, { loader: "tsx", format: "esm", jsx: "automatic", sourcefile: "page.tsx" });
  const pageCode = compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
  const page = (await import("data:text/javascript," + encodeURIComponent(pageCode))).default;
  const result = await page({ searchParams: Promise.resolve(scenario.params ?? {}) });
  const output = { calls, text: "", links: [] };
  inspect(result, output);
  console.log(JSON.stringify(output));
} catch (error) {
  console.log(JSON.stringify({ calls, error: String(error?.message ?? error) }));
}
`;

async function runPage(scenario: Scenario): Promise<{ calls: unknown[]; text?: string; links?: { href: string; text: string }[]; error?: string }> {
  const { stdout } = await execFileAsync(process.execPath, [
    "--experimental-test-module-mocks", "--import", "tsx/esm", "-e", runtimeHarness, JSON.stringify(scenario)
  ], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim());
}

async function readPage(): Promise<string> {
  return fs.readFile(pagePath, "utf-8");
}

function rowCount(text: string): number {
  return (text.match(/Khách \d+/g) ?? []).length;
}

describe("Task 4.2-C: Admin consultation inbox", () => {
  test("keeps the page server-only and read-only", async () => {
    const code = await readPage();
    assert.ok(!code.includes('"use client"'));
    assert.ok(!code.includes("@/lib/supabase/client"));
    assert.ok(!code.includes("SUPABASE_SERVICE_ROLE_KEY"));
    assert.ok(!code.includes("service_role"));
    assert.ok(!code.includes('from("consultations")'));
    assert.ok(!code.includes(".insert("));
    assert.ok(!code.includes(".update("));
    assert.ok(!code.includes(".delete("));
  });

  test("redirects anonymous requests without calling the repository", async () => {
    const result = await runPage({ access: "anonymous" });
    assert.equal(result.error, "REDIRECT:/dang-nhap?next=/quan-tri/tu-van");
    assert.deepEqual(result.calls, []);
  });

  test("blocks approved non-admin users before repository access", async () => {
    const result = await runPage({ access: "non-admin" });
    assert.equal(result.error, "NOT_FOUND");
    assert.deepEqual(result.calls, []);
  });

  test("blocks unapproved admins before repository access", async () => {
    const result = await runPage({ access: "unapproved" });
    assert.equal(result.error, "NOT_FOUND");
    assert.deepEqual(result.calls, []);
  });

  test("loads an approved inbox with a one-row lookahead and valid filters", async () => {
    const result = await runPage({ access: "admin", params: { q: "  Nguyen Van A ", status: "contacted", page: "3" }, rows: 21 });
    assert.deepEqual(result.calls, [{ search: "Nguyen Van A", status: "contacted", limit: 21, offset: 40 }]);
    assert.equal(rowCount(result.text ?? ""), 20);
    assert.ok(result.links?.some((link) => link.href === "/quan-tri/tu-van?q=Nguyen+Van+A&status=contacted&page=4"));
    assert.ok(result.links?.some((link) => link.href === "/quan-tri/tu-van?q=Nguyen+Van+A&status=contacted&page=2"));
  });

  test("defaults invalid status and unsafe pages", async () => {
    const result = await runPage({ access: "admin", params: { q: "hello", status: "invalid", page: "10001" }, rows: 0 });
    assert.deepEqual(result.calls, [{ search: "hello", limit: 21, offset: 0 }]);
    const decimal = await runPage({ access: "admin", params: { page: "2.5" }, rows: 0 });
    assert.deepEqual(decimal.calls, [{ limit: 21, offset: 0 }]);
  });

  test("does not link past the maximum inbox page", async () => {
    const result = await runPage({ access: "admin", params: { page: "10000" }, rows: 21 });
    assert.deepEqual(result.calls, [{ limit: 21, offset: 199980 }]);
    assert.ok(!result.links?.some((link) => link.href.includes("page=10001")));
  });

  test("renders only a generic Vietnamese error when loading fails", async () => {
    const result = await runPage({ access: "admin", repositoryError: true });
    assert.ok(result.text?.includes("Không thể tải danh sách tư vấn lúc này"));
    assert.ok(!result.text?.includes("RAW_DATABASE_SECRET"));
  });
});
