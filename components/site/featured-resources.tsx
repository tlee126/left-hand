"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  PlayCircle,
  Search,
  Sparkles,
  Star
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { categoryFilterOptions } from "@/components/catalog/catalog-options";
import { coverThemes } from "@/components/catalog/theme";
import type { Category } from "@/lib/domain/subjects";
import { formatVND } from "@/lib/domain/product-types";
import { normalizeCatalogSearch } from "@/lib/domain/catalog";
import { buildFeaturedResources, type FeaturedResourceItem } from "@/lib/domain/catalog-presentations";

export { buildFeaturedResources } from "@/lib/domain/catalog-presentations";

type ResourceItem = FeaturedResourceItem;

type FilterKey = "Tất cả" | "Tài liệu" | "Khóa học" | Category;

const filters: Array<{ label: FilterKey; icon: string }> = [
  { label: "Tất cả", icon: "" },
  { label: "Tài liệu", icon: "📚" },
  { label: "Khóa học", icon: "🎥" },
  ...categoryFilterOptions.filter((filter) => filter.label !== "Tất cả")
];

function matchesFilter(item: ResourceItem, filter: FilterKey) {
  if (filter === "Tất cả") return true;
  if (filter === "Tài liệu") return item.type === "TÀI LIỆU";
  if (filter === "Khóa học") return item.type === "KHÓA HỌC";
  return item.category === filter;
}

export interface FeaturedResourcesProps {
  resources?: readonly ResourceItem[];
  /** Compatibility input for non-production callers; the homepage sends resources. */
  materials?: Parameters<typeof buildFeaturedResources>[0];
  courses?: Parameters<typeof buildFeaturedResources>[1];
  loadError?: boolean;
}

