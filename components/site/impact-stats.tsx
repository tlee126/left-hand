import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { CountUp } from "@/components/site/count-up";
import { impactStats } from "@/data/site";

export function ImpactStats() {
  return (
    <section id="impact" className="container-shell pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <MotionReveal>
          <SectionHeading
            prefix="Chúng mình đã đồng hành cùng"
            highlight="sinh viên UFM"
            suffix="như thế nào?"
          />
        </MotionReveal>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {impactStats.map((item, index) => (
            <MotionReveal key={item.title} delay={0.05 * index}>
              <article className="surface-card hover-lift relative h-full overflow-hidden p-6">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(100deg,#1765e9_0%,#7b3ff2_56%,#e957ff_100%)]" />
                <span className="eyebrow mb-4 w-fit">{item.tag}</span>
                <strong className="block text-4xl font-black tracking-[-0.05em] text-accent">
                  <CountUp
                    value={item.numericValue}
                    suffix={item.suffix}
                    padStart={item.padStart}
                  />
                </strong>
                <p className="mt-2 text-base font-bold leading-7 text-ink">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-7 text-ink/70">{item.detail}</p>
              </article>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
