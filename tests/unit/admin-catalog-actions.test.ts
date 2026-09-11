/** Runtime-mock tests for the admin catalog server actions. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, test } from "node:test";

const execFileAsync = promisify(execFile);
const SUBJECT_ID = "11111111-1111-1111-1111-111111111111";
const PRODUCT_ID = "22222222-2222-2222-2222-222222222222";
const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

type ActionName =
  | "createSubjectAction"
  | "updateSubjectAction"
  | "deleteSubjectAction"
  | "createMaterialAction"
  | "updateMaterialAction"
  | "deleteMaterialAction"
  | "createCourseAction"
  | "updateCourseAction"
  | "deleteCourseAction"
  | "createTutorAction"
  | "updateTutorAction"
  | "deleteTutorAction";

type Scenario = {
  action: ActionName;
  access?: "anonymous" | "non-admin" | "pending" | "rejected" | "suspended" | "profile-missing" | "admin";
  id?: string;
  input?: Record<string, unknown>;
  repositoryError?: boolean;
  repositoryReturnsNull?: boolean;
  repositoryReturnsFalse?: boolean;
};

type Result = {
  repositoryCalls: Array<{ name: string; args: unknown[] }>;
  revalidateCalls: string[];
  timeline: string[];
  error: string;
};

const runtimeHarness = String.raw`
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import { mock } from "node:test";

const scenario = JSON.parse(process.argv[1]);
const repositoryCalls = [];
const revalidateCalls = [];
const timeline = [];
let validationStarted = false;
const markValidation = () => {
  if (!validationStarted) {
    validationStarted = true;
    timeline.push("validation");
  }
};

const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "non-admin"
    ? { status: "approved", user: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, profile: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", role: "student" } }
    : scenario.access === "pending"
      ? { status: "pending", user: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, profile: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", role: "admin" } }
      : scenario.access === "rejected"
        ? { status: "rejected", user: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, profile: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", role: "admin" } }
        : scenario.access === "suspended"
          ? { status: "suspended", user: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, profile: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", role: "admin" } }
          : scenario.access === "profile-missing"
            ? { status: "profile_missing", user: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }, profile: null }
            : { status: "approved", user: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }, profile: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "admin" } };

const authModule = "data:text/javascript,admin-catalog-auth";
const repositoryModule = "data:text/javascript,admin-catalog-repository";
const navigationModule = "data:text/javascript,admin-catalog-navigation";
const cacheModule = "data:text/javascript,admin-catalog-cache";

mock.module(authModule, {
  namedExports: {
    getAccountAccess: async () => {
      timeline.push("guard");
      return access;
    }
  }
});

const recordRepository = (name, args) => {
  markValidation();
  timeline.push("repository");
  repositoryCalls.push({ name, args });
  if (scenario.repositoryError) throw new Error("RAW SQL secret=jwt PII@example.test 0901234567");
  if (scenario.repositoryReturnsFalse) return false;
  if (scenario.repositoryReturnsNull) return null;
  return { id: args[0] ?? "created-id", slug: "safe-slug" };
};

mock.module(repositoryModule, {
  namedExports: {
    isValidUuid: (value) => {
      markValidation();
      return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    },
    isValidCatalogSlug: (value) => {
      markValidation();
      return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
    },
    createAdminSubject: async (...args) => recordRepository("createAdminSubject", args),
    updateAdminSubject: async (...args) => recordRepository("updateAdminSubject", args),
    deleteAdminSubject: async (...args) => recordRepository("deleteAdminSubject", args),
    createAdminMaterial: async (...args) => recordRepository("createAdminMaterial", args),
    updateAdminMaterial: async (...args) => recordRepository("updateAdminMaterial", args),
    updateAdminMaterialDownloadPermission: async (...args) => recordRepository("updateAdminMaterialDownloadPermission", args),
    deleteAdminMaterial: async (...args) => recordRepository("deleteAdminMaterial", args),
    createAdminCourse: async (...args) => recordRepository("createAdminCourse", args),
    updateAdminCourse: async (...args) => recordRepository("updateAdminCourse", args),
    deleteAdminCourse: async (...args) => recordRepository("deleteAdminCourse", args),
    createAdminTutor: async (...args) => recordRepository("createAdminTutor", args),
    updateAdminTutor: async (...args) => recordRepository("updateAdminTutor", args),
    deleteAdminTutor: async (...args) => recordRepository("deleteAdminTutor", args)
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

const domainSubjectsModule = "data:text/javascript," + encodeURIComponent("export const CATEGORIES = ['Kế toán','Kinh tế','Thống kê','Marketing','Quản trị','Tài chính','MIS','Luật','Ngoại ngữ']; export const COLOR_THEMES = ['accounting','economics','statistics','marketing','management','finance','law','mis','languages'];");
const domainProductTypesModule = "data:text/javascript," + encodeURIComponent("export const DELIVERY_KINDS = ['digital_download','live_session','recorded_video','one_on_one_tutoring']; export const PUBLICATION_STATUSES = ['draft','published','archived']; export const COURSE_FORMATS = ['online','offline','video','zoom']; export const ENROLLMENT_STATUSES = ['open','coming-soon','full']; export const TUTOR_FORMATS = ['1:1 & Nhóm nhỏ (Online/Offline)','1:1 (Online/Offline quận 7)','1:1 & Nhóm nhỏ (Online)','1:1 (Online qua Google Meet)','1:1 & Nhóm nhỏ (Offline/Online)','1:1 (Online)','1:1 & Nhóm nhỏ (Online/Offline Q7)']; export const isValidVND = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;");

try {
  let source = await readFile(process.cwd() + "/app/quan-tri/catalog/actions.ts", "utf8");
  source = source
    .replaceAll("@/lib/auth/session", authModule)
    .replaceAll("@/lib/repositories/admin-catalog-repository", repositoryModule)
    .replaceAll("@/lib/domain/subjects", domainSubjectsModule)
    .replaceAll("@/lib/domain/product-types", domainProductTypesModule)
    .replaceAll("next/navigation", navigationModule)
    .replaceAll("next/cache", cacheModule);
  const compiled = await transform(source, { loader: "ts", format: "esm", sourcefile: "actions.ts" });
  const mod = await import("data:text/javascript," + encodeURIComponent(compiled.code));
  const rawInput = scenario.input ?? {};
  const input = new Proxy(rawInput, {
    ownKeys(target) {
      markValidation();
      return Reflect.ownKeys(target);
    }
  });
  const action = mod[scenario.action];
  if (scenario.action.startsWith("create")) {
    await action(input);
  } else if (scenario.action.startsWith("update")) {
    await action(scenario.id, input);
  } else {
    await action(scenario.id);
  }
  console.log(JSON.stringify({ repositoryCalls, revalidateCalls, timeline, error: "COMPLETED" }));
} catch (error) {
  console.log(JSON.stringify({ repositoryCalls, revalidateCalls, timeline, error: String(error?.message ?? error) }));
}
`;

async function runAction(scenario: Scenario): Promise<Result> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", runtimeHarness, JSON.stringify(scenario)],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as Result;
}

const subjectInput = {
  slug: " marketing ",
  name: " Marketing ",
  category: "Marketing",
  faculty_group: " Business ",
  color_theme: "marketing"
};
const canonicalVietnameseCategories = [
  "Kế toán",
  "Kinh tế",
  "Thống kê",
  "Quản trị",
  "Tài chính",
  "Luật",
  "Ngoại ngữ"
] as const;
const productInput = {
  slug: " marketing-foundation ",
  title: " Marketing Foundation ",
  description: " A bounded catalog description ",
  subject_id: SUBJECT_ID,
  category: "Marketing",
  delivery_kind: "digital_download",
  publication_status: "draft",
  price_vnd: 10000,
  old_price_vnd: null,
  is_contact_for_price: false,
  rating: 5,
  is_hot: false,
  color_theme: "marketing"
};
const inputs: Record<string, Record<string, unknown>> = {
  createSubjectAction: subjectInput,
  updateSubjectAction: { name: " Updated Marketing " },
  deleteSubjectAction: {},
  createMaterialAction: { ...productInput, pages: 20, tags: [" tag ", " second tag "], includes: [" pdf "], suitable_for: [" students "] },
  updateMaterialAction: { pages: 24, tags: [" updated tag "] },
  deleteMaterialAction: {},
  createCourseAction: { ...productInput, delivery_kind: "live_session", publication_status: "published", format: "online", sessions: 4, duration: " 4 weeks ", schedule: " Saturday ", enrollment_status: "coming-soon", mentor: " Mentor ", tags: [" live ", " cohort "], curriculum: [" basics "], suitable_for: [" students "], preparation: [" notebook "] },
  updateCourseAction: { mentor: " Updated Mentor ", enrollment_status: "full" },
  deleteCourseAction: {},
  createTutorAction: { ...productInput, delivery_kind: "one_on_one_tutoring", format: " 1:1 (Online) ", name: " Tutor ", faculty: " Business ", availability: " Weekends ", short_bio: " Tutor bio ", strengths: [" exams ", " planning "], tags: [" mentor "], suitable_for: [" students "], support_methods: [" chat "] },
  updateTutorAction: { availability: " Weekdays ", support_methods: [" video ", " chat "] },
  deleteTutorAction: {}
};
const allActions = Object.keys(inputs) as ActionName[];
const updateActions = allActions.filter((action) => action.startsWith("update"));
const deleteActions = allActions.filter((action) => action.startsWith("delete"));
const actionIds: Record<ActionName, string> = {
  createSubjectAction: SUBJECT_ID,
  updateSubjectAction: SUBJECT_ID,
  deleteSubjectAction: SUBJECT_ID,
  createMaterialAction: PRODUCT_ID,
  updateMaterialAction: PRODUCT_ID,
  deleteMaterialAction: PRODUCT_ID,
  createCourseAction: PRODUCT_ID,
  updateCourseAction: PRODUCT_ID,
  deleteCourseAction: PRODUCT_ID,
  createTutorAction: PRODUCT_ID,
  updateTutorAction: PRODUCT_ID,
  deleteTutorAction: PRODUCT_ID
};
const expectedRepositoryArguments: Record<ActionName, unknown[]> = {
  createSubjectAction: [
    {
      slug: "marketing",
      name: "Marketing",
      category: "Marketing",
      faculty_group: "Business",
      color_theme: "marketing"
    }
  ],
  updateSubjectAction: [SUBJECT_ID, { name: "Updated Marketing" }],
  deleteSubjectAction: [SUBJECT_ID],
  createMaterialAction: [
    {
      slug: "marketing-foundation",
      title: "Marketing Foundation",
      description: "A bounded catalog description",
      subject_id: SUBJECT_ID,
      category: "Marketing",
      delivery_kind: "digital_download",
      publication_status: "draft",
      price_vnd: 10000,
      old_price_vnd: null,
      is_contact_for_price: false,
      rating: 5,
      is_hot: false,
      color_theme: "marketing",
      pages: 20,
      tags: ["tag", "second tag"],
      includes: ["pdf"],
      suitable_for: ["students"]
    }
  ],
  updateMaterialAction: [PRODUCT_ID, { pages: 24, tags: ["updated tag"] }],
  deleteMaterialAction: [PRODUCT_ID],
  createCourseAction: [
    {
      slug: "marketing-foundation",
      title: "Marketing Foundation",
      description: "A bounded catalog description",
      subject_id: SUBJECT_ID,
      category: "Marketing",
      delivery_kind: "live_session",
      publication_status: "published",
      price_vnd: 10000,
      old_price_vnd: null,
      is_contact_for_price: false,
      rating: 5,
      is_hot: false,
      color_theme: "marketing",
      format: "online",
      sessions: 4,
      duration: "4 weeks",
      schedule: "Saturday",
      enrollment_status: "coming-soon",
      mentor: "Mentor",
      tags: ["live", "cohort"],
      curriculum: ["basics"],
      suitable_for: ["students"],
      preparation: ["notebook"]
    }
  ],
  updateCourseAction: [PRODUCT_ID, { mentor: "Updated Mentor", enrollment_status: "full" }],
  deleteCourseAction: [PRODUCT_ID],
  createTutorAction: [
    {
      slug: "marketing-foundation",
      title: "Marketing Foundation",
      description: "A bounded catalog description",
      subject_id: SUBJECT_ID,
      category: "Marketing",
      delivery_kind: "one_on_one_tutoring",
      publication_status: "draft",
      price_vnd: 10000,
      old_price_vnd: null,
      is_contact_for_price: false,
      rating: 5,
      is_hot: false,
      color_theme: "marketing",
      name: "Tutor",
      faculty: "Business",
      format: "1:1 (Online)",
      availability: "Weekends",
      short_bio: "Tutor bio",
      strengths: ["exams", "planning"],
      tags: ["mentor"],
      suitable_for: ["students"],
      support_methods: ["chat"]
    }
  ],
  updateTutorAction: [PRODUCT_ID, { availability: "Weekdays", support_methods: ["video", "chat"] }],
  deleteTutorAction: [PRODUCT_ID]
};

describe("Task 5.1-B: admin catalog server actions", () => {
  test("has the server directive, typed CRUD action exports, and no unsafe access", async () => {
    const source = await readFile("app/quan-tri/catalog/actions.ts", "utf8");
    assert.match(source, /^"use server";/);
    for (const action of allActions) assert.match(source, new RegExp(`export async function ${action}`));
    assert.doesNotMatch(source, /@\/lib\/supabase\/browser|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
    assert.doesNotMatch(source, /\.from\(|\.rpc\(|dynamic SQL/i);
  });

  test("anonymous access redirects every action before validation and repository", async () => {
    for (const action of allActions) {
      const result = await runAction({ action, access: "anonymous", id: PRODUCT_ID, input: inputs[action] });
      assert.equal(result.error, "REDIRECT:/dang-nhap?next=/quan-tri");
      assert.deepEqual(result.repositoryCalls, []);
      assert.deepEqual(result.revalidateCalls, []);
      assert.deepEqual(result.timeline, ["guard", "redirect"]);
    }
  });

  test("non-admin, unapproved, and missing-profile access is blocked before validation and repository", async () => {
    for (const access of ["non-admin", "pending", "rejected", "suspended", "profile-missing"] as const) {
      const result = await runAction({ action: "createSubjectAction", access, input: subjectInput });
      assert.equal(result.error, "NOT_FOUND");
      assert.deepEqual(result.repositoryCalls, []);
      assert.deepEqual(result.timeline, ["guard", "notFound"]);
    }
  });

  test("invalid UUIDs are rejected before repository for every update/delete action", async () => {
    for (const action of [...updateActions, ...deleteActions]) {
      const result = await runAction({ action, access: "admin", id: "not-a-uuid", input: inputs[action] });
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?error=1", action);
      assert.deepEqual(result.repositoryCalls, []);
      assert.deepEqual(result.timeline, ["guard", "validation", "redirect"]);
    }
  });

  test("invalid slug, status, required fields, and arbitrary fields are rejected before repository", async () => {
    const invalidCases: Array<{ action: ActionName; input: Record<string, unknown> }> = [
      { action: "createSubjectAction", input: { ...subjectInput, slug: "Bad Slug" } },
      { action: "createMaterialAction", input: { ...inputs.createMaterialAction, publication_status: "pending" } },
      { action: "createCourseAction", input: { ...inputs.createCourseAction, sessions: 0 } },
      { action: "createTutorAction", input: { ...inputs.createTutorAction, short_bio: "" } },
      { action: "updateMaterialAction", input: { role: "admin" } },
      { action: "updateCourseAction", input: { arbitrary: "field" } },
      { action: "updateTutorAction", input: { subject_id: "invalid" } },
      { action: "updateSubjectAction", input: {} }
    ];
    for (const current of invalidCases) {
      const result = await runAction({ action: current.action, access: "admin", id: PRODUCT_ID, input: current.input });
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?error=1", current.action);
      assert.deepEqual(result.repositoryCalls, []);
      assert.equal(result.timeline.at(-1), "redirect");
      assert.ok(result.timeline.indexOf("validation") < result.timeline.indexOf("redirect"));
    }
  });

  test("create/update/delete calls every repository method with exact ID and allowed payload", async () => {
    for (const action of allActions) {
      const result = await runAction({ action, access: "admin", id: actionIds[action], input: inputs[action] });
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?success=1", action);
      assert.equal(result.repositoryCalls.length, 1);
      const call = result.repositoryCalls[0];
      assert.deepStrictEqual(call.args, expectedRepositoryArguments[action]);
      const serialized = JSON.stringify(call.args);
      assert.doesNotMatch(serialized, /role|user_id|userId|approved_by|updated_by|arbitrary/);
      assert.deepEqual(result.timeline.slice(0, 3), ["guard", "validation", "repository"]);
    }
  });

  test("canonical Vietnamese categories are accepted and forwarded exactly", async () => {
    for (const category of canonicalVietnameseCategories) {
      const result = await runAction({
        action: "createSubjectAction",
        access: "admin",
        input: { ...subjectInput, category }
      });
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?success=1", category);
      assert.deepEqual(result.repositoryCalls, [{
        name: "createAdminSubject",
        args: [{
          slug: "marketing",
          name: "Marketing",
          category,
          faculty_group: "Business",
          color_theme: "marketing"
        }]
      }]);
      assert.deepEqual(result.timeline.slice(0, 3), ["guard", "validation", "repository"]);
    }
  });

  test("mojibake, ASCII, unsupported, and alias categories are rejected at runtime", async () => {
    const invalidCategories = [
      "Káº¿ toÃ¡n",
      "Ke toan",
      "Accounting",
      "Other",
      "unknown",
      "accounting",
      "Ketoan",
      "Kế Toán",
      "Kinh tế học"
    ];
    for (const category of invalidCategories) {
      const result = await runAction({
        action: "createSubjectAction",
        access: "admin",
        input: { ...subjectInput, category }
      });
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?error=1", category);
      assert.deepEqual(result.repositoryCalls, [], category);
      assert.deepEqual(result.revalidateCalls, [], category);
      assert.deepEqual(result.timeline, ["guard", "validation", "redirect"], category);
      assert.doesNotMatch(result.error, /RAW|SQL|secret|PII|0901234567/i, category);
    }
  });

  test("repository errors and false/null results use only the fixed generic error redirect", async () => {
    for (const action of ["createSubjectAction", "updateMaterialAction", "deleteCourseAction"] as const) {
      const result = await runAction({
        action,
        access: "admin",
        id: PRODUCT_ID,
        input: inputs[action],
        repositoryError: true
      });
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?error=1");
      assert.doesNotMatch(result.error, /RAW|secret|PII|0901234567|SQL/);
      assert.deepEqual(result.revalidateCalls, []);
    }
    for (const [action, field] of [["updateSubjectAction", "repositoryReturnsNull"], ["deleteTutorAction", "repositoryReturnsFalse"]] as const) {
      const result = await runAction({ action, access: "admin", id: PRODUCT_ID, input: inputs[action], [field]: true });
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?error=1");
      assert.deepEqual(result.revalidateCalls, []);
      assert.deepEqual(result.timeline.slice(-1), ["redirect"]);
    }
  });

  test("success revalidates the admin route and the corresponding public route", async () => {
    const expected: Record<ActionName, string[]> = {
      createSubjectAction: ["/quan-tri/catalog", "/tai-lieu", "/khoa-hoc", "/tutor"],
      updateSubjectAction: ["/quan-tri/catalog", "/tai-lieu", "/khoa-hoc", "/tutor"],
      deleteSubjectAction: ["/quan-tri/catalog", "/tai-lieu", "/khoa-hoc", "/tutor"],
      createMaterialAction: ["/quan-tri/catalog", "/tai-lieu", "/tai-lieu/safe-slug"],
      updateMaterialAction: ["/quan-tri/catalog", "/tai-lieu", "/tai-lieu/safe-slug"],
      deleteMaterialAction: ["/quan-tri/catalog", "/tai-lieu"],
      createCourseAction: ["/quan-tri/catalog", "/khoa-hoc", "/khoa-hoc/safe-slug"],
      updateCourseAction: ["/quan-tri/catalog", "/khoa-hoc", "/khoa-hoc/safe-slug"],
      deleteCourseAction: ["/quan-tri/catalog", "/khoa-hoc"],
      createTutorAction: ["/quan-tri/catalog", "/tutor", "/tutor/safe-slug"],
      updateTutorAction: ["/quan-tri/catalog", "/tutor", "/tutor/safe-slug"],
      deleteTutorAction: ["/quan-tri/catalog", "/tutor"]
    };
    for (const action of allActions) {
      const result = await runAction({ action, access: "admin", id: PRODUCT_ID, input: inputs[action] });
      assert.deepEqual(result.revalidateCalls, expected[action], action);
      assert.equal(result.error, "REDIRECT:/quan-tri/catalog?success=1");
      assert.deepEqual(
        result.timeline.slice(3),
        [...expected[action].map(() => "revalidate"), "redirect"]
      );
    }
  });

  test("navigation control-flow exceptions are not converted into repository errors", async () => {
    const anonymous = await runAction({ action: "deleteTutorAction", access: "anonymous", id: "not-a-uuid" });
    assert.equal(anonymous.error, "REDIRECT:/dang-nhap?next=/quan-tri");
    assert.deepEqual(anonymous.timeline, ["guard", "redirect"]);
    const blocked = await runAction({ action: "deleteTutorAction", access: "non-admin", id: "not-a-uuid" });
    assert.equal(blocked.error, "NOT_FOUND");
    assert.deepEqual(blocked.timeline, ["guard", "notFound"]);
  });
});
