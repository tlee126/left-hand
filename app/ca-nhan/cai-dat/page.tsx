import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/repositories/profile-repository";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";
import { ProfileForm } from "@/components/account/profile-form";
import { MotionReveal } from "@/components/site/motion-reveal";
import { ArrowLeft, User, ShieldCheck } from "lucide-react";

export default async function ProfileSettingsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/dang-nhap?next=%2Fca-nhan%2Fcai-dat");
  }

  const profile = await getProfileByUserId(user.id);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.12),transparent_28%)]" />

      <Header />

      <main className="mx-auto max-w-[800px] px-4 py-8 md:py-12">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/ca-nhan"
            className="inline-flex items-center gap-2 rounded-full border border-[#13245d]/10 bg-white/90 px-4 py-2 text-xs font-extrabold text-[#13245d] shadow-sm transition hover:bg-slate-50 hover:border-[#13245d]/20 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại góc học tập
          </Link>
        </div>

        {/* Notebook Card Shell */}
        <MotionReveal>
          <div className="relative overflow-hidden rounded-[28px] border-2 border-[#13245d] bg-[#fffdf9] p-6 shadow-[0_20px_50px_rgba(27,46,116,0.1)] sm:p-10">
            {/* Background grid pattern */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #13245d 1px, transparent 1px),
                  linear-gradient(to bottom, #13245d 1px, transparent 1px)
                `,
                backgroundSize: "24px 24px"
              }}
            />

            {/* Header section */}
            <div className="border-b border-[#13245d]/10 pb-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 text-white shadow-md">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[#13245d] tracking-tight">
                    Cài đặt hồ sơ học tập
                  </h1>
                  <p className="mt-1 text-xs font-semibold text-[#5f6d8f]">
                    Cập nhật thông tin khoa, chuyên ngành và mục tiêu GPA để cá nhân hóa lộ trình ôn tập.
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <ProfileForm initialProfile={profile} authUserEmail={user.email ?? null} />

            {/* Security note */}
            <div className="mt-8 flex items-start gap-2.5 rounded-2xl border border-[#13245d]/10 bg-slate-50/80 p-4 text-xs text-[#5f6d8f]">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Thông tin hồ sơ được bảo mật và chỉ dùng để hiển thị trong khu vực học tập cá nhân của bạn.
              </p>
            </div>
          </div>
        </MotionReveal>
      </main>

      <Footer />
      <FloatingActions />
    </div>
  );
}
