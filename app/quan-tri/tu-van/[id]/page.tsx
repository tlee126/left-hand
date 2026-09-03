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
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-slate-900">{value}</dd>
    </div>
  );
}

function ConsultationDetails({ consultation }: { consultation: Consultation }): ReactNode {
  return (
    <dl className="grid gap-6 sm:grid-cols-2">
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
      <DetailField label="Slug môn học đã chọn" value={displayNullableValue(consultation.selected_subject_slug)} />
      <DetailField label="Trạng thái" value={consultation.status} />
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
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-slate-900">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Không thể tải thông tin tư vấn lúc này. Vui lòng thử lại sau.
        </p>
        <Link href={INBOX_PATH} className="mt-6 inline-block font-semibold text-blue-600">
          Quay lại danh sách tư vấn
        </Link>
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
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-slate-900">
      <Link href={INBOX_PATH} className="font-semibold text-blue-600">
        Quay lại danh sách tư vấn
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Chi tiết tư vấn</h1>

      {successFlag && (
        <p role="status" className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Cập nhật trạng thái thành công.
        </p>
      )}

      {errorFlag && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Không thể cập nhật trạng thái tư vấn. Vui lòng thử lại sau.
        </p>
      )}

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <ConsultationDetails consultation={consultation} />
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Cập nhật trạng thái tư vấn</h2>
        <form action={updateStatusWithId} className="mt-4 flex flex-wrap items-center gap-4">
          <label htmlFor="status-select" className="text-sm font-medium text-slate-700">
            Trạng thái hiện tại: <span className="font-semibold">{consultation.status}</span>
          </label>
          <select
            id="status-select"
            name="status"
            defaultValue={consultation.status}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {VALID_CONSULTATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Lưu trạng thái
          </button>
        </form>
      </div>
    </main>
  );
}
