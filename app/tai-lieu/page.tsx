"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { MaterialCard } from "@/components/catalog/material-card";
import { EmptyState } from "@/components/catalog/empty-state";
import { materials } from "@/data/catalog";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";

type CategoryFilter = "Tất cả" | "Kế toán" | "Kinh tế" | "Thống kê" | "Marketing" | "Quản trị" | "Tài chính" | "MIS" | "Luật" | "Ngoại ngữ";
type SortOption = "newest" | "price-asc" | "rating-desc";

const filterOptions: Array<{ label: CategoryFilter; icon: string }> = [
  { label: "Tất cả", icon: "" },
  { label: "Kế toán", icon: "💼" },
  { label: "Kinh tế", icon: "📈" },
  { label: "Thống kê", icon: "📊" },
  { label: "Marketing", icon: "🎯" },
  { label: "Quản trị", icon: "🧠" },
  { label: "Tài chính", icon: "💵" },
  { label: "MIS", icon: "💻" },
  { label: "Luật", icon: "⚖️" },
  { label: "Ngoại ngữ", icon: "🗣️" }
];

const sortOptions = [
  { value: "newest", label: "Mới nhất" },
  { value: "price-asc", label: "Giá thấp đến cao" },
  { value: "rating-desc", label: "Đánh giá cao" }
];

export default function MaterialsCatalogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("Tất cả");
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
  }, [category]);

  const handleReset = () => {
    setQuery("");
    setCategory("Tất cả");
    setSortBy("newest");
  };

  const processedMaterials = useMemo(() => {
    let result = [...materials];

    // Filter by category
    if (category !== "Tất cả") {
      result = result.filter((item) => item.category === category);
    }

    // Filter by query
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((item) => {
        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.subject.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery) ||
          item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
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
      // "newest" - keep natural list order
      return 0;
    });

    return result;
  }, [category, query, sortBy]);

  return (
    <CatalogPageShell>
      <div className="section-shell px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        {/* Page Hero/Header */}
        <div className="mb-8">
          <MotionReveal>
            <SectionHeading
              align="left"
              prefix="Kho"
              highlight="tài liệu ôn thi"
              description="Tìm nhanh tài liệu theo môn học, nhóm ngành và giai đoạn ôn tập."
            />
          </MotionReveal>
        </div>

        {/* Filters and Search Bar Container */}
        <MotionReveal delay={0.05}>
          <div className="mb-8 rounded-[24px] border border-[#1b2e7442] bg-white/90 p-4 shadow-[0_14px_28px_rgba(19,37,79,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Category Filters */}
              <div
                ref={filterContainerRef}
                className="flex overflow-x-auto whitespace-nowrap gap-2 scrollbar-none pb-1 lg:pb-0 flex-1 min-w-0 scroll-smooth"
              >
                {filterOptions.map((opt) => {
                  const isActive = category === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setCategory(opt.label)}
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

              {/* Search input & Sort select */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
                <label className="relative block w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8091b8]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm tài liệu, môn học..."
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
          {processedMaterials.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {processedMaterials.map((item) => (
                <MaterialCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState onReset={handleReset} message="Không tìm thấy tài liệu phù hợp." />
          )}
        </div>
      </div>
    </CatalogPageShell>
  );
}
