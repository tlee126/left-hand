import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, describe } from "node:test";

const execFileAsync = promisify(execFile);

type ActionScenario = {
  access: "anonymous" | "non-admin" | "unapproved" | "admin";
  id: string;
  formData: Record<string, string>;
  repositoryError?: boolean;
  repositoryReturnsNull?: boolean;
};

type PageScenario = {
  access: "anonymous" | "non-admin" | "unapproved" | "admin";
  id: string;
  status?: string;
  searchParams?: Record<string, string>;
};

const actionRuntimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const scenario = JSON.parse(process.argv[1]);
const repoCalls = [];
const revalidateCalls = [];

const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: {}, profile: { role: "student" } }
    : scenario.access === "unapproved"
      ? { status: "pending", user: {}, profile: { role: "admin" } }
      : { status: "approved", user: {}, profile: { role: "admin" } };

const authModule = "data:text/javascript,auth-module";
const repositoryModule = "data:text/javascript,repository-module";
const navigationModule = "data:text/javascript,navigation-module";
const cacheModule = "data:text/javascript,cache-module";

mock.module(authModule, { namedExports: { getAccountAccess: async () => access } });
mock.module(repositoryModule, { namedExports: {
  VALID_CONSULTATION_STATUSES: ["new", "contacted", "qualified", "closed"],
  isValidUuid: (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  updateConsultationStatus: async (...args) => {
    repoCalls.push(args);
    if (scenario.repositoryError) throw new Error("RAW_DATABASE_SECRET_SQL_FAIL_0901234567");
    if (scenario.repositoryReturnsNull) return null;
    return { id: args[0], status: args[1], updated_at: "2026-01-01T00:00:00.000Z" };
  }
} });
mock.module(navigationModule, { namedExports: {
  redirect: (loc) => { throw new Error("REDIRECT:" + loc); },
  notFound: () => { throw new Error("NOT_FOUND"); }
} });
mock.module(cacheModule, { namedExports: {
  revalidatePath: (path) => { revalidateCalls.push(path); }
} });

try {
  let source = await readFile(process.cwd() + "/app/quan-tri/tu-van/actions.ts", "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("@/lib/repositories/consultation-repository", repositoryModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/cache", cacheModule);
  const compiled = await transform(source, { loader: "ts", format: "esm", sourcefile: "actions.ts" });
  const mod = await import("data:text/javascript," + encodeURIComponent(compiled.code));
  const formData = new FormData();
  for (const [k, v] of Object.entries(scenario.formData || {})) {
    formData.append(k, v);
  }
  await mod.updateConsultationStatusAction(scenario.id, formData);
  console.log(JSON.stringify({ repoCalls, revalidateCalls, success: true }));
} catch (error) {
  console.log(JSON.stringify({ repoCalls, revalidateCalls, error: String(error?.message ?? error) }));
}
`;

const pageRuntimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const scenario = JSON.parse(process.argv[1]);
const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: {}, profile: { role: "student" } }
    : scenario.access === "unapproved"
      ? { status: "pending", user: {}, profile: { role: "admin" } }
      : { status: "approved", user: {}, profile: { role: "admin" } };

const record = {
  id: scenario.id,
  request_id: "req-status-1",
  full_name: "Nguyen Van A",
  phone: "0901234567",
  faculty: "Khoa Kinh Te",
  major: "Kinh Doanh",
  interest: "Mon Hoc",
  need: "Tu Van",
  note: "Ghi chu hoc tap",
  source_path: "/khoa-hoc",
  selected_product_slug: "prod-slug",
  selected_subject_slug: "subj-slug",
  status: scenario.status || "new",
  created_at: "2026-01-01T00:00:00.000Z",
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
  getConsultationById: async () => record
} });
mock.module(navigationModule, { namedExports: {
  redirect: (loc) => { throw new Error("REDIRECT:" + loc); },
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
    if (value.type === "select") {
      output.selects.push({ name: value.props.name, defaultValue: value.props.defaultValue });
    }
    if (value.type === "option") {
      output.options.push({ value: value.props.value, text: textOf(value.props.children) });
    }
    if (value.type === "form") {
      output.forms.push({ hasAction: typeof value.props.action === "function" || typeof value.props.action === "string" });
    }
    inspect(value.props.children, output);
  }
}
function textOf(value) { const output = { text: "", selects: [], options: [], forms: [] }; inspect(value, output); return output.text; }

try {
  let source = await readFile(process.cwd() + "/app/quan-tri/tu-van/[id]/page.tsx", "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("@/lib/repositories/profile-repository", profileModule)
    .replaceAll("@/lib/repositories/consultation-repository", repositoryModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/link", linkModule);
  const compiled = await transform(source, { loader: "tsx", format: "esm", jsx: "automatic", sourcefile: "page.tsx" });
  const pageCode = compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
  const page = (await import("data:text/javascript," + encodeURIComponent(pageCode))).default;
  const result = await page({
    params: Promise.resolve({ id: scenario.id }),
    searchParams: Promise.resolve(scenario.searchParams || {})
  });
  const output = { text: "", selects: [], options: [], forms: [] };
  inspect(result, output);
  console.log(JSON.stringify(output));
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.message ?? error) }));
}
`;

async function runAction(scenario: ActionScenario): Promise<{
  repoCalls: [string, string][];
  revalidateCalls: string[];
  error?: string;
  success?: boolean;
}> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "tsx/esm",
      "-e",
      actionRuntimeHarness,
      JSON.stringify(scenario)
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim());
}

