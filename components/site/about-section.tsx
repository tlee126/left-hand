import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { featureIcons } from "@/components/site/icon-map";
import { aboutItems } from "@/data/site";

export function AboutSection() {
  return (
    <section id="about" className="container-shell pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <MotionReveal>
          <SectionHeading
            highlight="LEFT HAND"
            suffix="là gì?"
            description="LEFT HAND - Onthidithoi là đội ngũ trẻ xây dựng hệ sinh thái học tập dành cho sinh viên UFM, giúp những phần kiến thức đại học khô khan trở nên dễ hiểu hơn thông qua tài liệu ôn thi, peer tutor, hỏi bài 24/7 và video bài giảng."
          />
        </MotionReveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {aboutItems.map((item, index) => {
            const Icon = featureIcons[item.icon];

            return (
              <MotionReveal key={item.title} delay={0.05 * index} className="h-full">
                <article className="notebook-info-card flex h-full flex-col gap-5 p-7 group">
                  <div className="notebook-card-fold" />
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,rgba(23,101,233,0.08),rgba(123,63,242,0.12))] text-accent relative z-10 transition duration-300 group-hover:scale-105 group-hover:bg-[linear-gradient(135deg,rgba(23,101,233,0.14),rgba(123,63,242,0.18))]">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="w-fit rounded-md bg-accent/[0.06] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-accent border border-accent/10 relative z-10">
                    {item.label}
                  </span>
                  <h3 className="text-[20px] font-extrabold leading-[1.3] text-ink relative z-10">
                    {item.title}
                  </h3>
                  <p className="flex-1 text-[15px] leading-[1.7] text-ink/70 relative z-10">
                    {item.body}
                  </p>
                  <div className="mt-4 flex items-center text-sm font-extrabold text-accent relative z-10 transition-transform duration-200">
                    <span>Tìm hiểu thêm</span>
                    <span className="ml-1 transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </article>
              </MotionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
