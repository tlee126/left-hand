"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Download, FileText, Home, Sparkles } from "lucide-react";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";
import type {
  LearningProgress,
  LearningProgressItemType,
  UpsertLearningProgressInput
} from "@/lib/repositories/learning-progress-repository";
import type { StudentWorkspaceData } from "@/lib/repositories/student-workspace-repository";

interface SubjectWorkspaceClientProps {
  workspace: StudentWorkspaceData & { progress?: LearningProgress[]; progressUnavailable?: boolean };
}
type TabKey = "overview" | "documents" | "courses" | "unavailable";
type ProgressMap = Record<string, LearningProgress>;
type RetryMap = Record<string, UpsertLearningProgressInput>;
const PROGRESS_PRODUCT_BATCH_SIZE = 100;

function progressKey(productId: string, itemType: LearningProgressItemType, itemId: string): string {
  return `${productId}:${itemType}:${itemId}`;
}

function makeProgressMap(progress: LearningProgress[] | undefined): ProgressMap {
  return (progress ?? []).reduce<ProgressMap>((result, row) => {
    result[progressKey(row.product_id, row.item_type, row.item_id)] = row;
    return result;
  }, {});
}

function completedProgress(
  previous: LearningProgress | undefined,
  productId: string,
  itemType: LearningProgressItemType,
  itemId: string
): UpsertLearningProgressInput {
  const now = new Date().toISOString();
  return {
    productId,
    itemType,
    itemId,
    status: "completed",
    watchedPercent: 100,
    expectedVersion: previous?.version ?? 0,
    startedAt: previous?.started_at ?? now,
    completedAt: previous?.completed_at ?? now
  };
}

function progressPercent(progress: ProgressMap, productId: string, itemType: LearningProgressItemType, itemId: string): number {
  return progress[progressKey(productId, itemType, itemId)]?.watched_percent ?? 0;
}

function progressLabel(progress: ProgressMap, productId: string, itemType: LearningProgressItemType, itemId: string): string {
  return progressPercent(progress, productId, itemType, itemId) >= 100 ? "Đã hoàn thành" : "Chưa hoàn thành";
}

function progressForItem(progress: LearningProgress[], input: UpsertLearningProgressInput): LearningProgress | undefined {
  return progress.find((row) => progressKey(row.product_id, row.item_type, row.item_id) === progressKey(input.productId, input.itemType, input.itemId));
}

function productIdBatches(productIds: readonly string[]): string[][] {
  const result: string[][] = [];
  for (let index = 0; index < productIds.length; index += PROGRESS_PRODUCT_BATCH_SIZE) result.push(productIds.slice(index, index + PROGRESS_PRODUCT_BATCH_SIZE));
  return result;
}

function compareProgress(left: LearningProgress, right: LearningProgress): number {
  return left.product_id.localeCompare(right.product_id)
    || left.item_type.localeCompare(right.item_type)
    || left.item_id.localeCompare(right.item_id);
}

