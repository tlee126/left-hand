"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";
import { MotionReveal } from "@/components/site/motion-reveal";
import type { StudentProfile } from "@/lib/repositories/profile-repository";
import type { CreateStudyPlanInput, DailyStudyPlanProgress, StudyPlan, StudyPlanStatus, StudyPlanSubject } from "@/lib/repositories/study-plan-repository";
import type { StudentMaterialDiscoveryData } from "@/lib/repositories/student-material-discovery-repository";
import { ArrowRight, Clock, Flame, BookOpen, CalendarPlus, FileText, Settings, User, TrendingUp } from "lucide-react";
import { DashboardStatCard } from "@/components/student/dashboard-stat-card";
import { TodayPlannerCard } from "@/components/student/today-planner-card";
import { StudyPlanCreateForm, StudyPlanEditor } from "@/components/student/study-plan-editor";
import { completeStudyPlanAction, createStudyPlanAction, updateStudyPlanAction, type StudyPlanActionResult } from "./actions";

interface StudentDashboardClientProps {
  initialProfile?: StudentProfile | null;
  authUserEmail?: string | null;
  initialStudyPlans?: StudyPlan[];
  studyPlanSubjects?: StudyPlanSubject[];
  todayDate?: string;
  studyPlanLoadError?: boolean;
  materialDiscovery?: StudentMaterialDiscoveryData;
  materialDiscoveryLoadError?: boolean;
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

export function StudentDashboardClient({ initialProfile, authUserEmail, initialStudyPlans = [], studyPlanSubjects = [], todayDate = "", studyPlanLoadError = false, materialDiscovery = { subjects: [], directMaterials: [] }, materialDiscoveryLoadError = false }: StudentDashboardClientProps) {
  const router = useRouter();
  const [refreshPending, startRefresh] = useTransition();
  const [tasks, setTasks] = useState<StudyPlan[]>(initialStudyPlans);
  const [editingTask, setEditingTask] = useState<StudyPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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
  const pastTasks = useMemo(() => tasks.filter((task) => task.task_date < currentDate), [tasks, currentDate]);
  const futureTasks = useMemo(() => tasks.filter((task) => task.task_date > currentDate), [tasks, currentDate]);
  const fullName = initialProfile?.fullName?.trim() || "Học viên";
  const email = initialProfile?.email || authUserEmail || "Email chưa cập nhật";

  const perform = async (taskId: string, operation: () => Promise<StudyPlanActionResult>, retry: () => void) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingTaskId(taskId); setErrorMessage(null); setSuccessMessage(null); retryRef.current = retry;
    try {
      const result = await operation();
      if (!result.success || !result.task) { setErrorMessage(result.message || "Không thể lưu kế hoạch học tập. Vui lòng thử lại sau."); return; }
      setTasks((previous) => { const existingIndex = previous.findIndex((task) => task.id === result.task!.id || task.request_key === result.task!.request_key); if (existingIndex < 0) return [...previous, result.task!]; return previous.map((task, index) => index === existingIndex ? result.task! : task); });
      setEditingTask(null); setCreateOpen(false); setSuccessMessage(result.message || "Đã lưu kế hoạch học tập."); retryRef.current = null;
    } catch { setErrorMessage("Không thể lưu kế hoạch học tập. Vui lòng thử lại sau."); }
    finally { pendingRef.current = false; setPendingTaskId(null); }
  };

  const completeTask = (taskId: string) => perform(taskId, () => { const form = new FormData(); form.set("id", taskId); return completeStudyPlanAction({ success: false }, form); }, () => completeTask(taskId));
  const updateTask = (task: StudyPlan, input: { taskDate: string; title: string; subjectId: string; durationMinutes: number; status: StudyPlanStatus }) => perform(task.id, () => { const form = new FormData(); form.set("id", task.id); form.set("taskDate", input.taskDate); form.set("title", input.title); form.set("subjectId", input.subjectId); form.set("durationMinutes", String(input.durationMinutes)); form.set("status", input.status); return updateStudyPlanAction({ success: false }, form); }, () => updateTask(task, input));
  const createTask = (input: CreateStudyPlanInput) => perform(input.requestKey, () => { const form = new FormData(); form.set("requestKey", input.requestKey); form.set("taskDate", input.taskDate); form.set("title", input.title); form.set("subjectId", input.subjectId); form.set("durationMinutes", String(input.durationMinutes)); if (input.status) form.set("status", input.status); return createStudyPlanAction({ success: false }, form); }, () => createTask(input));

