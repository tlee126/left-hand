/** Runtime rendering and interaction coverage for the persisted study-plan UI. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayPlannerCard } from "../../components/student/today-planner-card";
import { StudyPlanEditor } from "../../components/student/study-plan-editor";

const SUBJECT_ID = "650e8400-e29b-41d4-a716-446655440000";
const TASK_ID = "950e8400-e29b-41d4-a716-446655440000";
const task = { id: TASK_ID, user_id: "550e8400-e29b-41d4-a716-446655440000", task_date: "2026-09-07", title: "Ôn bài", subject_id: SUBJECT_ID, duration_minutes: 25, status: "pending" as const, completed_at: null, created_at: "2026-09-07T00:00:00.000Z", updated_at: "2026-09-07T00:00:00.000Z" };
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
