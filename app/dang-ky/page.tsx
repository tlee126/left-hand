"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDemoAuth, getValidCallbackUrl, validateSignupInput } from "@/hooks/use-demo-auth";
import { ArrowLeft, Lock, Mail, CheckCircle2 } from "lucide-react";
import { FloatingActions } from "@/components/site/floating-actions";

export default function SignupPage() {
  const router = useRouter();
  const { signup, isLoggedIn, loading: authLoading } = useDemoAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

    // Client-side validation
    const validation = validateSignupInput({
      email,
      password,
      confirmPassword
    });

    if (!validation.isValid) {
      setError(validation.error || "Thông tin đăng ký không hợp lệ.");
      return;
    }

    setIsSubmitting(true);

    try {
      const emailRedirectTo = getValidCallbackUrl();
      const result = await signup(email, password, emailRedirectTo);

      if (result.success) {
        if (result.data?.session) {
          router.push("/ca-nhan");
        } else {
          setSuccessMessage("Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác thực tài khoản.");
        }
      } else {
        setError(result.error || "Đăng ký không thành công. Vui lòng kiểm tra lại.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra trong quá trình đăng ký.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className="relative flex min-h-screen flex-col justify-between bg-transparent">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.14),transparent_28%)]" />
        
        <div className="container mx-auto px-4 pt-6 md:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/90 px-4 py-2 text-sm font-extrabold text-[#132a67] transition-all hover:bg-slate-50 hover:border-ink/20 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang chủ
          </Link>
        </div>

        <main className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="relative overflow-hidden rounded-[28px] border-2 border-[#1b2e74] bg-[#fffdf9] p-6 shadow-[0_20px_50px_rgba(27,46,116,0.15)] sm:p-8 text-center">
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
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h1 className="text-2xl font-black text-[#132a67] tracking-tight mb-2">
                Kiểm tra email
              </h1>
              <p className="text-sm font-semibold leading-relaxed text-[#5f6d8f] mb-6">
                {successMessage}
              </p>
              <Link href="/dang-nhap" className="inline-block relative w-full h-11 bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white rounded-full text-sm font-extrabold shadow-[0_10px_24px_rgba(37,99,235,0.2)] hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 transition active:scale-[0.98] leading-[44px]">
                Đến trang đăng nhập
              </Link>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-xs font-semibold text-[#8091b8]">
          © 2026 LEFT HAND. Thiết kế học thuật chất lượng cao.
        </footer>
        <FloatingActions />
      </div>
    );
  }

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
                Đăng ký tài khoản
              </h1>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-[#5f6d8f]">
                Tạo tài khoản để tham gia khu học tập của LEFT HAND.
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1b2e74]">
                    Xác nhận mật khẩu
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#8091b8]" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    disabled={isSubmitting}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  "Đăng ký ngay"
                )}
              </button>

              <div className="mt-4 text-center text-sm font-semibold text-[#5f6d8f]">
                Đã có tài khoản?{" "}
                <Link href="/dang-nhap" className="text-blue-600 hover:underline transition">
                  Đăng nhập
                </Link>
              </div>
            </form>
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

