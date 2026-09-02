import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAccountAccess } from "@/lib/auth/session";
import {
  getConsultationById,
  isValidUuid,
  type Consultation
} from "@/lib/repositories/consultation-repository";

const INBOX_PATH = "/quan-tri/tu-van";

function displayValue(value: string | null): string {
  return value?.trim() || "—";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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
      <DetailField label="Họ và tên" value={displayValue(consultation.full_name)} />
      <DetailField label="Số điện thoại" value={displayValue(consultation.phone)} />
      <DetailField label="Khoa" value={displayValue(consultation.faculty)} />
      <DetailField label="Chuyên ngành" value={displayValue(consultation.major)} />
      <DetailField label="Mối quan tâm" value={displayValue(consultation.interest)} />
      <DetailField label="Nhu cầu" value={displayValue(consultation.need)} />
      <DetailField label="Ghi chú" value={displayValue(consultation.note)} />
      <DetailField label="Đường dẫn nguồn" value={displayValue(consultation.source_path)} />
      <DetailField label="Slug sản phẩm đã chọn" value={displayValue(consultation.selected_product_slug)} />
      <DetailField label="Slug môn học đã chọn" value={displayValue(consultation.selected_subject_slug)} />
      <DetailField label="Trạng thái" value={displayValue(consultation.status)} />
      <DetailField label="Thời gian tạo" value={formatTimestamp(consultation.created_at)} />
      <DetailField label="Thời gian cập nhật" value={formatTimestamp(consultation.updated_at)} />
    </dl>
  );
}

export default async function AdminConsultationDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
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

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-slate-900">
      <Link href={INBOX_PATH} className="font-semibold text-blue-600">
        Quay lại danh sách tư vấn
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Chi tiết tư vấn</h1>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <ConsultationDetails consultation={consultation} />
      </div>
    </main>
  );
}
