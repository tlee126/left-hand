"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CourseCard } from "@/components/catalog/course-card";
import { EmptyState } from "@/components/catalog/empty-state";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import type { CourseItem } from "@/data/catalog";

type CourseFilter =
  | "Tất cả"
  | "Zoom"
  | "Video"
  | "Online"
  | "Sắp mở"
  | "Đang nhận đăng ký";

type SortOption = "newest" | "price-asc" | "rating-desc";

const filterOptions: Array<{ label: CourseFilter; icon: string }> = [
  { label: "Tất cả", icon: "" },
  { label: "Zoom", icon: "🎥" },
  { label: "Video", icon: "💿" },
  { label: "Online", icon: "🌐" },
  { label: "Sắp mở", icon: "⏳" },
  { label: "Đang nhận đăng ký", icon: "✅" }
];

const sortOptions = [
  { value: "newest", label: "Mới nhất" },
  { value: "price-asc", label: "Giá thấp đến cao" },
  { value: "rating-desc", label: "Đánh giá cao" }
];

interface CoursesCatalogClientProps {
  initialCourses: CourseItem[];
}

export function CoursesCatalogClient({
  initialCourses
}: CoursesCatalogClientProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CourseFilter>("Tất cả");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const filterContainerRef = useRef<HTMLDivElement>(null);

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

  const handleReset = () => {
    setQuery("");
    setFilter("Tất cả");
    setSortBy("newest");
  };

  const processedCourses = useMemo(() => {
    let result = [...initialCourses];

    // Filter by type/status
    if (filter === "Zoom") {
      result = result.filter((item) => item.format === "zoom");
    } else if (filter === "Video") {
      result = result.filter((item) => item.format === "video");
    } else if (filter === "Online") {
      result = result.filter(
        (item) => item.format === "online" || item.format === "zoom"
      );
    } else if (filter === "Sắp mở") {
      result = result.filter((item) => item.status === "coming-soon");
    } else if (filter === "Đang nhận đăng ký") {
      result = result.filter((item) => item.status === "open");
    }

    // Filter by search query
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((item) => {
        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.subject.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery) ||
          item.mentor.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery)
        );
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "price-asc") {
        const priceA = parseFloat(a.price.replace(/[^\d]/g, "")) || 0;
        const priceB = parseFloat(b.price.replace(/[^\d]/g, "")) || 0;
        return priceA - priceB;
      }
      if (sortBy === "rating-desc") {
        return b.rating - a.rating;
      }
      // "newest"
      return 0;
    });

    return result;
  }, [initialCourses, filter, query, sortBy]);

  return (
    <div className="section-shell px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
      {/* Page Hero/Header */}
      <div className="mb-8">
        <MotionReveal>
          <SectionHeading
            align="left"
            prefix="Khóa học &"
            highlight="lớp ôn thi"
            description="Chọn lớp ôn, video bài giảng hoặc buổi học phù hợp với lịch ôn thi của bạn."
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
              {filterOptions.map((opt) => {
                const isActive = filter === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setFilter(opt.label)}
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
                  placeholder="Tìm khóa học, mentor..."
                  className="h-10 w-full rounded-[16px] border border-[#d8deef] bg-slate-50/90 pl-10 pr-4 text-xs font-medium text-[#22325f] outline-none transition placeholder:text-[#98a4be] focus:border-accent/45 focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
              </label>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
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
        {processedCourses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {processedCourses.map((item) => (
              <CourseCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            onReset={handleReset}
            message="Không tìm thấy khóa học phù hợp."
          />
        )}
      </div>
    </div>
  );
}