  const statsConfig = [
    { label: "Hôm nay đã học", value: formatMinutes(progress.completedMinutes), microcopy: "Thời lượng hoàn thành từ kế hoạch", icon: Clock, iconColor: "text-blue-500", borderColor: "border-blue-100", bgColor: "bg-blue-50/20" },
    { label: "Tiến độ tuần", value: `${weeklyProgress}%`, microcopy: "Tính từ việc học đã lưu", icon: TrendingUp, iconColor: "text-violet-500", borderColor: "border-violet-100", bgColor: "bg-violet-50/20" },
    { label: "Streak học tập", value: `${streakDays} ngày`, microcopy: "Từ những ngày đã hoàn thành", icon: Flame, iconColor: "text-orange-500", borderColor: "border-orange-100", bgColor: "bg-orange-50/20" },
    { label: "Việc đã lưu", value: tasks.length, microcopy: "Từ study plans của bạn", icon: BookOpen, iconColor: "text-rose-500", borderColor: "border-rose-100", bgColor: "bg-rose-50/20" },
    { label: "Môn khả dụng", value: materialDiscoveryLoadError ? "—" : materialDiscovery.subjects.length, microcopy: "Theo quyền truy cập hiện tại", icon: CalendarPlus, iconColor: "text-fuchsia-500", borderColor: "border-fuchsia-100", bgColor: "bg-fuchsia-50/20" }
  ];

