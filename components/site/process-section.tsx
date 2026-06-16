import {
  BadgeCheck,
  CreditCard,
  PenLine,
  Search
} from "lucide-react";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";

const processSteps = [
  {
    step: "01",
    title: "Chọn dịch vụ",
    body: "Duyệt qua kho tài liệu hoặc tham khảo danh mục Khóa học/Tutor phù hợp nhất với bạn.",
    icon: Search,
    tone: "bg-[#eaf2ff] text-[#2d67ec] ring-[#c9dafd]",
    arrowClass: "xl:block"
  },
  {
    step: "02",
    title: "Đăng ký / Đặt mua",
    body: "Nhập thông tin cá nhân cơ bản và chọn môn học quan tâm vào form đăng ký tư vấn nhanh.",
    icon: PenLine,
    tone: "bg-[#f5ebff] text-[#8b4cf7] ring-[#e3cdfd]",
    arrowClass: "xl:block"
  },
  {
    step: "03",
    title: "Thanh toán / Xác nhận",
    body: "Giao dịch chuyển khoản an toàn, nhanh gọn. Đội ngũ LEFT HAND sẽ duyệt và gửi thông tin ngay.",
    icon: CreditCard,
    tone: "bg-[#ffeaf5] text-[#e34a91] ring-[#f8c9df]",
    arrowClass: "xl:block"
  },
  {
    step: "04",
    title: "Nhận hỗ trợ học tập",
    body: "Nhận tài liệu PDF, truy cập bài học hoặc bắt đầu trò chuyện ôn bài cùng Tutor.",
    icon: BadgeCheck,
    tone: "bg-[#e9faef] text-[#33a262] ring-[#c6efcf]",
    arrowClass: "hidden"
  }
] as const;

export function ProcessSection() {
  return (
    <section id="process" className="container-shell pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <MotionReveal>
          <SectionHeading
            prefix="Quy trình học tập tại"
            highlight="LEFT HAND"
          />
        </MotionReveal>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {processSteps.map((item, index) => {
            const Icon = item.icon;

            return (
              <MotionReveal key={item.step} delay={0.06 * index}>
                <article className="group relative flex h-full flex-col items-center rounded-[30px] border border-[rgba(24,43,93,0.09)] bg-[rgba(255,255,255,0.62)] px-5 pb-6 pt-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(19,37,79,0.08)] sm:px-6">
                  <div className="relative">
                    <div
                      className={`flex h-[88px] w-[88px] items-center justify-center rounded-full ring-1 transition-transform duration-300 group-hover:scale-[1.03] ${item.tone}`}
                    >
                      <Icon className="h-8 w-8" strokeWidth={2.2} />
                    </div>
                    <span className="absolute -right-1 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#13245d] text-[11px] font-extrabold tracking-[0.08em] text-white shadow-[0_8px_18px_rgba(19,36,93,0.2)]">
                      {item.step}
                    </span>
                  </div>

                  <h3 className="mt-5 text-[1.2rem] font-black leading-8 tracking-[-0.02em] text-ink">
                    Bước {index + 1}: {item.title}
                  </h3>
                  <p className="mt-3 max-w-[28ch] text-[15px] leading-7 text-[#617092]">
                    {item.body}
                  </p>

                  <div
                    className={`pointer-events-none absolute left-[72%] top-[34px] z-10 hidden h-[88px] w-[180px] ${item.arrowClass}`}
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 180 88"
                      className="h-full w-full overflow-visible"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <marker
                          id={`process-arrow-${item.step}`}
                          markerWidth="10"
                          markerHeight="10"
                          refX="8"
                          refY="5"
                          orient="auto"
                        >
                          <path d="M0 0L10 5L0 10V0Z" fill="#c8d6ef" />
                        </marker>
                      </defs>
                      <path
                        d="M6 46C54 28 112 28 170 46"
                        stroke="#c8d6ef"
                        strokeWidth="3"
                        strokeDasharray="7 9"
                        strokeLinecap="round"
                        markerEnd={`url(#process-arrow-${item.step})`}
                      />
                    </svg>
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
