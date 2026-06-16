"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { FaFacebookMessenger } from "react-icons/fa";

const MESSENGER_URL = "https://m.me/onthidithoi"; // Placeholder Messenger link

export function FloatingActions() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-center gap-3 sm:bottom-6 sm:right-6 sm:gap-3.5">
      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            className="group relative"
          >
            {/* Tooltip */}
            <div className="absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white shadow-md opacity-0 translate-x-2 transition-all duration-200 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 hidden md:block">
              Lên đầu trang
            </div>
            
            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Lên đầu trang"
              className="relative flex h-[72px] w-[72px] sm:h-[80px] sm:w-[80px] items-center justify-center bg-transparent border-0 outline-none cursor-pointer select-none transition-all duration-300 hover:scale-106 hover:-translate-y-1.5 hover:rotate-[-3deg] active:scale-97 active:rotate-[1deg]"
            >
              {/* Soft warm circular backing with blur that fades in on hover */}
              <div className="absolute inset-3 -z-10 rounded-full bg-[#fbf7ee]/45 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_4px_12px_rgba(19,36,93,0.04)]" />
              
              {/* Hand-drawn paper plane doodle image */}
              <Image
                src="/assets/branding/paper-plane-doodle.png"
                alt="Lên đầu trang"
                width={80}
                height={80}
                className="h-full w-full object-contain filter drop-shadow-[0_2px_4px_rgba(19,36,93,0.05)] transition duration-300 group-hover:drop-shadow-[0_4px_8px_rgba(19,36,93,0.10)]"
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messenger Contact Button */}
      <div className="group relative">
        {/* Tooltip */}
        <div className="absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white shadow-md opacity-0 translate-x-2 transition-all duration-200 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 hidden md:block">
          Nhắn tin LEFT HAND
        </div>

        <a
          href={MESSENGER_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Nhắn tin LEFT HAND qua Messenger"
          className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(37,99,235,0.35)] active:scale-95 sm:h-[56px] sm:w-[56px]"
        >
          <FaFacebookMessenger className="h-5 w-5 sm:h-[24px] sm:w-[24px]" />
        </a>
      </div>
    </div>
  );
}
