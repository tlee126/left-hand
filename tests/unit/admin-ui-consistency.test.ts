import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, test } from "node:test";

const execFileAsync = promisify(execFile);

type Target = "layout" | "landing" | "account" | "inbox" | "detail";

type Scenario = {
  target: Target;
  access: "anonymous" | "non-admin" | "pending" | "admin";
  params?: Record<string, string>;
  rows?: number;
};

type RenderedResult = {
  calls: unknown[][];
  links: { href: string; text: string }[];
  navLinks: { href: string; text: string }[];
  forms: { method?: string; hasAction: boolean }[];
  selects: { name?: string; defaultValue?: string }[];
  options: string[];
  tags: string[];
  classes: string[];
  text: string;
  error?: string;
};

const runtimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
const calls = [];

const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: { id: "student-id" }, profile: { role: "student" } }
    : scenario.access === "pending"
      ? { status: "pending", user: { id: "pending-id" }, profile: { role: "admin" } }
      : { status: "approved", user: { id: "admin-id" }, profile: { id: "admin-profile-id", role: "admin", fullName: "Quản trị viên" } };

const accountRows = Array.from({ length: scenario.rows ?? 1 }, (_, index) => ({
  id: index === 0 ? "11111111-1111-1111-1111-111111111111" : "22222222-2222-2222-2222-222222222222",
  full_name: index === 0 ? "Nguyễn Văn A" : "Trần Thị B",
  email: index === 0 ? "nguyen@example.test" : null,
  role: index === 0 ? "student" : "tutor",
  account_status: index === 0 ? "pending" : "approved",
  created_at: "2026-01-01T00:00:00.000Z",
  approved_at: index === 0 ? null : "2026-01-02T00:00:00.000Z",
  rejection_reason: index === 0 ? "Thiếu thông tin" : null
}));

const consultationRows = Array.from({ length: scenario.rows ?? 1 }, (_, index) => ({
  id: "00000000-0000-0000-0000-0000000000" + String(index + 1).padStart(2, "0"),
  request_id: "request-1",
  full_name: "Khách tư vấn " + (index + 1),
  phone: "0901234567",
  faculty: "Khoa Toán",
  major: index === 0 ? "Toán ứng dụng" : null,
  interest: "Học bổng",
  need: "Cần tư vấn chi tiết",
  note: index === 0 ? "Ghi chú học tập" : null,
  source_path: "/khoa-hoc",
  selected_product_slug: "product-secret",
  selected_subject_slug: "subject-secret",
  status: "new",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z"
}));

const authModule = "data:text/javascript,admin-ui-auth";
const accountRepositoryModule = "data:text/javascript,admin-ui-account-repository";
const consultationRepositoryModule = "data:text/javascript,admin-ui-consultation-repository";
const actionModule = "data:text/javascript,admin-ui-action";
const navigationModule = "data:text/javascript,admin-ui-navigation";
const linkModule = "data:text/javascript,admin-ui-link";
const jsxRuntimeModule = "data:text/javascript,admin-ui-jsx-runtime";

mock.module(authModule, { namedExports: { getAccountAccess: async () => access } });
mock.module(accountRepositoryModule, { namedExports: {
  ACCOUNT_APPROVAL_STATUSES: ["pending", "approved", "rejected", "suspended"],
  isValidUuid: (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  listAccountsForApproval: async (...args) => { calls.push(args); return accountRows; }
} });
mock.module(consultationRepositoryModule, { namedExports: {
  VALID_CONSULTATION_STATUSES: ["new", "contacted", "qualified", "closed"],
  isValidUuid: (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  listConsultations: async (...args) => { calls.push(args); return consultationRows; },
  getConsultationById: async (...args) => { calls.push(args); return consultationRows[0]; }
} });
mock.module(actionModule, { namedExports: { updateAccountApprovalAction: async () => {} } });
mock.module(navigationModule, { namedExports: {
  redirect: (location) => { throw new Error("REDIRECT:" + location); },
  notFound: () => { throw new Error("NOT_FOUND"); }
} });
mock.module(linkModule, { namedExports: { default: (props) => ({ type: "a", props }) } });
mock.module(jsxRuntimeModule, { namedExports: {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props })
} });

function textOf(value) {
  const output = { text: "", links: [], navLinks: [], forms: [], selects: [], options: [], tags: [], classes: [] };
  inspect(value, output);
  return output.text.trim();
}