export function SubjectWorkspaceClient({ workspace }: SubjectWorkspaceClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [openingProductId, setOpeningProductId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressMap>(() => makeProgressMap(workspace.progress));
  const [retryItems, setRetryItems] = useState<RetryMap>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingKeys = useRef(new Set<string>());

  async function fetchLatestProgress(): Promise<LearningProgress[]> {
    const productIds = [...new Set([
      ...workspace.materials.map((material) => material.productId),
      ...workspace.courses.map((course) => course.productId)
    ])];
    if (!productIds.length) return [];
    const batchResults = await Promise.all(productIdBatches(productIds).map(async (productIdBatch) => {
      const params = new URLSearchParams();
      productIdBatch.forEach((productId) => params.append("productId", productId));
      const response = await fetch(`/api/progress?${params.toString()}`, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error();
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !Array.isArray((body as { progress?: unknown }).progress)) throw new Error();
      return (body as { progress: LearningProgress[] }).progress;
    }));
    const byItem = new Map<string, LearningProgress>();
    for (const rows of batchResults) for (const row of rows) byItem.set(progressKey(row.product_id, row.item_type, row.item_id), row);
    return [...byItem.values()].sort(compareProgress);
  }

  async function saveProgress(input: UpsertLearningProgressInput) {
    const key = progressKey(input.productId, input.itemType, input.itemId);
    if (pendingKeys.current.has(key)) return;
    pendingKeys.current.add(key);
    setPendingKey(key);
    setNotice(null);

    const previous = progress[key];
    const optimisticFor = (mutation: UpsertLearningProgressInput, current: LearningProgress | undefined): LearningProgress => ({
      user_id: current?.user_id ?? "",
      product_id: mutation.productId,
      item_type: mutation.itemType,
      item_id: mutation.itemId,
      status: mutation.status,
      watched_percent: mutation.watchedPercent,
      started_at: mutation.startedAt ?? null,
      completed_at: mutation.completedAt ?? null,
      created_at: current?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: (current?.version ?? 0) + 1
    });
    setProgress((current) => ({ ...current, [key]: optimisticFor(input, current[key]) }));
    setRetryItems((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    let mutation = input;
    let latest: LearningProgress[] | null = null;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(mutation),
          cache: "no-store"
        });
        if (response.ok) return;
        if (response.status !== 409 || attempt === 1) throw new Error("PROGRESS_CONFLICT");

        latest = await fetchLatestProgress();
        const fresh = progressForItem(latest, mutation);
        mutation = {
          ...mutation,
          expectedVersion: fresh?.version ?? 0,
          watchedPercent: Math.max(mutation.watchedPercent, fresh?.watched_percent ?? 0),
          status: fresh?.status === "completed" ? "completed" : mutation.status,
          startedAt: fresh?.started_at ?? mutation.startedAt ?? null,
          completedAt: fresh?.completed_at ?? mutation.completedAt ?? null
        };
        setProgress(() => {
          const next = makeProgressMap(latest ?? []);
          next[key] = optimisticFor(mutation, fresh);
          return next;
        });
      }
    } catch {
      if (latest) setProgress(makeProgressMap(latest));
      else setProgress((current) => {
        const next = { ...current };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      setRetryItems((current) => ({ ...current, [key]: mutation }));
      setNotice(latest ? "Tiến độ vừa được cập nhật ở nơi khác. Vui lòng thử lại." : "Tiến độ chưa được lưu. Vui lòng thử lại.");
    } finally {
      pendingKeys.current.delete(key);
      setPendingKey((current) => current === key ? null : current);
    }
  }

  async function openMaterial(productId: string) {
    setOpeningProductId(productId);
    setNotice(null);
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(productId)}/signed-url`, { method: "GET", cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== "object" || typeof (body as { url?: unknown }).url !== "string") throw new Error();
      window.open((body as { url: string }).url, "_blank", "noopener,noreferrer");
    } catch {
      setNotice("Tài liệu hiện chưa thể mở. Vui lòng thử lại sau.");
    } finally {
      setOpeningProductId(null);
    }
  }

  const hasData = workspace.materials.length > 0 || workspace.courses.some((course) => course.lessons.length > 0);
  const totalItems = workspace.materials.length + workspace.courses.reduce((sum, course) => sum + course.lessons.length, 0);
  const completedItems = workspace.materials.filter((material) => progressPercent(progress, material.productId, "material", material.productId) >= 100).length
    + workspace.courses.reduce((sum, course) => sum + course.lessons.filter((lesson) => progressPercent(progress, course.productId, "lesson", lesson.id) >= 100).length, 0);
  const overallPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
  const tabs: Array<{ id: TabKey; label: string; count?: number }> = [
    { id: "overview", label: "Tổng quan" }, { id: "documents", label: "Tài liệu", count: workspace.materials.length },
    { id: "courses", label: "Khóa học", count: workspace.courses.length }, { id: "unavailable", label: "Nội dung khác" }
  ];
  const pageHref = (targetPage: number) => `/ca-nhan/mon/${encodeURIComponent(workspace.subject.slug)}?page=${targetPage}`;
  return <div className="relative min-h-screen overflow-x-hidden bg-[#fffdf9]">
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.14),transparent_28%)]" />
    <Header />
    <main className="container mx-auto px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-5"><Link href="/ca-nhan" className="inline-flex items-center gap-1.5 text-sm font-bold text-accent"><ArrowLeft className="h-4 w-4" />Quay lại Cá nhân</Link><Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a97b4]"><Home className="h-3.5 w-3.5" />Trang chủ</Link></div>
      <section className="mb-6 rounded-[28px] border border-[#1b2e7428] bg-white p-6 shadow-[0_12px_36px_rgba(19,37,79,0.05)]"><span className="inline-flex rounded-full border border-blue-100 bg-[#edf2ff] px-3 py-1 text-[11px] font-extrabold text-[#3657d7]">{workspace.subject.category}</span><h1 className="mt-3 text-2xl font-black text-[#132a67] sm:text-3xl">{workspace.subject.name}</h1><p className="mt-2 text-xs font-semibold text-[#617092]">Học liệu đã được cấp quyền cho môn học này.</p>{workspace.hasHardOverflow && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Không thể hiển thị toàn bộ học liệu trong giới hạn an toàn. Danh sách này chưa hoàn chỉnh.</p>}{workspace.progressUnavailable && <p role="status" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Tiến độ hiện chưa thể tải. Vui lòng tải lại trang trước khi tiếp tục.</p>}</section>
      {(workspace.hasPreviousPage || workspace.hasNextPage) && <nav aria-label="Phân trang không gian học" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[#1b2e7420] bg-white p-3 shadow-sm">{workspace.hasPreviousPage ? <Link href={pageHref(workspace.page - 1)} className="rounded-full border border-[#132a67] px-4 py-2 text-xs font-bold text-[#132a67]">← Trang trước</Link> : <span aria-hidden="true" />}{<span className="text-xs font-bold text-[#617092]">Trang {workspace.page}</span>}{workspace.hasNextPage ? <Link href={pageHref(workspace.page + 1)} className="rounded-full bg-[#132a67] px-4 py-2 text-xs font-bold text-white">Trang sau →</Link> : <span aria-hidden="true" />}</nav>}
      <nav className="mb-6 flex gap-1.5 overflow-x-auto rounded-[20px] border border-[#1b2e7420] bg-white p-2 shadow-sm">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-extrabold ${activeTab === tab.id ? "bg-[#132a67] text-white" : "text-[#617092] hover:bg-slate-50"}`}>{tab.label}{tab.count !== undefined && <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{tab.count}</span>}</button>)}</nav>
      <section className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm">
        {activeTab === "overview" && (hasData ? <div><h2 className="flex items-center gap-2 text-base font-extrabold text-[#132a67]"><Sparkles className="h-5 w-5 text-accent" />Không gian tự học</h2><p className="mt-3 text-sm leading-relaxed text-[#5f6d8f]">Chọn tab Tài liệu hoặc Khóa học để xem nội dung bạn được cấp quyền.</p><p className="mt-4 text-sm font-extrabold text-[#132a67]">Tiến độ đã lưu: {overallPercent}% <span className="ml-2 text-xs font-semibold text-[#8091b8]">({completedItems}/{totalItems} mục)</span></p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#3657d7]" style={{ width: `${overallPercent}%` }} /></div></div> : <Unavailable />)}
        {activeTab === "documents" && (workspace.materials.length ? <div className="space-y-3"><h2 className="text-base font-extrabold text-[#132a67]">Danh mục tài liệu</h2>{workspace.materials.map((material) => { const itemId = material.productId; const key = progressKey(material.productId, "material", itemId); const retry = retryItems[key]; const completed = progressLabel(progress, material.productId, "material", itemId) === "Đã hoàn thành"; return <article key={material.productId} className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="flex items-center gap-2 text-sm font-bold text-[#132a67]"><FileText className="h-5 w-5 text-blue-600" />{material.title}</h3><p className="mt-1 text-xs text-[#5f6d8f]">{material.description}</p><p className="mt-2 text-[11px] font-semibold text-[#8091b8]">{material.pages} trang · {progressPercent(progress, material.productId, "material", itemId)}% · {completed ? "Đã hoàn thành" : "Chưa hoàn thành"}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={openingProductId === material.productId} onClick={() => openMaterial(material.productId)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#132a67] px-4 text-xs font-bold text-white disabled:opacity-60"><Download className="h-3.5 w-3.5" />{openingProductId === material.productId ? "Đang mở..." : "Mở tài liệu"}</button><ProgressButton pending={pendingKey === key} completed={completed} retry={Boolean(retry)} onClick={() => retry ? saveProgress(retry) : saveProgress(completedProgress(progress[key], material.productId, "material", itemId))} /></div></article>; })}</div> : <Unavailable />)}
        {activeTab === "courses" && (workspace.courses.length ? <div className="space-y-5"><h2 className="flex items-center gap-2 text-base font-extrabold text-[#132a67]"><BookOpen className="h-5 w-5 text-violet-600" />Chương trình bài giảng</h2>{workspace.courses.map((course) => <article key={course.productId} className="rounded-2xl border border-slate-100 p-4"><h3 className="text-sm font-bold text-[#132a67]">{course.title}</h3>{course.lessons.length ? <ol className="mt-3 space-y-2">{course.lessons.map((lesson) => { const key = progressKey(course.productId, "lesson", lesson.id); const retry = retryItems[key]; const completed = progressLabel(progress, course.productId, "lesson", lesson.id) === "Đã hoàn thành"; return <li key={lesson.id} className="flex flex-col gap-2 border-b border-slate-50 py-2 text-xs text-[#5f6d8f] last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><span><span className="mr-2 font-bold text-[#132a67]">{lesson.orderIndex}.</span>{lesson.title}{lesson.durationMinutes ? ` · ${lesson.durationMinutes} phút` : ""}<span className="ml-2 font-semibold text-[#8091b8]">{progressPercent(progress, course.productId, "lesson", lesson.id)}% · {completed ? "Đã hoàn thành" : "Chưa hoàn thành"}</span></span><ProgressButton pending={pendingKey === key} completed={completed} retry={Boolean(retry)} onClick={() => retry ? saveProgress(retry) : saveProgress(completedProgress(progress[key], course.productId, "lesson", lesson.id))} /></li>; })}</ol> : <p className="mt-3 text-xs font-semibold text-[#8091b8]">Chưa có dữ liệu</p>}</article>)}</div> : <Unavailable />)}
        {activeTab === "unavailable" && <Unavailable />}{notice && <p role="status" className="mt-4 text-xs font-semibold text-rose-600">{notice}</p>}
      </section>
    </main><Footer /><FloatingActions />
  </div>;
}

function Unavailable() { return <p className="text-sm font-semibold text-[#8091b8]">Chưa có dữ liệu</p>; }

function ProgressButton({
  pending,
  completed,
  retry,
  onClick
}: {
  pending: boolean;
  completed: boolean;
  retry: boolean;
  onClick: () => void;
}) {
  return <button type="button" disabled={pending || completed} onClick={onClick} className="inline-flex h-9 items-center justify-center rounded-full border border-[#132a67] px-3 text-xs font-bold text-[#132a67] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Đang lưu..." : retry ? "Lưu lại" : completed ? "Đã lưu" : "Đánh dấu đã học"}</button>;
}
