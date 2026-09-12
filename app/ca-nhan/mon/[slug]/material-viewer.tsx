"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, X } from "lucide-react";

const VIEW_ERROR = "Không thể mở tài liệu. Vui lòng thử lại sau.";
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<{ getViewport(options: { scale: number }): { width: number; height: number }; render(options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): PdfRenderTask }>;
  destroy(): Promise<void>;
};

type PdfRenderTask = {
  promise: Promise<void>;
  cancel(): void;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
};

function isVideo(mimeType: string): boolean {
  return VIDEO_MIME_TYPES.has(mimeType);
}

export default function MaterialViewer({
  productId,
  mimeType,
  allowDownload,
  autoOpen = false
}: {
  productId: string;
  mimeType: string | null;
  allowDownload: boolean;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedMimeType, setResolvedMimeType] = useState<string | null>(mimeType);
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [page, setPage] = useState(1);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef(0);
  const loadingTaskRef = useRef<PdfLoadingTask | null>(null);
  const pdfRef = useRef<PdfDocument | null>(null);
  const renderTaskRef = useRef<PdfRenderTask | null>(null);
  const viewEndpoint = `/api/materials/${encodeURIComponent(productId)}/view`;
  const pdfMaterial = resolvedMimeType === "application/pdf";
  const videoMaterial = typeof resolvedMimeType === "string" && isVideo(resolvedMimeType);

  function cancelRenderTask(): void {
    const renderTask = renderTaskRef.current;
    renderTaskRef.current = null;
    renderTask?.cancel();
  }

  function destroyLoadingTask(): void {
    const loadingTask = loadingTaskRef.current;
    loadingTaskRef.current = null;
    if (loadingTask) void loadingTask.destroy();
  }

  function destroyPdf(): void {
    const currentPdf = pdfRef.current;
    pdfRef.current = null;
    if (currentPdf) void currentPdf.destroy();
  }

  useEffect(() => () => {
    requestRef.current += 1;
    cancelRenderTask();
    destroyLoadingTask();
    destroyPdf();
  }, []);

  useEffect(() => {
    if (autoOpen) void openViewer();
  }, [autoOpen]);

  useEffect(() => {
    if (!open || !pdf || !canvasRef.current) return;
    const requestId = requestRef.current;
    let cancelled = false;
    let renderTask: PdfRenderTask | null = null;
    setRendering(true);
    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled || requestId !== requestRef.current || !canvasRef.current) return;
        const viewport = pdfPage.getViewport({ scale: 1.35 });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) throw new Error();
        renderTask = pdfPage.render({ canvasContext, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch {
        if (!cancelled && requestId === requestRef.current) setError(VIEW_ERROR);
      } finally {
        if (renderTaskRef.current === renderTask) renderTaskRef.current = null;
        if (!cancelled && requestId === requestRef.current) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
        renderTask?.cancel();
      }
    };
  }, [open, page, pdf]);

  async function openViewer(): Promise<void> {
    let currentMimeType = mimeType;
    requestRef.current += 1;
    const requestId = requestRef.current;
    cancelRenderTask();
    destroyLoadingTask();
    destroyPdf();
    setPdf(null);
    setOpen(true);
    setLoading(true);
    setError(null);
    setPage(1);
    try {
      if (!currentMimeType) {
        const metadataResponse = await fetch(`${viewEndpoint}?metadata=1`, { method: "GET", cache: "no-store" });
        const metadata: unknown = await metadataResponse.json().catch(() => null);
        const candidate = metadata && typeof metadata === "object" ? (metadata as { mimeType?: unknown }).mimeType : null;
        if (!metadataResponse.ok || typeof candidate !== "string" || (candidate !== "application/pdf" && !isVideo(candidate))) throw new Error();
        currentMimeType = candidate;
        setResolvedMimeType(candidate);
      }
    } catch {
      if (requestId === requestRef.current) {
        setLoading(false);
        setError(VIEW_ERROR);
      }
      return;
    }
    if (currentMimeType === "application/pdf") {
      try {
        const response = await fetch(viewEndpoint, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error();
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const loadingTask = getDocument({ data: new Uint8Array(await response.arrayBuffer()) } as any) as unknown as PdfLoadingTask;
        loadingTaskRef.current = loadingTask;
        const loaded = await loadingTask.promise;
        if (requestId !== requestRef.current) {
          await loadingTask.destroy();
          await loaded.destroy();
          return;
        }
        pdfRef.current = loaded;
        setPdf(loaded);
      } catch {
        if (requestId === requestRef.current) setError(VIEW_ERROR);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    } else {
      if (currentMimeType && isVideo(currentMimeType)) setLoading(false);
      else setError(VIEW_ERROR);
    }
  }

  function closeViewer(): void {
    requestRef.current += 1;
    cancelRenderTask();
    destroyLoadingTask();
    destroyPdf();
    setPdf(null);
    setResolvedMimeType(mimeType);
    setOpen(false);
    setLoading(false);
    setError(null);
  }

  async function downloadMaterial(): Promise<void> {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(productId)}/download`, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (blob.size === 0) throw new Error();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `material-${productId}`;
      anchor.rel = "noopener";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      setError("Không thể tải tài liệu. Vui lòng thử lại sau.");
    } finally {
      setDownloading(false);
    }
  }

  if (mimeType !== null && !pdfMaterial && !videoMaterial) return null;

  return <div className="flex flex-wrap gap-2">
    <button type="button" onClick={() => void openViewer()} disabled={loading} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#132a67] px-4 text-xs font-bold text-white disabled:opacity-60">
      <Eye className="h-3.5 w-3.5" />{loading ? "Đang mở..." : "Mở tài liệu"}
    </button>
    {open ? <section role="dialog" aria-modal="true" aria-labelledby={`student-material-viewer-title-${productId}`} className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-ink/70 p-3 sm:p-6">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/10 px-4 py-3 sm:px-6">
          <h2 id={`student-material-viewer-title-${productId}`} className="text-base font-black text-ink sm:text-lg">Xem {pdfMaterial ? "tài liệu PDF" : "video"}</h2>
          <div className="flex items-center gap-2">
            {allowDownload ? <button type="button" onClick={() => void downloadMaterial()} disabled={downloading} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"><Download className="h-4 w-4" />{downloading ? "Đang tải..." : "Tải xuống"}</button> : null}
            <button type="button" onClick={closeViewer} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-full border border-ink/20 px-4 py-2 text-sm font-extrabold text-ink transition hover:bg-ink/5"><X className="h-4 w-4" />Đóng</button>
          </div>
        </header>
        <div className="flex min-h-[16rem] flex-1 items-center justify-center overflow-auto bg-ink/5 p-2 sm:min-h-[24rem] sm:p-4">
          {loading ? <p role="status" className="text-sm font-semibold text-ink/65">Đang tải nội dung...</p> : pdfMaterial ? <div className="flex max-h-[calc(100vh-11rem)] flex-col items-center gap-3 overflow-auto"><canvas ref={canvasRef} aria-label="Trang PDF đang xem" className="max-w-full bg-white shadow-sm" />{pdf ? <nav aria-label="Điều hướng trang PDF" className="flex items-center gap-3 text-xs font-bold text-ink/65"><button type="button" disabled={page <= 1 || rendering} onClick={() => setPage((current) => current - 1)} className="rounded-full border border-ink/20 px-3 py-2 disabled:opacity-40">Trang trước</button><span>Trang {page}/{pdf.numPages}</span><button type="button" disabled={page >= pdf.numPages || rendering} onClick={() => setPage((current) => current + 1)} className="rounded-full border border-ink/20 px-3 py-2 disabled:opacity-40">Trang sau</button></nav> : null}</div> : <video controls preload="metadata" className="max-h-[calc(100vh-8rem)] w-full rounded-lg bg-black" src={viewEndpoint}>Trình duyệt không hỗ trợ phát video.</video>}
        </div>
        {error ? <p role="alert" className="shrink-0 px-4 pb-3 text-sm font-semibold text-rose-700 sm:px-6">{error}</p> : null}
      </div>
    </section> : null}
  </div>;
}
