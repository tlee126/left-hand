import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, test } from "node:test";

const execFileAsync = promisify(execFile);
const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

type Scenario = {
  target: "page" | "layout" | "landing";
  access:
    | "anonymous"
    | "non-admin"
    | "pending"
    | "rejected"
    | "suspended"
    | "profile-missing"
    | "admin";
  params?: Record<string, string>;
  rows?: number;
  repositoryError?: boolean;
};

type RuntimeResult = {
  calls: unknown[][];
  actionIds: string[];
  forms: { hasAction: boolean }[];
  options: string[];
  links: { href: string; text: string }[];
  accessTimeline: string[];
  text?: string;
  error?: string;
};

const runtimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
const calls = [];
const actionIds = [];
const forms = [];
const accessTimeline = [];

const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: { id: "student-id" }, profile: { role: "student" } }
    : scenario.access === "pending"
      ? { status: "pending", user: { id: "pending-id" }, profile: { role: "admin" } }
      : scenario.access === "rejected"
        ? { status: "rejected", user: { id: "rejected-id" }, profile: { role: "admin" } }
        : scenario.access === "suspended"
          ? { status: "suspended", user: { id: "suspended-id" }, profile: { role: "admin" } }
          : scenario.access === "profile-missing"
            ? { status: "profile_missing", user: { id: "missing-id" }, profile: null }
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

const authModule = "data:text/javascript,admin-account-auth";
const repositoryModule = "data:text/javascript,admin-account-repository";
const actionModule = "data:text/javascript,admin-account-action";
const navigationModule = "data:text/javascript,admin-account-navigation";
const linkModule = "data:text/javascript,admin-account-link";
const jsxRuntimeModule = "data:text/javascript,admin-account-jsx-runtime";

