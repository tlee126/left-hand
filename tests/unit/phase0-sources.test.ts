import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadPublishedHomepageCatalog } from "../../app/page";
import { buildFeaturedResources } from "../../components/site/featured-resources";
import {
  getInterestGroups,
  resolveCtaMetadata,
  type ConsultationCatalog
} from "../../components/site/consultation-form";

const execFileAsync = promisify(execFile);

const demoAuthRuntimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import * as path from "node:path";

const scenario = JSON.parse(process.argv[1]);
process.env.NODE_ENV = scenario.nodeEnv;
process.env.NEXT_PUBLIC_DEMO_MODE = scenario.demoFlag ? "true" : "false";
process.env.NEXT_PUBLIC_DEMO_EMAIL = scenario.demoEmail;
process.env.NEXT_PUBLIC_DEMO_PASSWORD = scenario.demoPassword;

let stateCursor = 0;
const state = [];
const effects = [];
let signInCalls = 0;
let localStorageReads = 0;
let localStorageWrites = 0;
let localStorageRemoves = 0;

const reactModule = "data:text/javascript,phase0-react";
const authClientModule = "data:text/javascript,phase0-browser-client";
const signupModule = "data:text/javascript,phase0-signup";

function useState(initialValue) {
  const index = stateCursor++;
  if (!(index in state)) state[index] = initialValue;
  return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
}
function useEffect(effect) { effects.push(effect); }
function useTransition() { return [false, (callback) => callback()]; }

const authClient = {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async ({ email }) => {
      signInCalls++;
      return {
        data: { user: { id: "real-user", email, user_metadata: { full_name: "Real User" } } },
        error: null
      };
    },
    signOut: async () => ({ error: null })
  }
};

const localStorage = {
  getItem() { localStorageReads++; return scenario.storedDemo ? "true" : null; },
  setItem() { localStorageWrites++; },
  removeItem() { localStorageRemoves++; }
};
globalThis.window = { localStorage };
globalThis.localStorage = localStorage;

mock.module(reactModule, { namedExports: { useState, useEffect, useTransition } });
mock.module(authClientModule, { namedExports: { createClient: () => authClient } });
mock.module(signupModule, {
  namedExports: {
    performSignup: async () => ({ success: true }),
    mapSignupError: (error) => String(error),
    getValidCallbackUrl: () => undefined,
    validateSignupInput: () => ({ isValid: true }),
    validateSignupFullName: () => ({ isValid: true })
  }
});

const source = await readFile(path.resolve(process.cwd(), "hooks/use-demo-auth.ts"), "utf8");
const compiled = await transform(source, {
  loader: "tsx",
  format: "esm",
  sourcefile: "use-demo-auth.ts"
});
const hookCode = compiled.code
  .replaceAll('"react"', JSON.stringify(reactModule))
  .replaceAll('"@/lib/supabase/browser"', JSON.stringify(authClientModule))
  .replaceAll('"@/lib/auth/signup"', JSON.stringify(signupModule));
const hook = (await import("data:text/javascript," + encodeURIComponent(hookCode))).useDemoAuth;

const auth = hook();
if (effects[0]) effects[0]();
await new Promise((resolve) => setTimeout(resolve, 0));
const loginResult = await auth.login(scenario.loginEmail, scenario.loginPassword);
await auth.logout();