  return <div className="relative min-h-screen overflow-x-hidden bg-transparent"><Header /><main className="mx-auto max-w-[1200px] px-4 py-8 md:py-12"><div className="mb-6 flex items-center justify-between rounded-2xl border border-[#13245d]/10 bg-white/80 p-3.5 px-5 shadow-sm"><div className="flex items-center gap-2.5 text-xs font-bold text-[#13245d]"><User className="h-4 w-4 text-[#1765e9]" /><span>Khu học tập cá nhân · {fullName}</span></div><Link href="/ca-nhan/cai-dat" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-black text-[#13245d]"><Settings className="h-3.5 w-3.5" />Cài đặt hồ sơ</Link></div><section className="mb-8 rounded-[28px] border-2 border-[#13245d] bg-[#fffdf6] p-6 shadow-[0_16px_36px_rgba(19,37,79,0.08)]"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-black tracking-tight text-[#13245d]">Chào mừng trở lại, {fullName}</h1><p className="mt-1 text-sm font-bold text-[#5f6d8f]">{email}</p><p className="mt-3 text-xs font-bold text-[#8091b8]">{initialProfile?.faculty || "Khoa chưa cập nhật"}{initialProfile?.major ? ` · ${initialProfile.major}` : ""}</p></div><div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs font-black text-[#1765e9]">Ngày học hiện tại: {currentDate}</div></div></section><section className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">{statsConfig.map((stat) => <DashboardStatCard key={stat.label} {...stat} />)}</section><div className="grid gap-8 lg:grid-cols-[1fr_320px]"><div className="min-w-0 space-y-8"><section className="rounded-2xl border border-[#13245d]/10 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-[#13245d]">Môn học có quyền truy cập</h2><p className="mt-1 text-xs font-bold text-[#8091b8]">Chỉ hiển thị môn có entitlement hoặc tài liệu được cấp riêng còn hiệu lực.</p></div><BookOpen className="h-5 w-5 text-[#1765e9]" /></div>{materialDiscoveryLoadError ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-bold text-rose-700"><p>Không thể tải danh sách quyền truy cập. Vui lòng thử lại sau.</p><button type="button" onClick={() => startRefresh(() => router.refresh())} disabled={refreshPending} className="mt-3 min-h-9 rounded-full bg-[#13245d] px-4 py-2 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60">{refreshPending ? "Đang thử lại…" : "Thử lại"}</button></div> : materialDiscovery.subjects.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-[#13245d]/20 bg-slate-50/60 p-5 text-center text-xs font-bold text-[#8091b8]">Bạn chưa có môn học hoặc tài liệu được cấp quyền.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{materialDiscovery.subjects.map((subject) => <Link key={subject.id} href={`/ca-nhan/mon/${encodeURIComponent(subject.slug)}`} className="group rounded-2xl border border-slate-100 p-4 transition hover:border-blue-200 hover:bg-blue-50/30"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-wider text-[#8091b8]">{subject.category}</span><h3 className="mt-1 text-sm font-black text-[#13245d] group-hover:text-[#1765e9]">{subject.name}</h3></div><ArrowRight className="h-4 w-4 shrink-0 text-[#8091b8] group-hover:text-[#1765e9]" /></div><span className="mt-3 inline-flex rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-[#3657d7]">{subject.accessSource === "direct_grant" ? "Có tài liệu được cấp riêng" : subject.accessSource === "both" ? "Quyền môn học + cấp riêng" : "Theo quyền môn học"}</span></Link>)}</div>}</section>{!materialDiscoveryLoadError && <section className="rounded-2xl border border-[#13245d]/10 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-[#13245d]">Tài liệu được cấp riêng</h2><p className="mt-1 text-xs font-bold text-[#8091b8]">Các tài liệu này có quyền riêng theo tài khoản của bạn.</p></div><FileText className="h-5 w-5 text-violet-600" /></div>{materialDiscovery.directMaterials.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-[#13245d]/20 bg-slate-50/60 p-5 text-center text-xs font-bold text-[#8091b8]">Chưa có tài liệu được cấp riêng.</p> : <div className="mt-4 space-y-3">{materialDiscovery.directMaterials.map((material) => <article key={material.productId} className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/30 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="truncate text-sm font-black text-[#13245d]">{material.title}</h3><p className="mt-1 text-xs font-bold text-[#5f6d8f]">Môn: {material.subjectName}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black"><span className="rounded-full bg-white px-2 py-1 text-violet-700">Được cấp riêng</span><span className="rounded-full bg-white px-2 py-1 text-[#5f6d8f]">{material.allowDownload ? "Được phép tải" : "Chỉ xem"}</span>{material.expiresAt && <span className="text-[#8091b8]">Hết hạn: {formatAccessExpiry(material.expiresAt)}</span>}</div></div><Link href={`/ca-nhan/mon/${encodeURIComponent(material.subjectSlug)}?page=${material.workspacePage}&material=${encodeURIComponent(material.productId)}`} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#13245d] px-4 py-2 text-xs font-black text-white hover:bg-[#1765e9]">Mở tài liệu <ArrowRight className="h-3.5 w-3.5" /></Link></article>)}</div>}</section>}<section id="plan" className="scroll-mt-28"><MotionReveal><TodayPlannerCard tasks={todayTasks} subjects={studyPlanSubjects} progress={progress} onCompleteTask={completeTask} onEditTask={setEditingTask} pendingTaskId={pendingTaskId} errorMessage={errorMessage} successMessage={successMessage} onRetry={() => retryRef.current?.()} lowestProgressSlug={null} />{editingTask && <StudyPlanEditor task={editingTask} subjects={studyPlanSubjects} pending={pendingTaskId === editingTask.id} errorMessage={pendingTaskId === editingTask.id ? errorMessage : null} onSubmit={(input) => updateTask(editingTask, input)} onCancel={() => setEditingTask(null)} />}</MotionReveal></section><section className="rounded-2xl border border-[#13245d]/10 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#13245d]">Thêm việc học</h2><p className="mt-1 text-xs font-bold text-[#8091b8]">Request key được giữ nguyên trong suốt retry.</p></div><button type="button" onClick={() => setCreateOpen((open) => !open)} className="rounded-full bg-[#13245d] px-4 py-2 text-xs font-black text-white">{createOpen ? "Đóng" : "Thêm việc"}</button></div>{createOpen && <StudyPlanCreateForm subjects={studyPlanSubjects} pending={pendingTaskId !== null} errorMessage={errorMessage} successMessage={successMessage} onSubmit={createTask} onCancel={() => setCreateOpen(false)} />}</section>{futureTasks.length > 0 ? <section className="rounded-2xl border border-[#13245d]/10 bg-white p-5"><h2 className="text-lg font-black text-[#13245d]">Kế hoạch sắp tới</h2><div className="mt-4 space-y-2">{futureTasks.map((task) => <button type="button" key={task.id} onClick={() => setEditingTask(task)} className="flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2 text-left text-xs font-bold text-[#13245d]"><span>{task.task_date} · {task.title}</span><span>{task.duration_minutes} phút</span></button>)}</div></section> : <section className="rounded-2xl border border-dashed border-[#13245d]/20 bg-white/70 p-5 text-xs font-bold text-[#8091b8]">Chưa có kế hoạch cho ngày tương lai trong phạm vi 30 ngày.</section>}{pastTasks.length > 0 && <section className="rounded-2xl border border-[#13245d]/10 bg-white p-5"><h2 className="text-lg font-black text-[#13245d]">Nhật ký gần đây</h2><div className="mt-4 space-y-2">{pastTasks.map((task) => <div key={task.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs font-bold text-[#5f6d8f]"><span>{task.task_date} · {task.title}</span><span>{task.status === "completed" ? "Đã hoàn thành" : "Chưa hoàn thành"}</span></div>)}</div></section>}</div><aside className="rounded-2xl border border-[#13245d]/10 bg-white p-5 text-sm font-bold text-[#5f6d8f]"><h2 className="text-base font-black text-[#13245d]">Dữ liệu cá nhân</h2><p className="mt-3">GPA và lịch thi chưa có nguồn dữ liệu trong hồ sơ hiện tại.</p><p className="mt-2 text-xs text-[#8091b8]">Các chỉ số trên được tính trực tiếp từ study plans đã lưu.</p></aside></div></main><Footer /><FloatingActions /></div>;
}

function formatAccessExpiry(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
