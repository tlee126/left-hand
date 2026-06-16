"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Lightbulb, Flame, Trophy, Calendar, ArrowRight } from "lucide-react";
import { DemoStudent, StudentStats, PurchasedSubject } from "@/data/student-demo";

interface DashboardSidebarProps {
  student: DemoStudent;
  stats: StudentStats;
  lowestProgressSubject: PurchasedSubject | null;
  dynamicQuote: string;
}

export function DashboardSidebar({
  student,
  stats,
  lowestProgressSubject,
  dynamicQuote
}: DashboardSidebarProps) {
  // Determine recommendation target slug
  const recommendationSlug = lowestProgressSubject?.slug || "ke-toan-tai-chinh-1";

  return (
    <div className="space-y-6 lg:sticky lg:top-24">
      {/* 1. Động lực hôm nay (Sticky Note style) */}
      <div 
        className="relative overflow-hidden rounded-[22px] border border-[#eab308]/30 bg-[#fefce8] p-5 shadow-[0_10px_20px_rgba(234,179,8,0.03)] rotate-[-1deg] transition-transform duration-300 hover:rotate-0"
      >
        {/* Push-pin or Tape decoration at the top */}
        <div 
          className="absolute left-1/2 -top-1 h-3.5 w-14 -translate-x-1/2 bg-[#ef4444]/25 border-x border-dashed border-[#13245d]/10 rotate-[2deg] pointer-events-none"
          style={{
            clipPath: "polygon(0% 15%, 100% 5%, 98% 85%, 2% 95%)"
          }}
        />

        {/* Paper Fold Corner */}
        <div className="absolute right-0 top-0 h-4.5 w-4.5 bg-[#fef08a] rounded-bl-lg border-b border-l border-[#eab308]/20" />

        <div className="flex items-start gap-2.5 mt-2">
          <Sparkles className="h-5 w-5 text-[#ca8a04] shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-[#854d0e] uppercase tracking-wider">
              Động lực hôm nay
            </h4>
            <p className="text-xs font-bold leading-relaxed text-[#713f12] italic">
              "{dynamicQuote}"
            </p>
            {lowestProgressSubject && (
              <Link
                href={`/ca-nhan/mon/${lowestProgressSubject.slug}`}
                className="inline-flex items-center gap-1 text-[11px] font-black text-[#ca8a04] hover:underline"
              >
                Học theo gợi ý <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 2. LEFT HAND gợi ý (Tear-out Sheet look) */}
      {lowestProgressSubject && (
        <div className="relative overflow-hidden rounded-[24px] border-2 border-dashed border-[#13245d]/20 bg-[#fffdf6] p-5 shadow-[0_8px_20px_rgba(19,37,79,0.02)]">
          {/* Blue piece of tape decoration */}
          <div 
            className="absolute left-6 -top-2.5 h-5 w-16 bg-[#1765e9]/20 border-x border-dashed border-[#13245d]/10 rotate-[4deg] pointer-events-none"
            style={{
              clipPath: "polygon(2% 10%, 98% 0%, 95% 90%, 5% 100%)"
            }}
          />

          <div className="flex items-start gap-2.5">
            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-[#13245d] uppercase tracking-wider">
                LEFT HAND gợi ý
              </h4>
              <p className="text-xs font-bold leading-relaxed text-[#5f6d8f]">
                Môn <strong className="text-[#13245d]">{lowestProgressSubject.title}</strong> đang có tiến độ thấp nhất ({lowestProgressSubject.progressPercent}%). 
                Dành 25 phút hôm nay ôn lại công thức sẽ dễ hiểu bài hơn.
              </p>
              
              <Link
                href={`/ca-nhan/mon/${recommendationSlug}`}
                className="w-full inline-flex h-8.5 items-center justify-center gap-1.5 rounded-full bg-[#13245d] text-[10px] font-black text-[#fbf7ee] hover:bg-[#1765e9] active:scale-95 transition-all duration-200"
              >
                Học môn này ngay
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 3. Mini profile/progress summary */}
      <div className="rounded-[24px] border border-[#13245d]/10 bg-white p-5 shadow-[0_8px_24px_rgba(19,37,79,0.02)] space-y-4">
        <div className="flex items-center gap-3 border-b border-[#13245d]/5 pb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-xs font-black text-[#1765e9]">
            {student.avatarInitials}
          </div>
          <div>
            <span className="block text-xs font-black text-[#13245d]">
              {student.name}
            </span>
            <span className="block text-[9px] font-bold text-[#8091b8] uppercase tracking-wider">
              {student.major}
            </span>
          </div>
        </div>

        {/* GPA Track slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-[9px] font-black uppercase text-[#5f6d8f]">
            <span>Lộ trình GPA</span>
            <span className="text-[#1765e9]">{student.currentGpa} → {student.gpaGoal}</span>
          </div>
          {/* Custom Slider Indicator */}
          <div className="relative pt-1">
            <div className="h-1.5 w-full rounded-full bg-[#13245d]/5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#1765e9] to-[#7b3ff2] rounded-full" 
                style={{ width: `${(student.currentGpa / student.gpaGoal) * 100}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Quick specs */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-[#617092]">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-2">
            <Flame className="h-4 w-4 text-[#f8b31d] shrink-0" />
            <div>
              <span className="block text-[8px] uppercase tracking-wider text-[#8091b8] font-black">Streak</span>
              <span className="text-[#13245d] font-black">{student.streakDays} ngày</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-2">
            <Calendar className="h-4 w-4 text-[#e957ff] shrink-0" />
            <div>
              <span className="block text-[8px] uppercase tracking-wider text-[#8091b8] font-black">Mùa thi</span>
              <span className="text-[#13245d] font-black">Còn {student.nextExamDays} ngày</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
