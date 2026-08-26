import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, FileText, Home, Star, Users } from "lucide-react";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { getPublishedMaterialBySlug } from "@/lib/repositories/catalog-repository";
import { coverThemes } from "@/components/catalog/theme";

export const revalidate = 60;

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getPublishedMaterialBySlug(slug);

  if (!item) {
    notFound();
  }

  const theme = coverThemes[item.colorTheme] || coverThemes.accounting;

  // Determine document badge label based on tags
  const docType = item.tags.includes("Sơ đồ Mindmap") ? "MINDMAP" : "PDF HỌC TẬP";

  return (
    <CatalogPageShell>
      <div className="section-shell px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <Link
            href="/tai-lieu"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent transition hover:-translate-x-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách tài liệu
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a97b4] hover:text-accent"
          >
            <Home className="h-3.5 w-3.5" />
            Trang chủ
          </Link>
        </div>

        {/* 2-Column Desktop Grid Layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
          {/* Left Column: Details */}
          <div className="space-y-8">
            {/* Header info */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf2ff] px-3 py-1 text-[11px] font-extrabold text-[#3657d7] border border-blue-100">
                  <FileText className="h-3.5 w-3.5" />
                  {docType}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-[#5f6d8f]">
                  {item.category}
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
                <span className="text-slate-300">|</span>
                <span>{item.pages} trang</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#132a67]">Giới thiệu tài liệu</h2>
              <p className="text-[15px] leading-7 text-[#5f6d8f]">{item.description}</p>
            </div>

            {/* Inclusions */}
            {item.includes && item.includes.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#132a67] mb-4">
                  <BookOpen className="h-5 w-5 text-accent" />
                  Bạn sẽ nhận được gì?
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {item.includes.map((inc, index) => (
                    <li key={index} className="flex gap-2.5 text-[14px] leading-6 text-[#5f6d8f]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suitable For */}
            {item.suitableFor && item.suitableFor.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#132a67] mb-4">
                  <Users className="h-5 w-5 text-accent" />
                  Tài liệu này phù hợp với ai?
                </h3>
                <ul className="space-y-3">
                  {item.suitableFor.map((suit, index) => (
                    <li key={index} className="flex gap-2.5 text-[14px] leading-6 text-[#5f6d8f]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{suit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Price & CTA Card */}
          <div className="relative">
            <div className="sticky top-28 rounded-3xl border border-[#1b2e7428] bg-white p-6 shadow-[0_16px_36px_rgba(19,37,79,0.06)]">
              {/* Card visual cover tag */}
              <div className={`h-2 rounded-full bg-gradient-to-r ${theme.background} mb-5`} />

              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a97b4]">Chi phí sở hữu</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#243152]">{item.price}</span>
                {item.oldPrice && (
                  <span className="text-sm font-semibold text-[#9ca7bf] line-through">{item.oldPrice}</span>
                )}
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-[#8091b8]">
                * Bấm nút đăng ký tư vấn để được nhận tài liệu sớm nhất qua Email / Zalo của bạn.
              </p>

              <div className="mt-6 space-y-3">
                <Link
                  href={`/?interest=${item.slug}&type=material#contact`}
                  className="flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-sm font-extrabold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg active:scale-98"
                >
                  Cần tư vấn tài liệu này
                </Link>

                <Link
                  href="/tai-lieu"
                  className="flex h-12 w-full items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-[#132a67] border border-[#132a67]/5 transition hover:bg-slate-200/70"
                >
                  Quay lại kho tài liệu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CatalogPageShell>
  );
}
