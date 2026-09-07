import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import { Constants } from "@/lib/supabase/database.types";
import {
  listAdminSubjects, listAdminMaterials, listAdminCourses, listAdminTutors,
  isValidUuid, type AdminSubject,
  type CreateAdminSubjectInput, type CreateAdminMaterialInput,
  type CreateAdminCourseInput, type CreateAdminTutorInput
} from "@/lib/repositories/admin-catalog-repository";
import {
  createSubjectAction, updateSubjectAction, deleteSubjectAction,
  createMaterialAction, updateMaterialAction, deleteMaterialAction,
  createCourseAction, updateCourseAction, deleteCourseAction,
  createTutorAction, updateTutorAction, deleteTutorAction
} from "./actions";

type Kind = "subject" | "material" | "course" | "tutor";
type Field = { name: string; label: string; type?: "number" | "array" | "textarea" | "boolean"; options?: readonly string[]; required?: boolean; maxLength?: number; min?: number; max?: number; step?: number; initial?: string | number };
const enums = Constants.public.Enums;
const common: Field[] = [
  { name: "slug", label: "Đường dẫn (slug)", required: true, maxLength: 150 },
  { name: "category", label: "Nhóm ngành", options: enums.category_enum, required: true },
  { name: "color_theme", label: "Chủ đề màu", options: enums.color_theme_enum, required: true }
];
const product: Field[] = [
  ...common,
  { name: "title", label: "Tiêu đề", required: true, maxLength: 250 },
  { name: "description", label: "Mô tả", type: "textarea", required: true, maxLength: 5000 },
  { name: "subject_id", label: "Môn học", required: true },
  { name: "delivery_kind", label: "Hình thức cung cấp", options: enums.delivery_kind_enum, required: true },
  { name: "publication_status", label: "Trạng thái xuất bản", options: enums.publication_status_enum, required: true },
  { name: "price_vnd", label: "Giá (VNĐ, để trống khi liên hệ báo giá)", type: "number", min: 0 },
  { name: "old_price_vnd", label: "Giá cũ (VNĐ, có thể để trống)", type: "number", min: 0 },
  { name: "is_contact_for_price", label: "Liên hệ báo giá (cần để trống giá)", type: "boolean" },
  { name: "rating", label: "Đánh giá (1–5)", type: "number", required: true, min: 1, max: 5, step: 0.1, initial: 5 },
  { name: "is_hot", label: "Nổi bật", type: "boolean" }
];
const array = (name: string, label: string): Field => ({ name, label, type: "array" });
const fields: Record<Kind, Field[]> = {
  subject: [...common,
    { name: "name", label: "Tên môn học", required: true, maxLength: 150 },
    { name: "faculty_group", label: "Nhóm khoa", required: true, maxLength: 150 }],
  material: [...product,
    { name: "pages", label: "Số trang", type: "number", required: true, min: 1 },
    array("tags", "Nhãn"), array("includes", "Nội dung bao gồm"), array("suitable_for", "Đối tượng phù hợp")],
  course: [...product,
    { name: "format", label: "Hình thức học", options: enums.course_format_enum, required: true },
    { name: "sessions", label: "Số buổi", type: "number", required: true, min: 1 },
    ...[["duration", "Thời lượng"], ["schedule", "Lịch học"], ["mentor", "Người hướng dẫn"]].map(([name, label]) => ({ name, label, required: true, maxLength: 500 })),
    { name: "enrollment_status", label: "Trạng thái tuyển sinh", options: enums.enrollment_status_enum, required: true },
    array("tags", "Nhãn"), array("curriculum", "Nội dung khóa học"), array("suitable_for", "Đối tượng phù hợp"), array("preparation", "Chuẩn bị")],
  tutor: [...product,
    ...[["name", "Tên gia sư"], ["faculty", "Khoa"], ["format", "Hình thức hỗ trợ"], ["availability", "Thời gian nhận hỗ trợ"]].map(([name, label]) => ({ name, label, required: true, maxLength: 500 })),
    { name: "short_bio", label: "Giới thiệu", type: "textarea", required: true, maxLength: 5000 },
    array("strengths", "Thế mạnh"), array("tags", "Nhãn"), array("suitable_for", "Đối tượng phù hợp"), array("support_methods", "Phương thức hỗ trợ")]
};
const labels: Record<Kind, string> = { subject: "Môn học", material: "Tài liệu", course: "Khóa học", tutor: "Gia sư" };
const optionLabels: Record<string, string> = {
  draft: "Bản nháp", published: "Đã xuất bản", archived: "Đã lưu trữ",
  digital_download: "Tài liệu tải xuống", live_session: "Buổi học trực tiếp", recorded_video: "Video ghi sẵn", one_on_one_tutoring: "Gia sư 1:1",
  online: "Trực tuyến", offline: "Tại lớp", video: "Video", zoom: "Zoom",
  open: "Đang tuyển sinh", "coming-soon": "Sắp mở", full: "Đã đủ chỗ",
  accounting: "Kế toán", economics: "Kinh tế", statistics: "Thống kê", marketing: "Marketing", management: "Quản trị", finance: "Tài chính", law: "Luật", mis: "MIS", languages: "Ngoại ngữ"
};

