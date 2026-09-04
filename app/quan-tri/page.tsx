import Link from "next/link";

export default function AdminLandingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Khu vực quản trị
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          Quản trị LEFT HAND
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Chào mừng đến với hệ thống quản trị nội bộ của LEFT HAND. Bạn có thể quản lý và theo dõi các yêu cầu tư vấn học tập từ sinh viên.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/quan-tri/tu-van"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Hộp thư tư vấn
          </Link>
          <Link
            href="/quan-tri/tai-khoan"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Quản lý tài khoản
          </Link>
        </div>
      </div>
    </main>
  );
}
