import type { CurrentMaterialAssetVersion } from "@/lib/repositories/material-asset-repository";

export function formatMaterialAssetByteSize(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount)} ${units[unitIndex]}`;
}

export function isUsableMaterialAssetVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

export function materialAssetMetadataMessage(asset: CurrentMaterialAssetVersion): string | null {
  if (asset.status === "unsupported_mime") return asset.metadataComplete
    ? "Định dạng tệp hiện tại chưa được hỗ trợ để xem."
    : "Định dạng tệp hiện tại chưa được hỗ trợ và metadata còn thiếu hoặc không hợp lệ.";
  if (asset.status === "incomplete_metadata") return "Metadata của tệp hiện tại không đầy đủ hoặc không hợp lệ.";
  return null;
}