function inspect(value, output, inNav = false) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") { output.text += " " + value; return; }
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output, inNav)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output, inNav); return; }
  const nextInNav = inNav || value.type === "nav";
  if (typeof value.type === "string") {
    output.tags.push(value.type);
    if (value.props?.className) output.classes.push(value.props.className);
  }
  if (value.type === "a") {
    const link = { href: value.props.href, text: textOf(value.props.children) };
    output.links.push(link);
    if (nextInNav) output.navLinks.push(link);
  }
  if (value.type === "form") output.forms.push({ method: value.props.method, hasAction: typeof value.props.action === "function" });
  if (value.type === "select") output.selects.push({ name: value.props.name, defaultValue: value.props.defaultValue });
  if (value.type === "option") output.options.push(value.props.value);
  if (value.props) inspect(value.props.children, output, nextInNav);
}

async function compileAndLoad(filePath) {
  let source = await readFile(filePath, "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("@/lib/repositories/account-approval-repository", accountRepositoryModule)
    .replaceAll("@/lib/repositories/consultation-repository", consultationRepositoryModule)
    .replaceAll("./actions", actionModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/link", linkModule);
  const compiled = await transform(source, { loader: "tsx", format: "esm", jsx: "automatic", sourcefile: path.basename(filePath) });
  const code = compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
  return (await import("data:text/javascript," + encodeURIComponent(code))).default;
}

try {
  const output = { calls, links: [], navLinks: [], forms: [], selects: [], options: [], tags: [], classes: [], text: "" };
  const root = process.cwd();
  if (scenario.target === "layout") {
    const layout = await compileAndLoad(path.resolve(root, "app/quan-tri/layout.tsx"));
    inspect(await layout({ children: { type: "div", props: { children: "ADMIN_CHILDREN" } } }), output);
  } else if (scenario.target === "landing") {
    const page = await compileAndLoad(path.resolve(root, "app/quan-tri/page.tsx"));
    inspect(await page(), output);
  } else if (scenario.target === "account") {
    const page = await compileAndLoad(path.resolve(root, "app/quan-tri/tai-khoan/page.tsx"));
    inspect(await page({ searchParams: Promise.resolve(scenario.params ?? {}) }), output);
  } else if (scenario.target === "inbox") {
    const page = await compileAndLoad(path.resolve(root, "app/quan-tri/tu-van/page.tsx"));
    inspect(await page({ searchParams: Promise.resolve(scenario.params ?? {}) }), output);
  } else {
    const page = await compileAndLoad(path.resolve(root, "app/quan-tri/tu-van/[id]/page.tsx"));
    inspect(await page({
      params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }),
      searchParams: Promise.resolve(scenario.params ?? {})
    }), output);
  }
  output.text = output.text.trim();
  console.log(JSON.stringify(output));
} catch (error) {
  console.log(JSON.stringify({ calls, links: [], navLinks: [], forms: [], selects: [], options: [], tags: [], classes: [], text: "", error: String(error?.message ?? error) }));
}
`;

async function runScenario(scenario: Scenario): Promise<RenderedResult> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", runtimeHarness, JSON.stringify(scenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as RenderedResult;
}

describe("Task 3.1-F-D: admin UI visual consistency", () => {
  test("renders the admin destinations in the required navigation order", async () => {
    const result = await runScenario({ target: "layout", access: "admin" });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.navLinks.map((link) => link.href), [
      "/quan-tri",
      "/quan-tri/tai-khoan",
      "/quan-tri/tu-van"
    ]);
    assert.deepEqual(result.navLinks.map((link) => link.text), [
      "Tổng quan",
      "Quản lý tài khoản",
      "Tư vấn"
    ]);
    assert.ok(result.classes.some((className) => className.includes("overflow-x-hidden")));
    assert.ok(result.classes.some((className) => className.includes("container-shell")));
  });

  test("landing page provides account and consultation entry cards without student metrics", async () => {
    const result = await runScenario({ target: "landing", access: "admin" });
    assert.equal(result.error, undefined);
    const entryLinks = result.links.filter((link) => link.href.startsWith("/quan-tri/"));
    assert.equal(entryLinks.length, 2);
    assert.ok(entryLinks[0].href === "/quan-tri/tai-khoan" && entryLinks[0].text.includes("Quản lý tài khoản"));
    assert.ok(entryLinks[1].href === "/quan-tri/tu-van" && entryLinks[1].text.includes("Tư vấn"));
    assert.ok(!entryLinks[1].text.includes("Hộp thư tư vấn"));
    for (const forbidden of ["gpa", "môn học", "kế hoạch học tập", "streak học tập"]) {
      assert.ok(!result.text.toLowerCase().includes(forbidden), forbidden);
    }
    assert.ok(result.tags.includes("section"));
  });

  test("account page retains filters, native approval actions, fields, and pagination", async () => {
    const result = await runScenario({
      target: "account",
      access: "admin",
      params: { q: "Nguyen Van A", status: "approved", page: "2" },
      rows: 21
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.calls, [[{ search: "Nguyen Van A", status: "approved", limit: 21, offset: 20 }]]);
    assert.ok(result.forms.some((form) => form.method === "get"));
    assert.ok(result.forms.some((form) => form.hasAction));
    assert.ok(result.selects.some((select) => select.name === "status"));
    assert.ok(result.options.includes("approved"));
    assert.ok(result.links.some((link) => link.href.includes("/quan-tri/tai-khoan?q=Nguyen+Van+A&status=approved&page=3")));
    assert.ok(result.text.includes("Lý do từ chối"));
    assert.ok(result.classes.some((className) => className.includes("notebook-input")));
    const accountFieldClasses = result.classes.flatMap((className) => className.split(/\s+/));
    assert.ok(accountFieldClasses.includes("text-ink/55"));
    assert.ok(accountFieldClasses.includes("text-ink"));
    assert.ok(!accountFieldClasses.includes("text-slate-500"));
    assert.ok(!accountFieldClasses.includes("text-slate-900"));
  });

  test("consultation inbox and detail retain links, filters, status controls, and audit fields", async () => {
    const inbox = await runScenario({
      target: "inbox",
      access: "admin",
      params: { q: "Nguyen", status: "contacted", page: "2" },
      rows: 21
    });
    assert.equal(inbox.error, undefined);
    assert.deepEqual(inbox.calls, [[{ search: "Nguyen", status: "contacted", limit: 21, offset: 20 }]]);
    assert.ok(inbox.tags.includes("table"));
    assert.ok(inbox.links.some((link) => link.href.startsWith("/quan-tri/tu-van/")));
    assert.ok(inbox.links.some((link) => link.href.includes("page=3")));
    assert.ok(inbox.classes.some((className) => className.includes("overflow-x-auto")));

    const detail = await runScenario({ target: "detail", access: "admin", params: { success: "1" } });
    assert.equal(detail.error, undefined);
    assert.ok(detail.links.some((link) => link.href === "/quan-tri/tu-van"));
    assert.ok(detail.forms.some((form) => form.hasAction));
    assert.deepEqual(detail.options, ["new", "contacted", "qualified", "closed"]);
    for (const field of ["ID lead", "Mã yêu cầu", "Ghi chú", "Đường dẫn nguồn", "Thời gian cập nhật"]) {
      assert.ok(detail.text.includes(field), field);
    }
    assert.ok(detail.text.includes("Cập nhật trạng thái thành công."));
    assert.ok(!detail.text.includes("Slug môn học đã chọn"));
    assert.ok(!detail.text.includes("selected_subject_slug"));
  });

  test("server guards still run before repository access for every admin page", async () => {
    for (const target of ["account", "inbox", "detail"] as const) {
      const anonymous = await runScenario({ target, access: "anonymous" });
      assert.equal(anonymous.error, target === "detail"
        ? "REDIRECT:/dang-nhap?next=/quan-tri/tu-van/00000000-0000-0000-0000-000000000001"
        : `REDIRECT:/dang-nhap?next=/quan-tri/${target === "account" ? "tai-khoan" : "tu-van"}`);
      assert.deepEqual(anonymous.calls, []);

      const unauthorized = await runScenario({ target, access: "non-admin" });
      assert.equal(unauthorized.error, "NOT_FOUND");
      assert.deepEqual(unauthorized.calls, []);
    }
  });

  test("admin rendered views contain no student dashboard content", async () => {
    for (const target of ["landing", "account", "inbox", "detail"] as const) {
      const result = await runScenario({ target, access: "admin" });
      const text = result.text.toLowerCase();
      for (const forbidden of ["gpa", "kế hoạch học tập", "streak học tập", "studentdashboardclient"]) {
        assert.ok(!text.includes(forbidden), `${target}: ${forbidden}`);
      }
    }
  });
});
