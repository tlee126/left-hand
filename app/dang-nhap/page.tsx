"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemoAuth } from "@/hooks/use-demo-auth";
import { ArrowLeft, Lock, Mail, Sparkles } from "lucide-react";
import { FloatingActions } from "@/components/site/floating-actions";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, loading: authLoading, isDemoMode } = useDemoAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect immediately to student personal dashboard
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      router.push("/ca-nhan");
    }
  }, [authLoading, isLoggedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      router.push("/ca-nhan");
    } else {
      setError(result.error || "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
    }
  };

  const handleFillDemo = () => {
    setEmail("demo@lefthand.vn");
    setPassword("123456");
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-transparent">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.14),transparent_28%)]" />
      
      {/* Top back button */}
      <div className="container mx-auto px-4 pt-6 md:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/90 px-4 py-2 text-sm font-extrabold text-[#132a67] transition-all hover:bg-slate-50 hover:border-ink/20 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          Về trang chủ
        </Link>
      </div>

      {/* Main card */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card Notebook shell */}
          <div className="relative overflow-hidden rounded-[28px] border-2 border-[#1b2e74] bg-[#fffdf9] p-6 shadow-[0_20px_50px_rgba(27,46,116,0.15)] sm:p-8">
            {/* Notebook grid line patterns */}
            <div 
              className="absolute inset-0 -z-10 opacity-[0.04] pointer-events-none" 
              style={{
                backgroundImage: `
                  linear-gradient(to right, #1b2e74 1px, transparent 1px),
                  linear-gradient(to bottom, #1b2e74 1px, transparent 1px)
                `,
                backgroundSize: '24px 24px'
              }}
            />
            
            {/* Logo */}
            <div className="mb-6 flex justify-center">
              <Link href="/">
                <Image
                  src="/assets/branding/logo-left-hand-onthidithoi.png"
                  alt="LEFT HAND"
                  width={190}
                  height={53}
                  className="h-auto w-[160px] object-contain"
                />
              </Link>
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-black text-[#132a67] tracking-tight">
                Đăng nhập khu học tập
              </h1>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#5f6d8f]">
                Dành cho sinh viên đã được LEFT HAND cấp tài khoản sau khi mua tài liệu, khóa học hoặc tutor.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1b2e74] mb-1.5">
                  Email học tập
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#8091b8]" />
                  <input
                    type="email"
                    required
                    value={email}
                    disabled={isSubmitting}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@lefthand.vn"
                    className="h-11 w-full rounded-[16px] border border-[#d8deef] bg-white pl-11 pr-4 text-sm font-medium text-[#22325f] outline-none transition focus:border-[#132a67]/60 focus:ring-4 focus:ring-accent/5 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1b2e74]">
                    Mật khẩu
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#8091b8]" />
                  <input
                    type="password"
                    required
                    value={password}
                    disabled={isSubmitting}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-[16px] border border-[#d8deef] bg-white pl-11 pr-4 text-sm font-medium text-[#22325f] outline-none transition focus:border-[#132a67]/60 focus:ring-4 focus:ring-accent/5 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-600 leading-normal">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="relative w-full h-11 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white rounded-full text-sm font-extrabold shadow-[0_10px_24px_rgba(37,99,235,0.2)] hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Đăng nhập ngay"
                )}
              </button>
            </form>

            {/* Demo Account Box (Only visible in Demo Mode) */}
            {isDemoMode && (
              <div className="mt-6 rounded-2xl border border-dashed border-[#1b2e7430] bg-[#fcf9f2] p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-accent">
                  <Sparkles className="h-4 w-4" />
                  Tài khoản demo trải nghiệm
                </div>
                <div className="mt-2 text-left space-y-1 text-xs text-[#5f6d8f] font-semibold">
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-mono text-ink">demo@lefthand.vn</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mật khẩu:</span>
                    <span className="font-mono text-ink">123456</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="mt-3 text-[11px] font-bold text-blue-600 hover:underline transition"
                >
                  Tự động nhập thông tin demo
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-6 text-center text-xs font-semibold text-[#8091b8]">
        © 2026 LEFT HAND. Thiết kế học thuật chất lượng cao.
      </footer>
      <FloatingActions />
    </div>
  );
}