// Only allowlisted controls become action input. The existing actions validate
// authorization and every typed value again before any mutation.
function formInput(kind: Kind, data: FormData) {
  return Object.fromEntries(fields[kind].map((field) => {
    const raw = data.get(field.name);
    const value = typeof raw === "string" ? raw : "";
    return [field.name, field.type === "boolean" ? value === "on"
      : field.type === "array" ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
      : field.type === "number" ? (value.trim() === "" ? (field.name.endsWith("price_vnd") ? null : NaN) : Number(value))
      : value];
  }));
}

async function saveRecord(kind: Kind, id: string | null, data: FormData) {
  "use server";
  if (id !== null && !isValidUuid(id)) redirect("/quan-tri/catalog?error=1");
  const input = formInput(kind, data);
  switch (kind) {
    case "subject": return id === null ? createSubjectAction(input as unknown as CreateAdminSubjectInput) : updateSubjectAction(id, input as unknown as CreateAdminSubjectInput);
    case "material": return id === null ? createMaterialAction(input as unknown as CreateAdminMaterialInput) : updateMaterialAction(id, input as unknown as CreateAdminMaterialInput);
    case "course": return id === null ? createCourseAction(input as unknown as CreateAdminCourseInput) : updateCourseAction(id, input as unknown as CreateAdminCourseInput);
    case "tutor": return id === null ? createTutorAction(input as unknown as CreateAdminTutorInput) : updateTutorAction(id, input as unknown as CreateAdminTutorInput);
  }
}

const button = "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#1258ce]";
function Editor({ kind, id = null, values = {}, subjects }: { kind: Kind; id?: string | null; values?: Record<string, unknown>; subjects: AdminSubject[] }) {
  return <form action={saveRecord.bind(null, kind, id)} className="mt-4 space-y-4">
    <fieldset className="min-w-0">
      <legend className="text-sm font-black text-ink">{id ? "Chỉnh sửa" : "Tạo mới"} · {labels[kind]}</legend>
      <p className="mt-2 text-xs leading-6 text-ink/65">Các trường có * là bắt buộc. Với danh sách, nhập mỗi mục trên một dòng.</p>
      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        {fields[kind].map((field) => {
          const value = values[field.name] ?? field.initial ?? (field.name === "delivery_kind" ? ({ material: "digital_download", course: "live_session", tutor: "one_on_one_tutoring", subject: "" }[kind]) : "");
          const control = { name: field.name, required: field.required, className: "notebook-input mt-1 min-w-0 max-w-full", defaultValue: String(value), maxLength: field.maxLength };
          return <label key={field.name} className="block min-w-0 text-sm font-bold text-ink/65">
            <span>{field.label}{field.required ? " *" : ""}</span>
            {field.name === "subject_id" ? <select {...control} className="notebook-select mt-1 min-w-0 max-w-full"><option value="" disabled>Chọn môn học</option>{subjects.filter((subject) => isValidUuid(subject.id)).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}{typeof value === "string" && isValidUuid(value) && !subjects.some((subject) => subject.id === value) ? <option value={value}>Môn học hiện tại</option> : null}</select>
              : field.options ? <select {...control} defaultValue={String(value || field.options[0])} className="notebook-select mt-1 min-w-0 max-w-full">{field.options.map((option) => <option key={option} value={option}>{optionLabels[option] ?? option}</option>)}</select>
              : field.type === "boolean" ? <input type="checkbox" name={field.name} defaultChecked={value === true} className="ml-3 h-4 w-4 accent-accent" />
              : field.type === "array" || field.type === "textarea" ? <textarea {...control} defaultValue={Array.isArray(value) ? value.join("\n") : String(value)} rows={3} className="notebook-textarea mt-1 min-w-0 max-w-full" />
              : <input {...control} type={field.type === "number" ? "number" : "text"} min={field.min} max={field.max} step={field.step ?? 1} pattern={field.name === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined} />}
          </label>;
        })}
      </div>
    </fieldset>
    <button type="submit" className={button}>{id ? "Lưu thay đổi" : "Tạo mới"}</button>
  </form>;
}

