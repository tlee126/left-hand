import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

type Scenario = {
  target: "layout" | "page" | "shell" | "ca-nhan";
  access:
    | "anonymous"
    | "pending"
    | "rejected"
    | "suspended"
    | "profile_missing"
    | "student"
    | "tutor"
    | "admin";
  role?: string;
  params?: Record<string, string>;
  customAccess?: Record<string, unknown>;
};

type ScenarioResult = {
  text?: string;
  links?: { href: string; text: string }[];
  clientCalls?: unknown[];
  clientRenders?: unknown[];
  error?: string;
  success?: boolean;
};

const runtimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
const clientCalls = [];

const access = scenario.customAccess
  ? scenario.customAccess
  : scenario.access === "anonymous"
    ? { status: "unauthenticated", user: null, profile: null }
    : scenario.access === "pending"
      ? {
          status: "pending",
          user: { id: "user-1", email: "user@lefthand.vn" },
          profile: { role: scenario.role || "student", accountStatus: "pending" }
        }
      : scenario.access === "rejected"
        ? {
            status: "rejected",
            user: { id: "user-1", email: "user@lefthand.vn" },
            profile: { role: scenario.role || "student", accountStatus: "rejected" }
          }
        : scenario.access === "suspended"
          ? {
              status: "suspended",
              user: { id: "user-1", email: "user@lefthand.vn" },
              profile: { role: scenario.role || "student", accountStatus: "suspended" }
            }
          : scenario.access === "profile_missing"
            ? {
                status: "profile_missing",
                user: { id: "user-1", email: "user@lefthand.vn" },
                profile: null
              }
            : scenario.access === "student"
              ? {
                  status: "approved",
                  user: { id: "user-student", email: "student@lefthand.vn" },
                  profile: {
                    role: "student",
                    accountStatus: "approved",
                    fullName: "Sinh Vien A"
                  }
                }
              : scenario.access === "tutor"
                ? {
                    status: "approved",
                    user: { id: "user-tutor", email: "tutor@lefthand.vn" },
                    profile: {
                      role: "tutor",
                      accountStatus: "approved",
                      fullName: "Tutor B"
                    }
                  }
                : scenario.access === "admin"
                  ? {
                      status: "approved",
                      user: { id: "user-admin", email: "admin@lefthand.vn" },
                      profile: {
                        role: "admin",
                        accountStatus: "approved",
                        fullName: "Quản trị viên"
                      }
                    }
                  : { status: "unauthenticated", user: null, profile: null };

const authModule = "data:text/javascript,auth-module";
const navigationModule = "data:text/javascript,navigation-module";
const linkModule = "data:text/javascript,link-module";
const jsxRuntimeModule = "data:text/javascript,jsx-runtime-module";
const dashboardClientModule = "data:text/javascript,dashboard-client-module";

mock.module(authModule, { namedExports: { getAccountAccess: async () => access } });
mock.module(navigationModule, {
  namedExports: {
    redirect: (location) => {
      throw new Error("REDIRECT:" + location);
    },
    notFound: () => {
      throw new Error("NOT_FOUND");
    }
  }
});
mock.module(linkModule, {
  namedExports: {
    default: (props) => ({ type: "a", props })
  }
});
mock.module(jsxRuntimeModule, {
  namedExports: {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props })
  }
});
mock.module(dashboardClientModule, {
  namedExports: {
    StudentDashboardClient: (props) => {
      clientCalls.push(props);
      return { type: "StudentDashboardClient", props };
    }
  }
});

function inspect(value, output) {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return;
  }
  if (typeof value === "string") {
    output.text += " " + value;
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => inspect(item, output));
    return;
  }
  if (typeof value.type === "function") {
    inspect(value.type(value.props), output);
    return;
  }
  if (value.type === "StudentDashboardClient") {
    output.clientRenders.push(value.props);
  }
  if (value.props) {
    if (value.type === "a" || value.type === "Link") {
      output.links.push({
        href: value.props.href,
        text: textOf(value.props.children)
      });
    }
    inspect(value.props.children, output);
  }
}

function textOf(value) {
  const output = { text: "", links: [], clientRenders: [] };
  inspect(value, output);
  return output.text.trim();
}

