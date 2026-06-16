"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { navItems } from "@/data/site";
import { useDemoAuth } from "@/hooks/use-demo-auth";

export function Header() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { isLoggedIn, user, logout } = useDemoAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showUserMenu = mounted && isLoggedIn && user;

  const activeNavItems = useMemo(() => {
    if (showUserMenu) {
      return [
        ...navItems,
        { label: "Cá nhân", href: "/ca-nhan" }
      ];
    }
    return navItems;
  }, [showUserMenu]);

  useEffect(() => {
    const sections = ["services", "resources", "contact", "ecosystem"];
    const observers = sections.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(`#${id}`);
          }
        },
        {
          rootMargin: "-25% 0px -55% 0px",
          threshold: 0,
        }
      );
      observer.observe(el);
      return { observer, el };
    });

    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveSection("");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observers.forEach((obs) => {
        if (obs) {
          obs.observer.unobserve(obs.el);
        }
      });
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const isItemActive = (href: string) => {
    if (href.startsWith("/") && !href.includes("#")) {
      return pathname === href;
    }
    if (href.includes("#")) {
      const hash = href.substring(href.indexOf("#"));
      const path = href.substring(0, href.indexOf("#")) || "/";
      const pathMatches = pathname === path || (pathname === "/" && path === "/");
      return pathMatches && activeSection === hash;
    }
    return false;
  };

  return (
    <>
      <div className="h-[98px] sm:h-[108px]" aria-hidden="true" />
      <div className="fixed inset-x-0 top-4 z-[80] px-3 sm:px-4">
        <div className="relative mx-auto w-[min(97vw,1640px)]">
          <header className="flex h-[76px] items-center justify-between rounded-[28px] border border-white/70 bg-white/85 px-5 shadow-[0_18px_45px_rgba(27,46,116,0.10)] backdrop-blur-md sm:h-[80px] sm:px-6 lg:px-7">
            <Link
              href="/"
              className="shrink-0 translate-y-[5px] transition duration-300 hover:scale-[1.02] sm:translate-y-[6px] lg:translate-y-[7px]"
              aria-label="LEFT HAND - về đầu trang"
            >
              <Image
                src="/assets/branding/logo-left-hand-onthidithoi.png"
                alt="LEFT HAND - Onthidithoi"
                width={320}
                height={89}
                priority
                className="h-auto w-[206px] object-contain sm:w-[226px] lg:w-[286px] xl:w-[314px]"
              />
            </Link>

            <nav className="hidden flex-1 items-center justify-center gap-6 px-5 text-[15px] sm:text-[16px] font-extrabold text-ink lg:flex xl:gap-8">
              {activeNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (item.href.includes("#")) {
                      setActiveSection(item.href.substring(item.href.indexOf("#")));
                    }
                  }}
                  className="nav-paper-link"
                  data-active={isItemActive(item.href) ? "true" : "false"}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {showUserMenu ? (
              <div className="hidden items-center gap-4 lg:flex">
                <div className="flex items-center gap-3">
                  <Link
                    href="/ca-nhan"
                    className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50/80 p-1.5 pr-4 transition hover:bg-slate-100 hover:border-slate-200"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-violet-600 text-[12px] font-black text-white">
                      {user.avatarInitials}
                    </div>
                    <span className="text-sm font-extrabold text-[#22325f]">{user.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      router.push("/");
                    }}
                    className="text-xs font-bold text-[#8091b8] hover:text-red-500 transition px-2.5 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    Đăng xuất
                  </button>
                </div>
                <Link
                  href="/#contact"
                  className="bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white h-[44px] shrink-0 items-center justify-center px-7 rounded-full text-sm font-extrabold shadow-[0_12px_28px_rgba(37,99,235,0.25)] transition-all duration-300 hover:-translate-y-[1px] hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 hover:shadow-[0_16px_32px_rgba(37,99,235,0.35)] active:scale-[0.98] inline-flex"
                >
                  Đăng ký tư vấn
                </Link>
              </div>
            ) : (
              <div className="hidden items-center gap-4 lg:flex">
                <Link
                  href="/dang-nhap"
                  className="text-sm font-extrabold text-[#1b2e74] hover:text-blue-600 transition px-3 py-2"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/#contact"
                  className="bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white h-[44px] shrink-0 items-center justify-center px-7 rounded-full text-sm font-extrabold shadow-[0_12px_28px_rgba(37,99,235,0.25)] transition-all duration-300 hover:-translate-y-[1px] hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 hover:shadow-[0_16px_32px_rgba(37,99,235,0.35)] active:scale-[0.98] inline-flex"
                >
                  Đăng ký tư vấn
                </Link>
              </div>
            )}

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white text-ink lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Đóng menu" : "Mở menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </header>

          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                id="mobile-nav"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-x-0 top-[calc(100%+10px)] overflow-hidden lg:hidden"
              >
                <div className="rounded-[24px] border border-white/70 bg-white/95 p-3 shadow-[0_18px_40px_rgba(27,46,116,0.12)] backdrop-blur-md">
                  <div className="flex flex-col gap-2">
                    {activeNavItems.map((item) => {
                      const isActive = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => {
                            if (item.href.includes("#")) {
                              setActiveSection(item.href.substring(item.href.indexOf("#")));
                            }
                            setOpen(false);
                          }}
                          className={`rounded-2xl px-4 py-3 text-base font-extrabold transition-all duration-200 ${
                            isActive
                              ? "bg-[#f5edd6] text-accent border border-ink/5 shadow-sm"
                              : "text-ink hover:bg-accent/[0.06] hover:text-accent"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                    <Link
                      href="/#contact"
                      className="bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-white mt-2 inline-flex h-[44px] items-center justify-center rounded-full px-6 text-sm font-extrabold shadow-[0_8px_20px_rgba(37,99,235,0.2)] transition-all duration-300 hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 active:scale-[0.98]"
                      onClick={() => setOpen(false)}
                    >
                      Đăng ký tư vấn
                    </Link>

                    {showUserMenu ? (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-3 px-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 text-sm font-black text-white">
                            {user.avatarInitials}
                          </div>
                          <div>
                            <div className="text-sm font-extrabold text-[#22325f]">{user.name}</div>
                            <div className="text-[11px] font-semibold text-[#8091b8]">{user.email}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            logout();
                            setOpen(false);
                            router.push("/");
                          }}
                          className="mt-4 w-full h-[40px] inline-flex items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600 text-xs font-extrabold hover:bg-red-100 transition active:scale-[0.98]"
                        >
                          Đăng xuất tài khoản
                        </button>
                      </div>
                    ) : (
                      <Link
                        href="/dang-nhap"
                        className="inline-flex h-[44px] items-center justify-center rounded-full border border-ink/10 bg-white text-ink text-sm font-extrabold hover:bg-slate-50 active:scale-[0.98] px-6 mt-1"
                        onClick={() => setOpen(false)}
                      >
                        Đăng nhập khu học tập
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
