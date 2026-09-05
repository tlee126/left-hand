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
  const hasNextPage = page < MAX_INBOX_PAGE && fetchedRows.length > PAGE_SIZE;
  const previousHref = `${INBOX_PATH}${buildQuery(page - 1, search, status)}`;
  const nextHref = `${INBOX_PATH}${buildQuery(page + 1, search, status)}`;

  return (
    <main className="container-shell min-h-screen px-4 pb-16 pt-8 text-ink sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-accent">
            Quản trị · Tư vấn
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Hộp thư tư vấn</h1>
          <p className="mt-3 text-sm text-ink/65">Trang {page} · {consultations.length} yêu cầu trong trang này</p>
        </div>
      </header>

      <form method="get" className="surface-card mt-8 flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Tìm theo họ tên hoặc số điện thoại</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Tìm theo họ tên hoặc số điện thoại"
            className="notebook-input"
          />
        </label>
        <label className="w-full lg:w-56">
          <span className="sr-only">Lọc theo trạng thái</span>
          <select name="status" defaultValue={status ?? ""} className="notebook-select">
            <option value="">Tất cả trạng thái</option>
            {VALID_CONSULTATION_STATUSES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="inline-flex h-[50px] shrink-0 items-center justify-center rounded-full bg-accent px-6 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(23,101,233,0.2)] transition hover:-translate-y-px hover:bg-[#1258ce]">Tìm kiếm</button>
      </form>

      {loadFailed ? (
        <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm font-semibold text-rose-700">
          Không thể tải danh sách tư vấn lúc này. Vui lòng thử lại sau.
        </p>
      ) : consultations.length === 0 ? (
        <section className="notebook-card notebook-paper-lines mt-8 rounded-[26px] p-10 text-center" aria-label="Kết quả tư vấn">
          <p className="text-sm font-bold text-ink/65">Chưa có yêu cầu tư vấn phù hợp.</p>
        </section>
      ) : (
        <section className="surface-card mt-8 overflow-hidden p-1" aria-label="Danh sách yêu cầu tư vấn">
          <div className="overflow-x-auto rounded-[22px]">
          <table className="min-w-[900px] text-left text-sm lg:min-w-full">
            <thead className="bg-paper/80 text-xs uppercase tracking-wide text-ink/60">
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
            <tbody className="divide-y divide-ink/10">
              {consultations.map((consultation) => (
                <tr key={consultation.id} className="align-top transition hover:bg-accent/[0.035]">
                  <td className="whitespace-nowrap px-4 py-4 text-ink/65">{formatCreatedAt(consultation.created_at)}</td>
                  <td className="max-w-56 break-words px-4 py-4 font-extrabold"><Link href={`${INBOX_PATH}/${consultation.id}`} className="text-accent hover:underline">{displayValue(consultation.full_name)}</Link></td>
                  <td className="max-w-40 break-words px-4 py-4">{displayValue(consultation.phone)}</td>
                  <td className="max-w-40 break-words px-4 py-4">{displayValue(consultation.faculty)}</td>
                  <td className="max-w-40 break-words px-4 py-4">{displayValue(consultation.interest)}</td>
                  <td className="max-w-xs break-words px-4 py-4">{displayValue(consultation.need)}</td>
                  <td className="px-4 py-4"><span className="inline-flex rounded-full border border-accent/15 bg-accent/[0.07] px-2.5 py-1 text-xs font-extrabold text-ink/75">{consultation.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <nav aria-label="Phân trang" className="mt-8 flex items-center justify-between gap-4 border-t border-ink/10 pt-5">
        {hasPreviousPage ? <Link href={previousHref} className="rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-extrabold text-accent transition hover:border-accent/25 hover:bg-white">← Trang trước</Link> : <span aria-hidden="true" />}
        {hasNextPage ? <Link href={nextHref} className="rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-extrabold text-accent transition hover:border-accent/25 hover:bg-white">Trang sau →</Link> : <span aria-hidden="true" />}
      </nav>
    </main>
  );
}
