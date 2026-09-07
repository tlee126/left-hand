"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";
import { purchasedSubjects, studentStats, demoStudent, type TaskItem, type DemoStudent } from "@/data/student-demo";
import type { StudentProfile } from "@/lib/repositories/profile-repository";
import type { DailyStudyPlanProgress, StudyPlan, StudyPlanStatus, StudyPlanSubject } from "@/lib/repositories/study-plan-repository";
import { MotionReveal } from "@/components/site/motion-reveal";
import { Clock, Trophy, TrendingUp, BookOpen, Flame, Calendar, Settings, User } from "lucide-react";
import { DashboardHero } from "@/components/student/dashboard-hero";
import { DashboardStatCard } from "@/components/student/dashboard-stat-card";
import { TodayPlannerCard } from "@/components/student/today-planner-card";
import { StudyPlanEditor } from "@/components/student/study-plan-editor";
import { SubjectFolderCard } from "@/components/student/subject-folder-card";
import { DashboardSidebar } from "@/components/student/dashboard-sidebar";
import { completeStudyPlanAction, updateStudyPlanAction, type StudyPlanActionResult } from "./actions";

interface StudentDashboardClientProps {
  initialProfile?: StudentProfile | null;
  authUserEmail?: string | null;
  initialStudyPlans?: StudyPlan[];
  studyPlanSubjects?: StudyPlanSubject[];
  todayDate?: string;
  studyPlanLoadError?: boolean;
}

