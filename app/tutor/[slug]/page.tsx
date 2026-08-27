import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Home, Star, Target, Users } from "lucide-react";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { getPublishedTutorBySlug } from "@/lib/repositories/catalog-repository";
import { coverThemes } from "@/components/catalog/theme";

export const revalidate = 60;

function getInitials(name: string): string {
  const cleanName = name.replace(/^tutor\s+/i, "");
  const parts = cleanName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleanName.substring(0, 2).toUpperCase();
}

export default async function TutorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getPublishedTutorBySlug(slug);

  if (!item) {
    notFound();
  }

  const theme = coverThemes[item.colorTheme] || coverThemes.finance;
  const initials = getInitials(item.name);

  return (
    <CatalogPageShell>
      <div className="section-shell px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        {/* Breadcrumb / Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <Link
            href="/tutor"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent transition hover:-translate-x-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách tutor
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
            {/* Header info */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Profile Bubble Avatar */}
              <div
                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${theme.background} text-2xl font-black text-white shadow-md`}
              >
                {initials}
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf8ec] px-3 py-1 text-[11px] font-extrabold text-[#f59e0b] border border-[#fef3c7] mb-1.5">
                  TUTOR ĐỒNG HÀNH
                </span>
                <h1 className="text-2xl font-black text-[#132a67] sm:text-3xl">
                  {item.name}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[#617092]">
                  Khoa: {item.faculty} | Hình thức: <strong>{item.format}</strong>
                </p>
              </div>
            </div>

            {/* Short Bio */}
            <div className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#132a67]">Giới thiệu bản thân</h2>
              <p className="text-[15px] leading-7 text-[#5f6d8f]">{item.shortBio}</p>
            </div>

            {/* Support Subjects */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
              <h3 className="text-base font-extrabold text-[#132a67] mb-3">Học phần hỗ trợ</h3>
              <div className="flex flex-wrap gap-2">
                {item.subjects.map((subject) => (
                  <span
                    key={subject}
                    className="rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-1.5 text-sm font-extrabold text-accent"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </div>

            {/* Strengths */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
              <h3 className="text-base font-extrabold text-[#132a67] mb-4">Điểm mạnh nổi bật</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {item.strengths.map((str, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-[14px] leading-6 text-[#5f6d8f]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                    <span>{str}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suitable For */}
            {item.suitableFor && item.suitableFor.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#132a67] mb-4">
                  <Target className="h-5 w-5 text-accent" />
                  Tutor này phù hợp nếu bạn...
                </h3>
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

            {/* Support Methods */}
            {item.supportMethods && item.supportMethods.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#132a67] mb-4">
                  <Users className="h-5 w-5 text-accent" />
                  Hình thức hỗ trợ học thuật
                </h3>
                <ul className="space-y-3">
                  {item.supportMethods.map((method, idx) => (
                    <li key={idx} className="flex gap-2.5 text-[14px] leading-6 text-[#5f6d8f]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                      <span>{method}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Price & Booking Card */}
          <div className="relative">
            <div className="sticky top-28 rounded-3xl border border-[#1b2e7428] bg-white p-6 shadow-[0_16px_36px_rgba(19,37,79,0.06)]">
              {/* Card strip */}
              <div className={`h-2 rounded-full bg-gradient-to-r ${theme.background} mb-5`} />

              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a97b4]">Chi phí gia sư</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-[#243152]">{item.price}</span>
              </div>

              <div className="mt-4 border-t border-b border-slate-100 py-3.5 space-y-2 text-xs text-[#617092] font-semibold">
                <div className="flex justify-between">
                  <span>Trạng thái slot:</span>
                  <span className="text-accent font-extrabold">{item.availability}</span>
                </div>
                <div className="flex justify-between">
                  <span>Đánh giá từ SV:</span>
                  <span className="flex items-center gap-1 text-amber-500 font-extrabold">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {item.rating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-[#8091b8]">
                * Tutor đồng hành theo dạng kèm 1:1 hoặc nhóm 2-3 người sát sườn phần kiến thức bị hổng trên lớp.
              </p>

              <div className="mt-6 space-y-3">
                <Link
                  href={`/?interest=${item.slug}&type=tutor#contact`}
                  className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-sm font-extrabold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg active:scale-98"
                >
                  Đặt lịch tutor
                </Link>

                <Link
                  href="/tutor"
                  className="flex h-12 w-full items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-[#132a67] border border-[#132a67]/5 transition hover:bg-slate-200/70"
                >
                  Quay lại danh sách tutor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CatalogPageShell>
  );
}
