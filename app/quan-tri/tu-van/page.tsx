import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import {
  listConsultations,
  VALID_CONSULTATION_STATUSES,
  type Consultation,
  type ConsultationStatus,
  type ListConsultationsOptions
} from "@/lib/repositories/consultation-repository";

const INBOX_PATH = "/quan-tri/tu-van";
const PAGE_SIZE = 20;
/** Maximum accepted inbox page; its offset remains a safe integer. */
const MAX_INBOX_PAGE = 10_000;

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= MAX_INBOX_PAGE ? page : 1;
}

function parseStatus(value: string | undefined): ConsultationStatus | undefined {
  return value && VALID_CONSULTATION_STATUSES.includes(value as ConsultationStatus)
    ? (value as ConsultationStatus)
    : undefined;
}

function buildQuery(page: number, search: string, status?: ConsultationStatus): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatCreatedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function displayValue(value: string | null): string {
  return value?.trim() || "—";
}

export default async function AdminConsultationInboxPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
    redirect(`/dang-nhap?next=${INBOX_PATH}`);
  }

  if (
    access.status !== "approved" ||
    access.profile?.role !== "admin"
  ) {
    notFound();
  }

  const params = searchParams ? await searchParams : {};
  const search = firstParam(params.q)?.trim() ?? "";
  const status = parseStatus(firstParam(params.status));
  const page = parsePage(firstParam(params.page));
  const options: ListConsultationsOptions = {
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE
  };
  if (search) options.search = search;
  if (status) options.status = status;

  let fetchedRows: Consultation[];
  let loadFailed = false;
  try {
    fetchedRows = await listConsultations(options);
  } catch {
    loadFailed = true;
    fetchedRows = [];
  }

  const consultations = fetchedRows.slice(0, PAGE_SIZE);
  const hasPreviousPage = page > 1;
  const hasNextPage = fetchedRows.length > PAGE_SIZE;
  const previousHref = `${INBOX_PATH}${buildQuery(page - 1, search, status)}`;
  const nextHref = `${INBOX_PATH}${buildQuery(page + 1, search, status)}`;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 text-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Quản trị · Tư vấn
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Hộp thư tư vấn</h1>
          <p className="mt-2 text-sm text-slate-600">Trang {page} · {consultations.length} yêu cầu trong trang này</p>
        </div>
      </div>

      <form method="get" className="mt-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Tìm theo họ tên hoặc số điện thoại</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Tìm theo họ tên hoặc số điện thoại"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label>
          <span className="sr-only">Lọc theo trạng thái</span>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Tất cả trạng thái</option>
            {VALID_CONSULTATION_STATUSES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white">Tìm kiếm</button>
      </form>

      {loadFailed ? (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Không thể tải danh sách tư vấn lúc này. Vui lòng thử lại sau.
        </p>
      ) : consultations.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-600">
          Chưa có yêu cầu tư vấn phù hợp.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Điện thoại</th>
                <th className="px-4 py-3">Khoa</th>
                <th className="px-4 py-3">Mối quan tâm</th>
                <th className="px-4 py-3">Nhu cầu</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consultations.map((consultation) => (
                <tr key={consultation.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatCreatedAt(consultation.created_at)}</td>
                  <td className="px-4 py-3 font-semibold">{displayValue(consultation.full_name)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{displayValue(consultation.phone)}</td>
                  <td className="px-4 py-3">{displayValue(consultation.faculty)}</td>
                  <td className="px-4 py-3">{displayValue(consultation.interest)}</td>
                  <td className="max-w-xs px-4 py-3">{displayValue(consultation.need)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{consultation.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Phân trang" className="mt-8 flex justify-between">
        {hasPreviousPage ? <Link href={previousHref} className="font-semibold text-blue-600">← Trang trước</Link> : <span />}
        {hasNextPage ? <Link href={nextHref} className="font-semibold text-blue-600">Trang sau →</Link> : <span />}
      </nav>
    </main>
  );
}
