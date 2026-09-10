"use client";

import { useState } from "react";

const VIEW_ERROR = "Không thể mở tài liệu. Vui lòng thử lại sau.";

export function hasCurrentMaterialAsset(version: unknown): version is number {
  return typeof version === "number" && Number.isSafeInteger(version) && version > 0;
}

export async function openMaterialDocument(productId: string): Promise<void> {
  const target = window.open("about:blank", "_blank", "noopener,noreferrer");
  if (!target) throw new Error("Trình duyệt đã chặn tab mới.");

  try {
    const response = await fetch(`/api/materials/${encodeURIComponent(productId)}/signed-url`, {
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => null) as { url?: unknown } | null;
    if (!response.ok || typeof payload?.url !== "string" || payload.url.length === 0) throw new Error(VIEW_ERROR);
    target.location.href = payload.url;
  } catch {
    target.close();
    throw new Error(VIEW_ERROR);
  }
}

export default function MaterialViewButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await openMaterialDocument(productId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : VIEW_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return <div className="mt-3 space-y-2">
    <button type="button" onClick={handleClick} disabled={loading} className="inline-flex min-h-11 items-center justify-center rounded-full border border-accent px-5 py-2 text-sm font-extrabold text-accent transition hover:bg-accent/10 disabled:cursor-wait disabled:opacity-60">
      {loading ? "Đang mở tài liệu…" : "Xem tài liệu"}
    </button>
    {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
  </div>;
}
