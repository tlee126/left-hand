import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DecorativeDoodles } from "@/components/site/decorative-doodles";
import { FloatingActions } from "@/components/site/floating-actions";
import { Footer } from "@/components/site/footer";
import type { ReactNode } from "react";

interface CatalogPageShellProps {
  children: ReactNode;
}

export function CatalogPageShell({ children }: CatalogPageShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.14),transparent_28%),radial-gradient(circle_at_center_top,rgba(248,179,29,0.12),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[34rem] -z-10 h-[24rem] bg-[radial-gradient(circle_at_left,rgba(123,63,242,0.08),transparent_24%),radial-gradient(circle_at_right,rgba(23,101,233,0.08),transparent_26%)]" />
      <DecorativeDoodles />

      <main className="container-shell px-4 sm:px-6 lg:px-8 pb-16 pt-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-[#fffdf9] px-5 py-2.5 text-sm font-extrabold text-[#132a67] shadow-[0_4px_12px_rgba(19,37,79,0.02)] transition-all duration-300 hover:bg-slate-50 hover:border-ink/20 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-[#132a67]/70" />
            Quay về trang chủ
          </Link>
        </div>
        {children}
      </main>

      <Footer />
      <FloatingActions />
    </div>
  );
}
