"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";

export default function MaterialsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service if needed
    console.error("Materials catalog route error:", error);
  }, [error]);

  return (
    <CatalogPageShell>
      <div className="section-shell flex min-h-[400px] flex-col items-center justify-center px-4 py-16 text-center sm:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 shadow-inner">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-[#1f2d5a] sm:text-2xl">
          Không thể tải danh sách tài liệu
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#697598]">
          Đã xảy ra sự cố trong quá trình tải dữ liệu tài liệu. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu lỗi tiếp diễn.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:opacity-95 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Thử lại
        </button>
      </div>
    </CatalogPageShell>
  );
}
