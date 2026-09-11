"use client";

import { useEffect, useRef, useState } from "react";

const VIEW_ERROR = "Không thể mở tài liệu. Vui lòng thử lại sau.";
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function isValidMaterialUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function hasCurrentMaterialAsset(version: unknown): version is number {
  return typeof version === "number" && Number.isSafeInteger(version) && version > 0;
}

export function isVideoMaterialMimeType(mimeType: unknown): boolean {
  return typeof mimeType === "string" && VIDEO_MIME_TYPES.has(mimeType);
}

export function materialViewLabel(mimeType: unknown): "Xem tài liệu" | "Xem video" {
  return isVideoMaterialMimeType(mimeType) ? "Xem video" : "Xem tài liệu";
}

export function materialViewerKind(mimeType: unknown): "pdf" | "video" {
  return isVideoMaterialMimeType(mimeType) ? "video" : "pdf";
}

export async function fetchMaterialDocumentUrl(productId: string, signal?: AbortSignal): Promise<string> {
  try {
    const response = await fetch(`/api/materials/${encodeURIComponent(productId)}/signed-url`, {
      headers: { Accept: "application/json" },
      signal
    });
    const payload = await response.json().catch(() => null) as { url?: unknown } | null;
    if (!response.ok || !isValidMaterialUrl(payload?.url)) throw new Error();
    return payload.url;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(VIEW_ERROR);
  }
}

export default function MaterialViewButton({ productId, mimeType }: { productId: string; mimeType: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const requestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const viewerKind = materialViewerKind(mimeType);
  const contentLabel = viewerKind === "video" ? "video" : "tài liệu";

  useEffect(() => () => abortController.current?.abort(), []);

  function closeViewer() {
    requestId.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    setViewerOpen(false);
    setViewerUrl(null);
    setLoading(false);
    setError(null);
  }

  async function handleClick() {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setViewerOpen(true);
    setViewerUrl(null);
    setLoading(true);
    setError(null);
    try {
      const url = await fetchMaterialDocumentUrl(productId, controller.signal);
      if (requestId.current !== currentRequest) return;
      setViewerUrl(url);
    } catch (reason) {
      if (requestId.current !== currentRequest || (reason instanceof DOMException && reason.name === "AbortError")) return;
      setViewerOpen(false);
      setError(reason instanceof Error ? reason.message : VIEW_ERROR);
    } finally {
      if (requestId.current === currentRequest) {
        abortController.current = null;
        setLoading(false);
      }
    }
  }

  return <div className="mt-3 space-y-2">
    <button type="button" onClick={handleClick} disabled={loading} className="inline-flex min-h-11 items-center justify-center rounded-full border border-accent px-5 py-2 text-sm font-extrabold text-accent transition hover:bg-accent/10 disabled:cursor-wait disabled:opacity-60">
      {loading ? `Đang mở ${contentLabel}…` : materialViewLabel(mimeType)}
    </button>
    {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
    {viewerOpen ? <section role="dialog" aria-modal="true" aria-labelledby={`material-viewer-title-${productId}`} className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-ink/70 p-3 sm:p-6">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/10 px-4 py-3 sm:px-6">
          <h2 id={`material-viewer-title-${productId}`} className="text-base font-black text-ink sm:text-lg">Đang xem {contentLabel}</h2>
          <button type="button" onClick={closeViewer} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-ink/20 px-4 py-2 text-sm font-extrabold text-ink transition hover:bg-ink/5">Đóng</button>
        </header>
        <div className="flex min-h-[16rem] flex-1 items-center justify-center bg-ink/5 p-2 sm:min-h-[24rem] sm:p-4">
          {loading ? <p role="status" className="text-sm font-semibold text-ink/65">Đang tải {contentLabel}…</p> : viewerUrl && viewerKind === "pdf" ? <iframe title="Tài liệu PDF" src={viewerUrl} className="h-[calc(100vh-8rem)] min-h-[16rem] w-full rounded-lg bg-white" /> : viewerUrl ? <video controls className="max-h-[calc(100vh-8rem)] w-full rounded-lg bg-black" src={viewerUrl}>Trình duyệt không hỗ trợ phát video.</video> : null}
        </div>
      </div>
    </section> : null}
  </div>;
}
