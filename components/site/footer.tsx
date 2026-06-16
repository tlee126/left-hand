import Image from "next/image";
import Link from "next/link";
import { navItems } from "@/data/site";

export function Footer() {
  return (
    <footer className="container-shell pb-8 pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.75fr_0.8fr_0.9fr]">
          <div>
            <Image
              src="/assets/branding/logo-left-hand-onthidithoi.png"
              alt="LEFT HAND - Onthidithoi"
              width={720}
              height={228}
              className="h-auto w-[250px]"
            />
            <p className="mt-4 max-w-md text-sm leading-7 text-ink/72">
              Onthidithoi là hệ sinh thái học tập cho sinh viên UFM, gọn hơn để
              tìm đúng thứ cần trước kỳ thi.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold">Điều hướng</h3>
            <ul className="mt-4 space-y-3 text-sm text-ink/72">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition hover:text-accent">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold">Dịch vụ</h3>
            <ul className="mt-4 space-y-3 text-sm text-ink/72">
              <li>Tài liệu ôn thi</li>
              <li>Peer Tutor</li>
              <li>Hỏi bài 24/7</li>
              <li>Video bài giảng</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-bold">Liên hệ</h3>
            <div className="mt-4 space-y-3 text-sm text-ink/72">
              <p>
                <a
                  href="mailto:Onthidithoi@gmail.com"
                  className="transition hover:text-accent"
                >
                  Onthidithoi@gmail.com
                </a>
              </p>
              <p>UFM, TP. Hồ Chí Minh</p>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-ink/10 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
          © 2025 LEFT HAND. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
