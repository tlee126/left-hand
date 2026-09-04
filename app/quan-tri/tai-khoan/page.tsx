import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccountAccess } from "@/lib/auth/session";
import { updateAccountApprovalAction } from "./actions";
import {
  ACCOUNT_APPROVAL_STATUSES,
  isValidUuid,
  listAccountsForApproval,
  type AccountApprovalStatus,
  type AccountForApproval,
  type ListAccountsForApprovalOptions
} from "@/lib/repositories/account-approval-repository";

const ACCOUNT_PATH = "/quan-tri/tai-khoan";
const PAGE_SIZE = 20;
/** Keep the offset bounded while allowing normal account-list pagination. */
const MAX_ACCOUNT_PAGE = 10_000;

type SearchParams = Record<string, string | string[] | undefined>;
type ActionStatus = Exclude<AccountApprovalStatus, "pending">;

const ACTION_STATUSES: readonly ActionStatus[] = [
  "approved",
  "rejected",
  "suspended"
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= MAX_ACCOUNT_PAGE
    ? page
    : 1;
}

function parseStatus(value: string | undefined): AccountApprovalStatus | undefined {
  return value && ACCOUNT_APPROVAL_STATUSES.includes(value as AccountApprovalStatus)
    ? (value as AccountApprovalStatus)
    : undefined;
}

function buildQuery(
  page: number,
  search: string,
  status?: AccountApprovalStatus
): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function displayNullable(value: string | null): string {
  return value?.trim() || "—";
}

function formatTimestamp(value: string | null): string {
  if (value === null) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function AccountField({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function isSelfAccount(account: AccountForApproval, adminId: string | undefined, profileId: string | undefined): boolean {
  if (!isValidUuid(account.id)) return false;
  const normalizedId = account.id.toLowerCase();
  return normalizedId === adminId?.toLowerCase() || normalizedId === profileId?.toLowerCase();
}

export default async function AdminAccountApprovalPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const access = await getAccountAccess();

  if (access.status === "unauthenticated") {
    redirect(`/dang-nhap?next=${ACCOUNT_PATH}`);
  }

  if (access.status !== "approved" || access.profile?.role !== "admin") {
    notFound();
  }

  const params = searchParams ? await searchParams : {};
  const search = firstParam(params.q)?.trim() ?? "";
  const status = parseStatus(firstParam(params.status));
  const page = parsePage(firstParam(params.page));
  const options: ListAccountsForApprovalOptions = {
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE
  };
  if (search) options.search = search;
  if (status) options.status = status;

  let fetchedAccounts: AccountForApproval[] = [];
  let loadFailed = false;
  try {
    fetchedAccounts = await listAccountsForApproval(options);
  } catch {
    loadFailed = true;
  }

  const accounts = fetchedAccounts.slice(0, PAGE_SIZE);
  const hasPreviousPage = page > 1;
  const hasNextPage = page < MAX_ACCOUNT_PAGE && fetchedAccounts.length > PAGE_SIZE;
  const previousHref = `${ACCOUNT_PATH}${buildQuery(page - 1, search, status)}`;
  const nextHref = `${ACCOUNT_PATH}${buildQuery(page + 1, search, status)}`;
  const successFlag = firstParam(params.success) === "1";
  const errorFlag =
    firstParam(params.error) === "1" || firstParam(params.error) === "not_found";

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 text-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Quản trị · Tài khoản
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Quản lý tài khoản
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Trang {page} · {accounts.length} tài khoản trong trang này
          </p>
        </div>
      </div>

      {successFlag ? (
        <p
          role="status"
          className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          Cập nhật trạng thái tài khoản thành công.
        </p>
      ) : null}

      {errorFlag ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Không thể cập nhật tài khoản. Vui lòng thử lại sau.
        </p>
      ) : null}

      <form
        method="get"
        className="mt-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row"
      >
        <label className="flex-1">
          <span className="sr-only">Tìm theo họ tên, email hoặc số điện thoại</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Tìm theo họ tên, email hoặc số điện thoại"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input type="hidden" name="page" value={page} />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white"
        >
          Tìm kiếm
        </button>
      </form>

      <nav aria-label="Lọc trạng thái tài khoản" className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href={`${ACCOUNT_PATH}${buildQuery(page, search)}`}
          className={!status ? "rounded-full bg-blue-600 px-3 py-1.5 font-semibold text-white" : "rounded-full border border-slate-300 px-3 py-1.5 text-slate-700"}
        >
          Tất cả
        </Link>
        {ACCOUNT_APPROVAL_STATUSES.map((item) => (
          <Link
            key={item}
            href={`${ACCOUNT_PATH}${buildQuery(page, search, item)}`}
            className={status === item ? "rounded-full bg-blue-600 px-3 py-1.5 font-semibold text-white" : "rounded-full border border-slate-300 px-3 py-1.5 text-slate-700"}
          >
            {item}
          </Link>
        ))}
      </nav>

      {loadFailed ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Không thể tải danh sách tài khoản lúc này. Vui lòng thử lại sau.
        </p>
      ) : accounts.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-600">
          Không có tài khoản phù hợp.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {accounts.map((account) => {
            const canManage =
              isValidUuid(account.id) &&
              !isSelfAccount(account, access.user?.id, access.profile?.id);
            const updateAccount = updateAccountApprovalAction.bind(null, account.id);

            return (
              <article
                key={account.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900">{account.full_name}</h2>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Trạng thái: {account.account_status}
                      </span>
                    </div>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <AccountField label="Email" value={displayNullable(account.email)} />
                      <AccountField label="Vai trò" value={account.role} />
                      <AccountField label="Ngày tạo" value={formatTimestamp(account.created_at)} />
                      <AccountField label="Đã duyệt lúc" value={formatTimestamp(account.approved_at)} />
                      <AccountField label="Lý do từ chối" value={displayNullable(account.rejection_reason)} />
                    </dl>
                  </div>

                  {canManage ? (
                    <form action={updateAccount} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 lg:max-w-sm">
                      <p className="text-sm font-semibold text-slate-900">Cập nhật phê duyệt</p>
                      <label htmlFor={`account-status-${account.id}`} className="mt-3 block text-sm font-medium text-slate-700">
                        Trạng thái mới
                      </label>
                      <select
                        id={`account-status-${account.id}`}
                        name="status"
                        defaultValue={account.account_status === "pending" ? "approved" : account.account_status}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {ACTION_STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <label htmlFor={`rejection-reason-${account.id}`} className="mt-3 block text-sm font-medium text-slate-700">
                        Lý do từ chối (nếu có)
                      </label>
                      <textarea
                        id={`rejection-reason-${account.id}`}
                        name="rejection_reason"
                        defaultValue={account.rejection_reason ?? ""}
                        maxLength={500}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Lưu trạng thái
                      </button>
                    </form>
                  ) : (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Tài khoản quản trị hiện tại không thể tự thay đổi.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <nav aria-label="Phân trang" className="mt-8 flex justify-between">
        {hasPreviousPage ? (
          <Link href={previousHref} className="font-semibold text-blue-600">
            ← Trang trước
          </Link>
        ) : (
          <span />
        )}
        {hasNextPage ? (
          <Link href={nextHref} className="font-semibold text-blue-600">
            Trang sau →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
