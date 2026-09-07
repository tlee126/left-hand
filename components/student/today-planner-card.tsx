"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Pencil, RefreshCw } from "lucide-react";
import type { StudyPlan, StudyPlanSubject, DailyStudyPlanProgress } from "@/lib/repositories/study-plan-repository";

interface TodayPlannerCardProps {
  tasks: StudyPlan[];
  subjects: StudyPlanSubject[];
  progress: DailyStudyPlanProgress;
  onCompleteTask: (taskId: string) => void;
  onEditTask: (task: StudyPlan) => void;
  pendingTaskId: string | null;
  errorMessage?: string | null;
  successMessage?: string | null;
  onRetry?: () => void;
  lowestProgressSlug: string | null;
}

export function TodayPlannerCard({ tasks, subjects, progress, onCompleteTask, onEditTask, pendingTaskId, errorMessage, successMessage, onRetry, lowestProgressSlug }: TodayPlannerCardProps) {
  const subjectById = new Map(subjects.map((subject) => [subject.id.toLowerCase(), subject]));
  const currentTask = tasks.find((task) => task.status === "in_progress") ?? tasks.find((task) => task.status === "pending");
  const nextSubjectSlug = (currentTask && subjectById.get(currentTask.subject_id.toLowerCase())?.slug) || lowestProgressSlug || "ke-toan-tai-chinh-1";

  return (
    <div className="relative overflow-hidden rounded-[28px] border-2 border-[#13245d] bg-[#fffdf6] p-6 pt-10 shadow-[0_12px_28px_rgba(19,36,93,0.05)]">
      <div className="pointer-events-none absolute left-6 right-6 top-4 z-10 flex justify-between px-4">{[...Array(6)].map((_, index) => <div key={index} className="flex flex-col items-center"><div className="z-20 h-7 w-2.5 rounded-full border border-slate-400 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 shadow-sm" /><div className="z-10 -mt-2 h-3.5 w-3.5 rounded-full border border-[#13245d]/10 bg-[#ebdcb9] shadow-inner" /></div>)}</div>
      <div className="pointer-events-none absolute bottom-0 left-10 top-0 w-px bg-red-400/40 md:left-12" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(to bottom, #13245d 1px, transparent 1px)", backgroundSize: "100% 36px", backgroundPosition: "0 40px" }} />
      <div className="relative z-10 pl-8 md:pl-10">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#13245d]/10 pb-4 sm:flex-row sm:items-center"><div><h3 className="text-lg font-black tracking-tight text-[#13245d]">Kế hoạch hôm nay</h3><p className="mt-1 text-xs font-bold leading-tight text-[#8091b8]">Hoàn thành từng việc nhỏ để tích lũy kiến thức bền vững.</p></div><div className="shrink-0 text-left sm:text-right"><span className="block w-max rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-black text-[#1765e9] sm:ml-auto">{progress.completedTasks}/{progress.totalTasks} việc đã xong</span><div className="mt-2 h-1.5 w-[110px] overflow-hidden rounded-full bg-[#13245d]/10 shadow-inner"><div className="h-full rounded-full bg-gradient-to-r from-[#1765e9] to-[#7b3ff2] transition-all duration-300" style={{ width: `${progress.percentage}%` }} /></div><span className="mt-1 block text-[10px] font-bold text-[#8091b8]">{progress.completedMinutes}/{progress.totalMinutes} phút</span></div></div>
        {errorMessage && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><span>{errorMessage}</span>{onRetry && <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1"><RefreshCw className="h-3 w-3" /> Thử lại</button>}</div>}
        {successMessage && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{successMessage}</p>}
        <div className="space-y-3">{tasks.length === 0 ? <div className="rounded-2xl border border-dashed border-[#13245d]/20 bg-white/70 p-6 text-center text-xs font-bold text-[#8091b8]">Chưa có việc học nào cho hôm nay.</div> : tasks.map((task) => { const isDone = task.status === "completed"; const isCurrent = task.status === "in_progress"; const subject = subjectById.get(task.subject_id.toLowerCase()); const isPending = pendingTaskId === task.id; return <div key={task.id} className={`group flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-200 ${isDone ? "border-slate-200 bg-slate-100/50 opacity-60" : isCurrent ? "translate-x-1 border-[#1765e9] bg-[#fffdf6] shadow-[0_4px_16px_rgba(23,101,233,0.08)] ring-1 ring-[#1765e9]/10" : "border-[#13245d]/10 bg-white hover:border-[#13245d]/25"}`}><button type="button" disabled={isDone || isPending} onClick={() => onCompleteTask(task.id)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left disabled:cursor-default"><span className="shrink-0">{isDone ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-slate-300 group-hover:text-[#1765e9]" />}</span><span className={`truncate text-xs font-bold leading-normal md:text-sm ${isDone ? "text-[#8091b8] line-through" : "text-[#13245d]"}`}>{task.title}</span>{isCurrent && <span className="shrink-0 rounded border border-[#e957ff]/20 bg-[#e957ff]/10 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#e957ff]">Đang học</span>}</button><div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-md border border-[#13245d]/10 bg-[#13245d]/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#617092] sm:inline">{subject?.name ?? "Môn học"}</span><span className="text-[10px] font-bold text-[#8091b8]">{task.duration_minutes} phút</span><button type="button" aria-label={`Sửa ${task.title}`} disabled={isPending} onClick={() => onEditTask(task)} className="rounded-full p-1.5 text-[#8091b8] hover:bg-blue-50 hover:text-[#1765e9] disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /></button></div></div>; })}</div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#13245d]/5 pt-5"><p className="text-[11px] font-bold leading-tight text-[#8091b8]">{currentTask ? <>Việc tiếp theo: <strong className="text-[#13245d]">{currentTask.title}</strong></> : "Đã hoàn thành mọi mục tiêu đề ra hôm nay!"}</p><Link href={`/ca-nhan/mon/${nextSubjectSlug}`} className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-full bg-[#13245d] px-5 text-xs font-black text-[#fbf7ee] shadow-sm transition-all hover:bg-[#1765e9]">Bắt đầu việc tiếp theo <ArrowRight className="h-3.5 w-3.5" /></Link></div>
      </div>
    </div>
  );
}
