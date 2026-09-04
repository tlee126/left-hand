/** Runtime tests for the server-side admin account approval action. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, test } from "node:test";

const execFileAsync = promisify(execFile);
const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";

type AccessScenario =
  | "anonymous"
  | "non-admin"
  | "pending"
  | "rejected"
  | "suspended"
  | "profile-missing"
  | "admin";

type ActionScenario = {
  access: AccessScenario;
  id: string;
  formData?: Record<string, string>;
  fileReason?: boolean;
  repositoryReturnsNull?: boolean;
  repositoryError?: boolean;
};

type ActionResult = {
  accessCalls: number;
  repositoryCalls: unknown[][];
  revalidateCalls: string[];
  timeline: string[];
  error?: string;
};

const runtimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const scenario = JSON.parse(process.argv[1]);
const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const repositoryCalls = [];
const revalidateCalls = [];
const timeline = [];
let accessCalls = 0;

const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, profile: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", role: "student" } }
    : scenario.access === "pending"
      ? { status: "pending", user: { id: ADMIN_ID }, profile: { id: ADMIN_ID, role: "admin" } }
      : scenario.access === "rejected"
        ? { status: "rejected", user: { id: ADMIN_ID }, profile: { id: ADMIN_ID, role: "admin" } }
        : scenario.access === "suspended"
          ? { status: "suspended", user: { id: ADMIN_ID }, profile: { id: ADMIN_ID, role: "admin" } }
          : scenario.access === "profile-missing"
            ? { status: "profile_missing", user: { id: ADMIN_ID }, profile: null }
          : { status: "approved", user: { id: ADMIN_ID }, profile: { id: ADMIN_ID, role: "admin" } };

const authModule = "data:text/javascript,admin-approval-auth";
const repositoryModule = "data:text/javascript,admin-approval-repository";
const navigationModule = "data:text/javascript,admin-approval-navigation";
const cacheModule = "data:text/javascript,admin-approval-cache";

mock.module(authModule, {
  namedExports: {
    getAccountAccess: async () => {
      accessCalls += 1;
      timeline.push("guard");
      return access;
    }
  }
});
mock.module(repositoryModule, {
  namedExports: {
    isValidUuid: (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    updateAccountApproval: async (...args) => {
      timeline.push("repository");
      repositoryCalls.push(args);
      if (scenario.repositoryError) {
        throw new Error("RAW SQL password=secret nguyen@example.test 0901234567");
      }
      return scenario.repositoryReturnsNull ? null : { id: args[0], account_status: args[1].account_status };
    }
  }
});
mock.module(navigationModule, {
  namedExports: {
    redirect: (location) => { timeline.push("redirect"); throw new Error("REDIRECT:" + location); },
    notFound: () => { timeline.push("notFound"); throw new Error("NOT_FOUND"); }
  }
});
mock.module(cacheModule, {
  namedExports: {
    revalidatePath: (path) => { timeline.push("revalidate"); revalidateCalls.push(path); }
  }
});

try {
  let source = await readFile(process.cwd() + "/app/quan-tri/tai-khoan/actions.ts", "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("@/lib/repositories/account-approval-repository", repositoryModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/cache", cacheModule);
  const compiled = await transform(source, { loader: "ts", format: "esm", sourcefile: "actions.ts" });
  const mod = await import("data:text/javascript," + encodeURIComponent(compiled.code));
  let validationRecorded = false;
  const formData = {
    get(key) {
      if (!validationRecorded) {
        validationRecorded = true;
        timeline.push("validation");
      }
      if (scenario.fileReason && key === "rejection_reason") {
        return new Blob(["file reason"], { type: "text/plain" });
      }
      return scenario.formData?.[key] ?? null;
    }
  };
  await mod.updateAccountApprovalAction(scenario.id, formData);
  console.log(JSON.stringify({ accessCalls, repositoryCalls, revalidateCalls, timeline, error: "COMPLETED" }));
} catch (error) {
  console.log(JSON.stringify({ accessCalls, repositoryCalls, revalidateCalls, timeline, error: String(error?.message ?? error) }));
}
`;

async function runAction(scenario: ActionScenario): Promise<ActionResult> {
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
  return JSON.parse(stdout.trim()) as ActionResult;
}

function assertRedirect(result: ActionResult, location: string): void {
  assert.equal(result.error, `REDIRECT:${location}`);
}

describe("Task 3.1-F-B: admin account approval server actions", () => {
  test("has a module-level server directive, one exported action, and no unsafe imports", async () => {
    const source = await readFile("app/quan-tri/tai-khoan/actions.ts", "utf8");
    assert.match(source, /^"use server";/);
    assert.doesNotMatch(source, /@\/lib\/supabase\/browser/);
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
    assert.match(source, /export async function updateAccountApprovalAction/);
    assert.doesNotMatch(source, /export (const|let|var|type|interface|function)\s+(?!updateAccountApprovalAction)/);
  });

  test("anonymous redirects before the repository", async () => {
    const result = await runAction({ access: "anonymous", id: ACCOUNT_ID, formData: { status: "approved" } });
    assertRedirect(result, "/dang-nhap?next=/quan-tri/tai-khoan");
    assert.equal(result.accessCalls, 1);
    assert.deepEqual(result.repositoryCalls, []);
    assert.deepEqual(result.revalidateCalls, []);
    assert.deepEqual(result.timeline, ["guard", "redirect"]);
  });

  test("non-admin and every unapproved admin status are blocked before the repository", async () => {
    for (const access of ["non-admin", "pending", "rejected", "suspended"] as const) {
      const result = await runAction({ access, id: ACCOUNT_ID, formData: { status: "approved" } });
      assert.equal(result.error, "NOT_FOUND");
      assert.equal(result.accessCalls, 1);
      assert.deepEqual(result.repositoryCalls, []);
      assert.deepEqual(result.revalidateCalls, []);
      assert.deepEqual(result.timeline, ["guard", "notFound"]);
    }
  });

  test("profile-missing access is blocked before validation and the repository", async () => {
    const result = await runAction({ access: "profile-missing", id: ACCOUNT_ID, formData: { status: "approved" } });
    assert.equal(result.error, "NOT_FOUND");
    assert.deepEqual(result.timeline, ["guard", "notFound"]);
    assert.deepEqual(result.repositoryCalls, []);
    assert.deepEqual(result.revalidateCalls, []);
  });

  test("an admin cannot change their own account status", async () => {
    const result = await runAction({ access: "admin", id: ADMIN_ID, formData: { status: "suspended" } });
    assert.equal(result.error, "NOT_FOUND");
    assert.deepEqual(result.repositoryCalls, []);
    assert.deepEqual(result.timeline, ["guard", "notFound"]);
  });

  test("invalid UUIDs and invalid statuses do not call the repository", async () => {
    for (const id of ["bad", "", "12345", "550e8400-e29b-41d4-a716-44665544000"]) {
      const result = await runAction({ access: "admin", id, formData: { status: "approved" } });
      assertRedirect(result, "/quan-tri/tai-khoan?error=1");
      assert.deepEqual(result.repositoryCalls, []);
      assert.deepEqual(result.timeline, ["guard", "validation", "redirect"]);
    }

    for (const status of ["", "pending", "deleted", "admin"]) {
      const result = await runAction({ access: "admin", id: ACCOUNT_ID, formData: { status } });
      assertRedirect(result, "/quan-tri/tai-khoan?error=1");
      assert.deepEqual(result.repositoryCalls, []);
      assert.deepEqual(result.timeline, ["guard", "validation", "redirect"]);
    }
  });

  test("accepts exactly approved, rejected, and suspended", async () => {
    for (const status of ["approved", "rejected", "suspended"] as const) {
      const result = await runAction({ access: "admin", id: ACCOUNT_ID, formData: { status } });
      assert.deepEqual(result.repositoryCalls, [[ACCOUNT_ID, { account_status: status, rejection_reason: null }]]);
      assertRedirect(result, "/quan-tri/tai-khoan?success=1");
      assert.deepEqual(result.timeline, ["guard", "validation", "repository", "revalidate", "redirect"]);
    }
  });

  test("rejects with a trimmed reason and only sends permitted fields", async () => {
    const result = await runAction({
      access: "admin",
      id: ACCOUNT_ID,
      formData: {
        status: "rejected",
        rejection_reason: "  Hồ sơ chưa đủ thông tin  ",
        role: "admin",
        userId: "attacker",
        user_id: "attacker",
        approved_by: "attacker",
        approved_at: "tomorrow",
        email: "attacker@example.test",
        id: "other-id",
        arbitrary: "ignored"
      }
    });
    assert.deepEqual(result.repositoryCalls, [[
      ACCOUNT_ID,
      { account_status: "rejected", rejection_reason: "Hồ sơ chưa đủ thông tin" }
    ]]);
    assertRedirect(result, "/quan-tri/tai-khoan?success=1");
  });

  test("suspension ignores arbitrary client fields and clears rejection reason", async () => {
    const result = await runAction({
      access: "admin",
      id: ACCOUNT_ID,
      formData: {
        status: "suspended",
        rejection_reason: "should not be saved",
        role: "student",
        userId: "other",
        approved_by: "other",
        approved_at: "other",
        email: "other@example.test",
        phone: "0901234567",
        id: "other",
        arbitrary: "other"
      }
    });
    assert.deepEqual(result.repositoryCalls, [[ACCOUNT_ID, { account_status: "suspended", rejection_reason: null }]]);
  });

  test("rejects non-string rejection reasons and bounds long reasons", async () => {
    const invalid = await runAction({ access: "admin", id: ACCOUNT_ID, formData: { status: "rejected" }, fileReason: true });
    assertRedirect(invalid, "/quan-tri/tai-khoan?error=1");
    assert.deepEqual(invalid.repositoryCalls, []);
    assert.deepEqual(invalid.timeline, ["guard", "validation", "redirect"]);

    const longReason = " x ".repeat(400);
    const bounded = await runAction({ access: "admin", id: ACCOUNT_ID, formData: { status: "rejected", rejection_reason: longReason } });
    assert.equal(bounded.repositoryCalls.length, 1);
    const payload = bounded.repositoryCalls[0][1] as { rejection_reason: string };
    assert.ok(payload.rejection_reason.length <= 500);
    assert.deepEqual(bounded.timeline, ["guard", "validation", "repository", "revalidate", "redirect"]);
  });

  test("maps a missing account to a fixed not_found redirect", async () => {
    const result = await runAction({ access: "admin", id: ACCOUNT_ID, formData: { status: "approved" }, repositoryReturnsNull: true });
    assertRedirect(result, "/quan-tri/tai-khoan?error=not_found");
    assert.deepEqual(result.revalidateCalls, []);
    assert.deepEqual(result.timeline, ["guard", "validation", "repository", "redirect"]);
  });

  test("maps repository errors to a fixed generic error without leaking raw data", async () => {
    const result = await runAction({ access: "admin", id: ACCOUNT_ID, formData: { status: "approved" }, repositoryError: true });
    assertRedirect(result, "/quan-tri/tai-khoan?error=1");
    assert.ok(!result.error?.includes("RAW SQL"));
    assert.ok(!result.error?.includes("nguyen@example.test"));
    assert.ok(!result.error?.includes("0901234567"));
    assert.deepEqual(result.revalidateCalls, []);
    assert.deepEqual(result.timeline, ["guard", "validation", "repository", "redirect"]);
  });

  test("revalidates the account path and redirects with a fixed success flag", async () => {
    const result = await runAction({ access: "admin", id: ACCOUNT_ID, formData: { status: "approved" } });
    assert.deepEqual(result.revalidateCalls, ["/quan-tri/tai-khoan"]);
    assertRedirect(result, "/quan-tri/tai-khoan?success=1");
    assert.deepEqual(result.timeline, ["guard", "validation", "repository", "revalidate", "redirect"]);
  });

  test("preserves redirect and notFound control-flow exceptions", async () => {
    const anonymous = await runAction({ access: "anonymous", id: "not-a-uuid", formData: {} });
    assert.equal(anonymous.error, "REDIRECT:/dang-nhap?next=/quan-tri/tai-khoan");
    assert.deepEqual(anonymous.timeline, ["guard", "redirect"]);

    const blocked = await runAction({ access: "non-admin", id: "not-a-uuid", formData: {} });
    assert.equal(blocked.error, "NOT_FOUND");
    assert.deepEqual(blocked.timeline, ["guard", "notFound"]);
  });
});
