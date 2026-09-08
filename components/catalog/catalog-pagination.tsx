"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CatalogPage } from "@/lib/domain/catalog";
import { buildCatalogPageUrl } from "@/lib/domain/catalog-url";

interface CatalogPaginationProps {
  page: CatalogPage<unknown>;
}

export function CatalogPagination({ page }: CatalogPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  if (!page.hasPrevious && page.hasNext === false) return null;

  const navigate = (nextPage: number) => {
    router.push(buildCatalogPageUrl(searchParams.toString(), nextPage), { scroll: false });
  };

  return (
    <nav aria-label="Phân trang catalog" className="mt-8 flex items-center justify-center gap-3">
      <button
        type="button"
        disabled={!page.hasPrevious}
        onClick={() => navigate(page.page - 1)}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#132a67] disabled:opacity-40"
      >
        Trang trước
      </button>
      <span className="text-xs font-bold text-[#697598]">
        Trang {page.page}{page.hasNext === null ? " · Tổng số trang chưa xác định" : ""}
      </span>
      <button
        type="button"
        disabled={!page.hasNext}
        onClick={() => navigate(page.page + 1)}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#132a67] disabled:opacity-40"
      >
        Trang sau
      </button>
    </nav>
  );
}
