"use client";

import { CatalogErrorState } from "@/components/catalog/catalog-error-state";

export default function MaterialsError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <CatalogErrorState context="materials" reset={reset} />;
}