export function FeaturedResources({ resources, materials = [], courses = [], loadError = false }: FeaturedResourcesProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("Tất cả");
  const [query, setQuery] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const filterContainerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const resourceData = useMemo(
    () => resources ?? buildFeaturedResources(materials, courses),
    [resources, materials, courses]
  );

  useEffect(() => {
    if (!filterContainerRef.current) return;
    const activeEl = filterContainerRef.current.querySelector<HTMLButtonElement>(
      `[data-filter-active="true"]`
    );
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest"
      });
    }
  }, [activeFilter]);

  const filteredResources = useMemo(() => {
    const normalized = normalizeCatalogSearch(query);

    return resourceData.filter((item) => {
      const passesFilter = matchesFilter(item, activeFilter);
      const haystack = [
        item.title,
        item.subject,
        item.category,
        item.description,
        item.meta,
        ...(item.tags || [])
      ]
        .join(" ");

      const passesQuery = normalized.length === 0 || normalizeCatalogSearch(haystack).includes(normalized);

      return passesFilter && passesQuery;
    });
  }, [resourceData, activeFilter, query]);

  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener("scroll", checkScroll, { passive: true });
      const observer = new ResizeObserver(() => checkScroll());
      observer.observe(container);
      return () => {
        container.removeEventListener("scroll", checkScroll);
        observer.disconnect();
      };
    }
  }, [filteredResources]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ left: 0 });
      checkScroll();
    }
  }, [activeFilter, query]);

  const handleScroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const cardWidth = 310; // Matches sm:w-[310px]
      const gap = 24; // gap-6
      const scrollAmount = direction === "left" ? -(cardWidth + gap) : (cardWidth + gap);
      container.scrollBy({
        left: scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <section id="resources" className="container-shell pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <MotionReveal className="max-w-[920px] flex-1">
            <SectionHeading
              className="mb-0"
              align="left"
              prefix="Kho tài liệu &"
              highlight="Khóa học bứt phá điểm thi"
            />
          </MotionReveal>

          <MotionReveal delay={0.05} className="flex items-center gap-4 shrink-0 self-start lg:self-end">
            <Link
              href="/tai-lieu"
              className="inline-flex items-center text-sm font-bold text-accent transition hover:translate-x-0.5"
            >
              Xem đầy đủ kho tài liệu →
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => handleScroll("left")}
                disabled={!canScrollLeft}
                aria-label="Xem sản phẩm trước"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white text-ink transition hover:bg-slate-50 hover:border-ink/20 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll("right")}
                disabled={!canScrollRight}
                aria-label="Xem sản phẩm tiếp theo"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white text-ink transition hover:bg-slate-50 hover:border-ink/20 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </MotionReveal>
        </div>

        <MotionReveal delay={0.08} className="mt-6">
          <div className="mb-8 rounded-[24px] border border-[#1b2e7442] bg-white/90 p-4 shadow-[0_14px_28px_rgba(19,37,79,0.06)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between w-full">
              {/* Horizontal scrolling filter bar with hidden scrollbar */}
              <div
                ref={filterContainerRef}
                className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-none pb-1 xl:pb-0 flex-1 min-w-0 scroll-smooth"
              >
                {filters.map((filter) => {
                  const isActive = activeFilter === filter.label;

                  return (
                    <button
                      key={filter.label}
                      type="button"
                      onClick={() => setActiveFilter(filter.label)}
                      data-filter-active={isActive ? "true" : "false"}
                      className={[
                        "inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition shrink-0",
                        isActive
                          ? "bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.25)] hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700"
                          : "bg-slate-100 text-[#22325f] hover:bg-slate-200/80"
                      ].join(" ")}
                    >
                      {filter.icon ? <span className="mr-2">{filter.icon}</span> : null}
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <label className="relative block w-full xl:max-w-[360px] shrink-0">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8091b8]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm kiếm tài liệu, môn học..."
                  className="h-11 w-full rounded-[18px] border border-[#d8deef] bg-slate-50/90 pl-12 pr-4 text-sm font-medium text-[#22325f] outline-none transition placeholder:text-[#98a4be] focus:border-accent/45 focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
              </label>
            </div>
          </div>
        </MotionReveal>

        <motion.div
          ref={scrollContainerRef}
          layout
          className="scrollbar-none flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scroll-smooth"
        >
          <AnimatePresence mode="popLayout">
            {filteredResources.map((item) => {
              const theme = coverThemes[item.colorTheme];
              const isCourse = item.type === "KHÓA HỌC";

              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="group w-[85vw] sm:w-[310px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-[#1b2e7440] bg-white shadow-[0_12px_26px_rgba(19,37,79,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(19,37,79,0.14)]"
                >
                  <div
                    className={`relative flex h-[160px] overflow-hidden rounded-b-none rounded-t-[22px] bg-gradient-to-br ${theme.background} px-5 py-4 text-white transition duration-500 group-hover:scale-[1.02]`}
                  >
                    <div className="absolute left-3 top-4 flex flex-col gap-4 opacity-60">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span
                          key={index}
                          className="h-2.5 w-2.5 rounded-full bg-white/55"
                        />
                      ))}
                    </div>

                    <div className="relative z-10 flex w-full flex-col justify-between pl-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] ${theme.badge}`}
                          >
                            {item.category.toUpperCase()}
                          </span>
                          {item.isHot ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffebf6] px-2.5 py-1 text-[10px] font-bold text-[#ff2f7f]">
                              <Sparkles className="h-3.5 w-3.5" />
                              Hot
                            </span>
                          ) : null}
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${theme.rating}`}
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {item.rating}
                        </span>
                      </div>

                      <h3 className="max-w-[12ch] text-balance text-[1.05rem] font-extrabold leading-7 text-white sm:text-[1.15rem]">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex h-[calc(100%-160px)] flex-col px-4 pb-4 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#edf2ff] px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#3657d7]">
                        {isCourse ? (
                          <PlayCircle className="h-4 w-4 shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0" />
                        )}
                        <span>{item.type}</span>
                      </div>
                      <span className="text-[12px] font-semibold leading-5 text-[#8a97b4]">
                        {item.meta}
                      </span>
                    </div>

                    <p className="line-clamp-3 min-h-[78px] text-[15px] leading-7 text-[#5f6d8f]">
                      {item.description}
                    </p>

                    <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-[1.05rem] font-black text-[#243152]">
                            {formatVND(item.amountVND)}
                          </strong>
                          {item.originalAmountVND !== null ? (
                            <span className="text-sm font-semibold text-[#9ca7bf] line-through">
                              {formatVND(item.originalAmountVND)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {item.bonus ? (
                        <span className="max-w-[90px] rounded-[10px] bg-slate-100 px-2.5 py-1.5 text-right text-[11px] font-semibold leading-4 text-[#8a97b4]">
                          {item.bonus}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {isCourse ? (
                        <>
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
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {filteredResources.length === 0 ? (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-[22px] border border-dashed border-[#1b2e7435] bg-white/72 px-5 py-8 text-center text-sm font-medium text-[#617092]"
          >
            {loadError
              ? "Kho catalog tạm thời chưa khả dụng. Vui lòng thử lại sau."
              : "Chưa tìm thấy tài liệu phù hợp."}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
