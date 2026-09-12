"use client";

export default function StudentWorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-[1200px] px-4 py-12">
    <section role="alert" className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center">
      <h1 className="text-lg font-black text-[#13245d]">Không thể tải không gian học tập</h1>
      <p className="mt-2 text-sm font-semibold text-rose-700">Dữ liệu học tập hiện chưa thể tải. Vui lòng thử lại.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-full bg-[#13245d] px-4 py-2 text-xs font-black text-white">Thử lại</button>
    </section>
  </main>;
}