async function compileAndLoad(filePath, isCaNhan = false) {
  let source = await readFile(filePath, "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/link", linkModule);
  if (isCaNhan) {
    source = source.replaceAll("./dashboard-client", dashboardClientModule);
  }
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
  const output = { text: "", links: [], clientCalls, clientRenders: [], success: true };
  if (scenario.target === "layout") {
    const layoutFn = await compileAndLoad(path.resolve(process.cwd(), "app/quan-tri/layout.tsx"));
    const rendered = await layoutFn({
      children: { type: "div", props: { children: "ADMIN_CHILDREN_CONTENT" } }
    });
    inspect(rendered, output);
  } else if (scenario.target === "page") {
    const pageFn = await compileAndLoad(path.resolve(process.cwd(), "app/quan-tri/page.tsx"));
    const rendered = await pageFn();
    inspect(rendered, output);
  } else if (scenario.target === "shell") {
    const layoutFn = await compileAndLoad(path.resolve(process.cwd(), "app/quan-tri/layout.tsx"));
    const pageFn = await compileAndLoad(path.resolve(process.cwd(), "app/quan-tri/page.tsx"));
    const pageChild = await pageFn();
    const rendered = await layoutFn({ children: pageChild });
    inspect(rendered, output);
  } else if (scenario.target === "ca-nhan") {
    const caNhanFn = await compileAndLoad(path.resolve(process.cwd(), "app/ca-nhan/page.tsx"), true);
    const rendered = await caNhanFn({ searchParams: Promise.resolve(scenario.params ?? {}) });
    inspect(rendered, output);
  }
  console.log(JSON.stringify(output));
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.message ?? error), clientCalls }));
}
`;

async function runScenario(scenario: Scenario): Promise<ScenarioResult> {
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
  return JSON.parse(stdout.trim());
}

describe("Task 4.2: Admin shell and role-aware routing", () => {
  describe("1. Static security contracts & Server-component rules", () => {
    test("app/quan-tri/layout.tsx is a server component without client directives or unsafe APIs", async () => {
      const code = await fs.readFile(
        path.resolve(process.cwd(), "app/quan-tri/layout.tsx"),
        "utf-8"
      );
      assert.ok(!code.includes('"use client"'), "Layout must not have 'use client'");
      assert.ok(!code.includes("'use client'"), "Layout must not have 'use client'");
      assert.ok(!code.includes("@/lib/supabase/client"), "Layout must not use browser supabase");
      assert.ok(!code.includes("SUPABASE_SERVICE_ROLE_KEY"), "Layout must not use service role key");
      assert.ok(!code.includes("service_role"), "Layout must not use service role");
      assert.ok(!code.includes("localStorage"), "Layout must not use localStorage");
    });

    test("app/quan-tri/page.tsx is a server component without client directives or fake statistics", async () => {
      const code = await fs.readFile(
        path.resolve(process.cwd(), "app/quan-tri/page.tsx"),
        "utf-8"
      );
      assert.ok(!code.includes('"use client"'), "Admin page must not have 'use client'");
      assert.ok(!code.includes("'use client'"), "Admin page must not have 'use client'");
      assert.ok(!code.includes("@/lib/supabase/client"), "Admin page must not use browser supabase");
      assert.ok(!code.includes("SUPABASE_SERVICE_ROLE_KEY"), "Admin page must not use service role key");
    });
  });

  describe("2. Admin Shell Layout & Access Control (/quan-tri)", () => {
    test("anonymous visiting /quan-tri redirects to /dang-nhap?next=/quan-tri", async () => {
      const result = await runScenario({ target: "layout", access: "anonymous" });
      assert.equal(result.error, "REDIRECT:/dang-nhap?next=/quan-tri");
    });

    test("anonymous visiting full admin shell (/quan-tri) redirects to /dang-nhap?next=/quan-tri", async () => {
      const result = await runScenario({ target: "shell", access: "anonymous" });
      assert.equal(result.error, "REDIRECT:/dang-nhap?next=/quan-tri");
    });

    test("approved student is blocked with notFound", async () => {
      const result = await runScenario({ target: "shell", access: "student" });
      assert.equal(result.error, "NOT_FOUND");
    });

    test("approved tutor is blocked with notFound", async () => {
      const result = await runScenario({ target: "shell", access: "tutor" });
      assert.equal(result.error, "NOT_FOUND");
    });

    test("pending user is blocked with notFound", async () => {
      const result = await runScenario({ target: "shell", access: "pending" });
      assert.equal(result.error, "NOT_FOUND");
    });

    test("pending admin is blocked with notFound", async () => {
      const result = await runScenario({
        target: "shell",
        access: "pending",
        role: "admin"
      });
      assert.equal(result.error, "NOT_FOUND");
    });

    test("rejected user is blocked with notFound", async () => {
      const result = await runScenario({ target: "shell", access: "rejected" });
      assert.equal(result.error, "NOT_FOUND");
    });

    test("suspended user is blocked with notFound", async () => {
      const result = await runScenario({ target: "shell", access: "suspended" });
      assert.equal(result.error, "NOT_FOUND");
    });

    test("profile-missing user is blocked with notFound", async () => {
      const result = await runScenario({ target: "shell", access: "profile_missing" });
      assert.equal(result.error, "NOT_FOUND");
    });

    test("approved admin can render /quan-tri shell and landing page", async () => {
      const result = await runScenario({ target: "shell", access: "admin" });
      assert.equal(result.error, undefined, "Approved admin should not throw error");
      assert.ok(result.text?.includes("Quản trị LEFT HAND"));
      assert.ok(result.text?.includes("Tư vấn"));
      assert.ok(!result.text?.includes("Hộp thư tư vấn"));
    });

    test("admin shell contains links to /quan-tri and /quan-tri/tu-van", async () => {
      const result = await runScenario({ target: "layout", access: "admin" });
      assert.equal(result.error, undefined);

      const hasHomeLink = result.links?.some((link) => link.href === "/quan-tri");
      const hasTuVanLink = result.links?.some((link) => link.href === "/quan-tri/tu-van");

      assert.ok(hasHomeLink, "Shell layout must contain link to /quan-tri");
      assert.ok(hasTuVanLink, "Shell layout must contain link to /quan-tri/tu-van");
      assert.ok(result.text?.includes("Quản trị LEFT HAND"), "Shell must be titled 'Quản trị LEFT HAND'");
    });

    test("approved admin shell contains an exact link back to the public home page", async () => {
      const result = await runScenario({ target: "layout", access: "admin" });
      assert.equal(result.error, undefined);

      assert.ok(
        result.links?.some((link) => link.href === "/" && link.text === "Về trang chủ"),
        "Approved admin shell must contain a link to the public home page labeled 'Về trang chủ'"
      );
    });

    test("admin landing page shows admin area title and link to /quan-tri/tu-van", async () => {
      const result = await runScenario({ target: "page", access: "admin" });
      assert.equal(result.error, undefined);
      assert.ok(result.text?.includes("Quản trị LEFT HAND"));

      const hasTuVanLink = result.links?.some((link) => link.href === "/quan-tri/tu-van");
      assert.ok(hasTuVanLink, "Landing page must contain link to /quan-tri/tu-van");
    });

    test("admin output contains no student metrics, subjects, GPA, or study-plan content", async () => {
      const result = await runScenario({ target: "shell", access: "admin" });
      assert.equal(result.error, undefined);

      const forbiddenTerms = [
        "mục tiêu gpa",
        "gpa goal",
        "kỳ thi gần nhất",
        "streak học tập",
        "hôm nay đã học",
        "môn đã mua",
        "tiến độ tuần",
        "kế hoạch hôm nay",
        "môn học của bạn",
        "studentdashboardclient",
        "gpa"
      ];

      const renderedText = (result.text ?? "").toLowerCase();
      for (const term of forbiddenTerms) {
        assert.ok(
          !renderedText.includes(term),
          `Admin output must not contain student content: "${term}"`
        );
      }
    });
  });

  describe("3. Personal Dashboard Routing & Admin Redirect (/ca-nhan)", () => {
    test("approved admin visiting /ca-nhan redirects to /quan-tri before StudentDashboardClient renders", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "admin" });
      assert.equal(result.error, "REDIRECT:/quan-tri");
      assert.equal(
        result.clientCalls?.length,
        0,
        "StudentDashboardClient must never be invoked for admin"
      );
    });

    test("approved student visiting /ca-nhan still renders StudentDashboardClient", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "student" });
      assert.equal(result.error, undefined, "Student should not be redirected away from ca-nhan");
      assert.equal(
        result.clientCalls?.length,
        1,
        "StudentDashboardClient must be rendered for student"
      );
    });

    test("approved tutor visiting /ca-nhan renders StudentDashboardClient", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "tutor" });
      assert.equal(result.error, undefined, "Tutor should not be redirected away from ca-nhan");
      assert.equal(
        result.clientCalls?.length,
        1,
        "StudentDashboardClient must be rendered for tutor"
      );
    });

    test("anonymous visiting /ca-nhan preserves login redirect with safe next parameter", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "anonymous" });
      assert.equal(result.error, "REDIRECT:/dang-nhap?next=%2Fca-nhan");
      assert.equal(result.clientCalls?.length, 0);
    });

    test("pending user visiting /ca-nhan redirects to /cho-duyet", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "pending" });
      assert.equal(result.error, "REDIRECT:/cho-duyet");
      assert.equal(result.clientCalls?.length, 0);
    });

    test("rejected user visiting /ca-nhan redirects to /cho-duyet?status=rejected", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "rejected" });
      assert.equal(result.error, "REDIRECT:/cho-duyet?status=rejected");
      assert.equal(result.clientCalls?.length, 0);
    });

    test("suspended user visiting /ca-nhan redirects to /cho-duyet?status=suspended", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "suspended" });
      assert.equal(result.error, "REDIRECT:/cho-duyet?status=suspended");
      assert.equal(result.clientCalls?.length, 0);
    });

    test("profile-missing user visiting /ca-nhan redirects to /cho-duyet?status=missing-profile", async () => {
      const result = await runScenario({ target: "ca-nhan", access: "profile_missing" });
      assert.equal(result.error, "REDIRECT:/cho-duyet?status=missing-profile");
      assert.equal(result.clientCalls?.length, 0);
    });
  });
});
