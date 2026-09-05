import Link from "next/link";

export default function AdminLandingPage() {
  return (
    <main className="container-shell px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <section
        aria-labelledby="admin-landing-title"
        className="notebook-card notebook-paper-lines rounded-[28px] p-6 sm:p-8 lg:p-10"
      >
        <p className="eyebrow text-accent">
          Khu vực quản trị
        </p>
        <h1 id="admin-landing-title" className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Quản trị LEFT HAND
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/70 sm:text-base">
          Chào mừng đến với hệ thống quản trị nội bộ của LEFT HAND. Bạn có thể quản lý và theo dõi các yêu cầu tư vấn học tập từ sinh viên.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Lối tắt quản trị">
          <Link
            href="/quan-tri/tai-khoan"
            className="group rounded-2xl border border-accent/15 bg-white/80 p-5 text-left shadow-[0_8px_20px_rgba(19,37,79,0.04)] transition hover:-translate-y-0.5 hover:border-accent/30 hover:bg-white"
          >
            <span className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-base font-black text-ink">Quản lý tài khoản</span>
                <span className="mt-1 block text-sm leading-6 text-ink/65">Xem tài khoản và xử lý phê duyệt.</span>
              </span>
              <span aria-hidden="true" className="text-xl text-accent transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
          <Link
            href="/quan-tri/tu-van"
            className="group rounded-2xl border border-violet/15 bg-white/80 p-5 text-left shadow-[0_8px_20px_rgba(19,37,79,0.04)] transition hover:-translate-y-0.5 hover:border-violet/30 hover:bg-white"
          >
            <span className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-base font-black text-ink">Hộp thư tư vấn</span>
                <span className="mt-1 block text-sm leading-6 text-ink/65">Theo dõi và cập nhật yêu cầu tư vấn.</span>
              </span>
              <span aria-hidden="true" className="text-xl text-violet transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
