"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { TutorCard } from "@/components/catalog/tutor-card";
import { EmptyState } from "@/components/catalog/empty-state";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import type { CatalogFilters, CatalogPage, PublishedTutor } from "@/lib/domain/catalog";
import { tutorFilterOptions, type TutorFilter } from "@/components/catalog/catalog-options";
import { buildCatalogFilterUrl } from "@/lib/domain/catalog-url";

type SortOption = "relevant" | "rating-desc" | "available-slot";

const sortOptions = [
  { value: "relevant", label: "Phù hợp nhất" },
  { value: "rating-desc", label: "Đánh giá cao" },
  { value: "available-slot", label: "Ưu tiên còn slot" }
];

interface TutorsCatalogClientProps {
  initialTutors: readonly PublishedTutor[];
  pagination: CatalogPage<PublishedTutor>;
  initialFilters: CatalogFilters;
}

export function TutorsCatalogClient({
  initialTutors,
  pagination,
  initialFilters
}: TutorsCatalogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialFilters.search ?? "");
  const filter: TutorFilter = initialFilters.tutorMode === "online"
    ? "Online"
    : initialFilters.tutorMode === "one-to-one"
      ? "1:1"
      : initialFilters.category ?? "Tất cả";
  const sortBy = (initialFilters.sort as SortOption | undefined) ?? "relevant";
  const filterContainerRef = useRef<HTMLDivElement>(null);

  const updateQuery = (key: string, value?: string) => {
    router.push(buildCatalogFilterUrl(pathname, searchParams.toString(), [[key, value]]), { scroll: false });
  };

  const updateFilters = (entries: Array<[string, string | undefined]>) => {
    router.push(buildCatalogFilterUrl(pathname, searchParams.toString(), entries), { scroll: false });
  };

  // Auto-scroll filter chip into view
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
  }, [filter]);

  useEffect(() => {
    setQuery(initialFilters.search ?? "");
  }, [initialFilters.search]);

  const handleReset = () => {
    setQuery("");
    router.push(pathname, { scroll: false });
  };

  return (
    <div className="section-shell px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
      {/* Page Hero/Header */}
      <div className="mb-8">
        <MotionReveal>
          <SectionHeading
            align="left"
            prefix="Đội ngũ"
            highlight="Tutor UFM"
            description="Tìm tutor theo môn học, hình thức học và phần kiến thức bạn đang cần gỡ rối."
          />
        </MotionReveal>
      </div>

      {/* Filters and Search Bar */}
      <MotionReveal delay={0.05}>
        <div className="mb-8 rounded-[24px] border border-[#1b2e7442] bg-white/90 p-4 shadow-[0_14px_28px_rgba(19,37,79,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Filters */}
            <div
              ref={filterContainerRef}
              className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-none pb-1 lg:pb-0 flex-1 min-w-0 scroll-smooth"
            >
              {tutorFilterOptions.map((opt) => {
                const isActive = filter === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                  onClick={() => {
                    if (opt.label === "Online") updateFilters([["tutorMode", "online"], ["category", undefined]]);
                    else if (opt.label === "1:1") updateFilters([["tutorMode", "one-to-one"], ["category", undefined]]);
                    else if (opt.label === "Tất cả") updateFilters([["tutorMode", undefined], ["category", undefined]]);
                    else updateFilters([["category", opt.label], ["tutorMode", undefined]]);
                  }}
                    data-filter-active={isActive ? "true" : "false"}
                    className={[
                      "inline-flex h-10 items-center rounded-full px-4 text-xs font-semibold transition shrink-0",
                      isActive
                        ? "bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)]"
                        : "bg-slate-100 text-[#22325f] hover:bg-slate-200/80"
                    ].join(" ")}
                  >
                    {opt.icon && <span className="mr-1.5">{opt.icon}</span>}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Search & Sort */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
              <label className="relative block w-full sm:w-[260px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8091b8]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") updateQuery("search", query.trim() || undefined); }}
                  placeholder="Tìm tutor, môn học..."
                  className="h-10 w-full rounded-[16px] border border-[#d8deef] bg-slate-50/90 pl-10 pr-4 text-xs font-medium text-[#22325f] outline-none transition placeholder:text-[#98a4be] focus:border-accent/45 focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
              </label>

              <select
                value={sortBy}
                onChange={(event) => updateQuery("sort", event.target.value === "relevant" ? undefined : event.target.value)}
                className="h-10 rounded-[16px] border border-[#d8deef] bg-slate-50/90 px-4 text-xs font-semibold text-[#22325f] outline-none transition focus:border-accent/45 focus:bg-white"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </MotionReveal>

      {/* Results grid */}
      <div className="mt-6">
        {initialTutors.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {initialTutors.map((item) => (
              <TutorCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            onReset={handleReset}
            message="Không tìm thấy tutor phù hợp."
          />
        )}
        <CatalogPagination page={pagination} />
      </div>
    </div>
  );
}
