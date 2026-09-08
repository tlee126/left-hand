"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";

export function CatalogErrorState({
  context,
  reset
}: {
  context: "materials" | "courses" | "tutors" | "material-detail" | "course-detail" | "tutor-detail";
  reset: () => void;
}) {
  const messages = {
    materials: ["Không thể tải danh sách tài liệu", "Đã xảy ra sự cố khi tải kho tài liệu. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu lỗi tiếp diễn."],
    courses: ["Không thể tải danh sách khóa học", "Đã xảy ra sự cố khi tải danh sách khóa học. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu lỗi tiếp diễn."],
    tutors: ["Không thể tải danh sách Tutor", "Đã xảy ra sự cố khi tải đội ngũ Tutor. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu lỗi tiếp diễn."],
    "material-detail": ["Không thể tải tài liệu", "Đã xảy ra sự cố khi tải chi tiết tài liệu. Vui lòng thử lại."],
    "course-detail": ["Không thể tải khóa học", "Đã xảy ra sự cố khi tải chi tiết khóa học. Vui lòng thử lại."],
    "tutor-detail": ["Không thể tải hồ sơ Tutor", "Đã xảy ra sự cố khi tải chi tiết hồ sơ Tutor. Vui lòng thử lại."]
  } as const;
  const [title, description] = messages[context];

  return (
    <CatalogPageShell>
      <div className="section-shell flex min-h-[400px] flex-col items-center justify-center px-4 py-16 text-center sm:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 shadow-inner">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-[#1f2d5a] sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#697598]">{description}</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:opacity-95 active:scale-95">
          <RefreshCw className="h-4 w-4" />
          Thử lại
        </button>
      </div>
    </CatalogPageShell>
  );
}
