"use client";

import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { MAX_PDF_BYTES, MAX_VIDEO_BYTES, MATERIALS_BUCKET, SUPPORTED_MATERIAL_MIME_TYPES } from "@/lib/storage/material-upload-constants";
import { getOrCreateMaterialUploadAttempt, type MaterialUploadAttempt } from "./material-upload-attempt";

type UploadState = "idle" | "preparing" | "uploading" | "finalizing" | "success" | "error";
type PrepareResponse = { reservationId?: string; version?: number; status?: "reserved" | "committed"; upload?: { bucket?: string; path?: string; token?: string } };

const accepted = new Set<string>(SUPPORTED_MATERIAL_MIME_TYPES);

function fileError(file: File): string | null {
  if (!accepted.has(file.type)) return "Chỉ hỗ trợ PDF, MP4, WebM hoặc QuickTime.";
  const limit = file.type === "application/pdf" ? MAX_PDF_BYTES : MAX_VIDEO_BYTES;
  if (file.size <= 0 || file.size > limit) return file.type === "application/pdf" ? "PDF phải nhỏ hơn hoặc bằng 20 MiB." : "Video phải nhỏ hơn hoặc bằng 500 MiB.";
  return null;
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("upload-failed");
  return body as Record<string, unknown>;
}

export default function MaterialUploadForm({ productId }: { productId: string }) {
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef<MaterialUploadAttempt | null>(null);
  const active = state === "preparing" || state === "uploading" || state === "finalizing";

  async function cancel(reservationId: string): Promise<void> {
    await fetch(`/api/admin/materials/${productId}/upload/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId }) }).catch(() => undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (active) return;
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState("error");
      setMessage("Vui lòng chọn tệp trước khi tải lên.");
      return;
    }
    const validationError = fileError(file);
    if (validationError) {
      setState("error");
      setMessage(validationError);
      return;
    }

    const attempt = getOrCreateMaterialUploadAttempt(attemptRef.current, { productId, originalName: file.name, mimeType: file.type, byteSize: file.size });
    attemptRef.current = attempt;
    let reservationId = "";
    let cancelRequired = false;
    try {
      setState("preparing");
      setMessage("Đang chuẩn bị tải lên…");
      const prepareResponse = await fetch(`/api/admin/materials/${productId}/upload/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: file.name, mimeType: file.type, byteSize: file.size, idempotencyKey: attempt.idempotencyKey })
      });
      const prepared = await jsonResponse(prepareResponse) as PrepareResponse;
      reservationId = typeof prepared.reservationId === "string" ? prepared.reservationId : "";
      if (prepared.status === "committed") {
        setState("success");
        setMessage("Tải tệp tài liệu thành công.");
        attemptRef.current = null;
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      if (reservationId) cancelRequired = true;
      const upload = prepared.upload;
      if (prepared.status !== "reserved" || !reservationId || !upload || upload.bucket !== MATERIALS_BUCKET || typeof upload.path !== "string" || typeof upload.token !== "string") throw new Error("upload-failed");

      setState("uploading");
      setMessage("Đang tải tệp trực tiếp lên bộ nhớ…");
      const supabase = createClient();
      const { error } = await supabase.storage.from(MATERIALS_BUCKET).uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, upsert: false });
      if (error) {
        cancelRequired = false;
        await cancel(reservationId);
        attemptRef.current = null;
        throw new Error("upload-failed");
      }
      cancelRequired = false;

      setState("finalizing");
      setMessage("Đang xác nhận phiên bản tệp…");
      const finalizeResponse = await fetch(`/api/admin/materials/${productId}/upload/finalize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: attempt.idempotencyKey }) });
      await jsonResponse(finalizeResponse);
      setState("success");
      setMessage("Tải tệp tài liệu thành công.");
      attemptRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setState("error");
      setMessage("Không thể tải tệp tài liệu. Vui lòng thử lại.");
      if (reservationId && cancelRequired) await cancel(reservationId);
    }
  }

  return <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3" aria-describedby={`${productId}-material-upload-status`}>
    <label className="block text-sm font-bold text-ink/65"><span>Tệp PDF hoặc video</span><input ref={inputRef} onChange={() => { attemptRef.current = null; }} name="file" type="file" required accept="application/pdf,video/mp4,video/webm,video/quicktime" disabled={active} className="mt-1 block max-w-full text-sm" /></label>
    <button type="submit" disabled={active} className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#1258ce] disabled:cursor-not-allowed disabled:opacity-50">{active ? "Đang tải…" : "Tải phiên bản mới"}</button>
    <p id={`${productId}-material-upload-status`} role={state === "error" ? "alert" : "status"} aria-live="polite" className="basis-full text-sm text-ink/65">{message}</p>
  </form>;
}
