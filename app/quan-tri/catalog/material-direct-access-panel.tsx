"use client";

import { type FormEvent, useRef, useState } from "react";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEARCH_ERROR = "Không thể tìm học viên. Vui lòng thử lại sau.";
const LOAD_ERROR = "Không thể tải quyền truy cập riêng. Vui lòng thử lại sau.";
const MUTATION_ERROR = "Không thể cập nhật quyền truy cập riêng. Vui lòng thử lại sau.";
const REVOKE_ERROR = "Không thể thu hồi quyền truy cập riêng. Vui lòng thử lại sau.";
const INVALID_EXPIRY_ERROR = "Ngày hết hạn phải là hôm nay hoặc một ngày trong tương lai.";

type Student = {
  id: string;
  full_name: string;
  email: string | null;
  student_code: string | null;
};

type Grant = {
  id: string;
  user_id: string;
  material_id: string;
  can_view: boolean;
  can_download: boolean;
  expires_at: string | null;
  revoked_at: string | null;
};

type Draft = { canView: boolean; canDownload: boolean; expiresAt: string };
type BusyAction = "loading" | "searching" | `create:${string}` | `update:${string}` | `revoke:${string}`;

export type MaterialDirectAccessPanelProps = { materialId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseStudent(value: unknown): Student | null {
  if (!isRecord(value) || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)
    || typeof value.full_name !== "string" || (value.email !== null && typeof value.email !== "string")
    || (value.student_code !== null && typeof value.student_code !== "string")) return null;
  return {
    id: value.id.toLowerCase(),
    full_name: value.full_name,
    email: value.email,
    student_code: value.student_code
  };
}

function parseGrant(value: unknown, materialId: string): Grant | null {
  if (!isRecord(value) || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)
    || typeof value.user_id !== "string" || !UUID_PATTERN.test(value.user_id)
    || typeof value.material_id !== "string" || value.material_id.toLowerCase() !== materialId
    || typeof value.can_view !== "boolean" || typeof value.can_download !== "boolean"
    || (value.can_download && !value.can_view)
    || (value.expires_at !== null && !isTimestamp(value.expires_at))
    || (value.revoked_at !== null && !isTimestamp(value.revoked_at))) return null;
  return {
    id: value.id.toLowerCase(),
    user_id: value.user_id.toLowerCase(),
    material_id: materialId,
    can_view: value.can_view,
    can_download: value.can_download,
    expires_at: value.expires_at,
    revoked_at: value.revoked_at
  };
}

async function readApi(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) }
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body)) throw new Error("request-failed");
  return body;
}

function dateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function expiryDateValue(value: string): string | null {
  if (value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("invalid-date");
  const timestamp = Date.parse(`${value}T23:59:59.999Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value || timestamp <= Date.now()) throw new Error("invalid-date");
  return `${value}T23:59:59.999Z`;
}

export function materialDirectGrantStatus(grant: Pick<Grant, "expires_at" | "revoked_at">, now = Date.now()): "active" | "expired" | "revoked" {
  if (grant.revoked_at !== null) return "revoked";
  if (grant.expires_at !== null && Date.parse(grant.expires_at) <= now) return "expired";
  return "active";
}

export function materialDirectPermissionLabel(grant: Pick<Grant, "can_view" | "can_download" | "expires_at" | "revoked_at">, now = Date.now()): string {
  const status = materialDirectGrantStatus(grant, now);
  if (status === "revoked") return "Đã thu hồi";
  if (status === "expired") return "Hết hạn";
  if (!grant.can_view) return "Chưa cấp quyền";
  return grant.can_download ? "Được xem và tải" : "Chỉ được xem";
}

function statusLabel(grant: Grant): string {
  const status = materialDirectGrantStatus(grant);
  return status === "active" ? "Đang hoạt động" : status === "expired" ? "Hết hạn" : "Đã thu hồi";
}

function formatExpiry(value: string | null): string {
  if (!value) return "Không đặt thời hạn";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không đặt thời hạn" : `Đến ${date.toLocaleDateString("vi-VN")}`;
}

function draftFor(grant: Grant): Draft {
  return { canView: grant.can_view, canDownload: grant.can_download, expiresAt: dateInputValue(grant.expires_at) };
}

function studentLabel(student: Student | undefined, userId: string): string {
  return student?.full_name || `Học viên · ${userId}`;
}

export default function MaterialDirectAccessPanel({ materialId }: MaterialDirectAccessPanelProps) {
  const canonicalMaterialId = materialId.toLowerCase();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [createDraft, setCreateDraft] = useState<Draft>({ canView: true, canDownload: false, expiresAt: "" });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  async function loadGrants(): Promise<void> {
    setBusy("loading");
    setError(null);
    try {
      const body = await readApi(`/api/admin/materials/${encodeURIComponent(canonicalMaterialId)}/direct-grants`);
      if (!isRecord(body) || !Array.isArray(body.grants)) throw new Error("invalid-response");
      const next = body.grants.map((grant) => parseGrant(grant, canonicalMaterialId));
      if (next.some((grant) => grant === null)) throw new Error("invalid-response");
      setGrants(next as Grant[]);
      setLoaded(true);
    } catch {
      setError(LOAD_ERROR);
    } finally {
      setBusy(null);
    }
  }

  async function togglePanel(): Promise<void> {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !loaded) await loadGrants();
  }

  async function search(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();
    if (requestInFlight.current) return;
    const query = searchQuery.trim();
    if (query.length < 1 || query.length > 100) {
      setSearchResults([]);
      setError(SEARCH_ERROR);
      return;
    }
    requestInFlight.current = true;
    setBusy("searching");
    setError(null);
    try {
      const body = await readApi(`/api/admin/students/search?q=${encodeURIComponent(query)}`);
      if (!isRecord(body) || !Array.isArray(body.students)) throw new Error("invalid-response");
      const next = body.students.map(parseStudent).filter((student): student is Student => student !== null);
      setSearchResults(next);
      setStudents((current) => Object.fromEntries([...Object.entries(current), ...next.map((student) => [student.id, student])]));
    } catch {
      setSearchResults([]);
      setError(SEARCH_ERROR);
    } finally {
      requestInFlight.current = false;
      setBusy(null);
    }
  }

  function chooseStudent(student: Student): void {
    setSelectedStudent(student);
    setCreateDraft({ canView: true, canDownload: false, expiresAt: "" });
    setSearchResults([]);
    setError(null);
  }

  async function createGrant(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedStudent || requestInFlight.current) return;
    let expiresAt: string | null;
    try { expiresAt = expiryDateValue(createDraft.expiresAt); } catch { setError(INVALID_EXPIRY_ERROR); return; }
    const userId = selectedStudent.id;
    requestInFlight.current = true;
    setBusy(`create:${userId}`);
    setError(null);
    try {
      await readApi(`/api/admin/materials/${encodeURIComponent(canonicalMaterialId)}/direct-grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, can_view: createDraft.canView, can_download: createDraft.canDownload, expires_at: expiresAt })
      });
      await loadGrants();
    } catch {
      setError(MUTATION_ERROR);
      setBusy(null);
    } finally {
      requestInFlight.current = false;
    }
  }

  function startEdit(grant: Grant): void {
    setEditingUserId(grant.user_id);
    setEditDraft(draftFor(grant));
    setError(null);
  }

  async function updateGrant(event: FormEvent<HTMLFormElement>, grant: Grant): Promise<void> {
    event.preventDefault();
    if (!editDraft || requestInFlight.current) return;
    let expiresAt: string | null;
    try { expiresAt = expiryDateValue(editDraft.expiresAt); } catch { setError(INVALID_EXPIRY_ERROR); return; }
    const userId = grant.user_id;
    requestInFlight.current = true;
    setBusy(`update:${userId}`);
    setError(null);
    try {
      await readApi(`/api/admin/materials/${encodeURIComponent(canonicalMaterialId)}/direct-grants/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ can_view: editDraft.canView, can_download: editDraft.canDownload, expires_at: expiresAt })
      });
      setEditingUserId(null);
      setEditDraft(null);
      await loadGrants();
    } catch {
      setError(MUTATION_ERROR);
      setBusy(null);
    } finally {
      requestInFlight.current = false;
    }
  }

  async function revokeGrant(grant: Grant): Promise<void> {
    if (requestInFlight.current) return;
    if (!window.confirm(`Thu hồi quyền riêng của ${studentLabel(students[grant.user_id], grant.user_id)} trên tài liệu này?`)) return;
    if (requestInFlight.current) return;
    const userId = grant.user_id;
    requestInFlight.current = true;
    setBusy(`revoke:${userId}`);
    setError(null);
    try {
      await readApi(`/api/admin/materials/${encodeURIComponent(canonicalMaterialId)}/direct-grants/${encodeURIComponent(userId)}`, { method: "DELETE" });
      await loadGrants();
    } catch {
      setError(REVOKE_ERROR);
      setBusy(null);
    } finally {
      requestInFlight.current = false;
    }
  }

  function updateDraft(setter: (draft: Draft) => void, draft: Draft, key: keyof Draft, value: boolean | string): void {
    const next = { ...draft, [key]: value } as Draft;
    if (key === "canView" && value === false) next.canDownload = false;
    setter(next);
  }

  const statusId = `material-direct-access-status-${canonicalMaterialId}`;
  const loading = busy === "loading";

  return <section className="mt-5 border-t border-ink/10 pt-5" data-material-direct-access={canonicalMaterialId}>
    <button type="button" onClick={() => void togglePanel()} aria-expanded={open} aria-controls={`material-direct-access-panel-${canonicalMaterialId}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-violet/40 bg-violet/5 px-5 py-2 text-sm font-extrabold text-[#5e2dbd] transition hover:bg-violet/10 disabled:cursor-wait disabled:opacity-60" disabled={loading}>
      {loading ? "Đang tải quyền riêng…" : open ? "Đóng quản lý quyền truy cập riêng" : "Quản lý quyền truy cập riêng"}
    </button>
    {open ? <div id={`material-direct-access-panel-${canonicalMaterialId}`} className="mt-4 rounded-2xl border border-violet/15 bg-[#faf8ff] p-4 sm:p-5">
      <header>
        <h4 className="text-lg font-black text-ink">Quyền truy cập riêng cho tài liệu này</h4>
        <p className="mt-2 text-sm leading-6 text-ink/65">Quyền xem và quyền tải là hai quyền độc lập, chỉ áp dụng cho đúng học viên và tài liệu này. Thiết lập này không thay đổi quyền của sản phẩm hoặc quyền tải mặc định.</p>
      </header>
      {error ? <p id={statusId} role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <div className="mt-5 border-b border-ink/10 pb-5">
        <h5 className="text-sm font-black text-ink">Tìm học viên để cấp quyền</h5>
        <form onSubmit={(event) => void search(event)} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-bold text-ink/65 sm:min-w-[20rem]"><span className="break-words [overflow-wrap:anywhere]">Tên, email hoặc mã học viên</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onInput={(event) => setSearchQuery(event.currentTarget.value)} className="notebook-input mt-1 min-w-0 max-w-full" aria-label="Tìm học viên" maxLength={100} autoComplete="off" /></label>
          <button type="submit" disabled={busy !== null} className="notebook-submit-btn min-h-11 px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">{busy === "searching" ? "Đang tìm…" : "Tìm học viên"}</button>
        </form>
        {searchResults.length > 0 ? <ul aria-label="Kết quả tìm học viên" className="mt-3 grid gap-2 sm:grid-cols-2">{searchResults.map((student) => <li key={student.id} className="min-w-0"><button type="button" onClick={() => chooseStudent(student)} disabled={busy !== null} className="w-full min-w-0 rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm transition hover:border-accent disabled:opacity-50"><span className="block min-w-0 break-words font-extrabold text-ink [overflow-wrap:anywhere]">{student.full_name}</span><span className="mt-1 block min-w-0 break-words text-xs text-ink/60 [overflow-wrap:anywhere]">{student.student_code ?? student.email ?? "Học viên đã được xác thực"}</span></button></li>)}</ul> : searchQuery.trim() && busy !== "searching" && !error ? <p className="mt-3 text-sm text-ink/65">Không tìm thấy học viên phù hợp.</p> : null}
        {selectedStudent ? <form onSubmit={(event) => void createGrant(event)} className="mt-4 min-w-0 rounded-xl border border-accent/15 bg-white p-4"><p className="min-w-0 break-words text-sm font-black text-ink [overflow-wrap:anywhere]">Cấp quyền cho: {selectedStudent.full_name}</p><p className="mt-1 min-w-0 break-words text-xs text-ink/60 [overflow-wrap:anywhere]">{selectedStudent.student_code ?? selectedStudent.email ?? "Học viên đã được xác thực"}</p><div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2"><label className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink"><input type="checkbox" checked={createDraft.canView} onChange={(event) => updateDraft(setCreateDraft, createDraft, "canView", event.target.checked)} disabled={busy !== null} />Được xem tài liệu</label><label className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink"><input type="checkbox" checked={createDraft.canDownload} onChange={(event) => updateDraft(setCreateDraft, createDraft, "canDownload", event.target.checked)} disabled={!createDraft.canView || busy !== null} />Được tải tài liệu</label><label className="min-w-0 text-sm font-bold text-ink/65 sm:col-span-2"><span>Ngày hết hạn (tùy chọn)</span><input type="date" value={createDraft.expiresAt} onChange={(event) => setCreateDraft({ ...createDraft, expiresAt: event.target.value })} onInput={(event) => setCreateDraft({ ...createDraft, expiresAt: event.currentTarget.value })} disabled={busy !== null} className="notebook-input mt-1 max-w-xs" /></label></div><button type="submit" disabled={busy !== null} className="notebook-submit-btn mt-4 min-h-11 px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">{busy === `create:${selectedStudent.id}` ? "Đang cấp quyền…" : "Cấp quyền riêng"}</button></form> : null}
      </div>
      <div className="pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h5 className="text-sm font-black text-ink">Danh sách quyền riêng của tài liệu</h5>{loading ? <span role="status" className="text-xs font-semibold text-ink/60">Đang tải danh sách…</span> : null}</div>
        {!loading && loaded && grants.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-ink/15 bg-white/70 p-4 text-sm text-ink/65">Chưa cấp quyền riêng cho tài liệu này.</p> : null}
        <ul className="mt-3 space-y-3">{grants.map((grant) => { const editing = editingUserId === grant.user_id && editDraft !== null; return <li key={grant.user_id} className="min-w-0 rounded-xl border border-ink/10 bg-white p-4"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 max-w-full"><p className="min-w-0 break-words font-extrabold text-ink [overflow-wrap:anywhere]">{studentLabel(students[grant.user_id], grant.user_id)}</p>{students[grant.user_id]?.student_code || students[grant.user_id]?.email ? <p className="mt-1 min-w-0 break-words text-xs text-ink/60 [overflow-wrap:anywhere]">{students[grant.user_id].student_code ?? students[grant.user_id].email}</p> : null}<p className="mt-2 min-w-0 break-words text-sm font-bold text-ink/70 [overflow-wrap:anywhere]">{materialDirectPermissionLabel(grant)} · {formatExpiry(grant.expires_at)}</p><p className="mt-1 min-w-0 break-words text-xs text-ink/55 [overflow-wrap:anywhere]">Trạng thái: {statusLabel(grant)}</p></div><div className="flex min-w-0 max-w-full flex-wrap gap-2"><button type="button" onClick={() => startEdit(grant)} disabled={busy !== null} className="min-h-10 rounded-full border border-accent/30 px-4 py-2 text-xs font-extrabold text-accent disabled:cursor-not-allowed disabled:opacity-50">Sửa quyền</button><button type="button" onClick={() => void revokeGrant(grant)} disabled={busy !== null} className="min-h-10 rounded-full border border-rose-200 px-4 py-2 text-xs font-extrabold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{busy === `revoke:${grant.user_id}` ? "Đang thu hồi…" : "Thu hồi"}</button></div></div>{editing ? <form onSubmit={(event) => void updateGrant(event, grant)} className="mt-4 min-w-0 border-t border-ink/10 pt-4"><div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink"><input type="checkbox" checked={editDraft.canView} onChange={(event) => updateDraft(setEditDraft, editDraft, "canView", event.target.checked)} disabled={busy !== null} />Được xem tài liệu</label><label className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink"><input type="checkbox" checked={editDraft.canDownload} onChange={(event) => updateDraft(setEditDraft, editDraft, "canDownload", event.target.checked)} disabled={!editDraft.canView || busy !== null} />Được tải tài liệu</label><label className="min-w-0 text-sm font-bold text-ink/65 sm:col-span-2"><span>Ngày hết hạn (tùy chọn)</span><input type="date" value={editDraft.expiresAt} onChange={(event) => setEditDraft({ ...editDraft, expiresAt: event.target.value })} onInput={(event) => setEditDraft({ ...editDraft, expiresAt: event.currentTarget.value })} disabled={busy !== null} className="notebook-input mt-1 max-w-xs" /></label></div><div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={busy !== null} className="notebook-submit-btn min-h-10 px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50">{busy === `update:${grant.user_id}` ? "Đang lưu…" : "Lưu quyền"}</button><button type="button" onClick={() => { setEditingUserId(null); setEditDraft(null); }} disabled={busy !== null} className="min-h-10 rounded-full border border-ink/15 px-4 py-2 text-xs font-extrabold text-ink/70 disabled:opacity-50">Hủy</button></div></form> : null}</li>; })}</ul>
      </div>
    </div> : null}
  </section>;
}
