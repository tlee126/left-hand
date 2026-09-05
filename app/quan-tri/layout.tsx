import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
    redirect("/dang-nhap?next=/quan-tri");
  }

  if (access.status !== "approved" || access.profile?.role !== "admin") {
    notFound();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent text-ink">
      <header className="border-b border-ink/10 bg-[#fffdf9]/90 shadow-[0_8px_24px_rgba(19,37,79,0.04)] backdrop-blur-xl">
        <div className="container-shell flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href="/quan-tri"
              className="shrink-0 text-lg font-black tracking-tight text-ink transition hover:text-accent sm:text-xl"
            >
              Quản trị LEFT HAND
            </Link>
            <nav
              aria-label="Điều hướng quản trị"
              className="grid min-w-0 grid-cols-1 gap-2 text-sm font-extrabold sm:flex sm:flex-wrap sm:items-center"
            >
              <Link
                href="/quan-tri"
                className="nav-paper-link rounded-lg border border-ink/10 bg-white/60 px-3 py-2 text-left text-ink/75 hover:border-accent/20"
              >
                Tổng quan
              </Link>
              <Link
                href="/quan-tri/tai-khoan"
                className="nav-paper-link rounded-lg border border-ink/10 bg-white/60 px-3 py-2 text-left text-ink/75 hover:border-accent/20"
              >
                Quản lý tài khoản
              </Link>
              <Link
                href="/quan-tri/tu-van"
                className="nav-paper-link rounded-lg border border-ink/10 bg-white/60 px-3 py-2 text-left text-ink/75 hover:border-accent/20"
              >
                Tư vấn
              </Link>
            </nav>
          </div>
          {access.profile?.fullName ? (
            <div className="max-w-full truncate rounded-full border border-ink/10 bg-white/70 px-3 py-1.5 text-sm font-bold text-ink/65 lg:max-w-56">
              {access.profile.fullName}
            </div>
          ) : null}
        </div>
      </header>
      <div className="relative">{children}</div>
    </div>
  );
}