export default async function AdminCatalogPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getAccountAccess();
  if (access.status === "unauthenticated") redirect("/dang-nhap?next=/quan-tri/catalog");
  if (access.status !== "approved" || access.profile?.role !== "admin") notFound();

  const params = await searchParams ?? {};
  const rawPage = params.page;
  const page = typeof rawPage === "string" && /^\d+$/.test(rawPage) && Number(rawPage) > 0 && Number(rawPage) <= 10000 ? Number(rawPage) : 1;
  const options = { limit: 21, offset: (page - 1) * 20 };
  const results = await Promise.allSettled([listAdminSubjects(options), listAdminMaterials(options), listAdminCourses(options), listAdminTutors(options)]);
  const [subjectResult, materialResult, courseResult, tutorResult] = results;
  const subjects = subjectResult.status === "fulfilled" ? subjectResult.value : [];
  const materialIds = materialResult.status === "fulfilled" ? materialResult.value.map((row) => row.id).filter(isValidUuid) : [];
  const materialVersions = await import("@/lib/repositories/material-asset-repository")
    .then(({ listCurrentMaterialAssetVersions }) => listCurrentMaterialAssetVersions(materialIds))
    .catch(() => null);
  const sections = [
    { kind: "subject" as const, result: subjectResult, rows: subjects.map((row) => ({ id: row.id, title: row.name, values: { ...row } })), remove: deleteSubjectAction },
    { kind: "material" as const, result: materialResult, rows: materialResult.status === "fulfilled" ? materialResult.value.map((row) => ({ id: row.id, title: row.title, values: { ...row, ...row.materials, material_asset_version: materialVersions?.[row.id] } })) : [], remove: deleteMaterialAction },
    { kind: "course" as const, result: courseResult, rows: courseResult.status === "fulfilled" ? courseResult.value.map((row) => ({ id: row.id, title: row.title, values: { ...row, ...row.courses } })) : [], remove: deleteCourseAction },
    { kind: "tutor" as const, result: tutorResult, rows: tutorResult.status === "fulfilled" ? tutorResult.value.map((row) => ({ id: row.id, title: row.title, values: { ...row, ...row.tutors } })) : [], remove: deleteTutorAction }
  ];
  return <main className="container-shell min-w-0 px-4 pb-16 pt-8 text-ink sm:px-6 lg:px-8">
    <header className="notebook-card notebook-paper-lines rounded-[28px] p-6 sm:p-8">
      <p className="eyebrow text-accent">Quản trị · Danh mục</p>
      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Quản lý danh mục</h1>
      <p className="mt-3 text-sm leading-7 text-ink/65">Quản lý môn học, tài liệu, khóa học và gia sư. Nội dung bản nháp và đã lưu trữ chỉ hiển thị trong khu vực quản trị.</p>
      <nav aria-label="Các mục danh mục" className="mt-5 flex flex-wrap gap-2">{sections.map(({ kind }) => <a key={kind} href={`#${kind}`} className="nav-paper-link rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm font-extrabold">{labels[kind]}</a>)}</nav>
    </header>
    {params.success === "1" ? <p role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm font-semibold text-emerald-800">Cập nhật danh mục thành công.</p> : null}
    {params.error === "1" ? <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm font-semibold text-rose-700">Không thể cập nhật danh mục. Vui lòng kiểm tra thông tin và thử lại.</p> : null}
    {params.upload === "success" ? <p role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm font-semibold text-emerald-800">Tải tệp tài liệu thành công.</p> : null}
    {params.upload === "error" ? <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm font-semibold text-rose-700">Không thể tải tệp tài liệu. Vui lòng thử lại.</p> : null}
    {sections.map(({ kind, rows, result, remove }) => <section key={kind} id={kind} aria-labelledby={`${kind}-title`} className="mt-8 min-w-0 space-y-4">
      <h2 id={`${kind}-title`} className="text-2xl font-black">{labels[kind]}</h2>
      <details className="surface-card min-w-0 p-5 sm:p-6"><summary className="cursor-pointer font-extrabold text-accent">Tạo mới · {labels[kind]}</summary><Editor kind={kind} subjects={subjects} /></details>
      {result.status === "rejected" ? <p role="alert" className="surface-card p-5 text-sm text-ink/65">Không thể tải danh mục lúc này. Vui lòng thử lại sau.</p> : rows.length === 0 ? <p className="notebook-card notebook-paper-lines rounded-2xl p-6 text-sm text-ink/65">Chưa có {labels[kind].toLowerCase()} trong trang này.</p> : rows.slice(0, 20).map((row) => <article key={row.id} className="surface-card min-w-0 p-5 sm:p-6">
        <h3 className="break-words text-lg font-black [overflow-wrap:anywhere]">{row.title}</h3>
        {"publication_status" in row.values ? <p className="mt-2 text-sm text-ink/65">{optionLabels[String(row.values.publication_status)] ?? "Trạng thái chưa xác định"}</p> : null}
        {kind === "material" && materialVersions !== null && isValidUuid(row.id) ? <div className="mt-4 border-t border-ink/10 pt-4"><p className="text-sm font-bold text-ink/65">{typeof (row.values as Record<string, unknown>).material_asset_version === "number" ? `Phiên bản tệp hiện tại: v${(row.values as unknown as Record<string, number>).material_asset_version}` : "Chưa có tệp được tải lên."}</p><form action={`/api/admin/materials/${row.id}/upload`} method="post" encType="multipart/form-data" className="mt-3 flex flex-wrap items-end gap-3"><label className="block text-sm font-bold text-ink/65"><span>Tệp PDF hoặc video</span><input name="file" type="file" required accept="application/pdf,video/mp4,video/webm,video/quicktime" className="mt-1 block max-w-full text-sm" /></label><button type="submit" className={button}>Tải phiên bản mới</button></form></div> : null}
        {isValidUuid(row.id) ? <><details className="mt-4 min-w-0"><summary className="cursor-pointer text-sm font-bold text-accent">Chỉnh sửa · {row.title}</summary><Editor kind={kind} id={row.id} values={row.values} subjects={subjects} /></details>
          <details className="mt-4 border-t border-ink/10 pt-4"><summary className="cursor-pointer text-sm font-bold text-rose-700">Xóa · {row.title}</summary><form action={remove.bind(null, row.id)} className="mt-3 space-y-3"><p className="text-sm text-ink/65">Thao tác xóa không thể hoàn tác. Nếu nội dung đang được sử dụng, yêu cầu có thể không thực hiện được.</p><label className="flex items-center gap-2 text-sm text-ink/65"><input type="checkbox" required />Tôi xác nhận xóa bản ghi này</label><button type="submit" className="min-h-11 rounded-full border border-rose-200 px-5 py-2 text-sm font-extrabold text-rose-700">Xác nhận xóa</button></form></details></> : <p className="mt-3 text-sm text-ink/65">Không thể chỉnh sửa bản ghi này.</p>}
      </article>)}
    </section>)}
    <nav aria-label="Phân trang danh mục" className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm font-bold">
      {page > 1 ? <a href={`?page=${page - 1}`} className="nav-paper-link">Trang trước</a> : <span />}
      <span className="text-ink/65">Trang {page}</span>
      {page < 10000 && sections.some(({ rows }) => rows.length > 20) ? <a href={`?page=${page + 1}`} className="nav-paper-link">Trang sau</a> : <span />}
    </nav>
  </main>;
}
