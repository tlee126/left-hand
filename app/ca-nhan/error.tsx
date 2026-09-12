"use client";

export default function StudentDashboardError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-[1200px] px-4 py-12"><div role="alert" className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center"><h1 className="text-lg font-black text-[#13245d]">Không thể tải khu học tập</h1><p className="mt-2 text-sm font-semibold text-rose-700">Danh sách quyền truy cập chưa thể tải. Vui lòng thử lại sau.</p><button type="button" onClick={reset} className="mt-4 rounded-full bg-[#13245d] px-4 py-2 text-xs font-black text-white">Thử lại</button></div></main>;
}
