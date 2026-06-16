import Link from "next/link";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { socialIcons } from "@/components/site/icon-map";
import { socialLinks } from "@/data/site";

export function EcosystemSection() {
  return (
    <section id="ecosystem" className="container-shell pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <MotionReveal>
          <SectionHeading
            prefix="Kết nối với"
            highlight="LEFT HAND"
            description="Theo dõi các kênh để xem lịch lớp ôn, video mới và thông báo hỗ trợ khi kỳ thi đến gần."
          />
        </MotionReveal>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {socialLinks.map((item, index) => {
            const Icon = socialIcons[item.icon];

            return (
              <MotionReveal key={item.name} delay={0.05 * index}>
                <article className="surface-card hover-lift flex h-full flex-col gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#13245d,#1f6fff)] text-xl text-white">
                    <Icon />
                  </div>
                  <h3 className="text-xl font-extrabold leading-[1.25] text-ink">{item.name}</h3>
                  <p className="flex-1 text-[15px] leading-[1.6] text-ink/72">
                    {item.description}
                  </p>
                  <Link
                    href={item.href}
                    className="inline-flex w-fit items-center text-sm font-bold text-accent transition hover:translate-x-0.5"
                  >
                    {item.cta}
                  </Link>
                </article>
              </MotionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
