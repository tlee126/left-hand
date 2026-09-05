import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAccountAccess } from "@/lib/auth/session";
import {
  getConsultationById,
  isValidUuid,
  VALID_CONSULTATION_STATUSES,
  type Consultation
} from "@/lib/repositories/consultation-repository";

const INBOX_PATH = "/quan-tri/tu-van";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function displayNullableValue(value: string | null): string {
  return value?.trim() || "—";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function DetailField({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase tracking-wide text-ink/55">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}

function ConsultationDetails({ consultation }: { consultation: Consultation }): ReactNode {
  return (
    <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      <DetailField label="ID lead" value={consultation.id} />
      <DetailField label="Mã yêu cầu" value={consultation.request_id} />
      <DetailField label="Họ và tên" value={consultation.full_name} />
      <DetailField label="Số điện thoại" value={consultation.phone} />
      <DetailField label="Khoa" value={consultation.faculty} />
      <DetailField label="Chuyên ngành" value={displayNullableValue(consultation.major)} />
      <DetailField label="Mối quan tâm" value={consultation.interest} />
      <DetailField label="Nhu cầu" value={consultation.need} />
      <DetailField label="Ghi chú" value={displayNullableValue(consultation.note)} />
      <DetailField label="Đường dẫn nguồn" value={displayNullableValue(consultation.source_path)} />
      <DetailField label="Slug sản phẩm đã chọn" value={displayNullableValue(consultation.selected_product_slug)} />
      <div>
        <dt className="text-xs font-extrabold uppercase tracking-wide text-ink/55">Trạng thái</dt>
        <dd className="mt-2">
          <span className="inline-flex rounded-full border border-accent/15 bg-accent/[0.07] px-2.5 py-1 text-xs font-extrabold text-ink/75">
            {consultation.status}
          </span>
        </dd>
      </div>
      <DetailField label="Thời gian tạo" value={formatTimestamp(consultation.created_at)} />
      <DetailField label="Thời gian cập nhật" value={formatTimestamp(consultation.updated_at)} />
    </dl>
  );
}

export default async function AdminConsultationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
    const { id } = await params;
    redirect(`/dang-nhap?next=${INBOX_PATH}/${id}`);
  }

  if (access.status !== "approved" || access.profile?.role !== "admin") {
    notFound();
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    notFound();
  }

  const query = searchParams ? await searchParams : {};
  const successFlag =
    firstParam(query.success) === "1" ||
    firstParam(query.status_updated) === "1" ||
    firstParam(query.status) === "success";
  const errorFlag =
    firstParam(query.error) === "1" ||
    firstParam(query.status_error) === "1" ||
    firstParam(query.status) === "error";

  let consultation: Consultation | null;
  try {
    consultation = await getConsultationById(id);
  } catch {
    return (
      <main className="container-shell min-h-screen px-4 pb-16 pt-8 text-ink sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl rounded-[26px] border border-rose-200 bg-rose-50/90 p-5 sm:p-6">
        <p role="alert" className="text-sm font-semibold text-rose-700">
          Không thể tải thông tin tư vấn lúc này. Vui lòng thử lại sau.
        </p>
        <Link href={INBOX_PATH} className="mt-6 inline-flex rounded-full border border-rose-200 bg-white/70 px-4 py-2 text-sm font-extrabold text-accent hover:bg-white">
          Quay lại danh sách tư vấn
        </Link>
        </section>
      </main>
    );
  }

  if (!consultation) {
    notFound();
  }

  async function updateConsultationStatusAction(
    targetId: string,
    formData: FormData
  ) {
    "use server";
    const { updateConsultationStatusAction: action } = await import(
      "../actions"
    );
    return action(targetId, formData);
  }

  const updateStatusWithId = updateConsultationStatusAction.bind(
    null,
    consultation.id
  );

  return (
    <main className="container-shell min-h-screen px-4 pb-16 pt-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
      <Link href={INBOX_PATH} className="inline-flex rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-extrabold text-accent transition hover:border-accent/25 hover:bg-white">
        ← Quay lại danh sách tư vấn
      </Link>
      <header className="mt-6">
        <p className="eyebrow text-accent">Quản trị · Tư vấn</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Chi tiết tư vấn</h1>
        <p className="mt-3 text-sm text-ink/65">Thông tin lead và lịch sử cập nhật trạng thái.</p>
      </header>

      {successFlag && (
        <p role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm font-semibold text-emerald-800">
          Cập nhật trạng thái thành công.
        </p>
      )}

      {errorFlag && (
        <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm font-semibold text-rose-700">
          Không thể cập nhật trạng thái tư vấn. Vui lòng thử lại sau.
        </p>
      )}

      <section className="notebook-card notebook-paper-lines mt-8 rounded-[26px] p-5 sm:p-7" aria-labelledby="consultation-details-title">
        <h2 id="consultation-details-title" className="mb-6 border-b border-ink/10 pb-4 text-lg font-black text-ink">Thông tin yêu cầu</h2>
        <ConsultationDetails consultation={consultation} />
      </section>

      <section className="surface-card mt-6 p-5 sm:p-7" aria-labelledby="consultation-status-title">
        <h2 id="consultation-status-title" className="text-lg font-black text-ink">Cập nhật trạng thái tư vấn</h2>
        <form action={updateStatusWithId} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <label htmlFor="status-select" className="text-sm font-bold text-ink/70">
            Trạng thái hiện tại: <span className="font-semibold">{consultation.status}</span>
          </label>
          <select
            id="status-select"
            name="status"
            defaultValue={consultation.status}
            className="notebook-select"
          >
            {VALID_CONSULTATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-accent px-5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(23,101,233,0.16)] transition hover:bg-[#1258ce]"
          >
            Lưu trạng thái
          </button>
        </form>
      </section>
      </div>
    </main>
  );
}
