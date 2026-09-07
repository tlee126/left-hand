/** Runtime coverage for the real study-plan repository and date calculations. */
import assert from "node:assert/strict";
import { before, test } from "node:test";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER_ID = "750e8400-e29b-41d4-a716-446655440000";
const SUBJECT_ID = "650e8400-e29b-41d4-a716-446655440000";
const TASK_ID = "950e8400-e29b-41d4-a716-446655440000";
const RAW_ERROR = "SQL user@example.test secret=jwt";
let repository: typeof import("../../lib/repositories/study-plan-repository");
let client: { calls: Array<{ method: string; args: unknown[] }> } | null = null;
let createCalls = 0;
let responseRow: Record<string, unknown>;
let responseError: unknown = null;

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: TASK_ID, user_id: USER_ID, task_date: "2026-09-07", title: "Ôn bài", subject_id: SUBJECT_ID, duration_minutes: 25, status: "pending", completed_at: null, created_at: "2026-09-07T01:00:00.000Z", updated_at: "2026-09-07T01:00:00.000Z", ...overrides };
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

function mockClient(options: { rows?: Record<string, unknown>[]; data?: Record<string, unknown> | null; error?: unknown } = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  responseRow = options.data ?? row(); responseError = options.error ?? null;
  const rows = options.rows ?? [row()];
  const query: any = {
    select: (...args: unknown[]) => { calls.push({ method: "select", args }); return query; },
    insert: (...args: unknown[]) => { calls.push({ method: "insert", args }); return query; },
    update: (...args: unknown[]) => { calls.push({ method: "update", args }); return query; },
    eq: (...args: unknown[]) => { calls.push({ method: "eq", args }); return query; },
    gte: (...args: unknown[]) => { calls.push({ method: "gte", args }); return query; },
    lte: (...args: unknown[]) => { calls.push({ method: "lte", args }); return query; },
    order: (...args: unknown[]) => { calls.push({ method: "order", args }); return query; },
    limit: (...args: unknown[]) => { calls.push({ method: "limit", args }); return query; },
    single: async () => { calls.push({ method: "single", args: [] }); return { data: responseRow, error: responseError }; },
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
    await assert.rejects(() => repository.createStudyPlan(USER_ID, invalid as never), repository.StudyPlanInputError);
  }
  assert.equal(createCalls, 0);
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
  await repository.createStudyPlan(USER_ID, { taskDate: "2026-09-07", title: "  Ôn bài  ", subjectId: SUBJECT_ID, durationMinutes: 25 });
  assert.deepEqual(create.calls.find((call) => call.method === "insert")?.args[0], { user_id: USER_ID, task_date: "2026-09-07", title: "Ôn bài", subject_id: SUBJECT_ID, duration_minutes: 25, status: "pending" });
  const update = mockClient({ data: row({ title: "Bài mới", duration_minutes: 30, status: "in_progress" }) });
  await repository.updateStudyPlan(USER_ID, TASK_ID, { taskDate: "2026-09-07", title: "Bài mới", subjectId: SUBJECT_ID, durationMinutes: 30, status: "in_progress" });
  assert.deepEqual(update.calls.find((call) => call.method === "update")?.args[0], { task_date: "2026-09-07", title: "Bài mới", subject_id: SUBJECT_ID, duration_minutes: 30, status: "in_progress", completed_at: null });
  const complete = mockClient({ data: row({ status: "completed", completed_at: "2026-09-07T02:00:00.000Z" }) });
  await repository.markStudyPlanCompleted(USER_ID, TASK_ID);
  assert.deepEqual(Object.keys(complete.calls.find((call) => call.method === "update")?.args[0] as object).sort(), ["completed_at", "status"]);
  mockClient({ error: new Error(RAW_ERROR), data: null });
  await assert.rejects(() => repository.markStudyPlanCompleted(USER_ID, TASK_ID), (error: unknown) => error instanceof repository.StudyPlanRepositoryError && !String(error).includes("user@example"));
});

test("calculates empty-day progress, UTC-safe local dates, and consecutive real completion streaks", () => {
  assert.equal(repository.getVietnamDate(new Date("2026-09-06T16:59:59.000Z")), "2026-09-06");
  assert.equal(repository.getVietnamDate(new Date("2026-09-06T17:00:00.000Z")), "2026-09-07");
  const tasks = [row({ task_date: "2026-09-05", status: "completed", completed_at: "2026-09-05T00:00:00.000Z", duration_minutes: 20 }), row({ id: "a50e8400-e29b-41d4-a716-446655440000", task_date: "2026-09-07", status: "completed", completed_at: "2026-09-07T00:00:00.000Z", duration_minutes: 30 }), row({ id: "b50e8400-e29b-41d4-a716-446655440000", task_date: "2026-09-07", status: "pending" })] as any;
  assert.deepEqual(repository.calculateDailyStudyPlanProgress(tasks, "2026-09-07"), { date: "2026-09-07", totalTasks: 2, completedTasks: 1, totalMinutes: 55, completedMinutes: 30, percentage: 50 });
  assert.equal(repository.calculateStudyPlanStreak(tasks, "2026-09-07"), 1);
  assert.equal(repository.calculateDailyStudyPlanProgress(tasks, "2026-09-08").totalTasks, 0);
});