async function runPage(scenario: PageScenario): Promise<{
  text?: string;
  selects?: { name: string; defaultValue?: string }[];
  options?: { value: string; text: string }[];
  forms?: { hasAction: boolean }[];
  error?: string;
}> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "tsx/esm",
      "-e",
      pageRuntimeHarness,
      JSON.stringify(scenario)
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim());
}

const validId = "11111111-1111-1111-1111-111111111111";

describe("Task 4.2-E-C: Admin consultation status UI & server action", () => {
  describe("Server Action: updateConsultationStatusAction", () => {
    test("anonymous action redirects to login with next return path before repository call", async () => {
      const result = await runAction({
        access: "anonymous",
        id: validId,
        formData: { status: "contacted" }
      });

      assert.equal(
        result.error,
        `REDIRECT:/dang-nhap?next=/quan-tri/tu-van/${validId}`
      );
      assert.deepEqual(result.repoCalls, []);
      assert.deepEqual(result.revalidateCalls, []);
    });

    test("non-admin is blocked with notFound before repository call", async () => {
      const result = await runAction({
        access: "non-admin",
        id: validId,
        formData: { status: "contacted" }
      });

      assert.equal(result.error, "NOT_FOUND");
      assert.deepEqual(result.repoCalls, []);
      assert.deepEqual(result.revalidateCalls, []);
    });

    test("unapproved admin is blocked with notFound before repository call", async () => {
      const result = await runAction({
        access: "unapproved",
        id: validId,
        formData: { status: "contacted" }
      });

      assert.equal(result.error, "NOT_FOUND");
      assert.deepEqual(result.repoCalls, []);
      assert.deepEqual(result.revalidateCalls, []);
    });

    test("valid admin submission calls repository with exact id and status only", async () => {
      const result = await runAction({
        access: "admin",
        id: validId,
        formData: {
          status: "contacted",
          role: "admin",
          userId: "malicious-user-id",
          notes: "unauthorized-extra-field"
        }
      });

      assert.deepEqual(result.repoCalls, [[validId, "contacted"]]);
      assert.equal(
        result.error,
        `REDIRECT:/quan-tri/tu-van/${validId}?success=1`
      );
    });

    test("covers all four canonical statuses: new, contacted, qualified, closed", async () => {
      const statuses = ["new", "contacted", "qualified", "closed"] as const;

      for (const status of statuses) {
        const result = await runAction({
          access: "admin",
          id: validId,
          formData: { status }
        });

        assert.deepEqual(result.repoCalls, [[validId, status]]);
        assert.equal(
          result.error,
          `REDIRECT:/quan-tri/tu-van/${validId}?success=1`
        );
      }
    });

    test("invalid id does not call repository and redirects with generic error flag", async () => {
      const invalidIds = ["bad-uuid", "12345", "not-a-uuid", "", "   "];

      for (const id of invalidIds) {
        const result = await runAction({
          access: "admin",
          id,
          formData: { status: "contacted" }
        });

        assert.deepEqual(result.repoCalls, []);
        assert.ok(result.error?.startsWith("REDIRECT:"));
        assert.ok(result.error?.includes("error=1"));
      }
    });

    test("invalid status does not call repository and redirects with generic error flag", async () => {
      const invalidStatuses = [
        "invalid",
        "pending",
        "deleted",
        "admin",
        "",
        "unknown_status"
      ];

      for (const status of invalidStatuses) {
        const result = await runAction({
          access: "admin",
          id: validId,
          formData: { status }
        });

        assert.deepEqual(result.repoCalls, []);
        assert.equal(
          result.error,
          `REDIRECT:/quan-tri/tu-van/${validId}?error=1`
        );
      }
    });

    test("missing status field does not call repository and redirects with generic error flag", async () => {
      const result = await runAction({
        access: "admin",
        id: validId,
        formData: {}
      });

      assert.deepEqual(result.repoCalls, []);
      assert.equal(
        result.error,
        `REDIRECT:/quan-tri/tu-van/${validId}?error=1`
      );
    });

    test("repository error redirects with fixed generic error flag and does not leak raw error or PII", async () => {
      const result = await runAction({
        access: "admin",
        id: validId,
        formData: { status: "closed" },
        repositoryError: true
      });

      assert.deepEqual(result.repoCalls, [[validId, "closed"]]);
      assert.equal(
        result.error,
        `REDIRECT:/quan-tri/tu-van/${validId}?error=1`
      );
      assert.ok(!result.error.includes("RAW_DATABASE_SECRET"));
      assert.ok(!result.error.includes("0901234567"));
      assert.ok(!result.error.includes("SQL"));
    });

    test("repository returning null redirects with fixed generic error flag", async () => {
      const result = await runAction({
        access: "admin",
        id: validId,
        formData: { status: "closed" },
        repositoryReturnsNull: true
      });

      assert.deepEqual(result.repoCalls, [[validId, "closed"]]);
      assert.equal(
        result.error,
        `REDIRECT:/quan-tri/tu-van/${validId}?error=1`
      );
    });

    test("success revalidates detail page and inbox paths before redirecting", async () => {
      const result = await runAction({
        access: "admin",
        id: validId,
        formData: { status: "qualified" }
      });

      assert.deepEqual(result.revalidateCalls, [
        `/quan-tri/tu-van/${validId}`,
        "/quan-tri/tu-van"
      ]);
      assert.equal(
        result.error,
        `REDIRECT:/quan-tri/tu-van/${validId}?success=1`
      );
    });
  });

  describe("UI Page: AdminConsultationDetailPage", () => {
    test("renders native server form with status select and exact canonical options", async () => {
      const result = await runPage({
        access: "admin",
        id: validId,
        status: "contacted"
      });

      assert.ok(result.forms?.length);
      assert.equal(result.forms[0].hasAction, true);

      const statusSelect = result.selects?.find((s) => s.name === "status");
      assert.ok(statusSelect, "Select name must be status");
      assert.equal(statusSelect.defaultValue, "contacted");

      const optionValues = result.options?.map((o) => o.value);
      assert.deepEqual(optionValues, ["new", "contacted", "qualified", "closed"]);

      assert.ok(result.text?.includes("Trạng thái hiện tại: contacted"));
      assert.ok(result.text?.includes("Cập nhật trạng thái tư vấn"));
      assert.ok(result.text?.includes("Lưu trạng thái"));
    });

    test("displays current status for all canonical values in status select and display dl", async () => {
      const statuses = ["new", "contacted", "qualified", "closed"] as const;

      for (const status of statuses) {
        const result = await runPage({
          access: "admin",
          id: validId,
          status
        });

        const statusSelect = result.selects?.find((s) => s.name === "status");
        assert.equal(statusSelect?.defaultValue, status);
        assert.ok(result.text?.includes(`Trạng thái hiện tại: ${status}`));
        assert.ok(result.text?.includes(`Trạng thái${status}`));
      }
    });

    test("renders fixed generic success message when known success flag is present", async () => {
      const result = await runPage({
        access: "admin",
        id: validId,
        searchParams: { success: "1" }
      });

      assert.ok(result.text?.includes("Cập nhật trạng thái thành công."));
      assert.ok(!result.text?.includes("Không thể cập nhật trạng thái"));
    });

    test("renders fixed generic error message when known error flag is present", async () => {
      const result = await runPage({
        access: "admin",
        id: validId,
        searchParams: { error: "1" }
      });

      assert.ok(
        result.text?.includes("Không thể cập nhật trạng thái tư vấn. Vui lòng thử lại sau.")
      );
      assert.ok(!result.text?.includes("Cập nhật trạng thái thành công."));
    });

    test("renders no success or error banner when query params are absent", async () => {
      const result = await runPage({
        access: "admin",
        id: validId,
        searchParams: {}
      });

      assert.ok(!result.text?.includes("Cập nhật trạng thái thành công."));
      assert.ok(!result.text?.includes("Không thể cập nhật trạng thái tư vấn. Vui lòng thử lại sau."));
    });

    test("preserves read-only consultation details and back link", async () => {
      const result = await runPage({
        access: "admin",
        id: validId,
        status: "new"
      });

      for (const value of [
        validId,
        "req-status-1",
        "Nguyen Van A",
        "0901234567",
        "Khoa Kinh Te",
        "Kinh Doanh",
        "Mon Hoc",
        "Tu Van",
        "Ghi chu hoc tap",
        "/khoa-hoc",
        "prod-slug",
        "subj-slug",
        "Quay lại danh sách tư vấn"
      ]) {
        assert.ok(result.text?.includes(value), `Should include ${value}`);
      }
    });
  });
});

