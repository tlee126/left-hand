"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { testimonials } from "@/data/site";

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  const first = parts[0]?.[0] || "";
  const last = parts[parts.length - 1]?.[0] || "";
  return (first + last).toUpperCase();
}

export function TestimonialsSection() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener("scroll", checkScroll, { passive: true });
      const observer = new ResizeObserver(() => checkScroll());
      observer.observe(container);
      return () => {
        container.removeEventListener("scroll", checkScroll);
        observer.disconnect();
      };
    }
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const cardWidth = 380; // matches w-[380px]
      const gap = 24; // gap-6
      const scrollAmount = direction === "left" ? -(cardWidth + gap) : (cardWidth + gap);
      container.scrollBy({
        left: scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <section id="trust" className="container-shell pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <MotionReveal className="max-w-2xl">
            <SectionHeading
              className="mb-0"
              align="left"
              prefix="Sinh viên nói gì về"
              highlight="LEFT HAND"
              description="Những phản hồi ẩn danh dưới đây được viết lại ngắn gọn để phản ánh cách sinh viên đang dùng LEFT HAND trong mùa ôn thi."
            />
          </MotionReveal>

          <MotionReveal delay={0.05} className="flex items-center gap-2 md:flex shrink-0">
            <button
              type="button"
              onClick={() => handleScroll("left")}
              disabled={!canScrollLeft}
              aria-label="Xem nhận xét trước"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white text-ink transition hover:bg-slate-50 hover:border-ink/20 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              disabled={!canScrollRight}
              aria-label="Xem nhận xét tiếp theo"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white text-ink transition hover:bg-slate-50 hover:border-ink/20 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </MotionReveal>
        </div>

        <div
          ref={scrollContainerRef}
          className="scrollbar-none flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scroll-smooth"
        >
          {testimonials.map((item, index) => (
            <MotionReveal key={index} delay={0.05 * index} className="shrink-0 snap-start">
              <article className="surface-card hover-lift w-[85vw] sm:w-[380px] h-full p-6 sm:p-7 flex flex-col justify-between">
                <div>
                  <span className="text-4xl font-black leading-none text-accent/30">
                    "
                  </span>
                  <p className="mt-3 text-base leading-[1.6] text-ink/78">{item.quote}</p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-[linear-gradient(135deg,rgba(23,101,233,0.18),rgba(248,179,29,0.28))] flex items-center justify-center font-extrabold text-[13px] text-ink/70">
                    {getInitials(item.author)}
                  </div>
                  <div>
                    <strong className="block text-sm font-bold text-ink">
                      {item.author}
                    </strong>
                    <span className="text-sm text-ink/65">{item.detail}</span>
                  </div>
                </div>
              </article>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
