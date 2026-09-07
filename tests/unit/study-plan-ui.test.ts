/** Runtime rendering and interaction coverage for the persisted study-plan UI. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createElement } from "react";
import { promisify } from "node:util";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { TodayPlannerCard } from "../../components/student/today-planner-card";
import { StudyPlanEditor } from "../../components/student/study-plan-editor";
import { StudentDashboardClient } from "../../app/ca-nhan/dashboard-client";

const execFileAsync = promisify(execFile);

const pageRuntimeHarness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const scenario = JSON.parse(process.argv[1]);
const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const todayParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
const todayValues = new Map(todayParts.map((part) => [part.type, part.value]));
const todayDate = todayValues.get("year") + "-" + todayValues.get("month") + "-" + todayValues.get("day");
const future = new Date(todayDate + "T00:00:00Z");
future.setUTCDate(future.getUTCDate() + 1);
const futureDate = future.toISOString().slice(0, 10);
const futureEnd = new Date(todayDate + "T00:00:00Z");
futureEnd.setUTCDate(futureEnd.getUTCDate() + 30);
const futureEndDate = futureEnd.toISOString().slice(0, 10);
const timeline = [];
const repositoryCalls = [];
const plans = [{ id: "950e8400-e29b-41d4-a716-446655440000", user_id: USER_ID, request_key: "850e8400-e29b-41d4-a716-446655440000", task_date: futureDate, title: "Tác vụ tương lai thật", subject_id: "650e8400-e29b-41d4-a716-446655440000", duration_minutes: 25, status: "pending", completed_at: null, created_at: "2026-09-07T00:00:00.000Z", updated_at: "2026-09-07T00:00:00.000Z" }];
const authModule = "data:text/javascript,study-plan-page-auth";
const navigationModule = "data:text/javascript,study-plan-page-navigation";
const repositoryModule = "data:text/javascript,study-plan-page-repository";
const dashboardModule = "data:text/javascript,study-plan-page-dashboard";
mock.module(authModule, { namedExports: { getAccountAccess: async () => { timeline.push("auth"); return scenario.access === "anonymous" ? { status: "unauthenticated", user: null, profile: null } : { status: scenario.access, user: { id: USER_ID }, profile: scenario.access === "profile_missing" ? null : { id: USER_ID, role: "student" } }; } } });
mock.module(navigationModule, { namedExports: { redirect: (location) => { timeline.push("redirect"); throw new Error("REDIRECT:" + location); } } });
mock.module(repositoryModule, { namedExports: {
  listStudyPlans: async (...args) => { timeline.push("plans"); repositoryCalls.push(["plans", ...args]); return plans; },
  listStudyPlanSubjects: async () => { timeline.push("subjects"); return [{ id: "650e8400-e29b-41d4-a716-446655440000", slug: "that", name: "Môn thật", category: "Kế toán", color_theme: "accounting" }]; }
} });
mock.module(dashboardModule, { namedExports: { StudentDashboardClient: (props) => { timeline.push("render"); return { type: "Dashboard", props }; } } });
try {
  let source = await readFile(process.cwd() + "/app/ca-nhan/page.tsx", "utf8");
  source = source.replaceAll("@/lib/auth/session", authModule).replaceAll("next/navigation", navigationModule).replaceAll("@/lib/repositories/study-plan-repository", repositoryModule).replaceAll("./dashboard-client", dashboardModule);
  source = source.replace('return (\n    <StudentDashboardClient\n      initialProfile={access.profile}\n      authUserEmail={access.user?.email ?? null}\n      initialStudyPlans={initialStudyPlans}\n      studyPlanSubjects={studyPlanSubjects}\n      todayDate={todayDate}\n      studyPlanLoadError={studyPlanLoadError}\n    />\n  );', 'return { type: "Dashboard", props: { initialProfile: access.profile, authUserEmail: access.user?.email ?? null, initialStudyPlans, studyPlanSubjects, todayDate, studyPlanLoadError } };');
  const compiled = await transform(source, { loader: "ts", format: "esm", sourcefile: "page.tsx" });
  const mod = await import("data:text/javascript," + encodeURIComponent(compiled.code));
  const result = await mod.default({});
  console.log(JSON.stringify({ result, timeline, repositoryCalls, todayDate, futureDate, futureEndDate }));
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.message ?? error), timeline, repositoryCalls, todayDate, futureDate, futureEndDate }));
}
`;

async function runPageRuntime(access: string): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", pageRuntimeHarness, JSON.stringify({ access })], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.trim()) as Record<string, unknown>;
}

const SUBJECT_ID = "650e8400-e29b-41d4-a716-446655440000";
const TASK_ID = "950e8400-e29b-41d4-a716-446655440000";
const task = { id: TASK_ID, user_id: "550e8400-e29b-41d4-a716-446655440000", request_key: "850e8400-e29b-41d4-a716-446655440000", task_date: "2026-09-07", title: "Ôn bài", subject_id: SUBJECT_ID, duration_minutes: 25, status: "pending" as const, completed_at: null, created_at: "2026-09-07T00:00:00.000Z", updated_at: "2026-09-07T00:00:00.000Z" };
const subject = { id: SUBJECT_ID, slug: "ke-toan-tai-chinh-1", name: "Kế toán tài chính 1", category: "Kế toán" as never, color_theme: "accounting" as never };
const progress = { date: "2026-09-07", totalTasks: 1, completedTasks: 0, totalMinutes: 25, completedMinutes: 0, percentage: 0 };

function elementsOfType(node: unknown, type: string): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => elementsOfType(child, type));
  const element = node as { type?: unknown; props?: { children?: unknown } };
  const current = element.type === type ? [element] : [];
  return current.concat(elementsOfType(element.props?.children, type));
}

test("TodayPlannerCard renders real task fields, progress, empty state, and completion/edit actions", () => {
  let completed = "";
  let edited = "";
  const element = TodayPlannerCard({ tasks: [task], subjects: [subject], progress, onCompleteTask: (id) => { completed = id; }, onEditTask: (value) => { edited = value.id; }, pendingTaskId: null, lowestProgressSlug: null });
  const html = renderToStaticMarkup(element);
  assert.match(html, /Ôn bài/);
  assert.match(html, /Kế toán tài chính 1/);
  assert.match(html, /25 phút/);
  assert.match(html, /0\/1 việc đã xong/);
  const buttons = elementsOfType(element, "button");
  buttons.find((button) => typeof button.props?.onClick === "function" && !button.props?.["aria-label"])?.props.onClick();
  buttons.find((button) => typeof button.props?.onClick === "function" && button.props?.["aria-label"])?.props.onClick();
  assert.equal(completed, TASK_ID);
  assert.equal(edited, TASK_ID);
  const empty = renderToStaticMarkup(TodayPlannerCard({ tasks: [], subjects: [], progress: { ...progress, totalTasks: 0 }, onCompleteTask: () => {}, onEditTask: () => {}, pendingTaskId: null, lowestProgressSlug: null }));
  assert.match(empty, /Chưa có việc học nào/);
});

test("StudyPlanEditor renders editable persisted values and pending/success states", () => {
  const html = renderToStaticMarkup(createElement(StudyPlanEditor, { task, subjects: [subject], pending: false, successMessage: "Đã lưu", onSubmit: () => {}, onCancel: () => {} }));
  assert.match(html, /Chỉnh sửa việc học/);
  assert.match(html, /value="Ôn bài"/);
  assert.match(html, /value="25"/);
  assert.match(html, /Đã lưu/);
  const pending = renderToStaticMarkup(createElement(StudyPlanEditor, { task, subjects: [subject], pending: true, errorMessage: "Thử lại", onSubmit: () => {}, onCancel: () => {} }));
  assert.match(pending, /Đang lưu/);
  assert.match(pending, /Thử lại/);
});

test("planner exposes generic error and retry without optimistic duplicate state", () => {
  let retries = 0;
  const element = TodayPlannerCard({ tasks: [task], subjects: [subject], progress, onCompleteTask: () => {}, onEditTask: () => {}, pendingTaskId: TASK_ID, errorMessage: "Không thể lưu kế hoạch học tập.", onRetry: () => { retries += 1; }, lowestProgressSlug: null });
  const html = renderToStaticMarkup(element);
  assert.match(html, /Không thể lưu kế hoạch học tập/);
  const retryButton = elementsOfType(element, "button").find((button) => typeof button.props?.onClick === "function" && button.props?.children?.some?.((child: unknown) => String(child).includes("Thử lại")));
  retryButton?.props.onClick();
  assert.equal(retries, 1);
});

test("real server page guards every account status before study-plan repository access", async () => {
  for (const access of ["anonymous", "profile_missing", "pending", "rejected", "suspended"] as const) {
    const result = await runPageRuntime(access);
    assert.match(String(result.error), /^REDIRECT:/, JSON.stringify(result));
    assert.deepEqual(result.repositoryCalls, []);
    assert.deepEqual(result.timeline, ["auth", "redirect"]);
  }
});

test("real server page reload reads future tasks in the bounded Vietnam-date window and renders them", async () => {
  const result = await runPageRuntime("approved");
  assert.ok(!result.error, JSON.stringify(result));
  const timeline = result.timeline as string[];
  assert.equal(timeline[0], "auth");
  assert.ok((result.timeline as string[]).includes("plans"));
  assert.ok((result.timeline as string[]).includes("subjects"));
  const repositoryCalls = result.repositoryCalls as Array<[string, string, { startDate: string; endDate: string }]>;
  const planCall = repositoryCalls.find((call) => call[0] === "plans");
  assert.ok(planCall);
  assert.equal(planCall[1], "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(planCall[2].endDate, result.futureEndDate);
  assert.notEqual(planCall[2].endDate, result.todayDate);
  assert.ok(result.result, JSON.stringify(result));
  const rendered = (result.result as { props: { initialStudyPlans: Array<{ title: string; task_date: string }>; todayDate: string } }).props;
  assert.equal(rendered.todayDate, result.todayDate);
  assert.equal(rendered.initialStudyPlans[0].title, "Tác vụ tương lai thật");
  assert.equal(rendered.initialStudyPlans[0].task_date, result.futureDate);
});

test("real dashboard renders authenticated profile and study-plan data without demo values", () => {
  const dashboard = createElement(StudentDashboardClient, {
    initialProfile: { id: "550e8400-e29b-41d4-a716-446655440000", fullName: "Người dùng thật", email: "real@example.test", phone: null, faculty: "Khoa thật", major: "Ngành thật", studentCode: null, avatarUrl: null, gpaGoal: null, role: "student", accountStatus: "approved", approvedAt: null, approvedBy: null, rejectionReason: null, createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z" },
    authUserEmail: "real@example.test",
    initialStudyPlans: [task],
    studyPlanSubjects: [subject],
    todayDate: "2026-09-07"
  });
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} } as never;
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(PathnameContext.Provider, { value: "/ca-nhan" }, dashboard)));
  assert.match(html, /Người dùng thật/);
  assert.match(html, /Ôn bài/);
  assert.doesNotMatch(html, /Minh Anh|demo@lefthand\.vn/);
});
