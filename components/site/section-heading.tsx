import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  prefix?: string;
  highlight?: string;
  suffix?: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  prefix,
  highlight,
  suffix,
  description,
  align = "center",
  className
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-8 lg:mb-10",
        align === "center" ? "section-copy max-w-3xl" : "max-w-3xl",
        className
      )}
    >
      <h2 className="text-balance text-[1.85rem] sm:text-[2.35rem] lg:text-[clamp(40px,3vw,56px)] font-black leading-[1.12] tracking-[-0.02em] text-ink overflow-visible py-0.5 pb-[0.06em]">
        {prefix ? <span>{prefix} </span> : null}
        {highlight ? (
          <span className="bg-[linear-gradient(100deg,#1f6fff_0%,#7b3ff2_52%,#e957ff_100%)] bg-clip-text text-transparent pb-[0.04em] inline-block">
            {highlight}
          </span>
        ) : null}
        {suffix ? <span> {suffix}</span> : null}
      </h2>
      {description && description.trim() !== "" ? (
        <p
          className={cn(
            "mt-3 lg:mt-4 text-[16px] sm:text-[17px] lg:text-[18px] font-medium leading-[1.7] text-ink/75",
            align === "center" ? "mx-auto" : ""
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
