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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/quan-tri"
              className="text-xl font-black tracking-tight text-slate-900 hover:text-blue-600 transition"
            >
              Quản trị LEFT HAND
            </Link>
            <nav className="flex items-center gap-6 text-sm font-semibold">
              <Link
                href="/quan-tri"
                className="text-slate-600 hover:text-slate-900 transition"
              >
                Tổng quan
              </Link>
              <Link
                href="/quan-tri/tu-van"
                className="text-slate-600 hover:text-slate-900 transition"
              >
                Hộp thư tư vấn
              </Link>
            </nav>
          </div>
          {access.profile?.fullName ? (
            <div className="text-sm font-medium text-slate-600">
              {access.profile.fullName}
            </div>
          ) : null}
        </div>
      </header>
      <div>{children}</div>
    </div>
  );
}