mock.module(authModule, {
  namedExports: {
    getAccountAccess: async () => {
      accessTimeline.push("access");
      return access;
    }
  }
});
mock.module(repositoryModule, {
  namedExports: {
    ACCOUNT_APPROVAL_STATUSES: ["pending", "approved", "rejected", "suspended"],
    isValidUuid: (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    listAccountsForApproval: async (...args) => {
      accessTimeline.push("repository");
      calls.push(args);
      if (scenario.repositoryError) throw new Error("RAW SQL password=secret nguyen@example.test");
      return accountRows;
    }
  }
});
mock.module(actionModule, {
  namedExports: {
    updateAccountApprovalAction: async (id) => {
      actionIds.push(id);
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

function textOf(value) {
  const output = { text: "", links: [], forms: [], options: [] };
  inspect(value, output);
  return output.text.trim();
}

function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") { output.text += " " + value; return; }
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  if (typeof value.type === "function") { inspect(value.type(value.props), output); return; }
  if (value.type === "a") {
    output.links.push({ href: value.props.href, text: textOf(value.props.children) });
  }
  if (value.type === "form") {
    output.forms.push({ hasAction: typeof value.props.action === "function" });
    forms.push(value.props);
  }
  if (value.type === "option") {
    output.options.push(value.props.value);
  }
  if (value.props) inspect(value.props.children, output);
}

async function compileAndLoad(filePath) {
  let source = await readFile(filePath, "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("@/lib/repositories/account-approval-repository", repositoryModule)
    .replaceAll("./actions", actionModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/link", linkModule);
  const compiled = await transform(source, {
    loader: "tsx",
    format: "esm",
    jsx: "automatic",
    sourcefile: path.basename(filePath)
  });
  const code = compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
  return (await import("data:text/javascript," + encodeURIComponent(code))).default;
}

try {
  const output = { calls, actionIds, forms: [], options: [], links: [], text: "" };
  if (scenario.target === "page") {
    const page = await compileAndLoad(path.resolve(process.cwd(), "app/quan-tri/tai-khoan/page.tsx"));
    const rendered = await page({ searchParams: Promise.resolve(scenario.params ?? {}) });
    inspect(rendered, output);
    for (const props of forms) {
      if (typeof props.action === "function") await props.action(new FormData());
    }
    output.forms = forms.map((props) => ({ hasAction: typeof props.action === "function" }));
  } else if (scenario.target === "layout") {
    const layout = await compileAndLoad(path.resolve(process.cwd(), "app/quan-tri/layout.tsx"));
    inspect(await layout({ children: "ADMIN_CHILDREN" }), output);
  } else {
    const landing = await compileAndLoad(path.resolve(process.cwd(), "app/quan-tri/page.tsx"));
    inspect(await landing(), output);
  }
  output.text = output.text.trim();
  console.log(JSON.stringify({ ...output, accessTimeline }));
} catch (error) {
  console.log(JSON.stringify({ calls, actionIds, forms: [], options: [], links: [], accessTimeline, error: String(error?.message ?? error) }));
}
`;

async function runScenario(scenario: Scenario): Promise<RuntimeResult> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "tsx/esm",
      "-e",
      runtimeHarness,
      JSON.stringify(scenario)
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as RuntimeResult;
}

describe("Task 3.1-F-C: admin account approval UI", () => {
  test("approved admin renders account fields, current status, and exactly canonical action options", async () => {
    const result = await runScenario({ target: "page", access: "admin" });
    assert.equal(result.error, undefined);
    assert.ok(result.text?.includes("Quản lý tài khoản"));
    assert.ok(result.text?.includes("Nguyễn Văn A"));
    assert.ok(result.text?.includes("nguyen@example.test"));
    assert.ok(result.text?.includes("student"));
    assert.match(result.text ?? "", /Trạng thái:\s+pending/);
    assert.ok(result.text?.includes("Thiếu thông tin"));
    assert.ok(result.text?.includes("Ngày tạo"));
    assert.deepEqual(result.options, ["approved", "rejected", "suspended"]);
    assert.deepEqual(result.actionIds, [ACCOUNT_ID]);
    assert.deepEqual(result.forms, [{ hasAction: false }, { hasAction: true }]);
  });

  test("anonymous access redirects before repository access", async () => {
    const result = await runScenario({ target: "page", access: "anonymous" });
    assert.equal(result.error, "REDIRECT:/dang-nhap?next=/quan-tri/tai-khoan");
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.accessTimeline, ["access"]);
  });

  test("non-admin and every unapproved or profile-missing status are blocked before repository access", async () => {
    for (const access of ["non-admin", "pending", "rejected", "suspended", "profile-missing"] as const) {
      const result = await runScenario({ target: "page", access });
      assert.equal(result.error, "NOT_FOUND", access);
      assert.deepEqual(result.calls, [], access);
      assert.deepEqual(result.accessTimeline, ["access"], access);
    }
  });

  test("maps q, status, and the bounded page to repository search, status, and offset", async () => {
    const result = await runScenario({
      target: "page",
      access: "admin",
      params: { q: "  Nguyen Van A ", status: "rejected", page: "3" },
      rows: 0
    });
    assert.deepEqual(result.calls, [[{
      search: "Nguyen Van A",
      status: "rejected",
      limit: 21,
      offset: 40
    }]]);
  });

  test("renders a clear empty state", async () => {
    const result = await runScenario({ target: "page", access: "admin", rows: 0 });
    assert.ok(result.text?.includes("Không có tài khoản phù hợp."));
  });

  test("renders fixed messages from supported query flags", async () => {
    const success = await runScenario({ target: "page", access: "admin", params: { success: "1" }, rows: 0 });
    assert.ok(success.text?.includes("Cập nhật trạng thái tài khoản thành công."));

    const error = await runScenario({ target: "page", access: "admin", params: { error: "1" }, rows: 0 });
    assert.ok(error.text?.includes("Không thể cập nhật tài khoản. Vui lòng thử lại sau."));
  });

  test("repository failures show only a fixed generic error", async () => {
    const result = await runScenario({ target: "page", access: "admin", repositoryError: true });
    assert.ok(result.text?.includes("Không thể tải danh sách tài khoản lúc này. Vui lòng thử lại sau."));
    assert.ok(!result.text?.includes("RAW SQL"));
    assert.ok(!result.text?.includes("nguyen@example.test"));
  });

  test("preserves filters in pagination and does not exceed the safe maximum page", async () => {
    const pageThree = await runScenario({
      target: "page",
      access: "admin",
      params: { q: "Nguyen Van A", status: "approved", page: "2" },
      rows: 21
    });
    assert.ok(pageThree.links.some((link) => link.href === "/quan-tri/tai-khoan?q=Nguyen+Van+A&status=approved"), JSON.stringify(pageThree.links));
    assert.ok(pageThree.links.some((link) => link.href === "/quan-tri/tai-khoan?q=Nguyen+Van+A&status=approved&page=3"));

    const maximum = await runScenario({
      target: "page",
      access: "admin",
      params: { q: "Nguyen", status: "approved", page: "10000" },
      rows: 21
    });
    assert.ok(!maximum.links.some((link) => link.href.includes("page=10001")));
  });

  test("admin shell and landing page keep consultation links and add account management links", async () => {
    const layout = await runScenario({ target: "layout", access: "admin" });
    assert.ok(layout.links.some((link) => link.href === "/quan-tri/tai-khoan"));
    assert.ok(layout.links.some((link) => link.href === "/quan-tri"));
    assert.ok(layout.links.some((link) => link.href === "/quan-tri/tu-van"));

    const landing = await runScenario({ target: "landing", access: "admin" });
    assert.ok(landing.links.some((link) => link.href === "/quan-tri/tai-khoan"));
    assert.ok(landing.links.some((link) => link.href === "/quan-tri/tu-van"));
  });

  test("admin UI contains no student dashboard metrics or unrelated profile content", async () => {
    const result = await runScenario({ target: "page", access: "admin" });
    const text = (result.text ?? "").toLowerCase();
    for (const forbidden of ["gpa", "môn học", "kế hoạch học tập", "studentdashboardclient", "streak học tập"]) {
      assert.ok(!text.includes(forbidden), `Unexpected student content: ${forbidden}`);
    }
  });
});
