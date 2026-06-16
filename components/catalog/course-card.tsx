"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, Clock, PlayCircle, Star, User, Video } from "lucide-react";
import { coverThemes } from "./theme";
import type { CourseItem } from "@/data/catalog";

interface CourseCardProps {
  item: CourseItem;
}

const formatLabels = {
  online: "Online",
  offline: "Offline tại CS",
  video: "Video tự học",
  zoom: "Học qua Zoom"
};

const statusConfig = {
  open: { label: "Đang nhận đăng ký", class: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
  "coming-soon": { label: "Sắp mở lớp", class: "bg-amber-50 text-amber-600 border border-amber-100" },
  full: { label: "Hết chỗ", class: "bg-rose-50 text-rose-500 border border-rose-100" }
};

export function CourseCard({ item }: CourseCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const theme = coverThemes[item.colorTheme] || coverThemes.economics;
  const status = statusConfig[item.status] || statusConfig.open;

  return (
    <motion.article
      layout
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-[#1b2e7440] bg-white shadow-[0_12px_26px_rgba(19,37,79,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(19,37,79,0.14)]"
    >
      <div
        className={`relative flex h-[165px] overflow-hidden rounded-b-none rounded-t-[22px] bg-gradient-to-br ${theme.background} px-5 py-4 text-white transition duration-500 group-hover:scale-[1.02]`}
      >
        {/* Spiral decorative lines */}
        <div className="absolute left-3 top-4 flex flex-col gap-4 opacity-60">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} className="h-2.5 w-2.5 rounded-full bg-white/55" />
          ))}
        </div>

        <div className="relative z-10 flex w-full flex-col justify-between pl-5">
          <div className="flex items-start justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] ${theme.badge}`}>
              {item.category.toUpperCase()}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${theme.rating}`}>
              <Star className="h-3.5 w-3.5 fill-current" />
              {item.rating}
            </span>
          </div>

          <h3 className="max-w-[15ch] text-balance text-[1.1rem] font-extrabold leading-7 text-white sm:text-[1.2rem]">
            {item.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Row 1: Format & Status */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf8ec] px-3 py-1 text-xs font-bold text-[#f59e0b] border border-[#fef3c7]">
            <Video className="h-3.5 w-3.5" />
            <span>{formatLabels[item.format]}</span>
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.class}`}>
            {status.label}
          </span>
        </div>

        <p className="line-clamp-3 text-[14px] leading-6 text-[#5f6d8f]">
          {item.description}
        </p>

        {/* Detailed specs */}
        <div className="mt-4 space-y-2.5 border-t border-b border-slate-100 py-3.5 text-xs text-[#617092]">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-accent/70 shrink-0" />
            <span>Thời lượng: <strong>{item.duration}</strong> ({item.sessions} buổi)</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-accent/70 shrink-0" />
            <span className="truncate">Lịch học: {item.schedule}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-accent/70 shrink-0" />
            <span className="truncate">Mentor: {item.mentor}</span>
          </div>
        </div>

        {/* Price & Actions */}
        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-[1.15rem] font-black text-[#243152]">
                {item.price}
              </strong>
              {item.oldPrice && (
                <span className="text-sm font-semibold text-[#9ca7bf] line-through">
                  {item.oldPrice}
                </span>
              )}
            </div>
            {item.tags?.[0] && (
              <span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-bold text-[#8091b8] border border-slate-100">
                {item.tags[0]}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href={`/khoa-hoc/${item.slug}`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-slate-100/90 text-xs font-bold text-[#132a67] border border-[#132a67]/5 transition hover:bg-blue-50 hover:border-[#132a67]/15"
            >
              Chi tiết lớp
            </Link>
            <Link
              href={`/?interest=${item.slug}&type=course#contact`}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-xs font-bold text-white shadow-sm transition active:scale-95 ${
                item.status === "full"
                  ? "bg-slate-300 cursor-not-allowed pointer-events-none"
                  : "bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 hover:opacity-95 hover:shadow-md"
              }`}
            >
              Đăng ký lớp
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