function dateBefore(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function dailyProgress(tasks: StudyPlan[], date: string): DailyStudyPlanProgress {
  const matching = tasks.filter((task) => task.task_date === date);
  const completed = matching.filter((task) => task.status === "completed");
  const totalMinutes = matching.reduce((sum, task) => sum + task.duration_minutes, 0);
  return { date, totalTasks: matching.length, completedTasks: completed.length, totalMinutes, completedMinutes: completed.reduce((sum, task) => sum + task.duration_minutes, 0), percentage: matching.length ? Math.round((completed.length / matching.length) * 100) : 0 };
}

function streak(tasks: StudyPlan[], today: string): number {
  const completedDates = new Set(tasks.filter((task) => task.status === "completed" && task.task_date <= today).map((task) => task.task_date));
  let cursor = completedDates.has(today) ? today : dateBefore(today, 1);
  let result = 0;
  while (completedDates.has(cursor)) { result += 1; cursor = dateBefore(cursor, 1); }
  return result;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}

function getClientVietnamDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function toHeroTasks(tasks: StudyPlan[], subjects: StudyPlanSubject[]): TaskItem[] {
  const subjectById = new Map(subjects.map((subject) => [subject.id.toLowerCase(), subject]));
  return tasks.map((task) => { const subject = subjectById.get(task.subject_id.toLowerCase()); return { id: task.id, title: task.title, duration: `${task.duration_minutes} phút`, subjectSlug: subject?.slug ?? "ke-toan-tai-chinh-1", category: subject?.category ?? "Môn học", status: task.status === "completed" ? "done" : task.status === "in_progress" ? "current" : "todo" }; });
}

export function StudentDashboardClient({ initialProfile, authUserEmail, initialStudyPlans = [], studyPlanSubjects = [], todayDate = "", studyPlanLoadError = false }: StudentDashboardClientProps) {
  const [tasks, setTasks] = useState<StudyPlan[]>(initialStudyPlans);
  const [editingTask, setEditingTask] = useState<StudyPlan | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(studyPlanLoadError ? "Không thể tải kế hoạch học tập. Vui lòng thử lại." : null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const pendingRef = useRef(false);
  const currentDate = todayDate || getClientVietnamDate();
  const todayTasks = useMemo(() => tasks.filter((task) => task.task_date === currentDate), [tasks, currentDate]);
  const progress = useMemo(() => dailyProgress(tasks, currentDate), [tasks, currentDate]);
  const streakDays = useMemo(() => streak(tasks, currentDate), [tasks, currentDate]);
  const weeklyTasks = useMemo(() => tasks.filter((task) => task.task_date >= dateBefore(currentDate, 6) && task.task_date <= currentDate), [tasks, currentDate]);
  const weeklyProgress = weeklyTasks.length ? Math.round((weeklyTasks.filter((task) => task.status === "completed").length / weeklyTasks.length) * 100) : 0;

  const currentStudent: DemoStudent = useMemo(() => {
    const fullName = initialProfile?.fullName || (authUserEmail ? authUserEmail.split("@")[0] : demoStudent.name);
    const initials = fullName.split(" ").filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase() || "HV";
    return { name: fullName, email: initialProfile?.email || authUserEmail || demoStudent.email, faculty: initialProfile?.faculty || demoStudent.faculty, major: initialProfile?.major || demoStudent.major, gpaGoal: initialProfile?.gpaGoal !== undefined && initialProfile?.gpaGoal !== null ? Number(initialProfile.gpaGoal) : demoStudent.gpaGoal, avatarInitials: initials, currentGpa: demoStudent.currentGpa, streakDays, nextExamDays: demoStudent.nextExamDays };
  }, [initialProfile, authUserEmail, streakDays]);
  const heroTasks = useMemo(() => toHeroTasks(todayTasks, studyPlanSubjects), [todayTasks, studyPlanSubjects]);
  const lowestProgressSubject = useMemo(() => purchasedSubjects.length ? purchasedSubjects.reduce((prev, curr) => prev.progressPercent < curr.progressPercent ? prev : curr) : null, []);
  const lowestProgressSlug = lowestProgressSubject?.slug ?? null;
  const dashboardStats = useMemo(() => ({ ...studentStats, todayStudyTime: formatMinutes(progress.completedMinutes), weeklyProgress }), [progress.completedMinutes, weeklyProgress]);
  const dynamicQuote = currentStudent.nextExamDays <= 14 ? `Còn ${currentStudent.nextExamDays} ngày tới kỳ thi gần nhất — học các phần yếu trước sẽ hiệu quả hơn học dàn trải.` : lowestProgressSubject && lowestProgressSubject.progressPercent < 45 ? `Môn "${lowestProgressSubject.title}" mới đạt ${lowestProgressSubject.progressPercent}% tiến độ. Hãy dành 25 phút học phần công thức hôm nay!` : `Mỗi buổi học nhỏ hôm nay đang kéo GPA của bạn gần hơn mục tiêu ${currentStudent.gpaGoal}. Bắt đầu ngay nhé!`;

  const perform = async (taskId: string, operation: () => Promise<StudyPlanActionResult>, retry: () => void) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingTaskId(taskId); setErrorMessage(null); setSuccessMessage(null); retryRef.current = retry;
    try {
      const result = await operation();
      if (!result.success || !result.task) { setErrorMessage(result.message || "Không thể lưu kế hoạch học tập. Vui lòng thử lại sau."); return; }
      setTasks((previous) => previous.map((task) => task.id === result.task!.id ? result.task! : task));
      setEditingTask(null); setSuccessMessage(result.message || "Đã lưu kế hoạch học tập."); retryRef.current = null;
    } catch { setErrorMessage("Không thể lưu kế hoạch học tập. Vui lòng thử lại sau."); }
    finally { pendingRef.current = false; setPendingTaskId(null); }
  };

  const completeTask = (taskId: string) => perform(taskId, () => { const form = new FormData(); form.set("id", taskId); return completeStudyPlanAction({ success: false }, form); }, () => completeTask(taskId));
  const updateTask = (task: StudyPlan, input: { taskDate: string; title: string; subjectId: string; durationMinutes: number; status: StudyPlanStatus }) => perform(task.id, () => { const form = new FormData(); form.set("id", task.id); form.set("taskDate", input.taskDate); form.set("title", input.title); form.set("subjectId", input.subjectId); form.set("durationMinutes", String(input.durationMinutes)); form.set("status", input.status); return updateStudyPlanAction({ success: false }, form); }, () => updateTask(task, input));

  const statsConfig = [{ label: "Hôm nay đã học", value: dashboardStats.todayStudyTime, microcopy: "Thời lượng hoàn thành từ kế hoạch", icon: Clock, iconColor: "text-blue-500", borderColor: "border-blue-100", bgColor: "bg-blue-50/20" }, { label: "Mục tiêu GPA", value: currentStudent.gpaGoal, microcopy: `Đang từ ${currentStudent.currentGpa} → ${currentStudent.gpaGoal}`, icon: Trophy, iconColor: "text-amber-500", borderColor: "border-amber-100", bgColor: "bg-amber-50/20" }, { label: "Tiến độ tuần", value: `${weeklyProgress}%`, microcopy: "Tính từ việc học đã lưu", icon: TrendingUp, iconColor: "text-violet-500", borderColor: "border-violet-100", bgColor: "bg-violet-50/20" }, { label: "Môn đã mua", value: purchasedSubjects.length, microcopy: "Sẵn sàng trong góc học tập", icon: BookOpen, iconColor: "text-rose-500", borderColor: "border-rose-100", bgColor: "bg-rose-50/20" }, { label: "Streak học tập", value: `${streakDays} ngày`, microcopy: "Từ những ngày đã hoàn thành", icon: Flame, iconColor: "text-orange-500", borderColor: "border-orange-100", bgColor: "bg-orange-50/20" }, { label: "Kỳ thi gần nhất", value: `${currentStudent.nextExamDays} ngày`, microcopy: "Ưu tiên phần yếu trước", icon: Calendar, iconColor: "text-fuchsia-500", borderColor: "border-fuchsia-100", bgColor: "bg-fuchsia-50/20" }];

  return <div className="relative min-h-screen overflow-x-hidden bg-transparent"><div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.12),transparent_28%),radial-gradient(circle_at_center_top,rgba(248,179,29,0.1),transparent_32%)]" /><Header /><main className="mx-auto max-w-[1200px] px-4 py-8 md:py-12"><div className="mb-6 flex items-center justify-between rounded-2xl border border-[#13245d]/10 bg-white/80 p-3.5 px-5 shadow-sm"><div className="flex items-center gap-2.5 text-xs font-bold text-[#13245d]"><User className="h-4 w-4 text-[#1765e9]" /><span>Khu học tập cá nhân · {currentStudent.name}</span></div><Link href="/ca-nhan/cai-dat" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-black text-[#13245d]"><Settings className="h-3.5 w-3.5" />Cài đặt hồ sơ</Link></div><MotionReveal className="mb-8"><DashboardHero student={currentStudent} stats={dashboardStats} tasks={heroTasks} lowestProgressSlug={lowestProgressSlug} /></MotionReveal><MotionReveal className="mb-12"><div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">{statsConfig.map((stat) => <DashboardStatCard key={stat.label} {...stat} />)}</div></MotionReveal><div className="grid gap-8 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_350px]"><div className="min-w-0 space-y-12"><section id="plan" className="scroll-mt-28"><MotionReveal><TodayPlannerCard tasks={todayTasks} subjects={studyPlanSubjects} progress={progress} onCompleteTask={completeTask} onEditTask={setEditingTask} pendingTaskId={pendingTaskId} errorMessage={errorMessage} successMessage={successMessage} onRetry={() => retryRef.current?.()} lowestProgressSlug={lowestProgressSlug} />{editingTask && <StudyPlanEditor task={editingTask} subjects={studyPlanSubjects} pending={pendingTaskId === editingTask.id} errorMessage={pendingTaskId === editingTask.id ? errorMessage : null} onSubmit={(input) => updateTask(editingTask, input)} onCancel={() => setEditingTask(null)} />}</MotionReveal></section><section className="space-y-6"><MotionReveal><div><h3 className="text-lg font-black tracking-tight text-[#13245d] md:text-xl">Môn học của bạn</h3><p className="mt-1 text-xs font-bold leading-normal text-[#8091b8]">Những môn/tài nguyên bạn đã được LEFT HAND cấp quyền truy cập.</p></div></MotionReveal><div className="grid gap-6 sm:grid-cols-2">{purchasedSubjects.map((subject) => <SubjectFolderCard key={subject.id} subject={subject} />)}</div></section></div><div className="min-w-0"><MotionReveal><DashboardSidebar student={currentStudent} stats={dashboardStats} lowestProgressSubject={lowestProgressSubject} dynamicQuote={dynamicQuote} /></MotionReveal></div></div></main><Footer /><FloatingActions /></div>;
}
