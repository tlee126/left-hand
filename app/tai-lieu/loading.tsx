import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";

export default function MaterialsLoading() {
  return (
    <CatalogPageShell>
      <div className="section-shell px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        {/* Header Skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="h-8 w-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-slate-100" />
        </div>

        {/* Filter / Search Bar Skeleton */}
        <div className="mb-8 rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-slate-100"
                />
              ))}
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-full sm:w-[260px] animate-pulse rounded-[16px] bg-slate-100" />
              <div className="h-10 w-36 animate-pulse rounded-[16px] bg-slate-100" />
            </div>
          </div>
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[380px] flex-col overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-sm"
            >
              <div className="h-[165px] animate-pulse bg-slate-200" />
              <div className="flex flex-1 flex-col p-5 space-y-3">
                <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="mt-auto flex justify-between pt-4 border-t border-slate-100">
                  <div className="h-6 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="h-6 w-16 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CatalogPageShell>
  );
}
