"use client";

interface EmptyStateProps {
  onReset?: () => void;
  message?: string;
}

export function EmptyState({ onReset, message = "Chưa tìm thấy kết quả phù hợp." }: EmptyStateProps) {
  return (
    <div className="mx-auto my-12 max-w-lg rounded-[22px] border border-dashed border-[#1b2e7435] bg-white/72 p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
        🔍
      </div>
      <p className="text-base font-semibold text-[#132a67]">{message}</p>
      <p className="mt-1 text-sm text-[#5f6d8f]">
        Thử đổi từ khóa tìm kiếm hoặc bỏ các bộ lọc hiện tại xem sao nhé.
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex h-9 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Đặt lại bộ lọc
        </button>
      )}
    </div>
  );
}
