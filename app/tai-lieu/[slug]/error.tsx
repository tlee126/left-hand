"use client";

import { CatalogErrorState } from "@/components/catalog/catalog-error-state";

export default function MaterialDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CatalogErrorState context="material-detail" reset={reset} />;
}
