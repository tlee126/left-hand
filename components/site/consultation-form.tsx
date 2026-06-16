"use client";

import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { faculties, majors, courseGroups, needs } from "@/data/site";
import { materials, courses, tutors } from "@/data/catalog";

type FormValues = {
  fullName: string;
  phone: string;
  faculty: string;
  major: string;
  interest: string;
  need: string;
  note: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  fullName: "",
  phone: "",
  faculty: "",
  major: "",
  interest: "",
  need: "",
  note: ""
};

export function ConsultationForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = status === "loading";

  const helperMessage = useMemo(() => {
    if (status === "success") {
      return "Đã nhận nhu cầu của bạn. LEFT HAND sẽ liên hệ lại với gợi ý phù hợp.";
    }

    if (Object.keys(errors).length > 0) {
      return "Vui lòng kiểm tra lại các trường bắt buộc.";
    }

    return "Điền nhanh nhu cầu hiện tại để team gợi ý tài liệu, tutor hoặc lớp ôn đúng môn.";
  }, [errors, status]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const interestParam = params.get("interest");
      const typeParam = params.get("type");

      if (interestParam) {
        // Resolve subject name from slug
        let resolvedInterest = interestParam;
        const mat = materials.find((m) => m.slug === interestParam);
        if (mat) {
          resolvedInterest = mat.subject;
        } else {
          const crs = courses.find((c) => c.slug === interestParam);
          if (crs) {
            resolvedInterest = crs.subject;
          } else {
            const tut = tutors.find((t) => t.slug === interestParam);
            if (tut) {
              resolvedInterest = tut.subjects[0] || interestParam;
            }
          }
        }

        setValues((current) => {
          const next = { ...current };
          next.interest = resolvedInterest;
          if (typeParam === "material") {
            next.need = "Tài liệu ôn thi";
          } else if (typeParam === "course") {
            next.need = "Khóa học / lớp ôn";
          } else if (typeParam === "tutor") {
            next.need = "Peer Tutor 1:1";
          }
          return next;
        });
      }
    }
  }, []);

  function validate(nextValues: FormValues) {
    const nextErrors: FormErrors = {};

    if (!nextValues.fullName.trim()) nextErrors.fullName = "Vui lòng nhập họ và tên.";
    if (!nextValues.phone.trim()) {
      nextErrors.phone = "Vui lòng nhập số điện thoại.";
    } else if (nextValues.phone.replace(/\D/g, "").length < 9) {
      nextErrors.phone = "Số điện thoại chưa hợp lệ.";
    }
    if (!nextValues.faculty) nextErrors.faculty = "Vui lòng chọn khoa/viện.";
    if (!nextValues.interest) nextErrors.interest = "Vui lòng chọn môn học.";
    if (!nextValues.need) nextErrors.need = "Vui lòng chọn nhu cầu.";

    return nextErrors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      return;
    }

    setStatus("loading");

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setStatus("success");
      setValues(initialValues);
      setErrors({});
    }, 1200);
  }

  return (
    <section id="contact" className="container-shell pt-5">
      <div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
          <MotionReveal>
            <div className="notebook-card notebook-paper-lines h-full pt-14 pb-8 px-6 sm:pt-16 sm:px-10 md:px-12">
              {/* Spiral binding holes */}
              <div className="notebook-holes">
                {Array.from({ length: 11 }).map((_, index) => (
                  <span key={index} className="notebook-hole" />
                ))}
              </div>

              <SectionHeading
                className="mb-0 relative z-10"
                align="left"
                highlight="Đăng ký"
                suffix="tư vấn"
                description={helperMessage}
              />

              <form className="mt-6 grid gap-4 relative z-10" noValidate onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Họ và tên *"
                    error={errors.fullName}
                    input={
                      <input
                        value={values.fullName}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            fullName: event.target.value
                          }))
                        }
                        placeholder="Ví dụ: Nguyễn Văn A"
                        className={inputClass("input", Boolean(errors.fullName))}
                      />
                    }
                  />

                  <Field
                    label="Số điện thoại *"
                    error={errors.phone}
                    input={
                      <input
                        value={values.phone}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            phone: event.target.value
                          }))
                        }
                        placeholder="Ví dụ: 09xx xxx xxx"
                        inputMode="tel"
                        className={inputClass("input", Boolean(errors.phone))}
                      />
                    }
                  />

                  <Field
                    label="Khoa/Viện đang học *"
                    error={errors.faculty}
                    input={
                      <select
                        value={values.faculty}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            faculty: event.target.value
                          }))
                        }
                        className={inputClass("select", Boolean(errors.faculty))}
                      >
                        <option value="">Chọn khoa/viện</option>
                        {faculties.map((faculty) => (
                          <option key={faculty} value={faculty}>
                            {faculty}
                          </option>
                        ))}
                      </select>
                    }
                  />

                  <Field
                    label="Ngành học"
                    error={errors.major}
                    input={
                      <select
                        value={values.major}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            major: event.target.value
                          }))
                        }
                        className={inputClass("select", Boolean(errors.major))}
                      >
                        <option value="">Chọn ngành học</option>
                        {majors.map((major) => (
                          <option key={major} value={major}>
                            {major}
                          </option>
                        ))}
                      </select>
                    }
                  />
                </div>

                <Field
                  label="Môn học / học phần quan tâm *"
                  error={errors.interest}
                  input={
                    <select
                      value={values.interest}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          interest: event.target.value
                        }))
                      }
                      className={inputClass("select", Boolean(errors.interest))}
                    >
                      <option value="">Chọn môn học hoặc học phần</option>
                      {courseGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.items.map((course) => (
                            <option key={course} value={course}>
                              {course}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  }
                />

                <Field
                  label="Bạn đang cần gì? *"
                  error={errors.need}
                  input={
                    <select
                      value={values.need}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          need: event.target.value
                        }))
                      }
                      className={inputClass("select", Boolean(errors.need))}
                    >
                      <option value="">Chọn nhu cầu</option>
                      {needs.map((need) => (
                        <option key={need} value={need}>
                          {need}
                        </option>
                      ))}
                    </select>
                  }
                />

                <Field
                  label="Ghi chú không bắt buộc"
                  input={
                    <textarea
                      value={values.note}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          note: event.target.value
                        }))
                      }
                      placeholder="Ví dụ: Mình cần ôn giữa kỳ gấp, đang kẹt phần nào, hoặc muốn học vào buổi tối."
                      className={inputClass("textarea", false)}
                    />
                  }
                />

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="notebook-submit-btn min-w-[170px] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      "Gửi nhu cầu"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </MotionReveal>

          <MotionReveal delay={0.08} className="group">
            <aside className="relative h-full rounded-tr-[36px] rounded-bl-[30px] rounded-tl-[20px] rounded-br-[24px] border border-[#132a67]/12 bg-[#fffdf5] note-paper-lines px-6 pt-12 pb-32 shadow-[0_16px_36px_rgba(19,37,79,0.05),_0_2px_8px_rgba(19,37,79,0.02)] rotate-[-0.7deg] transform transition-all duration-300 hover:rotate-0 hover:shadow-[0_20px_48px_rgba(19,37,79,0.09)] sm:px-8">
              {/* Paperclip (Kẹp ghim giấy SVG) */}
              <svg
                viewBox="0 0 32 72"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-9 h-20 text-[#132a67]/75 absolute -top-8 left-12 z-20 pointer-events-none drop-shadow-[0_4px_6px_rgba(19,36,93,0.18)] rotate-[15deg] transform origin-center"
              >
                <path d="M 14 38 V 20 C 14 13, 22 13, 22 20 V 46 C 22 52, 10 52, 10 46 V 12 C 10 5, 26 5, 26 12 V 42" />
              </svg>

              <div className="relative z-10">
                <h3 className="text-lg font-black uppercase tracking-wider text-[#132a67] mb-5">
                  Để tụi mình tư vấn sát nhất:
                </h3>

                <ul className="space-y-4 text-[15px] leading-relaxed text-ink/80">
                  <li className="flex gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" className="w-5 h-5 text-accent shrink-0 mt-0.5">
                      <path d="M20 6L9 17L4 12" />
                    </svg>
                    <span><strong>Tụi mình sẽ chủ động</strong> xem môn học của bạn để gợi ý đúng tài liệu, lớp ôn hoặc tutor UFM phù hợp.</span>
                  </li>
                  <li className="flex gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" className="w-5 h-5 text-accent shrink-0 mt-0.5">
                      <path d="M20 6L9 17L4 12" />
                    </svg>
                    <span>Ghi chú không bắt buộc, nhưng ghi càng rõ thì gợi ý sẽ càng sát nhu cầu của bạn.</span>
                  </li>
                  <li className="flex gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" className="w-5 h-5 text-accent shrink-0 mt-0.5">
                      <path d="M20 6L9 17L4 12" />
                    </svg>
                    <span>Team sẽ lọc nhanh theo môn học & phần đang kẹt để đề xuất hỗ trợ sớm nhất.</span>
                  </li>
                  <li className="flex gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" className="w-5 h-5 text-accent shrink-0 mt-0.5">
                      <path d="M20 6L9 17L4 12" />
                    </svg>
                    <span>Nếu cần hỗ trợ gấp, cứ để lại thông tin ngắn gọn để được ưu tiên phản hồi.</span>
                  </li>
                </ul>
              </div>

              {/* Mascot Peeking from bottom right */}
              <Image
                src="/assets/branding/mascot-cheetah-branch.png"
                alt="LEFT HAND mascot"
                width={360}
                height={360}
                className="absolute right-8 bottom-6 h-auto w-[176px] opacity-95 z-20 pointer-events-none transition-transform duration-300 group-hover:scale-105 group-hover:translate-y-[-2px]"
              />
            </aside>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  input
}: {
  label: string;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div className="notebook-field">
      <label className="text-sm font-bold text-ink/90 cursor-pointer flex flex-col gap-1.5">
        <span>{label}</span>
        {input}
      </label>
      {error ? <span className="text-xs font-semibold text-rose-500 pl-1">{error}</span> : null}
    </div>
  );
}

function inputClass(type: "input" | "select" | "textarea", hasError: boolean) {
  return [
    type === "input" ? "notebook-input" : type === "select" ? "notebook-select" : "notebook-textarea",
    hasError ? "has-error" : ""
  ].join(" ");
}
