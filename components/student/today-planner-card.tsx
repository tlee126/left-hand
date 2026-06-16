"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { TaskItem } from "@/data/student-demo";

interface TodayPlannerCardProps {
  tasks: TaskItem[];
  onToggleTask: (taskId: string) => void;
  lowestProgressSlug: string | null;
}

export function TodayPlannerCard({ tasks, onToggleTask, lowestProgressSlug }: TodayPlannerCardProps) {
  // Find completed tasks count
  const completedCount = useMemo(() => {
    return tasks.filter((t) => t.status === "done").length;
  }, [tasks]);

  const progressPercent = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((completedCount / tasks.length) * 100);
  }, [tasks, completedCount]);

  // Find the active current task
  const currentTask = useMemo(() => {
    return tasks.find((t) => t.status === "current");
  }, [tasks]);

  // Determine next subject URL
  const nextSubjectSlug = currentTask?.subjectSlug || lowestProgressSlug || "ke-toan-tai-chinh-1";

  return (
    <div className="relative rounded-[28px] border-2 border-[#13245d] bg-[#fffdf6] p-6 pt-10 shadow-[0_12px_28px_rgba(19,36,93,0.05)] overflow-hidden">
      {/* Notebook binder spiral coils at the top */}
      <div className="absolute top-4 left-6 right-6 flex justify-between pointer-events-none z-10 px-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            {/* The metal ring coil */}
            <div className="w-2.5 h-7 rounded-full bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 border border-slate-400 shadow-sm z-20" />
            {/* The punched paper hole */}
            <div className="w-3.5 h-3.5 -mt-2 rounded-full bg-[#ebdcb9] border border-inner border-[#13245d]/10 shadow-inner z-10" />
          </div>
        ))}
      </div>

      {/* Notebook red margin line */}
      <div className="absolute left-10 md:left-12 top-0 bottom-0 w-[1.5px] bg-red-400/40 pointer-events-none" />

      {/* Faint blue ruled lines */}
      <div 
        className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, #13245d 1px, transparent 1px)`,
          backgroundSize: '100% 36px',
          backgroundPosition: '0 40px'
        }}
      />

      <div className="relative z-10 pl-8 md:pl-10">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#13245d]/10 pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-black text-[#13245d] tracking-tight">Kế hoạch hôm nay</h3>
            <p className="mt-1 text-xs font-bold text-[#8091b8] leading-tight">
              Hoàn thành từng việc nhỏ để tích lũy kiến thức bền vững.
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <span className="text-xs font-black text-[#1765e9] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 block w-max sm:ml-auto">
              {completedCount}/{tasks.length} việc đã xong
            </span>
            <div className="mt-2 h-1.5 w-[110px] rounded-full bg-[#13245d]/10 overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#1765e9] to-[#7b3ff2] transition-all duration-300 rounded-full" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {tasks.map((task) => {
            const isDone = task.status === "done";
            const isCurrent = task.status === "current";

            return (
              <div
                key={task.id}
                onClick={() => onToggleTask(task.id)}
                className={`group flex items-center justify-between gap-4 p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  isDone
                    ? "bg-slate-100/50 border-slate-200 opacity-60 hover:opacity-80"
                    : isCurrent
                    ? "bg-[#fffdf6] border-[#1765e9] shadow-[0_4px_16px_rgba(23,101,233,0.08)] ring-1 ring-[#1765e9]/10 translate-x-1"
                    : "bg-white border-[#13245d]/10 hover:border-[#13245d]/25 hover:translate-x-0.5"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="shrink-0 transition-transform duration-200 active:scale-90">
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-50" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 group-hover:text-[#1765e9] group-hover:scale-105 transition-all" />
                    )}
                  </div>
                  <span className={`text-xs md:text-sm font-bold leading-normal truncate ${
                    isDone ? "text-[#8091b8] line-through font-semibold" : "text-[#13245d]"
                  }`}>
                    {task.title}
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 rounded bg-[#e957ff]/10 text-[#e957ff] text-[8px] font-black uppercase tracking-wider px-1 py-0.5 border border-[#e957ff]/20 animate-pulse">
                      Đang học
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-md bg-[#13245d]/5 border border-[#13245d]/10 px-2 py-0.5 text-[9px] font-black text-[#617092] uppercase tracking-wider">
                    {task.category}
                  </span>
                  <span className="text-[10px] font-bold text-[#8091b8]">
                    {task.duration}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Footer */}
        <div className="mt-6 border-t border-[#13245d]/5 pt-5 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px] font-bold text-[#8091b8] leading-tight">
            {currentTask ? (
              <>Đang dừng ở: <strong className="text-[#13245d]">{currentTask.title}</strong></>
            ) : (
              "Đã hoàn thành mọi mục tiêu đề ra hôm nay!"
            )}
          </p>
          <Link
            href={`/ca-nhan/mon/${nextSubjectSlug}`}
            className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-full bg-[#13245d] text-xs font-black text-[#fbf7ee] shadow-sm hover:bg-[#1765e9] active:scale-98 transition-all px-5"
          >
            Bắt đầu việc tiếp theo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
