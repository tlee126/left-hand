import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Calendar, Check, Clock, Home, Star, User, Video } from "lucide-react";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { getPublishedCourseBySlug } from "@/lib/repositories/catalog-repository";
import { coverThemes } from "@/components/catalog/theme";

export const revalidate = 60;

const formatLabels = {
  online: "Học Online",
  offline: "Học tại Cơ sở",
  video: "Video tự học",
  zoom: "Học qua Zoom"
};

const statusConfig = {
  open: { label: "Đang nhận đăng ký", class: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
  "coming-soon": { label: "Sắp mở lớp", class: "bg-amber-50 text-amber-600 border border-amber-100" },
  full: { label: "Hết chỗ", class: "bg-rose-50 text-rose-500 border border-rose-100" }
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getPublishedCourseBySlug(slug);

  if (!item) {
    notFound();
  }

  const theme = coverThemes[item.colorTheme] || coverThemes.economics;
  const status = statusConfig[item.status] || statusConfig.open;

  return (
    <CatalogPageShell>
      <div className="section-shell px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        {/* Navigation / Back link */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <Link
            href="/khoa-hoc"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent transition hover:-translate-x-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách khóa học
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a97b4] hover:text-accent"
          >
            <Home className="h-3.5 w-3.5" />
            Trang chủ
          </Link>
        </div>

        {/* 2-Column layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
          {/* Left Column */}
          <div className="space-y-8">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf8ec] px-3 py-1 text-[11px] font-extrabold text-[#f59e0b] border border-[#fef3c7]">
                  <Video className="h-3.5 w-3.5" />
                  {formatLabels[item.format]}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.class}`}>
                  {status.label}
                </span>
              </div>

              <h1 className="text-2xl font-black leading-tight text-[#132a67] sm:text-3xl">
                {item.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-[#617092]">
                <div className="flex items-center gap-1 text-amber-500 font-extrabold">
                  <Star className="h-4 w-4 fill-current" />
                  <span>{item.rating.toFixed(1)}</span>
                </div>
                <span className="text-slate-300">|</span>
                <span>Môn học: <strong>{item.subject}</strong></span>
              </div>
            </div>

            {/* General Description */}
            <div className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#132a67]">Giới thiệu khóa học</h2>
              <p className="text-[15px] leading-7 text-[#5f6d8f]">{item.description}</p>
            </div>

            {/* Course Specs */}
            <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/30 p-5 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8a97b4]">Thời lượng</span>
                  <span className="text-sm font-extrabold text-[#243152]">{item.duration}</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8a97b4]">Lịch học</span>
                  <span className="text-sm font-extrabold text-[#243152]">{item.schedule}</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8a97b4]">Mentor hướng dẫn</span>
                  <span className="text-sm font-extrabold text-[#243152]">{item.mentor}</span>
                </div>
              </div>
            </div>

            {/* Curriculum */}
            {item.curriculum && item.curriculum.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#132a67] mb-4">
                  <BookOpen className="h-5 w-5 text-accent" />
                  Nội dung lớp học
                </h3>
                <ul className="space-y-3.5">
                  {item.curriculum.map((curr, idx) => (
                    <li key={idx} className="flex gap-3 text-[14px] leading-6 text-[#5f6d8f]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-accent">
                        {idx + 1}
                      </span>
                      <span>{curr}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suitable For */}
            {item.suitableFor && item.suitableFor.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="text-base font-extrabold text-[#132a67] mb-4">Khóa học này phù hợp với ai?</h3>
                <ul className="space-y-3">
                  {item.suitableFor.map((suit, idx) => (
                    <li key={idx} className="flex gap-2.5 text-[14px] leading-6 text-[#5f6d8f]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{suit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preparation */}
            {item.preparation && item.preparation.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="text-base font-extrabold text-[#132a67] mb-4">Bạn cần chuẩn bị gì?</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {item.preparation.map((prep, idx) => (
                    <li key={idx} className="flex gap-2.5 text-[14px] leading-6 text-[#5f6d8f]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                      <span>{prep}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Price & CTA Card */}
          <div className="relative">
            <div className="sticky top-28 rounded-3xl border border-[#1b2e7428] bg-white p-6 shadow-[0_16px_36px_rgba(19,37,79,0.06)]">
              {/* Card visual strip */}
              <div className={`h-2 rounded-full bg-gradient-to-r ${theme.background} mb-5`} />

              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a97b4]">Chi phí lớp học</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#243152]">{item.price}</span>
                {item.oldPrice && (
                  <span className="text-sm font-semibold text-[#9ca7bf] line-through">{item.oldPrice}</span>
                )}
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-[#8091b8]">
                * Lớp học mở theo nhóm nhỏ và học qua Zoom chất lượng cao để đảm bảo tiến độ tương tác hiệu quả nhất.
              </p>

              <div className="mt-6 space-y-3">
                <Link
                  href={`/?interest=${item.slug}&type=course#contact`}
                  className={`flex h-12 w-full items-center justify-center rounded-full text-sm font-extrabold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg active:scale-98 ${
                    item.status === "full"
                      ? "bg-slate-500 hover:bg-slate-600"
                      : "bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600"
                  }`}
                >
                  {item.status === "full" ? "Nhận tư vấn lớp khác" : "Đăng ký lớp này"}
                </Link>

                <Link
                  href="/khoa-hoc"
                  className="flex h-12 w-full items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-[#132a67] border border-[#132a67]/5 transition hover:bg-slate-200/70"
                >
                  Quay lại danh sách khóa học
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CatalogPageShell>
  );
}
