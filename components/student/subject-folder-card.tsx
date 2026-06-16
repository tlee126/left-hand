"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, PlayCircle, UserCheck, AlertCircle } from "lucide-react";
import { PurchasedSubject } from "@/data/student-demo";

interface SubjectFolderCardProps {
  subject: PurchasedSubject;
}

const badgeColors = {
  "tài liệu": "bg-blue-50 text-blue-600 border border-blue-100",
  "khóa học": "bg-violet-50 text-violet-600 border border-violet-100",
  "tutor": "bg-rose-50 text-rose-600 border border-rose-100",
  "video": "bg-amber-50 text-amber-600 border border-amber-100"
};

const iconMapping = {
  "tài liệu": FileText,
  "khóa học": PlayCircle,
  "tutor": UserCheck,
  "video": PlayCircle
};

// Folder tab colors matching the subject category theme
const folderTabColors = {
  accounting: "bg-[#eff6ff] text-[#1e40af] border-[#3b82f6]/20",
  economics: "bg-[#faf5ff] text-[#6b21a8] border-[#a855f7]/20",
  statistics: "bg-[#f0fdfa] text-[#115e59] border-[#14b8a6]/20",
  marketing: "bg-[#fff1f2] text-[#9f1239] border-[#f43f5e]/20",
  management: "bg-[#fffbeb] text-[#92400e] border-[#f59e0b]/20",
  finance: "bg-[#f0f9ff] text-[#075985] border-[#0ea5e9]/20",
  law: "bg-[#faf7f2] text-[#78350f] border-[#d97706]/20",
  mis: "bg-[#f0fdf4] text-[#166534] border-[#22c55e]/20",
  languages: "bg-[#faf5ff] text-[#581c87] border-[#9333ea]/20"
};

export function SubjectFolderCard({ subject }: SubjectFolderCardProps) {
  const tabColor = folderTabColors[subject.colorTheme] || folderTabColors.accounting;

  return (
    <div className="relative pt-6 group hover:-translate-y-1 transition-all duration-300">
      {/* Manila Folder Tab */}
      <div 
        className={`absolute top-0.5 left-5 h-6.5 px-4 rounded-t-xl text-[9px] font-black uppercase tracking-wider flex items-center border-t border-x border-[#13245d]/10 ${tabColor} shadow-[-2px_-3px_6px_rgba(0,0,0,0.015)] z-10 pointer-events-none select-none`}
      >
        Folder: {subject.category}
      </div>

      {/* Manila Card Body */}
      <div 
        className="relative overflow-hidden rounded-b-2xl rounded-tr-2xl border-2 border-[#13245d]/10 bg-[#fffdf6] p-5 shadow-[0_8px_20px_rgba(19,37,79,0.03)] group-hover:border-[#13245d]/25 group-hover:shadow-[0_16px_32px_rgba(19,37,79,0.06)] transition-all duration-300 flex flex-col justify-between min-h-[350px]"
      >
        {/* Washi tape decoration at folder corner */}
        <div 
          className="absolute right-5 -top-1.5 h-4.5 w-14 bg-[#f8b31d]/20 border-x border-dashed border-[#13245d]/10 rotate-[-3deg] z-10 pointer-events-none"
          style={{
            clipPath: "polygon(0% 10%, 100% 0%, 98% 90%, 2% 100%)"
          }}
        />

        <div>
          {/* Header row with countdown indicator */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-black uppercase text-[#5f6d8f]">
              Mã: {subject.id}
            </span>
            <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100 flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Còn {subject.examCountdownDays} ngày thi
            </span>
          </div>

          <h4 className="text-base font-black text-[#13245d] leading-snug group-hover:text-[#1765e9] transition-colors">
            {subject.title}
          </h4>

          {/* Badges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {subject.purchasedTypes.map((type) => {
              const IconComp = iconMapping[type] || FileText;
              const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
              return (
                <span
                  key={type}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${badgeColors[type] || "bg-slate-100 text-slate-600"}`}
                >
                  <IconComp className="h-3 w-3 shrink-0" />
                  {capitalizedType}
                </span>
              );
            })}
          </div>

          {/* Study Progress */}
          <div className="mt-5 bg-white/60 rounded-xl p-3 border border-[#13245d]/5">
            <div className="flex justify-between items-baseline mb-1.5 text-[10px] font-black text-[#5f6d8f] uppercase tracking-wider">
              <span>Tiến độ học tập</span>
              <span className="text-[#1765e9]">{subject.progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#13245d]/5 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-[#1765e9] via-[#7b3ff2] to-[#e957ff] transition-all duration-500"
                style={{ width: `${subject.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Weak Points (Only if available) */}
          {subject.weakPoints && subject.weakPoints.length > 0 && (
            <div className="mt-4 bg-[#fffdf6] rounded-xl p-3 border border-dashed border-[#13245d]/10">
              <span className="text-[9px] font-black text-[#8091b8] uppercase tracking-wider block mb-1.5">
                Điểm yếu cần khắc phục:
              </span>
              <div className="space-y-1">
                {subject.weakPoints.map((point) => (
                  <span 
                    key={point} 
                    className="block text-[11px] font-bold text-rose-500 flex items-start gap-1"
                  >
                    <span className="text-rose-400 select-none">✕</span>
                    <span>{point}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Study Log */}
          <div className="mt-4 border-t border-[#13245d]/5 pt-3 text-[11px] font-bold text-[#5f6d8f] space-y-1 pl-1">
            <div className="flex justify-between">
              <span>Học lần cuối:</span>
              <span className="text-[#13245d]">{subject.lastStudied}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Mục tiêu tiếp theo:</span>
              <span className="text-[#1765e9] truncate font-extrabold text-right">{subject.nextAction}</span>
            </div>
          </div>
        </div>

        {/* CTA "Vào học" button */}
        <div className="mt-5 pt-3 border-t border-[#13245d]/5">
          <Link
            href={`/ca-nhan/mon/${subject.slug}`}
            className="w-full inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#13245d] text-xs font-black text-[#fbf7ee] shadow-sm hover:bg-[#1765e9] hover:shadow-md active:scale-98 transition-all duration-200"
          >
            Vào học
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
