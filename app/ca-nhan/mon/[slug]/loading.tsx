export default function StudentWorkspaceLoading() {
  return <main aria-busy="true" className="mx-auto max-w-[1200px] px-4 py-12">
    <div className="rounded-[28px] border border-[#13245d]/10 bg-white p-8 text-center shadow-sm">
      <p role="status" className="text-sm font-bold text-[#5f6d8f]">Đang tải tài liệu và quyền truy cập...</p>
    </div>
  </main>;
}
