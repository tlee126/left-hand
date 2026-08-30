"use client";

import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { faculties, majors, courseGroups, needs } from "@/data/site";
import { materials, courses, tutors } from "@/data/catalog";
import { findSubjectByName, findSubjectBySlug } from "@/lib/domain/subjects";
import { validateConsultationInput, type ConsultationInput } from "@/lib/validation/consultation";

export type FormValues = {
  fullName: string;
  phone: string;
  faculty: string;
  major: string;
  interest: string;
  need: string;
  note: string;
};

export type FormErrors = Partial<Record<keyof FormValues, string>>;

export const initialValues: FormValues = {
  fullName: "",
  phone: "",
  faculty: "",
  major: "",
  interest: "",
  need: "",
  note: ""
};

export interface CtaMetadataResult {
  sourcePath: string | null;
  selectedProductSlug: string | null;
  selectedSubjectSlug: string | null;
  resolvedInterest?: string;
  resolvedNeed?: string;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function resolveCtaMetadata(
  search: string,
  pathname: string = "/"
): CtaMetadataResult {
  const normalizedSearch = search.startsWith("?") || search === "" ? search : `?${search}`;
  const params = new URLSearchParams(normalizedSearch);
  const interestParam = params.get("interest");
  const typeParam = params.get("type");

  const sourcePath = `${pathname}${normalizedSearch}`.slice(0, 500);

  if (!interestParam) {
    return {
      sourcePath: sourcePath || "/",
      selectedProductSlug: null,
      selectedSubjectSlug: null
    };
  }

  let selectedProductSlug: string | null = null;
  let selectedSubjectSlug: string | null = null;
  let resolvedInterest = interestParam;
  let resolvedNeed = "";

  const mat = materials.find((m) => m.slug === interestParam);
  if (mat) {
    selectedProductSlug = mat.slug;
    resolvedInterest = mat.subject;
    const matchedSubject = findSubjectByName(mat.subject);
    selectedSubjectSlug = matchedSubject?.slug || null;
  } else {
    const crs = courses.find((c) => c.slug === interestParam);
    if (crs) {
      selectedProductSlug = crs.slug;
      resolvedInterest = crs.subject;
      const matchedSubject = findSubjectByName(crs.subject);
      selectedSubjectSlug = matchedSubject?.slug || null;
    } else {
      const tut = tutors.find((t) => t.slug === interestParam);
      if (tut) {
        selectedProductSlug = tut.slug;
        resolvedInterest = tut.subjects[0] || interestParam;
        const matchedSubject = findSubjectByName(tut.subjects[0]);
        selectedSubjectSlug = matchedSubject?.slug || null;
      } else {
        const subj = findSubjectBySlug(interestParam) || findSubjectByName(interestParam);
        if (subj) {
          selectedSubjectSlug = subj.slug;
          resolvedInterest = subj.name;
        }
      }
    }
  }

  if (typeParam === "material") {
    resolvedNeed = "Tài liệu ôn thi";
  } else if (typeParam === "course") {
    resolvedNeed = "Khóa học / lớp ôn";
  } else if (typeParam === "tutor") {
    resolvedNeed = "Peer Tutor 1:1";
  }

  return {
    sourcePath,
    selectedProductSlug,
    selectedSubjectSlug,
    resolvedInterest,
    resolvedNeed: resolvedNeed || undefined
  };
}

export function buildConsultationPayload(
  values: FormValues,
  ctaMeta: {
    sourcePath?: string | null;
    selectedProductSlug?: string | null;
    selectedSubjectSlug?: string | null;
  }
): ConsultationInput {
  const subjectSlug =
    findSubjectByName(values.interest)?.slug ||
    findSubjectBySlug(values.interest)?.slug ||
    ctaMeta.selectedSubjectSlug ||
    null;

  return {
    fullName: values.fullName.trim(),
    phone: values.phone.trim(),
    faculty: values.faculty.trim(),
    major: values.major.trim() || null,
    interest: values.interest.trim(),
    need: values.need.trim(),
    note: values.note.trim() || null,
    sourcePath: ctaMeta.sourcePath ? ctaMeta.sourcePath.slice(0, 500) : null,
    selectedProductSlug: ctaMeta.selectedProductSlug
      ? ctaMeta.selectedProductSlug.slice(0, 150)
      : null,
    selectedSubjectSlug: subjectSlug ? subjectSlug.slice(0, 150) : null
  };
}

export interface ConsultationSubmitResult {
  success: boolean;
  status: number;
  message: string;
  details?: Record<string, string>;
}

export async function submitConsultation(
  payload: ConsultationInput,
  idempotencyKey: string,
  fetchFn: typeof fetch = fetch
): Promise<ConsultationSubmitResult> {
  try {
    const response = await fetchFn("/api/consultations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 201) {
      return {
        success: true,
        status: 201,
        message: "Đã nhận nhu cầu của bạn. LEFT HAND sẽ liên hệ lại với gợi ý phù hợp."
      };
    }

    if (response.status === 409) {
      return {
        success: true,
        status: 409,
        message: "Yêu cầu tư vấn của bạn đã được tiếp nhận. LEFT HAND sẽ liên hệ sớm nhất."
      };
    }

    if (response.status === 400) {
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // ignore JSON parse error
      }

      return {
        success: false,
        status: 400,
        message: "Vui lòng kiểm tra lại các trường thông tin bắt buộc.",
        details: data?.details && typeof data.details === "object" ? data.details : undefined
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        status: 429,
        message: "Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút."
      };
    }

    // 500, 503, or any other server error status
    return {
      success: false,
      status: response.status,
      message: "Hệ thống đang bận hoặc tạm thời gián đoạn. Vui lòng thử lại sau ít phút."
    };
  } catch {
    return {
      success: false,
      status: 0,
      message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại."
    };
  }
}

