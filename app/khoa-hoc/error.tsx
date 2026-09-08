"use client";

import { CatalogErrorState } from "@/components/catalog/catalog-error-state";

export default function CoursesError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <CatalogErrorState context="courses" reset={reset} />;
}
