/** Runtime coverage for the real study-plan repository and date calculations. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const SUBJECT_ID = "650e8400-e29b-41d4-a716-446655440000";
const TASK_ID = "950e8400-e29b-41d4-a716-446655440000";
const REQUEST_KEY = "850e8400-e29b-41d4-a716-446655440000";
const RAW_ERROR = "SQL user@example.test secret=jwt";
let repository: typeof import("../../lib/repositories/study-plan-repository");
let client: { calls: Array<{ method: string; args: unknown[] }> } | null = null;
let createCalls = 0;
let responseRow: Record<string, unknown> | null;
let responseMaybeRow: Record<string, unknown> | null;
let responseError: unknown = null;

const actionRuntimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const scenario = JSON.parse(process.argv[1]);
const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TASK_ID = "950e8400-e29b-41d4-a716-446655440000";
const REQUEST_KEY = "850e8400-e29b-41d4-a716-446655440000";
const repositoryCalls = [];
const revalidateCalls = [];
const timeline = [];
const access = scenario.access === "anonymous"
  ? { status: "unauthenticated", user: null, profile: null }
  : scenario.access === "profile-missing"
    ? { status: "profile_missing", user: { id: USER_ID }, profile: null }
    : { status: scenario.access, user: { id: USER_ID }, profile: { id: USER_ID, role: "student" } };
const task = { id: TASK_ID, user_id: USER_ID, request_key: REQUEST_KEY, task_date: "2026-09-07", title: "Ôn bài", subject_id: "650e8400-e29b-41d4-a716-446655440000", duration_minutes: 25, status: "pending", completed_at: null, created_at: "2026-09-07T00:00:00.000Z", updated_at: "2026-09-07T00:00:00.000Z" };
const authModule = "data:text/javascript,study-plan-action-auth";
const repositoryModule = "data:text/javascript,study-plan-action-repository";
const cacheModule = "data:text/javascript,study-plan-action-cache";
mock.module(authModule, { namedExports: { getAccountAccess: async () => { timeline.push("auth"); return access; } } });
mock.module(repositoryModule, { namedExports: {
  validateCreateStudyPlanInput: (input) => { timeline.push("validation"); return input; },
  validateUpdateStudyPlanInput: (input) => { timeline.push("validation"); return input; },
  validateStudyPlanId: (id) => { timeline.push("validation"); if (id !== TASK_ID) { const error = new Error("invalid"); error.name = "StudyPlanInputError"; throw error; } return id; },
  createStudyPlan: async (...args) => { timeline.push("repository"); repositoryCalls.push(["create", ...args]); if (scenario.repositoryError) throw new Error("RAW SQL email@example.test secret=jwt"); return { ...task, request_key: args[1].requestKey, title: args[1].title }; },
  updateStudyPlan: async (...args) => { timeline.push("repository"); repositoryCalls.push(["update", ...args]); if (scenario.repositoryError) throw new Error("RAW SQL email@example.test secret=jwt"); return { ...task, title: args[2].title, task_date: args[2].taskDate }; },
  markStudyPlanCompleted: async (...args) => { timeline.push("repository"); repositoryCalls.push(["complete", ...args]); if (scenario.repositoryError) throw new Error("RAW SQL email@example.test secret=jwt"); return { ...task, status: "completed", completed_at: "2026-09-07T02:00:00.000Z" }; }
} });
mock.module(cacheModule, { namedExports: { revalidatePath: (path) => { timeline.push("revalidate"); revalidateCalls.push(path); } } });
try {
  let source = await readFile(process.cwd() + "/app/ca-nhan/actions.ts", "utf8");
  source = source.replaceAll("@/lib/auth/session", authModule).replaceAll("@/lib/repositories/study-plan-repository", repositoryModule).replaceAll("next/cache", cacheModule);
  const compiled = await transform(source, { loader: "ts", format: "esm", sourcefile: "actions.ts" });
  const mod = await import("data:text/javascript," + encodeURIComponent(compiled.code));
  const formData = { *entries() { timeline.push("validation"); for (const [key, value] of Object.entries(scenario.formData || {})) yield [key, value]; } };
  const action = scenario.action === "create" ? mod.createStudyPlanAction : scenario.action === "update" ? mod.updateStudyPlanAction : mod.completeStudyPlanAction;
  const result = await action({ success: false }, formData);
  console.log(JSON.stringify({ result, repositoryCalls, revalidateCalls, timeline }));
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.message ?? error), repositoryCalls, revalidateCalls, timeline }));
}
`;

async function runActionRuntime(scenario: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", actionRuntimeHarness, JSON.stringify(scenario)], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim()) as Record<string, unknown>;
}

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: TASK_ID, user_id: USER_ID, request_key: REQUEST_KEY, task_date: "2026-09-07", title: "Ôn bài", subject_id: SUBJECT_ID, duration_minutes: 25, status: "pending", completed_at: null, created_at: "2026-09-07T01:00:00.000Z", updated_at: "2026-09-07T01:00:00.000Z", ...overrides };
}

before(async () => {
  const loader = require("node:module") as { _load: (...args: any[]) => unknown };
  const original = loader._load;
  loader._load = function (request: string, ...args: any[]) { if (request === "server-only") return {}; return original.call(this, request, ...args); };
  const serverPath = require.resolve("../../lib/supabase/server");
  require.cache[serverPath] = { id: serverPath, filename: serverPath, loaded: true, exports: { createClient: async () => { createCalls += 1; return client; } } } as any;
  repository = await import("../../lib/repositories/study-plan-repository");
  loader._load = original;
});

function mockClient(options: { rows?: Record<string, unknown>[]; data?: Record<string, unknown> | null; maybeData?: Record<string, unknown> | null; error?: unknown } = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  responseRow = Object.prototype.hasOwnProperty.call(options, "data") ? options.data ?? null : row();
  responseMaybeRow = Object.prototype.hasOwnProperty.call(options, "maybeData") ? options.maybeData ?? null : responseRow;
  responseError = options.error ?? null;
  const rows = options.rows ?? [row()];
  const query: any = {
    select: (...args: unknown[]) => { calls.push({ method: "select", args }); return query; },
    insert: (...args: unknown[]) => { calls.push({ method: "insert", args }); return query; },
    upsert: (...args: unknown[]) => { calls.push({ method: "upsert", args }); return query; },
    update: (...args: unknown[]) => { calls.push({ method: "update", args }); return query; },
    eq: (...args: unknown[]) => { calls.push({ method: "eq", args }); return query; },
    neq: (...args: unknown[]) => { calls.push({ method: "neq", args }); return query; },
    gte: (...args: unknown[]) => { calls.push({ method: "gte", args }); return query; },
    lte: (...args: unknown[]) => { calls.push({ method: "lte", args }); return query; },
    order: (...args: unknown[]) => { calls.push({ method: "order", args }); return query; },
    limit: (...args: unknown[]) => { calls.push({ method: "limit", args }); return query; },
    single: async () => { calls.push({ method: "single", args: [] }); return { data: responseRow, error: responseError }; },
    maybeSingle: async () => { calls.push({ method: "maybeSingle", args: [] }); return { data: responseMaybeRow, error: responseError }; },
    then: (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: responseError })
  };
  client = { calls };
  (client as any).from = (table: string) => { calls.push({ method: "from", args: [table] }); if (table !== "study_plans") return query; return query; };
  (query as any).__rows = rows;
  return client;
}

test("validates exact inputs before creating Supabase and rejects user_id/arbitrary fields", async () => {
  createCalls = 0; client = null;
  for (const invalid of [{ taskDate: "2026-09-07", title: " ", subjectId: SUBJECT_ID, durationMinutes: 25 }, { taskDate: "2026-02-30", title: "x", subjectId: SUBJECT_ID, durationMinutes: 25 }, { taskDate: "2026-09-07", title: "x", subjectId: "bad", durationMinutes: 25 }, { taskDate: "2026-09-07", title: "x", subjectId: SUBJECT_ID, durationMinutes: 0 }, { taskDate: "2026-09-07", title: "x", subjectId: SUBJECT_ID, durationMinutes: 25, userId: USER_ID }]) {
    await assert.rejects(() => repository.createStudyPlan(USER_ID, { requestKey: REQUEST_KEY, ...(invalid as object) } as never), repository.StudyPlanInputError);
  }
  assert.equal(createCalls, 0);
});

test("rejects every invalid create/list/update field before the database client", async () => {
  const validCreate = { requestKey: REQUEST_KEY, taskDate: "2026-09-07", title: "x", subjectId: SUBJECT_ID, durationMinutes: 25, status: "pending" };
  const invalidCreates = [
    { ...validCreate, requestKey: "bad" },
    { ...validCreate, taskDate: "2026-02-30" },
    { ...validCreate, title: "" },
    { ...validCreate, durationMinutes: 1.5 },
    { ...validCreate, status: "done" },
    { ...validCreate, subjectId: "bad" }
  ];
  for (const input of invalidCreates) await assert.rejects(() => repository.createStudyPlan(USER_ID, input as never), repository.StudyPlanInputError);
  for (const input of [
    { startDate: "bad" }, { endDate: "2026-02-30" }, { status: "done" }, { subjectId: "bad" }, { limit: 0 }, { unknown: true }
  ]) await assert.rejects(() => repository.listStudyPlans(USER_ID, input as never), repository.StudyPlanInputError);
  const validUpdate = { taskDate: "2026-09-07", title: "x", subjectId: SUBJECT_ID, durationMinutes: 25, status: "pending" };
  for (const input of [
    { ...validUpdate, taskDate: "bad" }, { ...validUpdate, title: " " }, { ...validUpdate, durationMinutes: 0 }, { ...validUpdate, status: "bad" }, { ...validUpdate, requestKey: REQUEST_KEY }
  ]) await assert.rejects(() => repository.updateStudyPlan(USER_ID, TASK_ID, input as never), repository.StudyPlanInputError);
});

test("lists deterministically with ownership/date/status/subject filters and bounded results", async () => {
  const active = mockClient();
  const result = await repository.listStudyPlans(USER_ID.toUpperCase(), { startDate: "2026-09-01", endDate: "2026-09-07", status: "pending", subjectId: SUBJECT_ID });
  assert.deepEqual(result, [row()]);
  assert.deepEqual(active.calls.filter((call) => ["eq", "gte", "lte"].includes(call.method)).map((call) => call.args), [["user_id", USER_ID], ["task_date", "2026-09-01"], ["task_date", "2026-09-07"], ["status", "pending"], ["subject_id", SUBJECT_ID]]);
  assert.ok(active.calls.some((call) => call.method === "limit" && call.args[0] === 500));
});

test("sends exact create/update/complete payloads and maps database errors generically", async () => {
  const create = mockClient({ data: row() });
  await repository.createStudyPlan(USER_ID, { requestKey: REQUEST_KEY, taskDate: "2026-09-07", title: "  Ôn bài  ", subjectId: SUBJECT_ID, durationMinutes: 25 });
  assert.deepEqual(create.calls.find((call) => call.method === "upsert")?.args[0], { user_id: USER_ID, request_key: REQUEST_KEY, task_date: "2026-09-07", title: "Ôn bài", subject_id: SUBJECT_ID, duration_minutes: 25, status: "pending" });
  const update = mockClient({ data: row({ title: "Bài mới", duration_minutes: 30, status: "in_progress" }) });
  await repository.updateStudyPlan(USER_ID, TASK_ID, { taskDate: "2026-09-07", title: "Bài mới", subjectId: SUBJECT_ID, durationMinutes: 30, status: "in_progress" });
  assert.deepEqual(update.calls.find((call) => call.method === "update")?.args[0], { task_date: "2026-09-07", title: "Bài mới", subject_id: SUBJECT_ID, duration_minutes: 30, status: "in_progress", completed_at: null });
  const complete = mockClient({ data: row({ status: "completed", completed_at: "2026-09-07T02:00:00.000Z" }) });
  await repository.markStudyPlanCompleted(USER_ID, TASK_ID);
  assert.deepEqual(Object.keys(complete.calls.find((call) => call.method === "update")?.args[0] as object).sort(), ["completed_at", "status"]);
  mockClient({ error: new Error(RAW_ERROR), data: null });
  await assert.rejects(() => repository.markStudyPlanCompleted(USER_ID, TASK_ID), (error: unknown) => error instanceof repository.StudyPlanRepositoryError && !String(error).includes("user@example"));
});

test("retries create by request key and repeats completion without changing completed_at", async () => {
  const first = mockClient({ data: row() });
  const firstResult = await repository.createStudyPlan(USER_ID, { requestKey: REQUEST_KEY, taskDate: "2026-09-07", title: "Ôn bài", subjectId: SUBJECT_ID, durationMinutes: 25 });
  assert.equal(firstResult.request_key, REQUEST_KEY);
  const retry = mockClient({ maybeData: null });
  const retryResult = await repository.createStudyPlan(USER_ID, { requestKey: REQUEST_KEY, taskDate: "2026-09-07", title: "Ôn bài", subjectId: SUBJECT_ID, durationMinutes: 25 });
  assert.equal(retryResult.id, TASK_ID);
  assert.equal(retry.calls.filter((call) => call.method === "upsert").length, 1);
  assert.deepEqual(retry.calls.find((call) => call.method === "upsert")?.args[1], { onConflict: "user_id,request_key", ignoreDuplicates: true });
  assert.deepEqual(retry.calls.filter((call) => call.method === "eq").map((call) => call.args), [["user_id", USER_ID], ["request_key", REQUEST_KEY]]);
  assert.equal(first.calls.filter((call) => call.method === "upsert").length, 1);

  const completedAt = "2026-09-07T02:00:00.000Z";
  const repeated = mockClient({ data: row({ status: "completed", completed_at: completedAt }), maybeData: null });
  const repeatedResult = await repository.markStudyPlanCompleted(USER_ID, TASK_ID);
  assert.equal(repeatedResult.completed_at, completedAt);
  const repeatedPayload = repeated.calls.find((call) => call.method === "update")?.args[0] as Record<string, unknown>;
  assert.deepEqual(Object.keys(repeatedPayload).sort(), ["completed_at", "status"]);
  assert.equal(repeatedPayload.status, "completed");
  assert.match(String(repeatedPayload.completed_at), /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(repeated.calls.some((call) => call.method === "neq" && call.args[0] === "status" && call.args[1] === "completed"));
  assert.deepEqual(repeated.calls.filter((call) => call.method === "eq").map((call) => call.args), [["user_id", USER_ID], ["id", TASK_ID], ["user_id", USER_ID], ["id", TASK_ID]]);
});

test("calculates empty-day progress, UTC-safe local dates, and consecutive real completion streaks", () => {
  assert.equal(repository.getVietnamDate(new Date("2026-09-06T16:59:59.000Z")), "2026-09-06");
  assert.equal(repository.getVietnamDate(new Date("2026-09-06T17:00:00.000Z")), "2026-09-07");
  const tasks = [row({ task_date: "2026-09-05", status: "completed", completed_at: "2026-09-05T00:00:00.000Z", duration_minutes: 20 }), row({ id: "a50e8400-e29b-41d4-a716-446655440000", task_date: "2026-09-07", status: "completed", completed_at: "2026-09-07T00:00:00.000Z", duration_minutes: 30 }), row({ id: "b50e8400-e29b-41d4-a716-446655440000", task_date: "2026-09-07", status: "pending" })] as any;
  assert.deepEqual(repository.calculateDailyStudyPlanProgress(tasks, "2026-09-07"), { date: "2026-09-07", totalTasks: 2, completedTasks: 1, totalMinutes: 55, completedMinutes: 30, percentage: 50 });
  assert.equal(repository.calculateStudyPlanStreak(tasks, "2026-09-07"), 1);
  assert.equal(repository.calculateDailyStudyPlanProgress(tasks, "2026-09-08").totalTasks, 0);
  assert.equal(repository.calculateDailyStudyPlanProgress(tasks, "2026-09-06").totalTasks, 0);
  assert.equal(repository.calculateStudyPlanStreak([row({ task_date: "2026-09-05", status: "completed", completed_at: "2026-09-05T00:00:00.000Z" }), row({ id: "a50e8400-e29b-41d4-a716-446655440000", task_date: "2026-09-07", status: "completed", completed_at: "2026-09-07T00:00:00.000Z" })] as any, "2026-09-07"), 1);
});

test("fails closed when a database response belongs to another user", async () => {
  mockClient({ rows: [row({ user_id: OTHER_USER_ID })] });
  await assert.rejects(() => repository.listStudyPlans(USER_ID), repository.StudyPlanRepositoryError);
  mockClient({ data: row({ user_id: OTHER_USER_ID }) });
  await assert.rejects(() => repository.updateStudyPlan(USER_ID, TASK_ID, { taskDate: "2026-09-07", title: "Bài mới", subjectId: SUBJECT_ID, durationMinutes: 25, status: "pending" }), repository.StudyPlanRepositoryError);
  mockClient({ data: row({ user_id: OTHER_USER_ID }) });
  await assert.rejects(() => repository.markStudyPlanCompleted(USER_ID, TASK_ID), repository.StudyPlanRepositoryError);
});

test("server actions guard every account status and never call the repository first", async () => {
  for (const access of ["anonymous", "profile-missing", "pending", "rejected", "suspended"] as const) {
    const result = await runActionRuntime({ action: "create", access, formData: { requestKey: REQUEST_KEY } });
    assert.deepEqual(result.repositoryCalls, []);
    assert.deepEqual(result.timeline, ["auth"]);
  }
});

test("server actions execute auth, validation, repository, revalidate, and return generic errors", async () => {
  const create = await runActionRuntime({ action: "create", access: "approved", formData: { requestKey: REQUEST_KEY, taskDate: "2026-09-08", title: "Tác vụ thật", subjectId: SUBJECT_ID, durationMinutes: "30", status: "pending" } });
  assert.deepEqual(create.timeline, ["auth", "validation", "validation", "repository", "revalidate"]);
  assert.deepEqual(create.repositoryCalls, [["create", USER_ID, { requestKey: REQUEST_KEY, taskDate: "2026-09-08", title: "Tác vụ thật", subjectId: SUBJECT_ID, durationMinutes: 30, status: "pending" }]]);
  assert.deepEqual(create.revalidateCalls, ["/ca-nhan"]);

  const update = await runActionRuntime({ action: "update", access: "approved", formData: { id: TASK_ID, taskDate: "2026-09-09", title: "Đã sửa", subjectId: SUBJECT_ID, durationMinutes: "35", status: "in_progress" } });
  assert.deepEqual(update.repositoryCalls, [["update", USER_ID, TASK_ID, { taskDate: "2026-09-09", title: "Đã sửa", subjectId: SUBJECT_ID, durationMinutes: 35, status: "in_progress" }]]);
  const complete = await runActionRuntime({ action: "complete", access: "approved", formData: { id: TASK_ID } });
  assert.deepEqual(complete.timeline, ["auth", "validation", "validation", "repository", "revalidate"]);
  assert.deepEqual(complete.repositoryCalls, [["complete", USER_ID, TASK_ID]]);

  const invalid = await runActionRuntime({ action: "create", access: "approved", formData: { requestKey: REQUEST_KEY, taskDate: "2026-09-08", title: "Tác vụ", subjectId: SUBJECT_ID, durationMinutes: "30", status: "pending", user_id: "other" } });
  assert.deepEqual(invalid.repositoryCalls, []);
  assert.equal((invalid.result as { success: boolean }).success, false);
  const repositoryError = await runActionRuntime({ action: "create", access: "approved", repositoryError: true, formData: { requestKey: REQUEST_KEY, taskDate: "2026-09-08", title: "Tác vụ", subjectId: SUBJECT_ID, durationMinutes: "30" } });
  assert.deepEqual((repositoryError.repositoryCalls as unknown[]).length, 1);
  assert.doesNotMatch(String(repositoryError.result), /RAW SQL|email@example|secret=jwt/);
});

test("invalid completion IDs are rejected before repository access", async () => {
  const result = await runActionRuntime({ action: "complete", access: "approved", formData: { id: "not-a-uuid" } });
  assert.deepEqual(result.repositoryCalls, []);
  assert.deepEqual(result.timeline, ["auth", "validation", "validation"]);
});
