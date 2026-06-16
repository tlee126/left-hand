"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { DemoStudent, StudentStats, TaskItem } from "@/data/student-demo";

interface DashboardHeroProps {
  student: DemoStudent;
  stats: StudentStats;
  tasks: TaskItem[];
  lowestProgressSlug: string | null;
}

export function DashboardHero({ student, stats, tasks, lowestProgressSlug }: DashboardHeroProps) {
  // Find current task
  const currentTask = tasks.find((t) => t.status === "current");
  const nextSubjectSlug = currentTask?.subjectSlug || lowestProgressSlug || "ke-toan-tai-chinh-1";

  return (
    <div className="relative overflow-hidden rounded-[28px] border-2 border-[#13245d] bg-[#fffdf6] p-6 md:p-8 shadow-[0_16px_36px_rgba(19,37,79,0.08)]">
      {/* Decorative Washi Tape (Left top) */}
      <div 
        className="absolute left-10 -top-2.5 h-6 w-24 bg-[#f8b31d]/30 border-x border-dashed border-[#13245d]/20 rotate-[-2deg] z-10 pointer-events-none"
        style={{
          clipPath: "polygon(0% 15%, 100% 5%, 98% 85%, 2% 95%)"
        }}
      />
      {/* Notebook ruled lines (faint background) */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: `linear-gradient(to bottom, #13245d 1px, transparent 1px)`,
          backgroundSize: '100% 28px',
          backgroundPosition: '0 8px'
        }}
      />
      {/* Notebook margins (vertical line on the left) */}
      <div className="absolute left-4 md:left-6 top-0 bottom-0 w-[1px] bg-red-400/20 pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between pl-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Circular avatar with notebook style */}
          <div className="relative shrink-0">
            {/* Hand-drawn look circle ring */}
            <div className="absolute -inset-1 rounded-full border-2 border-dashed border-[#7b3ff2]/40 animate-spin-slow" />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1765e9] via-[#7b3ff2] to-[#e957ff] text-xl font-black text-white shadow-[0_6px_16px_rgba(23,101,233,0.25)]">
              {student.avatarInitials}
            </div>
            {/* Small active dot */}
            <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-[#fffdf6] bg-emerald-500 shadow-sm" />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-[#13245d] tracking-tight">
                Chào mừng trở lại, {student.name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf5e2] px-2.5 py-0.5 text-[10px] font-black text-[#f8b31d] border border-[#f8b31d]/20 shadow-sm">
                <Flame className="h-3.5 w-3.5 fill-[#f8b31d]" />
                🔥 {student.streakDays} ngày giữ nhịp
              </span>
            </div>

            <p className="text-xs md:text-sm font-bold text-[#5f6d8f]">
              Hôm nay mình học gì để tiến gần hơn mục tiêu GPA {student.gpaGoal}?
            </p>

            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider text-[#7b3ff2]">
              <span className="rounded-md bg-blue-50/80 px-2 py-0.5 border border-blue-100/65 text-[#1765e9]">
                Khoa: {student.faculty}
              </span>
              <span className="rounded-md bg-purple-50/80 px-2 py-0.5 border border-purple-100/65 text-[#7b3ff2]">
                Chuyên ngành: {student.major}
              </span>
            </div>
          </div>
        </div>

        {/* Weekly Progress and CTA buttons */}
        <div className="flex flex-wrap items-center gap-6 lg:justify-end shrink-0 border-t border-[#13245d]/5 pt-4 lg:border-t-0 lg:pt-0">
          <div className="text-left">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] font-black text-[#5f6d8f] uppercase tracking-wider">Tiến độ tuần</span>
              <span className="text-xs font-black text-[#1765e9] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{stats.weeklyProgress}%</span>
            </div>
            {/* Realistic Progress Bar */}
            <div className="relative h-2 w-[140px] rounded-full bg-[#13245d]/10 overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#1765e9] to-[#7b3ff2] rounded-full" 
                style={{ width: `${stats.weeklyProgress}%` }} 
              />
            </div>
          </div>

          <div className="flex gap-2.5">
            <Link
              href={`/ca-nhan/mon/${nextSubjectSlug}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#13245d] text-xs font-black text-[#fbf7ee] border-2 border-[#13245d] shadow-[0_6px_16px_rgba(19,36,93,0.15)] hover:bg-[#1765e9] hover:border-[#1765e9] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 px-6"
            >
              Tiếp tục học
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#plan"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white text-xs font-black text-[#13245d] border-2 border-[#13245d]/15 shadow-sm hover:border-[#13245d] hover:bg-slate-50 transition-all duration-200 px-5"
            >
              Kế hoạch hôm nay
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
