"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, FileText, Sparkles, Star } from "lucide-react";
import { coverThemes } from "./theme";
import type { MaterialItem } from "@/data/catalog";

interface MaterialCardProps {
  item: MaterialItem;
}

export function MaterialCard({ item }: MaterialCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const theme = coverThemes[item.colorTheme] || coverThemes.accounting;

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
        {/* Deco dots */}
        <div className="absolute left-3 top-4 flex flex-col gap-4 opacity-60">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} className="h-2.5 w-2.5 rounded-full bg-white/55" />
          ))}
        </div>

        <div className="relative z-10 flex w-full flex-col justify-between pl-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] ${theme.badge}`}>
                {item.category.toUpperCase()}
              </span>
              {item.isHot && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ffebf6] px-2.5 py-1 text-[10px] font-bold text-[#ff2f7f]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Hot
                </span>
              )}
            </div>

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
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#edf2ff] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#3657d7]">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span>TÀI LIỆU</span>
          </div>
          <span className="text-[12px] font-semibold leading-5 text-[#8a97b4]">
            {item.pages} trang PDF
          </span>
        </div>

        <p className="line-clamp-3 min-h-[72px] text-[14px] leading-6 text-[#5f6d8f]">
          {item.description}
        </p>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-[#8091b8] border border-slate-100"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Price & Actions */}
        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between border-t border-slate-100 pt-4">
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
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href={`/tai-lieu/${item.slug}`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-slate-100/90 text-xs font-bold text-[#132a67] border border-[#132a67]/5 transition hover:bg-blue-50 hover:border-[#132a67]/15"
            >
              <Eye className="h-3.5 w-3.5 text-[#132a67]/70" />
              Xem chi tiết
            </Link>
            <Link
              href={`/?interest=${item.slug}&type=material#contact`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-xs font-bold text-white shadow-sm transition hover:opacity-95 hover:shadow-md active:scale-95"
            >
              Cần tư vấn
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
