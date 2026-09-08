"use client";

import { CatalogErrorState } from "@/components/catalog/catalog-error-state";

export default function TutorDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CatalogErrorState context="tutor-detail" reset={reset} />;
}