export function ConsultationForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [ctaMeta, setCtaMeta] = useState<{
    sourcePath: string | null;
    selectedProductSlug: string | null;
    selectedSubjectSlug: string | null;
  }>({
    sourcePath: null,
    selectedProductSlug: null,
    selectedSubjectSlug: null
  });

  const idempotencyKeyRef = useRef<string | null>(null);
  const isLoading = status === "loading";

  const helperMessage = useMemo(() => {
    if (feedback?.message) {
      return feedback.message;
    }

    if (status === "success") {
      return "Đã nhận nhu cầu của bạn. LEFT HAND sẽ liên hệ lại với gợi ý phù hợp.";
    }

    if (Object.keys(errors).length > 0) {
      return "Vui lòng kiểm tra lại các trường bắt buộc.";
    }

    return "Điền nhanh nhu cầu hiện tại để team gợi ý tài liệu, tutor hoặc lớp ôn đúng môn.";
  }, [errors, feedback, status]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const meta = resolveCtaMetadata(window.location.search, window.location.pathname);
      setCtaMeta({
        sourcePath: meta.sourcePath,
        selectedProductSlug: meta.selectedProductSlug,
        selectedSubjectSlug: meta.selectedSubjectSlug
      });

      setValues((current) => {
        const next = { ...current };
        if (meta.resolvedInterest) {
          next.interest = meta.resolvedInterest;
        }
        if (meta.resolvedNeed) {
          next.need = meta.resolvedNeed;
        }
        return next;
      });
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    setFeedback(null);

    const currentSourcePath = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : ctaMeta.sourcePath;

    const payload = buildConsultationPayload(values, {
      sourcePath: currentSourcePath,
      selectedProductSlug: ctaMeta.selectedProductSlug,
      selectedSubjectSlug: ctaMeta.selectedSubjectSlug
    });

    const validation = validateConsultationInput(payload);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setStatus("idle");
      return;
    }

    setErrors({});
    setStatus("loading");

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
    const idempotencyKey = idempotencyKeyRef.current;

    try {
      const result = await submitConsultation(payload, idempotencyKey);

      if (result.success) {
        setStatus("success");
        setFeedback({ type: "success", message: result.message });
        setValues(initialValues);
        setErrors({});
        // Reset idempotency key only after successful completion or form reset
        idempotencyKeyRef.current = null;
      } else {
        setStatus("error");
        setFeedback({ type: "error", message: result.message });
        if (result.details) {
          setErrors(result.details);
        }
        // Retain entered values and idempotency key for retry
      }
    } catch {
      setStatus("error");
      setFeedback({
        type: "error",
        message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại."
      });
    }
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
                {feedback && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`rounded-xl p-3.5 text-sm font-semibold border transition-all ${
                      feedback.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}
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
                  error={errors.note}
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
                      className={inputClass("textarea", Boolean(errors.note))}
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
