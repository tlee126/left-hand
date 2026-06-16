"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Star, Users } from "lucide-react";
import { coverThemes } from "./theme";
import type { TutorItem } from "@/data/catalog";

interface TutorCardProps {
  item: TutorItem;
}

// Function to extract initials (e.g. "Tutor Minh Thư" -> "MT", "Tutor Hoàng Nam" -> "HN")
function getInitials(name: string): string {
  const cleanName = name.replace(/^tutor\s+/i, "");
  const parts = cleanName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleanName.substring(0, 2).toUpperCase();
}

export function TutorCard({ item }: TutorCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const theme = coverThemes[item.colorTheme] || coverThemes.finance;
  const initials = getInitials(item.name);
  const primarySubject = item.subjects[0] || "Chọn môn";

  return (
    <motion.article
      layout
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="notebook-info-card group flex h-full flex-col p-6"
    >
      {/* Torn corner detail */}
      <div className="notebook-card-fold" />

      {/* Profile Header */}
      <div className="relative z-10 flex items-start gap-4">
        {/* Avatar Initials Bubble */}
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.background} text-lg font-black text-white shadow-md transition-transform duration-300 group-hover:scale-[1.04]`}
        >
          {initials}
        </div>

        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-[#132a67] transition-colors group-hover:text-accent">
            {item.name}
          </h3>
          <p className="mt-0.5 truncate text-xs font-semibold text-[#8091b8]">
            Khoa: {item.faculty}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <span className="flex items-center gap-0.5 text-xs font-extrabold text-amber-500">
              <Star className="h-3 w-3 fill-current" />
              {item.rating.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-300">•</span>
            <span className="text-xs font-bold text-accent">{item.format}</span>
          </div>
        </div>
      </div>

      {/* Bio Description */}
      <p className="relative z-10 mt-4 line-clamp-3 text-xs leading-5 text-[#5f6d8f]">
        {item.shortBio}
      </p>

      {/* Subjects Taught */}
      <div className="relative z-10 mt-4">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#a0aed0]">
          Học phần hỗ trợ
        </h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.subjects.map((subj) => (
            <span
              key={subj}
              className="rounded-lg bg-blue-50/70 border border-blue-100/50 px-2.5 py-1 text-xs font-semibold text-accent"
            >
              {subj}
            </span>
          ))}
        </div>
      </div>

      {/* Strengths */}
      <div className="relative z-10 mt-4 space-y-1.5">
        {item.strengths.map((str, idx) => (
          <div key={idx} className="flex items-start gap-1.5 text-xs text-[#617092]">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={3} />
            <span>{str}</span>
          </div>
        ))}
      </div>

      {/* Footer Info: Price & availability */}
      <div className="relative z-10 mt-auto pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs font-semibold">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-[#8a97b4]">Chi phí học</span>
            <strong className="text-sm font-black text-[#243152]">{item.price}</strong>
          </div>
          <div className="text-right">
            <span className="block text-[10px] uppercase tracking-wider text-[#8a97b4]">Lịch trống</span>
            <span className="text-accent font-bold text-[11px]">{item.availability}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href={`/tutor/${item.slug}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-slate-100/90 text-xs font-bold text-[#132a67] border border-[#132a67]/5 transition hover:bg-blue-50 hover:border-[#132a67]/15"
          >
            Xem hồ sơ
          </Link>
          <Link
            href={`/?interest=${item.slug}&type=tutor#contact`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-xs font-bold text-white shadow-sm transition hover:opacity-95 hover:shadow-md active:scale-95"
          >
            Đặt lịch tutor
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