console.log(JSON.stringify({
  isDemoMode: auth.isDemoMode,
  demoEmail: auth.demoEmail,
  loginResult,
  signInCalls,
  localStorageReads,
  localStorageWrites,
  localStorageRemoves
}));
`;

async function runDemoAuthScenario(scenario: Record<string, unknown>) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", demoAuthRuntimeHarness, JSON.stringify(scenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as {
    isDemoMode: boolean;
    demoEmail: string;
    loginResult: { success: boolean; error?: string };
    signInCalls: number;
    localStorageReads: number;
    localStorageWrites: number;
    localStorageRemoves: number;
  };
}

const dbCatalog: ConsultationCatalog = {
  materials: [{
    id: "db-material",
    slug: "db-material-slug",
    title: "Tên tài liệu mới từ DB",
    subject: "Môn DB mới",
    subjectSlug: "mon-db-moi",
    facultyGroup: "UFM",
    category: "Kế toán",
    type: "TÀI LIỆU",
    description: "DB material",
    price: "10.000đ",
    pages: 10,
    tags: ["DB"],
    rating: 4.5,
    isHot: true,
    colorTheme: "accounting"
  }],
  courses: [],
  tutors: []
};

describe("Phase 0 source and runtime boundaries", () => {
  test("homepage loader passes changed repository fixtures to homepage consumers and has no static fallback", async () => {
    const changedCatalog = {
      ...dbCatalog,
      courses: [{
        id: "db-course",
        slug: "db-course-slug",
        title: "Khóa học mới từ DB",
        subject: "Môn DB mới",
        subjectSlug: "mon-db-moi",
        category: "Marketing" as const,
        format: "online" as const,
        sessions: 2,
        duration: "2 giờ",
        schedule: "Linh hoạt",
        description: "DB course",
        price: "20.000đ",
        status: "open" as const,
        mentor: "DB mentor",
        tags: ["DB"],
        rating: 4.5,
        colorTheme: "marketing" as const
      }]
    };
    const loaded = await loadPublishedHomepageCatalog({
      listPublishedMaterials: async () => changedCatalog.materials,
      listPublishedCourses: async () => changedCatalog.courses,
      listPublishedTutors: async () => []
    });

    assert.strictEqual(loaded.loadError, false);
    assert.strictEqual(loaded.catalog.materials[0].title, "Tên tài liệu mới từ DB");
    assert.strictEqual(loaded.catalog.courses[0].title, "Khóa học mới từ DB");

    const resources = buildFeaturedResources(loaded.catalog.materials, loaded.catalog.courses);
    const groups = getInterestGroups(loaded.catalog);
    assert.ok(resources.some((item) => item.title === "Tên tài liệu mới từ DB"));
    assert.ok(groups.some((group) => group.items.some((item) => item.label === "Môn DB mới")));
    const cta = resolveCtaMetadata("?interest=db-material-slug&type=material", "/", loaded.catalog);
    assert.strictEqual(cta.resolvedInterest, "Môn DB mới");
    assert.strictEqual(cta.selectedSubjectSlug, "mon-db-moi");
  });

  test("homepage loader renders safe empty/error state instead of falling back to static catalog", async () => {
    const loaded = await loadPublishedHomepageCatalog({
      listPublishedMaterials: async () => { throw new Error("database unavailable"); },
      listPublishedCourses: async () => [],
      listPublishedTutors: async () => []
    });
    assert.strictEqual(loaded.loadError, true);
    assert.deepStrictEqual(loaded.catalog, { materials: [], courses: [], tutors: [] });
  });

  test("production modules have no direct static catalog imports or demo password literals", async () => {
    const files = ["app/page.tsx", "components/site/featured-resources.tsx", "components/site/consultation-form.tsx", "hooks/use-demo-auth.ts", "app/dang-nhap/page.tsx", "data/student-demo.ts"];
    const contents = await Promise.all(files.map((file) => fs.readFile(path.resolve(process.cwd(), file), "utf8")));
    const source = contents.join("\n");
    assert.doesNotMatch(source, /@\/data\/catalog/);
    assert.doesNotMatch(source, /123456|demo@lefthand\.vn/);
  });

  test("README documents the current stack, commands, migrations, and explicit backlog", async () => {
    const readme = await fs.readFile(path.resolve(process.cwd(), "README.md"), "utf8");
    for (const entry of [
      "Next.js App Router",
      "Supabase",
      "npm run verify:db",
      "npm run typecheck",
      "npm test",
      "npm run build",
      "0001",
      "0017",
      "Order/cart",
      "Checkout, payment và webhook",
      "Tutor booking/room",
      "Notifications/email",
      "CI/E2E production",
      "Staging/production runbook"
    ]) {
      assert.ok(readme.includes(entry), `README must contain ${entry}`);
    }
    assert.doesNotMatch(readme, /catalog hiện vẫn sử dụng dữ liệu tĩnh/i);
    assert.doesNotMatch(readme, /payment production-ready/i);
  });

  test("development/test demo mode uses local fixture credentials", async () => {
    const result = await runDemoAuthScenario({
      nodeEnv: "test",
      demoFlag: true,
      demoEmail: "local-demo@example.test",
      demoPassword: "local-demo-pass",
      loginEmail: "local-demo@example.test",
      loginPassword: "local-demo-pass",
      storedDemo: false
    });
    assert.strictEqual(result.isDemoMode, true);
    assert.strictEqual(result.loginResult.success, true);
    assert.strictEqual(result.signInCalls, 0);
    assert.ok(Number(result.localStorageWrites) > 0);
  });

  test("production ignores demo flag and localStorage, then uses Supabase password auth", async () => {
    const result = await runDemoAuthScenario({
      nodeEnv: "production",
      demoFlag: true,
      demoEmail: "local-demo@example.test",
      demoPassword: "local-demo-pass",
      loginEmail: "local-demo@example.test",
      loginPassword: "local-demo-pass",
      storedDemo: true
    });
    assert.strictEqual(result.isDemoMode, false);
    assert.strictEqual(result.demoEmail, "");
    assert.strictEqual(result.loginResult.success, true);
    assert.strictEqual(result.signInCalls, 1);
    assert.strictEqual(result.localStorageReads, 0);
    assert.strictEqual(result.localStorageWrites, 0);
    assert.strictEqual(result.localStorageRemoves, 0);
  });
});
