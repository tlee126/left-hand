"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { GraduationCap, ShieldCheck, Tag, Zap, Calendar } from "lucide-react";
import { MotionReveal } from "@/components/site/motion-reveal";

const trustItems = [
  {
    icon: ShieldCheck,
    label: "Chuẩn chương trình\nUFM"
  },
  {
    icon: Tag,
    label: "Giá hợp lý\ncho sinh viên"
  },
  {
    icon: Zap,
    label: "Hỗ trợ nhanh\n& tận tâm"
  }
];

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="home" className="container-shell pt-4">
      <div className="section-shell relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-10 xl:px-12 xl:py-12 min-h-[580px] lg:min-h-[700px] flex items-center">
        {/* Background decorative grids & lights */}
        <div className="pointer-events-none absolute -left-10 top-10 h-20 w-20 rounded-full border-2 border-dashed border-accent/18" />
        <div className="pointer-events-none absolute right-[7%] top-[12%] h-4 w-4 rotate-12 rounded-sm bg-[#f8b31d]/70" />
        <div className="pointer-events-none absolute right-[4%] top-[18%] text-xl text-violet-400">✦</div>
        <div className="pointer-events-none absolute bottom-[12%] left-[44%] hidden h-24 w-24 rounded-full bg-[#e957ff]/8 blur-3xl lg:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] bg-[radial-gradient(circle_at_top,rgba(23,101,233,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(233,87,255,0.14),transparent_30%)] lg:block" />

        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10 xl:gap-12 w-full">
          {/* Left Column: Text & CTAs */}
          <MotionReveal>
            <div className="relative w-full">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.04] px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-ink/80 mb-5">
                <GraduationCap className="h-4 w-4 text-accent" />
                <span>Dành riêng cho sinh viên UFM</span>
              </div>

              {/* Headline with fixed line-height and overflow padding to prevent accent clipping */}
              <h1 className="max-w-[920px] text-[clamp(42px,5vw,58px)] sm:text-[clamp(64px,4.8vw,92px)] font-black leading-[1.04] tracking-[-0.025em] text-[#132a67] uppercase flex flex-col items-start gap-1 relative z-10 py-1 overflow-visible">
                <span className="block leading-[1.04] pb-[0.04em]">Đồng hành cùng</span>
                <span className="block bg-[linear-gradient(100deg,#1f6fff_0%,#7b3ff2_52%,#e957ff_100%)] bg-clip-text text-transparent pb-[0.06em] leading-[1.04]">
                  sinh viên UFM
                </span>
                <span className="block leading-[1.04] pb-[0.04em]">trong học tập</span>
                <span className="relative inline-block pb-[0.04em] leading-[1.04]">
                  <span>và ôn thi</span>
                  {/* Yellow hand-drawn style underline marker - 1 stroke only */}
                  <span className="absolute bottom-[-0.04em] left-[64%] w-[150px] sm:w-[185px] h-[7px] rounded-full bg-[#f4b321] rotate-[-4deg] transform origin-left opacity-95" />
                </span>
              </h1>

              {/* Description */}
              <p className="mt-6 text-[15px] font-medium leading-relaxed text-ink/75 sm:text-[16px] max-w-[620px]">
                Tài liệu chất lượng <span className="text-accent/30 mx-1.5 font-bold">·</span> Khóa học bài bản <span className="text-accent/30 mx-1.5 font-bold">·</span> Tutor tận tâm <br className="hidden sm:inline" />
                Hỏi đáp nhanh chóng <span className="text-accent/30 mx-1.5 font-bold">·</span> Chính xác <span className="text-accent/30 mx-1.5 font-bold">·</span> Tất cả trong một nền tảng
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <Link
                  href="#resources"
                  className="h-12 px-7 rounded-full text-white text-sm font-extrabold bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 shadow-[0_12px_28px_rgba(37,99,235,0.25)] transition-all duration-300 hover:-translate-y-[1px] hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 hover:shadow-[0_16px_32px_rgba(37,99,235,0.35)] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Xem tài liệu</span>
                  <span className="text-base font-normal">→</span>
                </Link>
                <Link
                  href="#contact"
                  className="h-12 px-7 rounded-full border border-[#132a67]/15 bg-white text-[#132a67] text-sm font-extrabold transition-all duration-300 hover:-translate-y-[1px] hover:bg-blue-50 hover:shadow-[0_8px_20px_rgba(19,37,79,0.06)] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Đăng ký tư vấn</span>
                  <Calendar className="h-4 w-4 text-[#132a67]" />
                </Link>
              </div>

              {/* Trust Row */}
              <div className="mt-8 pt-6 border-t border-ink/5 flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8">
                {trustItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/[0.08] text-accent">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold leading-tight text-ink/80 whitespace-pre-line">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </MotionReveal>

          {/* Right Column: Visual Graphic & Doodles */}
          <MotionReveal delay={0.08} className="relative w-full flex justify-center lg:justify-end">
            {/* Dashed loop doodles around the graphic */}
            <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full pointer-events-none text-violet-400/20 stroke-current z-0">
              <path
                d="M 50 150 C 120 80, 200 250, 100 320 C 50 350, 180 380, 320 280 C 420 200, 480 300, 450 350"
                strokeWidth="2"
                strokeDasharray="4 6"
                strokeLinecap="round"
              />
              <path
                d="M 380 50 C 440 80, 460 20, 420 100"
                strokeWidth="1.5"
                strokeDasharray="3 5"
                strokeLinecap="round"
              />
            </svg>

            {/* Paper plane doodle */}
            <div className="absolute top-[2%] right-[5%] pointer-events-none hidden sm:block z-20 text-accent/30 rotate-[15deg]">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                <path d="M22 2L2 8.66667L11.5 12.5L15.3333 22L22 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11.5 12.5L22 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Sparkles */}
            <div className="absolute top-[16%] left-[4%] pointer-events-none text-violet-400/40 z-20 animate-pulse">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
              </svg>
            </div>
            <div className="absolute bottom-[20%] right-[4%] pointer-events-none text-accent/30 z-20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
                <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
              </svg>
            </div>

            <motion.div
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      y: [0, -8, 0]
                    }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : {
                      duration: 5.6,
                      ease: "easeInOut",
                      repeat: Number.POSITIVE_INFINITY
                    }
              }
              className="relative w-full max-w-[980px] xl:max-w-[1040px] flex justify-center lg:justify-end z-10"
            >
              <div className="absolute left-[10%] top-[8%] h-32 w-32 rounded-full bg-accent/12 blur-3xl sm:h-40 sm:w-40" />
              <div className="absolute bottom-[8%] right-[6%] h-24 w-24 rounded-full bg-[#f8b31d]/16 blur-3xl sm:h-32 sm:w-32" />
              <div className="absolute left-[16%] top-[20%] hidden h-28 w-28 rounded-[32px] border border-dashed border-accent/18 lg:block" />

              <Image
                src="/assets/branding/hero-left-hand-study-plan.png"
                alt="LEFT HAND study plan hero"
                width={1800}
                height={1400}
                priority
                className="relative z-10 h-auto w-full max-w-[960px] object-contain drop-shadow-[0_24px_44px_rgba(19,37,79,0.12)]"
                sizes="(max-width: 1024px) 100vw, 55vw"
              />
            </motion.div>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}
